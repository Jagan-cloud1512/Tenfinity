import logging
import random
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.coding_problems import generate_coding_problem
from app.services.code_executor import run_against_test_cases
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coding")


class RunRequest(BaseModel):
    code: str
    language: str = "python"


async def _generate_coding_bg(assessment_id: str, chosen_topics: list[dict]):
    db = get_supabase_admin()
    display_order = 1

    for entry in chosen_topics:
        topic = entry["dsa_topics"]
        topic_name = topic["name"]
        topic_desc = topic.get("description", "")

        try:
            problem = await generate_coding_problem(topic_name, topic_desc)
        except Exception as e:
            logger.error("Failed to generate coding problem for %s: %s", topic_name, e)
            continue

        db.table("coding_problems").insert({
            "assessment_id": assessment_id,
            "topic_id": topic["id"],
            "title": problem["title"],
            "description": problem["description"],
            "starter_code": problem["starter_code"],
            "test_cases": problem["test_cases"],
            "total_count": len(problem["test_cases"]),
            "display_order": display_order,
        }).execute()
        display_order += 1

    generated = db.table("coding_problems").select("id").eq("assessment_id", assessment_id).execute()
    db.table("coding_assessments").update({
        "status": "in_progress",
        "total_problems": len(generated.data),
    }).eq("id", assessment_id).execute()

    logger.info("Coding assessment %s complete: %d problems", assessment_id, len(generated.data))


@router.post("/start")
async def start_coding_assessment(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()

    existing = (
        db.table("coding_assessments")
        .select("id, status")
        .eq("user_id", user["id"])
        .in_("status", ["generating", "in_progress"])
        .limit(1)
        .execute()
    )
    if existing.data:
        a = existing.data[0]
        if a["status"] == "generating":
            return {"assessment_id": a["id"], "status": "generating"}
        return {"assessment_id": a["id"], "status": a["status"], "message": "Coding assessment already exists"}

    known_topics = (
        db.table("user_topics")
        .select("topic_id, dsa_topics(id, name, description)")
        .eq("user_id", user["id"])
        .eq("self_reported_status", "known")
        .execute()
    )

    if not known_topics.data:
        raise HTTPException(status_code=400, detail="No known topics found.")

    chosen = random.sample(known_topics.data, min(2, len(known_topics.data)))

    assessment = (
        db.table("coding_assessments")
        .insert({
            "user_id": user["id"],
            "status": "generating",
            "total_problems": 2,
        })
        .execute()
    )
    assessment_id = assessment.data[0]["id"]

    background_tasks.add_task(_generate_coding_bg, assessment_id, chosen)

    return {
        "assessment_id": assessment_id,
        "status": "generating",
        "expected_problems": len(chosen),
    }


@router.get("/current")
async def get_current_coding(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()

    assessment = (
        db.table("coding_assessments")
        .select("*")
        .eq("user_id", user["id"])
        .in_("status", ["generating", "in_progress", "completed"])
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )

    if not assessment.data:
        return {"exists": False}

    a = assessment.data[0]

    if a["status"] == "generating":
        generated = (
            db.table("coding_problems")
            .select("id")
            .eq("assessment_id", a["id"])
            .execute()
        )
        return {
            "exists": True,
            "assessment": {
                "id": a["id"],
                "status": "generating",
                "total_problems": a["total_problems"],
                "problems_generated": len(generated.data),
            },
            "problems": [],
        }

    problems = (
        db.table("coding_problems")
        .select("id, topic_id, title, description, starter_code, test_cases, user_code, passed_count, total_count, submission_status, display_order, dsa_topics(name)")
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
            "total_problems": a["total_problems"],
            "passed_problems": a["passed_problems"],
            "score_percent": float(a["score_percent"]) if a["score_percent"] else 0,
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
        db.table("coding_problems")
        .select("*, coding_assessments!inner(user_id)")
        .eq("id", problem_id)
        .limit(1)
        .execute()
    )

    if not problem.data:
        raise HTTPException(status_code=404, detail="Problem not found")

    p = problem.data[0]
    if p["coding_assessments"]["user_id"] != user["id"]:
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
        db.table("coding_problems")
        .select("*, coding_assessments!inner(user_id, id, status, total_problems)")
        .eq("id", problem_id)
        .limit(1)
        .execute()
    )

    if not problem.data:
        raise HTTPException(status_code=404, detail="Problem not found")

    p = problem.data[0]
    ca = p["coding_assessments"]

    if ca["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your problem")

    if ca["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Assessment not in progress")

    if p["submission_status"] in ("passed", "failed"):
        raise HTTPException(status_code=400, detail="Problem already submitted")

    results = await run_against_test_cases(request.code, request.language, p["test_cases"])

    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    status = "passed" if passed_count == total_count else "failed"

    db.table("coding_problems").update({
        "user_code": request.code,
        "passed_count": passed_count,
        "total_count": total_count,
        "submission_status": status,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", problem_id).execute()

    all_problems = (
        db.table("coding_problems")
        .select("submission_status, passed_count, total_count")
        .eq("assessment_id", ca["id"])
        .execute()
    )

    all_submitted = all(
        pp["submission_status"] in ("passed", "failed")
        for pp in all_problems.data
    )

    assessment_complete = False
    if all_submitted:
        total_passed = sum(1 for pp in all_problems.data if pp["submission_status"] == "passed")
        total_probs = ca["total_problems"]
        score = round((total_passed / total_probs) * 100, 2) if total_probs > 0 else 0
        db.table("coding_assessments").update({
            "status": "completed",
            "passed_problems": total_passed,
            "score_percent": score,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", ca["id"]).execute()
        assessment_complete = True

    return {
        "results": results,
        "passed_count": passed_count,
        "total_count": total_count,
        "submission_status": status,
        "assessment_complete": assessment_complete,
    }


@router.get("/results")
async def get_coding_results(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()

    assessment = (
        db.table("coding_assessments")
        .select("*")
        .eq("user_id", user["id"])
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )

    if not assessment.data:
        raise HTTPException(status_code=404, detail="No completed coding assessment found")

    a = assessment.data[0]

    problems = (
        db.table("coding_problems")
        .select("id, topic_id, title, passed_count, total_count, submission_status, dsa_topics(name)")
        .eq("assessment_id", a["id"])
        .order("display_order")
        .execute()
    )

    return {
        "assessment": {
            "id": a["id"],
            "total_problems": a["total_problems"],
            "passed_problems": a["passed_problems"],
            "score_percent": float(a["score_percent"]),
            "started_at": a["started_at"],
            "completed_at": a["completed_at"],
        },
        "problems": [
            {
                "id": p["id"],
                "title": p["title"],
                "topic_name": p["dsa_topics"]["name"] if p.get("dsa_topics") else "",
                "passed_count": p["passed_count"],
                "total_count": p["total_count"],
                "submission_status": p["submission_status"],
            }
            for p in problems.data
        ],
    }
