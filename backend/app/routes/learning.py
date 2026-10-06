"""Learning API routes: classification, progress, problem suggestions, materials — phase-aware."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.classification import (
    classify_user,
    get_feedback_message,
    get_topic_strengths,
)
from app.services.learning import (
    generate_learning_material,
    get_topic_suggestions,
    get_user_learning_state,
    mark_problem_completed,
    suggest_problems,
    DIFFICULTY_BY_LEVEL,
    DIFFICULTY_BY_LEVEL_FRESH_C,
)
from app.services.progression import (
    ensure_progression,
    check_learning_complete,
    get_phase_number,
    get_topics_for_phase,
)
from app.services.supabase_client import get_supabase_admin

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _get_user_phase(user_id: str) -> tuple[str, str, dict]:
    """Get current phase, level, and progression for a user."""
    prog = ensure_progression(user_id)
    current_phase = prog["current_phase"]
    initial_level = prog.get("initial_level", current_phase)
    return current_phase, initial_level, prog


@router.get("/classify")
async def get_classification(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    result = classify_user(user["id"])
    result["feedback"] = get_feedback_message(result["level"], result["overall_score_percent"])
    prog = ensure_progression(user["id"])
    result["current_phase"] = prog["current_phase"]
    result["phases_completed"] = prog.get("phases_completed", [])
    return result


@router.get("/strengths")
async def get_strengths(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    strengths = get_topic_strengths(user["id"])
    return {"topics": strengths}


@router.get("/state")
async def get_learning_state(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    current_phase, _, prog = _get_user_phase(user["id"])
    state = get_user_learning_state(user["id"], learning_phase=current_phase)
    if not state["classification"]:
        result = classify_user(user["id"])
        state["classification"] = result
    state["current_phase"] = current_phase
    state["phases_completed"] = prog.get("phases_completed", [])
    return state


@router.get("/topics")
async def get_learning_topics(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    user_id = user["id"]

    current_phase, initial_level, prog = _get_user_phase(user_id)

    if current_phase == "COMPLETE":
        return {"level": "C", "current_phase": "COMPLETE", "topics": [], "all_complete": True}

    level = current_phase

    user_topics = db.table("user_topics").select("topic_id, self_reported_status").eq("user_id", user_id).execute()
    all_topics = db.table("dsa_topics").select("id, name, slug, category").order("display_order").execute()
    progress = db.table("learning_progress").select("topic_id, learning_status, materials_viewed, problems_suggested, problems_completed").eq("user_id", user_id).eq("learning_phase", current_phase).execute()

    progress_map = {p["topic_id"]: p for p in progress.data}
    topic_status_map = {ut["topic_id"]: ut["self_reported_status"] for ut in user_topics.data}

    phase_config = get_topics_for_phase(user_id, current_phase, initial_level)
    is_fresh_c = phase_config["is_fresh_c"]

    all_topic_ids = [t["id"] for t in all_topics.data]
    required_topic_ids = [
        tid for tid in all_topic_ids
        if not (is_fresh_c and topic_status_map.get(tid, "unknown") == "known")
    ]
    completed_count = sum(1 for tid in required_topic_ids if progress_map.get(tid, {}).get("learning_status") == "completed")
    total_required = len(required_topic_ids)
    learning_complete = completed_count >= total_required

    topics = []
    for t in all_topics.data:
        status = topic_status_map.get(t["id"], "unknown")
        prog_data = progress_map.get(t["id"], {})
        topics.append({
            "topic_id": t["id"],
            "name": t["name"],
            "slug": t["slug"],
            "category": t["category"],
            "self_reported": status,
            "learning_status": prog_data.get("learning_status", "not_started"),
            "materials_viewed": prog_data.get("materials_viewed", False),
            "problems_suggested": prog_data.get("problems_suggested", 0),
            "problems_completed": prog_data.get("problems_completed", 0),
            "skip": is_fresh_c and status == "known",
        })

    topics_started = len(progress.data)
    in_progress_count = sum(1 for p in progress.data if p.get("learning_status") == "in_progress")
    total_suggested = sum(p.get("problems_suggested") or 0 for p in progress.data)
    total_problems_completed = sum(p.get("problems_completed") or 0 for p in progress.data)

    return {
        "level": level,
        "current_phase": current_phase,
        "initial_level": initial_level,
        "phases_completed": prog.get("phases_completed", []) or [],
        "topics": topics,
        "learning_complete": learning_complete,
        "learning_progress_summary": {
            "complete": learning_complete,
            "current_phase": current_phase,
            "total": total_required,
            "completed": completed_count,
            "remaining": total_required - completed_count,
        },
        "progress_summary": {
            "topics_started": topics_started,
            "topics_completed": completed_count,
            "topics_in_progress": in_progress_count,
            "problems_suggested": total_suggested,
            "problems_completed": total_problems_completed,
            "current_phase": current_phase,
            "phases_completed": prog.get("phases_completed", []) or [],
        },
    }


@router.get("/suggestions/{topic_id}")
async def get_suggestions(topic_id: int, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    current_phase, _, _ = _get_user_phase(user["id"])

    problems = get_topic_suggestions(user["id"], topic_id, learning_phase=current_phase)
    progress = (
        db.table("learning_progress")
        .select("material_content")
        .eq("user_id", user["id"])
        .eq("topic_id", topic_id)
        .eq("learning_phase", current_phase)
        .limit(1)
        .execute()
    )
    saved_material = progress.data[0]["material_content"] if progress.data else None
    return {"problems": problems, "saved_material": saved_material}


class SuggestRequest(BaseModel):
    topic_id: int


@router.post("/suggest")
async def suggest(request: SuggestRequest, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    user_id = user["id"]
    current_phase, initial_level, _ = _get_user_phase(user_id)

    level = current_phase

    user_topic = (
        db.table("user_topics")
        .select("self_reported_status")
        .eq("user_id", user_id)
        .eq("topic_id", request.topic_id)
        .limit(1)
        .execute()
    )
    topic_status = user_topic.data[0]["self_reported_status"] if user_topic.data else "unknown"

    is_fresh_c = initial_level == "C" and current_phase == "C"

    if is_fresh_c and topic_status == "known":
        return {"problems": [], "message": "No suggestions needed — you've mastered this topic!", "exhausted": False}

    new_problems, exhausted = suggest_problems(
        user_id, request.topic_id, level, topic_status,
        learning_phase=current_phase, is_fresh_c=is_fresh_c,
    )
    all_problems = get_topic_suggestions(user_id, request.topic_id, learning_phase=current_phase)
    return {"problems": all_problems, "new_count": len(new_problems), "exhausted": exhausted}


class CompleteRequest(BaseModel):
    problem_id: int


@router.post("/complete")
async def complete_problem(request: CompleteRequest, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    current_phase, _, _ = _get_user_phase(user["id"])
    result = mark_problem_completed(user["id"], request.problem_id, learning_phase=current_phase)
    if result is None:
        raise HTTPException(status_code=404, detail="Problem suggestion not found")
    return {"success": True, **result}


@router.get("/material/{topic_id}")
async def get_material(topic_id: int, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    user_id = user["id"]
    current_phase, _, _ = _get_user_phase(user_id)

    topic = db.table("dsa_topics").select("name").eq("id", topic_id).limit(1).execute()
    if not topic.data:
        raise HTTPException(status_code=404, detail="Topic not found")

    level = current_phase

    phase_number = get_phase_number(user_id)
    material = await generate_learning_material(topic.data[0]["name"], level, phase_number=phase_number)

    existing = (
        db.table("learning_progress")
        .select("learning_status")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .eq("learning_phase", current_phase)
        .limit(1)
        .execute()
    )
    is_completed = existing.data and existing.data[0]["learning_status"] == "completed"

    db.table("learning_progress").upsert({
        "user_id": user_id,
        "topic_id": topic_id,
        "learning_phase": current_phase,
        "topic_status": "unknown",
        "learning_status": "completed" if is_completed else "in_progress",
        "materials_viewed": True,
        "material_content": material,
    }, on_conflict="user_id,topic_id,learning_phase").execute()

    return {"topic": topic.data[0]["name"], "level": level, "content": material, "phase": current_phase}


@router.get("/progress")
async def get_progress_summary(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    user_id = user["id"]
    current_phase, _, prog = _get_user_phase(user_id)

    progress = (
        db.table("learning_progress")
        .select("learning_status, problems_suggested, problems_completed")
        .eq("user_id", user_id)
        .eq("learning_phase", current_phase)
        .execute()
    )

    total_topics = len(progress.data)
    completed = sum(1 for p in progress.data if p["learning_status"] == "completed")
    in_progress = sum(1 for p in progress.data if p["learning_status"] == "in_progress")
    total_suggested = sum(p["problems_suggested"] or 0 for p in progress.data)
    total_completed = sum(p["problems_completed"] or 0 for p in progress.data)

    return {
        "topics_started": total_topics,
        "topics_completed": completed,
        "topics_in_progress": in_progress,
        "problems_suggested": total_suggested,
        "problems_completed": total_completed,
        "current_phase": current_phase,
        "phases_completed": prog.get("phases_completed", []) or [],
    }
