"""Final assessment API: coding problems after completing learning phase, gates level progression."""
import logging
import random
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.final_assessment import generate_final_problem
from app.services.code_executor import run_against_test_cases
from app.services.progression import (
    check_learning_complete,
    ensure_progression,
    promote_user,
)
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/final-assessment", tags=["final-assessment"])

PASS_THRESHOLD = 70


class RunRequest(BaseModel):
    code: str
    language: str = "python"


async def _generate_final_bg(assessment_id: int, chosen_topics: list[dict], difficulties: list[str]):
    """Background task: generate problems for each chosen topic at specified difficulty."""
    db = get_supabase_admin()

    for i, (entry, difficulty) in enumerate(zip(chosen_topics, difficulties)):
        topic_name = entry["name"]
        topic_desc = entry.get("description", "")

        try:
            problem = await generate_final_problem(topic_name, topic_desc, difficulty)
        except Exception as e:
            logger.error("Failed to generate final problem for %s (%s): %s", topic_name, difficulty, e)
            continue

        db.table("final_assessment_problems").insert({
            "assessment_id": assessment_id,
            "topic_id": entry["id"],
            "title": problem["title"],
            "description": problem["description"],
            "difficulty": difficulty,
            "starter_code": problem["starter_code"],
            "test_cases": problem["test_cases"],
            "total_count": len(problem["test_cases"]),
            "display_order": i + 1,
        }).execute()

    generated = (
        db.table("final_assessment_problems")
        .select("id")
        .eq("assessment_id", assessment_id)
        .execute()
    )
    db.table("final_assessments").update({
        "status": "in_progress",
        "total_problems": len(generated.data),
    }).eq("id", assessment_id).execute()

    logger.info("Final assessment %d ready: %d problems", assessment_id, len(generated.data))


@router.get("/eligibility")
async def check_eligibility(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Check if user is eligible to take the final assessment."""
    prog = ensure_progression(user["id"])
    current_phase = prog["current_phase"]

    if current_phase == "COMPLETE":
        return {"eligible": False, "reason": "All phases completed", "current_phase": "COMPLETE"}

    learning_check = check_learning_complete(user["id"])
    if not learning_check["complete"]:
        return {
            "eligible": False,
            "reason": f"Complete all learning topics first ({learning_check['completed']}/{learning_check['total']} done)",
            "current_phase": current_phase,
            **learning_check,
        }

    return {"eligible": True, "current_phase": current_phase}


@router.post("/start")
async def start_final_assessment(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()
    user_id = user["id"]

    prog = ensure_progression(user_id)
    current_phase = prog["current_phase"]

    if current_phase == "COMPLETE":
        raise HTTPException(status_code=400, detail="All phases completed")

    existing = (
        db.table("final_assessments")
        .select("id, status")
        .eq("user_id", user_id)
        .eq("phase", current_phase)
        .in_("status", ["generating", "in_progress"])
        .limit(1)
        .execute()
    )
    if existing.data:
        a = existing.data[0]
        return {"assessment_id": a["id"], "status": a["status"], "phase": current_phase}

    learning_check = check_learning_complete(user_id)
    if not learning_check["complete"]:
        raise HTTPException(
            status_code=400,
            detail=f"Complete all learning topics first ({learning_check['completed']}/{learning_check['total']} done)",
        )

    completed_progress = (
        db.table("learning_progress")
        .select("topic_id, dsa_topics(id, name, description)")
        .eq("user_id", user_id)
        .eq("learning_phase", current_phase)
        .eq("learning_status", "completed")
        .execute()
    )

    if not completed_progress.data or len(completed_progress.data) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 completed topics for final assessment")

    topic_pool = [p["dsa_topics"] for p in completed_progress.data if p.get("dsa_topics")]
    chosen = random.sample(topic_pool, min(2, len(topic_pool)))

    hard_or_medium = random.choice(["Medium", "Hard"])
    difficulties = ["Easy", hard_or_medium]
    random.shuffle(difficulties)

    assessment = (
        db.table("final_assessments")
        .insert({
            "user_id": user_id,
            "phase": current_phase,
            "status": "generating",
            "total_problems": 2,
        })
        .execute()
    )
    assessment_id = assessment.data[0]["id"]

    background_tasks.add_task(_generate_final_bg, assessment_id, chosen, difficulties)

    return {
        "assessment_id": assessment_id,
        "status": "generating",
        "phase": current_phase,
        "expected_problems": 2,
        "topics": [t["name"] for t in chosen],
        "difficulties": difficulties,
    }


@router.get("/current")
async def get_current(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    prog = ensure_progression(user["id"])
    current_phase = prog["current_phase"]

    query = db.table("final_assessments").select("*").eq("user_id", user["id"])
    if current_phase == "COMPLETE":
        query = query.eq("status", "completed").order("completed_at", desc=True)
    else:
        query = query.eq("phase", current_phase).in_("status", ["generating", "in_progress", "completed"]).order("started_at", desc=True)
    assessment = query.limit(1).execute()

    if not assessment.data:
        return {"exists": False, "phase": current_phase}

    a = assessment.data[0]

    if a["status"] == "generating":
        generated = (
            db.table("final_assessment_problems")
            .select("id")
            .eq("assessment_id", a["id"])
            .execute()
        )
        return {
            "exists": True,
            "assessment": {
                "id": a["id"],
                "status": "generating",
                "phase": a["phase"],
                "total_problems": a["total_problems"],
                "problems_generated": len(generated.data),
            },
            "problems": [],
        }

    problems = (
        db.table("final_assessment_problems")
        .select("id, topic_id, title, description, difficulty, starter_code, test_cases, user_code, passed_count, total_count, submission_status, display_order, dsa_topics(name)")
        .eq("assessment_id", a["id"])
        .order("display_order")
        .execute()
    )

    safe_problems = []
    for p in problems.data:
        visible_tests = [tc for tc in p["test_cases"] if tc.get("visible", False)]
        sp = {
            "id": p["id"],
            "topic_id": p["topic_id"],
            "topic_name": p["dsa_topics"]["name"] if p.get("dsa_topics") else "",
            "title": p["title"],
            "description": p["description"],
            "difficulty": p["difficulty"],
            "starter_code": p["starter_code"],
            "visible_test_cases": visible_tests,
            "user_code": p["user_code"],
            "passed_count": p["passed_count"],
            "total_count": p["total_count"],
            "submission_status": p["submission_status"],
            "display_order": p["display_order"],
        }
        if p["submission_status"] in ("passed", "failed"):
            sp["all_test_cases"] = p["test_cases"]
        safe_problems.append(sp)

    return {
        "exists": True,
        "assessment": {
            "id": a["id"],
            "status": a["status"],
            "phase": a["phase"],
            "total_problems": a["total_problems"],
            "score_percent": float(a["score_percent"]) if a["score_percent"] else 0,
            "passed": a["passed"],
            "started_at": a["started_at"],
            "completed_at": a["completed_at"],
        },
        "problems": safe_problems,
    }


@router.post("/run/{problem_id}")
async def run_code(
    problem_id: int,
    request: RunRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()

    problem = (
        db.table("final_assessment_problems")
        .select("*, final_assessments!inner(user_id)")
        .eq("id", problem_id)
        .limit(1)
        .execute()
    )

    if not problem.data:
        raise HTTPException(status_code=404, detail="Problem not found")

    p = problem.data[0]
    if p["final_assessments"]["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your problem")

    visible_tests = [tc for tc in p["test_cases"] if tc.get("visible", False)]
    if not visible_tests:
        raise HTTPException(status_code=400, detail="No visible test cases")

    results = await run_against_test_cases(request.code, request.language, visible_tests)

    return {
        "results": results,
        "passed": sum(1 for r in results if r["passed"]),
        "total": len(results),
    }


@router.post("/submit/{problem_id}")
async def submit_code(
    problem_id: int,
    request: RunRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()

    problem = (
        db.table("final_assessment_problems")
        .select("*, final_assessments!inner(user_id, id, status, phase, total_problems)")
        .eq("id", problem_id)
        .limit(1)
        .execute()
    )

    if not problem.data:
        raise HTTPException(status_code=404, detail="Problem not found")

    p = problem.data[0]
    fa = p["final_assessments"]

    if fa["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your problem")
    if fa["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Assessment not in progress")
    if p["submission_status"] in ("passed", "failed"):
        raise HTTPException(status_code=400, detail="Problem already submitted")

    results = await run_against_test_cases(request.code, request.language, p["test_cases"])

    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    status = "passed" if passed_count == total_count else "failed"

    db.table("final_assessment_problems").update({
        "user_code": request.code,
        "passed_count": passed_count,
        "total_count": total_count,
        "submission_status": status,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", problem_id).execute()

    all_problems = (
        db.table("final_assessment_problems")
        .select("submission_status, passed_count, total_count")
        .eq("assessment_id", fa["id"])
        .execute()
    )

    all_submitted = all(
        pp["submission_status"] in ("passed", "failed")
        for pp in all_problems.data
    )

    assessment_complete = False
    promotion_result = None

    if all_submitted:
        total_tests_passed = sum(pp["passed_count"] or 0 for pp in all_problems.data)
        total_tests = sum(pp["total_count"] or 0 for pp in all_problems.data)
        score = round((total_tests_passed / total_tests) * 100, 2) if total_tests > 0 else 0
        did_pass = score >= PASS_THRESHOLD

        db.table("final_assessments").update({
            "status": "completed",
            "total_tests_passed": total_tests_passed,
            "total_tests": total_tests,
            "score_percent": score,
            "passed": did_pass,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", fa["id"]).execute()

        assessment_complete = True

        if did_pass:
            promotion_result = promote_user(user["id"])

    return {
        "results": results,
        "passed_count": passed_count,
        "total_count": total_count,
        "submission_status": status,
        "assessment_complete": assessment_complete,
        "promotion": promotion_result,
    }


@router.get("/results")
async def get_results(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()

    prog = ensure_progression(user["id"])

    assessment = (
        db.table("final_assessments")
        .select("*")
        .eq("user_id", user["id"])
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )

    if not assessment.data:
        raise HTTPException(status_code=404, detail="No completed final assessment found")

    a = assessment.data[0]

    problems = (
        db.table("final_assessment_problems")
        .select("id, topic_id, title, difficulty, passed_count, total_count, submission_status, dsa_topics(name)")
        .eq("assessment_id", a["id"])
        .order("display_order")
        .execute()
    )

    return {
        "assessment": {
            "id": a["id"],
            "phase": a["phase"],
            "total_problems": a["total_problems"],
            "total_tests_passed": a["total_tests_passed"],
            "total_tests": a["total_tests"],
            "score_percent": float(a["score_percent"]),
            "passed": a["passed"],
            "started_at": a["started_at"],
            "completed_at": a["completed_at"],
        },
        "problems": [
            {
                "id": p["id"],
                "title": p["title"],
                "difficulty": p["difficulty"],
                "topic_name": p["dsa_topics"]["name"] if p.get("dsa_topics") else "",
                "passed_count": p["passed_count"],
                "total_count": p["total_count"],
                "submission_status": p["submission_status"],
            }
            for p in problems.data
        ],
        "progression": {
            "current_phase": prog["current_phase"],
            "phases_completed": prog.get("phases_completed", []),
        },
    }


@router.delete("/reset")
async def reset_assessment(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Delete the current phase's final assessment to allow retake."""
    db = get_supabase_admin()
    prog = ensure_progression(user["id"])
    current_phase = prog["current_phase"]

    if current_phase == "COMPLETE":
        raise HTTPException(status_code=400, detail="All phases completed, nothing to reset")

    result = (
        db.table("final_assessments")
        .delete()
        .eq("user_id", user["id"])
        .eq("phase", current_phase)
        .execute()
    )

    deleted_count = len(result.data) if result.data else 0
    return {"deleted": deleted_count, "phase": current_phase}
