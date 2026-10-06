import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.services.assessment import generate_questions_for_topic
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessment")


class AnswerRequest(BaseModel):
    selected_index: int = Field(..., ge=0, le=3)


async def _generate_assessment_bg(assessment_id: str, known_topics: list[dict]):
    db = get_supabase_admin()
    display_order = 1
    total_generated = 0

    for entry in known_topics:
        topic = entry["dsa_topics"]
        topic_id = topic["id"]
        topic_name = topic["name"]
        topic_desc = topic.get("description", "")

        try:
            questions = await generate_questions_for_topic(topic_name, topic_desc)
        except Exception as e:
            logger.error("Failed to generate questions for topic %s: %s", topic_name, e)
            continue

        rows = []
        for q in questions:
            rows.append({
                "assessment_id": assessment_id,
                "topic_id": topic_id,
                "question_type": q["question_type"],
                "difficulty": q["difficulty"],
                "question_text": q["question_text"],
                "code_snippet": q["code_snippet"],
                "code_language": q["code_language"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "explanation": q["explanation"],
                "display_order": display_order,
            })
            display_order += 1

        if rows:
            db.table("assessment_questions").insert(rows).execute()
            total_generated += len(rows)

    db.table("assessments").update({
        "status": "in_progress",
        "total_questions": total_generated,
    }).eq("id", assessment_id).execute()

    logger.info("Assessment %s complete: %d questions generated", assessment_id, total_generated)


@router.post("/start")
async def start_assessment(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()

    existing = (
        db.table("assessments")
        .select("id, status")
        .eq("user_id", user["id"])
        .in_("status", ["generating", "in_progress"])
        .limit(1)
        .execute()
    )
    if existing.data:
        a = existing.data[0]
        if a["status"] == "generating":
            return {"assessment_id": a["id"], "status": "generating", "message": "Already generating"}
        return {"assessment_id": a["id"], "status": a["status"], "message": "Assessment already exists"}

    known_topics = (
        db.table("user_topics")
        .select("topic_id, dsa_topics(id, name, description)")
        .eq("user_id", user["id"])
        .eq("self_reported_status", "known")
        .execute()
    )

    if not known_topics.data:
        raise HTTPException(status_code=400, detail="No known topics found. Please select topics first.")

    expected_total = len(known_topics.data) * 2

    assessment = (
        db.table("assessments")
        .insert({
            "user_id": user["id"],
            "status": "generating",
            "total_questions": expected_total,
        })
        .execute()
    )
    assessment_id = assessment.data[0]["id"]

    background_tasks.add_task(_generate_assessment_bg, assessment_id, known_topics.data)

    return {
        "assessment_id": assessment_id,
        "status": "generating",
        "total_topics": len(known_topics.data),
        "expected_questions": expected_total,
    }


@router.get("/current")
async def get_current_assessment(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()

    assessment = (
        db.table("assessments")
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
            db.table("assessment_questions")
            .select("id")
            .eq("assessment_id", a["id"])
            .execute()
        )
        return {
            "exists": True,
            "assessment": {
                "id": a["id"],
                "status": "generating",
                "total_questions": a["total_questions"],
                "questions_generated": len(generated.data),
            },
            "questions": [],
        }

    questions = (
        db.table("assessment_questions")
        .select("id, topic_id, question_type, difficulty, question_text, code_snippet, code_language, options, correct_index, explanation, user_answer, is_correct, answered_at, display_order, dsa_topics(name)")
        .eq("assessment_id", a["id"])
        .order("display_order")
        .execute()
    )

    safe_questions = []
    for q in questions.data:
        sq = {
            "id": q["id"],
            "topic_id": q["topic_id"],
            "topic_name": q["dsa_topics"]["name"] if q.get("dsa_topics") else "",
            "question_type": q["question_type"],
            "difficulty": q["difficulty"],
            "question_text": q["question_text"],
            "code_snippet": q["code_snippet"],
            "code_language": q["code_language"],
            "options": q["options"],
            "display_order": q["display_order"],
            "answered": q["user_answer"] is not None,
            "user_answer": q["user_answer"],
            "is_correct": q["is_correct"],
        }
        if q["user_answer"] is not None:
            sq["correct_index"] = q.get("correct_index")
            sq["explanation"] = q.get("explanation")
        safe_questions.append(sq)

    return {
        "exists": True,
        "assessment": {
            "id": a["id"],
            "status": a["status"],
            "total_questions": a["total_questions"],
            "correct_answers": a["correct_answers"],
            "score_percent": float(a["score_percent"]) if a["score_percent"] else 0,
            "started_at": a["started_at"],
            "completed_at": a["completed_at"],
        },
        "questions": safe_questions,
    }


@router.post("/answer/{question_id}")
async def submit_answer(
    question_id: int,
    request: AnswerRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_supabase_admin()

    question = (
        db.table("assessment_questions")
        .select("*, assessments!inner(user_id, id, status, total_questions)")
        .eq("id", question_id)
        .limit(1)
        .execute()
    )

    if not question.data:
        raise HTTPException(status_code=404, detail="Question not found")

    q = question.data[0]
    assessment = q["assessments"]

    if assessment["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your assessment")

    if assessment["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Assessment is not in progress")

    if q["user_answer"] is not None:
        raise HTTPException(status_code=400, detail="Question already answered")

    is_correct = request.selected_index == q["correct_index"]

    db.table("assessment_questions").update({
        "user_answer": request.selected_index,
        "is_correct": is_correct,
        "answered_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", question_id).execute()

    all_questions = (
        db.table("assessment_questions")
        .select("user_answer, is_correct")
        .eq("assessment_id", assessment["id"])
        .execute()
    )

    answered_count = sum(1 for qq in all_questions.data if qq["user_answer"] is not None)
    total = assessment["total_questions"]
    all_done = answered_count >= total

    if all_done:
        correct_count = sum(1 for qq in all_questions.data if qq["is_correct"])
        score = round((correct_count / total) * 100, 2) if total > 0 else 0
        db.table("assessments").update({
            "status": "completed",
            "correct_answers": correct_count,
            "score_percent": score,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", assessment["id"]).execute()

    return {
        "is_correct": is_correct,
        "correct_index": q["correct_index"],
        "explanation": q["explanation"],
        "answered": answered_count,
        "total": total,
        "assessment_complete": all_done,
    }


@router.get("/results")
async def get_results(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()

    assessment = (
        db.table("assessments")
        .select("*")
        .eq("user_id", user["id"])
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )

    if not assessment.data:
        raise HTTPException(status_code=404, detail="No completed assessment found")

    a = assessment.data[0]

    questions = (
        db.table("assessment_questions")
        .select("id, topic_id, question_type, difficulty, question_text, code_snippet, code_language, options, correct_index, explanation, user_answer, is_correct, display_order, dsa_topics(name)")
        .eq("assessment_id", a["id"])
        .order("display_order")
        .execute()
    )

    topic_scores = {}
    for q in questions.data:
        tname = q["dsa_topics"]["name"] if q.get("dsa_topics") else f"Topic {q['topic_id']}"
        if tname not in topic_scores:
            topic_scores[tname] = {"correct": 0, "total": 0}
        topic_scores[tname]["total"] += 1
        if q["is_correct"]:
            topic_scores[tname]["correct"] += 1

    return {
        "assessment": {
            "id": a["id"],
            "total_questions": a["total_questions"],
            "correct_answers": a["correct_answers"],
            "score_percent": float(a["score_percent"]),
            "started_at": a["started_at"],
            "completed_at": a["completed_at"],
        },
        "topic_scores": topic_scores,
        "questions": [
            {
                "id": q["id"],
                "topic_name": q["dsa_topics"]["name"] if q.get("dsa_topics") else "",
                "question_type": q["question_type"],
                "question_text": q["question_text"],
                "code_snippet": q["code_snippet"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "user_answer": q["user_answer"],
                "is_correct": q["is_correct"],
                "explanation": q["explanation"],
            }
            for q in questions.data
        ],
    }


@router.delete("/reset")
async def reset_assessment(user: dict = Depends(get_current_user)) -> dict[str, str]:
    db = get_supabase_admin()
    db.table("assessments").delete().eq("user_id", user["id"]).execute()
    return {"status": "reset"}
