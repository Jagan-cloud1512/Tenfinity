"""Skill classification engine: combine MCQ + coding scores → A/B/C level."""
import logging
from datetime import datetime, timezone

from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

LEVEL_THRESHOLDS = {
    "A": (0, 45),
    "B": (46, 80),
    "C": (81, 100),
}


def _compute_level(overall_percent: float) -> str:
    if overall_percent <= 45:
        return "A"
    elif overall_percent <= 80:
        return "B"
    return "C"


def _get_coding_test_case_percent(db, user_id: str) -> float | None:
    """Coding score based on test cases passed (not just problems)."""
    assessment = (
        db.table("coding_assessments")
        .select("id, status")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    if not assessment.data:
        return None

    problems = (
        db.table("coding_problems")
        .select("passed_count, total_count")
        .eq("assessment_id", assessment.data[0]["id"])
        .execute()
    )
    if not problems.data:
        return None

    total_tests = sum(p["total_count"] or 0 for p in problems.data)
    passed_tests = sum(p["passed_count"] or 0 for p in problems.data)

    if total_tests == 0:
        return 0.0
    return (passed_tests / total_tests) * 100


def classify_user(user_id: str) -> dict:
    """Classify user into A/B/C based on MCQ + coding assessment scores.

    If the user has been promoted beyond their initial classification,
    the promoted level is preserved — we only update scores, not level.
    """
    db = get_supabase_admin()

    # Get MCQ assessment score
    mcq_assessment = (
        db.table("assessments")
        .select("score_percent, status")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    mcq_percent = mcq_assessment.data[0]["score_percent"] if mcq_assessment.data else 0.0

    # Get coding assessment score (test-case based)
    coding_percent = _get_coding_test_case_percent(db, user_id)
    if coding_percent is None:
        coding_percent = 0.0

    # Combined score (equal weight)
    overall_percent = (mcq_percent + coding_percent) / 2
    computed_level = _compute_level(overall_percent)

    # Check if the user has been promoted beyond the computed level
    progression = (
        db.table("level_progression")
        .select("current_phase")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if progression.data:
        promoted_phase = progression.data[0]["current_phase"]
        phase_rank = {"A": 0, "B": 1, "C": 2, "COMPLETE": 3}
        if phase_rank.get(promoted_phase, 0) > phase_rank.get(computed_level, 0):
            level = promoted_phase if promoted_phase != "COMPLETE" else "C"
        else:
            level = computed_level
    else:
        level = computed_level

    # Upsert classification
    db.table("skill_classifications").upsert({
        "user_id": user_id,
        "mcq_score_percent": round(mcq_percent, 1),
        "coding_score_percent": round(coding_percent, 1),
        "overall_score_percent": round(overall_percent, 1),
        "level": level,
        "classified_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id").execute()

    logger.info(
        "User %s classified: MCQ=%.1f%%, Coding=%.1f%%, Overall=%.1f%% → Level %s",
        user_id, mcq_percent, coding_percent, overall_percent, level,
    )

    return {
        "mcq_score_percent": round(mcq_percent, 1),
        "coding_score_percent": round(coding_percent, 1),
        "overall_score_percent": round(overall_percent, 1),
        "level": level,
    }


def get_topic_strengths(user_id: str) -> list[dict]:
    """Get per-topic strength/weakness breakdown from assessments."""
    db = get_supabase_admin()

    # MCQ per-topic scores
    mcq_assessment = (
        db.table("assessments")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )

    topic_scores = {}

    if mcq_assessment.data:
        questions = (
            db.table("assessment_questions")
            .select("topic_id, is_correct")
            .eq("assessment_id", mcq_assessment.data[0]["id"])
            .execute()
        )
        for q in questions.data:
            tid = q["topic_id"]
            if tid not in topic_scores:
                topic_scores[tid] = {"correct": 0, "total": 0}
            topic_scores[tid]["total"] += 1
            if q["is_correct"]:
                topic_scores[tid]["correct"] += 1

    # Get topic names
    topics = db.table("dsa_topics").select("id, name").execute()
    topic_map = {t["id"]: t["name"] for t in topics.data}

    # Get user topic selections
    user_topics = (
        db.table("user_topics")
        .select("topic_id, self_reported_status")
        .eq("user_id", user_id)
        .execute()
    )
    user_topic_status = {ut["topic_id"]: ut["self_reported_status"] for ut in user_topics.data}

    assessed_topic_ids = set(topic_scores.keys()) | {
        tid for tid, status in user_topic_status.items() if status == "known"
    }

    results = []
    for tid in assessed_topic_ids:
        name = topic_map.get(tid)
        if not name:
            continue
        status = user_topic_status.get(tid, "unknown")
        if tid in topic_scores:
            s = topic_scores[tid]
            correct = s["correct"]
            total = s["total"]
            score = (correct / total * 100) if total > 0 else 0
            weakness = 100 - score
        else:
            correct = 0
            total = 0
            score = 0
            weakness = 100

        results.append({
            "topic_id": tid,
            "topic_name": name,
            "self_reported": status,
            "score_percent": round(score, 1),
            "weakness_percent": round(weakness, 1),
            "correct": correct,
            "total": total,
        })

    results.sort(key=lambda x: x["weakness_percent"], reverse=True)
    return results


def get_feedback_message(level: str, overall_percent: float) -> str:
    """Generate encouragement or improvement feedback."""
    if overall_percent >= 90:
        return "Outstanding performance! You have a strong grasp of DSA concepts. Focus on the advanced topics to reach mastery."
    elif overall_percent >= 70:
        return "Great work! You're doing well. A bit more practice on your weak areas will take you to the next level."
    elif overall_percent >= 50:
        return "Good effort! You have a solid foundation. The learning materials will help strengthen the areas where you need improvement."
    elif overall_percent >= 30:
        return "You're on the right track! Everyone starts somewhere. The personalized learning path will guide you through each topic step by step."
    else:
        return "Welcome to your DSA journey! Don't worry about the scores — the learning system is designed to take you from basics to mastery at your own pace."
