"""Learning service: problem suggestions, progress tracking, learning materials."""
import logging
import random
from datetime import datetime, timezone

from app.services.supabase_client import get_supabase_admin
from app.services.llm import get_provider_router

logger = logging.getLogger(__name__)

MAX_PROBLEMS_PER_TOPIC = 5

# DSA topic tag IDs (matches Tags table)
DSA_TOPIC_TAG_IDS = list(range(1, 19))

DIFFICULTY_BY_LEVEL = {
    "A": {
        "known": ["Easy"],
        "unknown": ["Easy"],
    },
    "B": {
        "known": ["Medium", "Hard"],
        "unknown": ["Easy", "Medium"],
    },
    "C": {
        "known": ["Medium", "Hard"],
        "unknown": ["Medium", "Hard"],
    },
}

DIFFICULTY_BY_LEVEL_FRESH_C = {
    "known": [],
    "unknown": ["Medium", "Hard"],
}


DIFFICULTY_FALLBACK = {
    "Easy": ["Medium"],
    "Medium": ["Easy", "Hard"],
    "Hard": ["Medium"],
}


def _get_fallback_difficulties(primary: list[str]) -> list[str]:
    """When no problems match primary difficulties, return nearby levels to try."""
    fallback = []
    for d in primary:
        for f in DIFFICULTY_FALLBACK.get(d, []):
            if f not in primary and f not in fallback:
                fallback.append(f)
    return fallback


def _get_tag_id_for_topic(db, topic_id: int) -> int | None:
    """Map dsa_topics.id to Tags.TagID based on display_order."""
    topic = db.table("dsa_topics").select("display_order").eq("id", topic_id).limit(1).execute()
    if topic.data:
        return topic.data[0]["display_order"]
    return None


def get_topic_suggestions(user_id: str, topic_id: int, learning_phase: str = None) -> list[dict]:
    """Get all existing problem suggestions for a user+topic, with problem details."""
    db = get_supabase_admin()

    query = (
        db.table("problem_suggestions")
        .select("problem_id, completed, completed_at, suggested_at")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
    )
    if learning_phase:
        query = query.eq("learning_phase", learning_phase)
    suggestions = query.order("suggested_at", desc=False).execute()
    if not suggestions.data:
        return []

    problem_ids = [s["problem_id"] for s in suggestions.data]
    completion_map = {s["problem_id"]: s["completed"] for s in suggestions.data}

    problems = []
    for i in range(0, len(problem_ids), 500):
        batch = (
            db.table("Problems_duplicate")
            .select("ProblemID, ProblemName, Difficulty_level, URL, AcceptanceRate")
            .in_("ProblemID", problem_ids[i:i + 500])
            .execute()
        )
        problems.extend(batch.data)

    problem_map = {p["ProblemID"]: p for p in problems}

    results = []
    for pid in problem_ids:
        p = problem_map.get(pid)
        if not p:
            continue
        results.append({
            "problem_id": pid,
            "name": p["ProblemName"],
            "difficulty": p["Difficulty_level"],
            "url": p["URL"],
            "acceptance_rate": p["AcceptanceRate"],
            "completed": completion_map.get(pid, False),
        })
    return results


def suggest_problems(
    user_id: str, topic_id: int, level: str, topic_status: str,
    learning_phase: str = None, is_fresh_c: bool = False,
) -> tuple[list[dict], bool]:
    """Suggest NEW level-appropriate problems for a topic, avoiding repeats.

    Returns (new_suggestions, exhausted) where exhausted=True if no more problems available.
    """
    db = get_supabase_admin()
    phase = learning_phase or level

    if is_fresh_c and topic_status == "known":
        return [], False

    if is_fresh_c:
        difficulties = DIFFICULTY_BY_LEVEL_FRESH_C.get(topic_status, ["Medium", "Hard"])
    else:
        difficulties = DIFFICULTY_BY_LEVEL.get(level, DIFFICULTY_BY_LEVEL["A"]).get(topic_status, ["Easy"])
    if not difficulties:
        return [], False

    tag_id = _get_tag_id_for_topic(db, topic_id)
    if tag_id is None:
        return [], True

    already_suggested = (
        db.table("problem_suggestions")
        .select("problem_id, learning_phase")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .execute()
    )
    same_phase = [s for s in already_suggested.data if s.get("learning_phase") == phase]
    existing_count = len(same_phase)
    exclude_ids = {s["problem_id"] for s in same_phase}

    tag_row = db.table("Tags").select("Problems").eq("TagID", tag_id).limit(1).execute()
    if not tag_row.data or not tag_row.data[0]["Problems"]:
        return [], True

    candidate_ids = [pid for pid in tag_row.data[0]["Problems"] if pid not in exclude_ids]
    if not candidate_ids:
        return [], True

    all_candidates = []
    for i in range(0, len(candidate_ids), 500):
        batch_ids = candidate_ids[i:i + 500]
        batch = (
            db.table("Problems_duplicate")
            .select("ProblemID, ProblemName, Difficulty_level, URL, AcceptanceRate")
            .in_("ProblemID", batch_ids)
            .in_("Difficulty_level", difficulties)
            .execute()
        )
        all_candidates.extend(batch.data)

    if not all_candidates:
        fallback_difficulties = _get_fallback_difficulties(difficulties)
        if fallback_difficulties:
            for i in range(0, len(candidate_ids), 500):
                batch_ids = candidate_ids[i:i + 500]
                batch = (
                    db.table("Problems_duplicate")
                    .select("ProblemID, ProblemName, Difficulty_level, URL, AcceptanceRate")
                    .in_("ProblemID", batch_ids)
                    .in_("Difficulty_level", fallback_difficulties)
                    .execute()
                )
                all_candidates.extend(batch.data)
        if not all_candidates:
            return [], True

    selected = random.sample(all_candidates, min(MAX_PROBLEMS_PER_TOPIC, len(all_candidates)))
    exhausted = len(all_candidates) <= MAX_PROBLEMS_PER_TOPIC

    suggestions = []
    for p in selected:
        row = {
            "user_id": user_id,
            "problem_id": p["ProblemID"],
            "topic_id": topic_id,
            "suggested_at": datetime.now(timezone.utc).isoformat(),
            "completed": False,
        }
        row["learning_phase"] = phase
        db.table("problem_suggestions").upsert(
            row, on_conflict="user_id,problem_id,learning_phase"
        ).execute()

        suggestions.append({
            "problem_id": p["ProblemID"],
            "name": p["ProblemName"],
            "difficulty": p["Difficulty_level"],
            "url": p["URL"],
            "acceptance_rate": p["AcceptanceRate"],
        })

    new_total = existing_count + len(selected)

    existing_progress = (
        db.table("learning_progress")
        .select("learning_status")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .eq("learning_phase", phase)
        .limit(1)
        .execute()
    )
    is_completed = existing_progress.data and existing_progress.data[0]["learning_status"] == "completed"

    upsert_data = {
        "user_id": user_id,
        "topic_id": topic_id,
        "learning_phase": phase,
        "topic_status": topic_status,
        "learning_status": "completed" if is_completed else "in_progress",
        "problems_suggested": new_total,
    }
    if not existing_progress.data:
        upsert_data["started_at"] = datetime.now(timezone.utc).isoformat()
    db.table("learning_progress").upsert(
        upsert_data, on_conflict="user_id,topic_id,learning_phase"
    ).execute()

    return suggestions, exhausted


def mark_problem_completed(user_id: str, problem_id: int, learning_phase: str = "A") -> dict | None:
    """Mark a suggested problem as completed. Returns updated topic progress or None."""
    db = get_supabase_admin()

    update_data = {
        "completed": True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    result = (
        db.table("problem_suggestions")
        .update(update_data)
        .eq("user_id", user_id)
        .eq("problem_id", problem_id)
        .eq("learning_phase", learning_phase)
        .execute()
    )

    if not result.data:
        return None

    topic_id = result.data[0]["topic_id"]

    all_for_topic = (
        db.table("problem_suggestions")
        .select("id, completed")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .eq("learning_phase", learning_phase)
        .execute()
    )
    total = len(all_for_topic.data)
    completed = sum(1 for s in all_for_topic.data if s["completed"])

    progress = (
        db.table("learning_progress")
        .select("materials_viewed")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .eq("learning_phase", learning_phase)
        .limit(1)
        .execute()
    )
    materials_viewed = progress.data[0]["materials_viewed"] if progress.data else False

    topic_done = completed == total and total > 0 and materials_viewed
    new_status = "completed" if topic_done else "in_progress"

    db.table("learning_progress").update({
        "problems_completed": completed,
        "learning_status": new_status,
    }).eq("user_id", user_id).eq("topic_id", topic_id).eq("learning_phase", learning_phase).execute()

    return {
        "topic_id": topic_id,
        "problems_completed": completed,
        "problems_total": total,
        "learning_status": new_status,
    }


def get_user_learning_state(user_id: str, learning_phase: str = None) -> dict:
    """Get full learning state: classification, progress, suggestions."""
    db = get_supabase_admin()

    classification = (
        db.table("skill_classifications")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    query = (
        db.table("learning_progress")
        .select("*, dsa_topics(name, slug, category)")
        .eq("user_id", user_id)
    )
    if learning_phase:
        query = query.eq("learning_phase", learning_phase)
    progress = query.execute()

    suggestions = (
        db.table("problem_suggestions")
        .select("*")
        .eq("user_id", user_id)
        .order("suggested_at", desc=True)
        .execute()
    )

    return {
        "classification": classification.data[0] if classification.data else None,
        "progress": progress.data,
        "suggestions": suggestions.data,
    }


LEARNING_MATERIAL_PROMPT = """You are a DSA tutor. Generate a concise learning module for the given topic tailored to the student's level.

Level descriptions:
- Level A (Beginner): Explain from scratch. Use simple language, analogies, step-by-step examples.
- Level B (Intermediate): Skip basics. Focus on patterns, common techniques, edge cases, time/space complexity.
- Level C (Advanced): Focus on optimizations, advanced variations, interview-level insights, tricky edge cases.

Structure your response as:
1. **Core Concept** — What is this and why does it matter? (2-3 sentences)
2. **Key Intuition** — The mental model or analogy (1-2 sentences)
3. **How It Works** — Step-by-step explanation with a small example
4. **Code Pattern** — Python code snippet showing the typical pattern (keep short)
5. **Common Mistakes** — 2-3 pitfalls to avoid
6. **Time & Space Complexity** — Big-O for common operations

Keep the entire response under 500 words. Use markdown formatting."""

PHASE_CONTEXT = {
    1: "",
    2: "\n\nIMPORTANT: This is the student's SECOND pass through this topic at a higher level. Generate COMPLETELY DIFFERENT examples, code patterns, analogies, and explanations than a typical tutorial. Use novel approaches, different sub-aspects of the topic, and fresh problem scenarios.",
    3: "\n\nIMPORTANT: This is the student's THIRD pass through this topic at the highest level. Generate ENTIRELY NEW advanced content — different algorithms, unusual edge cases, interview-specific tricks, and optimization techniques NOT covered in standard tutorials. Every example and code snippet must be completely original.",
}


async def generate_learning_material(topic_name: str, level: str, phase_number: int = 1) -> str:
    """Generate AI learning material for a topic at the user's level."""
    router = get_provider_router()

    phase_extra = PHASE_CONTEXT.get(phase_number, PHASE_CONTEXT.get(3, ""))
    system_prompt = LEARNING_MATERIAL_PROMPT + phase_extra

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Topic: {topic_name}\nStudent Level: {level}"},
    ]

    try:
        response = await router.chat(messages=messages, tools=None, temperature=0.3, mode="fast")
        return response.content
    except Exception as e:
        logger.error("Failed to generate learning material for %s: %s", topic_name, e)
        return f"# {topic_name}\n\nLearning material is temporarily unavailable. Please try again later."
