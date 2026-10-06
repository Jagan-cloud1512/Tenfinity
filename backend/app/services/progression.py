"""Level progression: track current learning phase, promote between A→B→C→COMPLETE."""
import logging
from datetime import datetime, timezone

from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

PHASE_ORDER = ["A", "B", "C", "COMPLETE"]

NEXT_PHASE = {
    "A": "B",
    "B": "C",
    "C": "COMPLETE",
}


def get_progression(user_id: str) -> dict | None:
    db = get_supabase_admin()
    result = (
        db.table("level_progression")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def initialize_progression(user_id: str, initial_level: str) -> dict:
    """Create progression record after initial classification."""
    db = get_supabase_admin()
    data = {
        "user_id": user_id,
        "initial_level": initial_level,
        "current_phase": initial_level,
        "phases_completed": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.table("level_progression").upsert(data, on_conflict="user_id").execute()

    if initial_level != "A":
        existing = (
            db.table("learning_progress")
            .select("topic_id")
            .eq("user_id", user_id)
            .eq("learning_phase", initial_level)
            .execute()
        )
        existing_topics = {r["topic_id"] for r in existing.data}

        old_records = (
            db.table("learning_progress")
            .select("topic_id")
            .eq("user_id", user_id)
            .eq("learning_phase", "A")
            .execute()
        )
        for r in old_records.data:
            tid = r["topic_id"]
            if tid in existing_topics:
                db.table("learning_progress").delete().eq("user_id", user_id).eq("topic_id", tid).eq("learning_phase", "A").execute()
            else:
                db.table("learning_progress").update({"learning_phase": initial_level}).eq("user_id", user_id).eq("topic_id", tid).eq("learning_phase", "A").execute()
        logger.info("Migrated existing learning records from phase A to %s for user %s", initial_level, user_id)

    logger.info("Initialized progression for user %s at level %s", user_id, initial_level)
    return data


def ensure_progression(user_id: str) -> dict:
    """Get or create progression. Uses classification level if exists, else A."""
    prog = get_progression(user_id)
    if prog:
        return prog

    db = get_supabase_admin()
    classification = (
        db.table("skill_classifications")
        .select("level")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    level = classification.data[0]["level"] if classification.data else "A"
    return initialize_progression(user_id, level)


def check_learning_complete(user_id: str) -> dict:
    """Check if all required topics are completed for the current phase."""
    db = get_supabase_admin()
    prog = ensure_progression(user_id)
    current_phase = prog["current_phase"]

    if current_phase == "COMPLETE":
        return {"complete": True, "current_phase": "COMPLETE", "total": 0, "completed": 0}

    user_topics = (
        db.table("user_topics")
        .select("topic_id, self_reported_status")
        .eq("user_id", user_id)
        .execute()
    )
    topic_status_map = {ut["topic_id"]: ut["self_reported_status"] for ut in user_topics.data}

    all_topics = db.table("dsa_topics").select("id").execute()
    all_topic_ids = [t["id"] for t in all_topics.data]

    initial_level = prog.get("initial_level", current_phase)
    is_fresh_c = initial_level == "C" and current_phase == "C"

    required_topic_ids = []
    for tid in all_topic_ids:
        status = topic_status_map.get(tid, "unknown")
        if is_fresh_c and status == "known":
            continue
        required_topic_ids.append(tid)

    if not required_topic_ids:
        return {"complete": True, "current_phase": current_phase, "total": 0, "completed": 0}

    progress = (
        db.table("learning_progress")
        .select("topic_id, learning_status")
        .eq("user_id", user_id)
        .eq("learning_phase", current_phase)
        .in_("topic_id", required_topic_ids)
        .execute()
    )
    progress_map = {p["topic_id"]: p["learning_status"] for p in progress.data}

    completed_count = sum(1 for tid in required_topic_ids if progress_map.get(tid) == "completed")
    total_required = len(required_topic_ids)

    return {
        "complete": completed_count >= total_required,
        "current_phase": current_phase,
        "total": total_required,
        "completed": completed_count,
        "remaining": total_required - completed_count,
    }


def promote_user(user_id: str) -> dict:
    """Promote user to next phase after passing final assessment."""
    db = get_supabase_admin()
    prog = ensure_progression(user_id)
    current = prog["current_phase"]

    if current == "COMPLETE":
        return {"promoted": False, "reason": "Already completed all phases", "current_phase": "COMPLETE"}

    next_phase = NEXT_PHASE.get(current)
    if not next_phase:
        return {"promoted": False, "reason": f"No next phase from {current}", "current_phase": current}

    completed = list(prog.get("phases_completed", []) or [])
    if current not in completed:
        completed.append(current)

    now = datetime.now(timezone.utc).isoformat()
    db.table("level_progression").update({
        "current_phase": next_phase,
        "phases_completed": completed,
        "promoted_at": now,
        "updated_at": now,
    }).eq("user_id", user_id).execute()

    if next_phase != "COMPLETE":
        db.table("skill_classifications").update({
            "level": next_phase,
            "classified_at": now,
        }).eq("user_id", user_id).execute()

    logger.info("Promoted user %s: %s → %s", user_id, current, next_phase)

    return {
        "promoted": True,
        "previous_phase": current,
        "current_phase": next_phase,
        "phases_completed": completed,
    }


def get_topics_for_phase(user_id: str, current_phase: str, initial_level: str) -> dict:
    """Determine which topics to show and whether to skip known topics.

    Rules:
    - Classified at C (fresh C): skip known topics
    - Promoted to C (from A or B): learn ALL topics at C difficulty
    - Phase A or B: learn all topics per existing difficulty rules
    """
    is_fresh_c = initial_level == "C" and current_phase == "C"
    is_promoted_c = initial_level != "C" and current_phase == "C"

    return {
        "skip_known": is_fresh_c,
        "learn_all": is_promoted_c or current_phase in ("A", "B"),
        "is_fresh_c": is_fresh_c,
        "is_promoted_c": is_promoted_c,
    }


def get_phase_number(user_id: str) -> int:
    """Get how many phases completed (for content differentiation)."""
    prog = get_progression(user_id)
    if not prog:
        return 1
    completed = prog.get("phases_completed", []) or []
    return len(completed) + 1
