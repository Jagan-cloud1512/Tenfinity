import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/topics")


class TopicSelectionRequest(BaseModel):
    selections: list[dict[str, Any]] = Field(
        ...,
        description="List of {topic_id: int, status: 'known' | 'unknown'}",
    )


@router.get("")
async def get_all_topics() -> list[dict[str, Any]]:
    client = get_supabase_admin()
    result = client.table("dsa_topics").select("*").order("display_order").execute()
    return result.data


@router.get("/user")
async def get_user_topics(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    client = get_supabase_admin()

    selections = (
        client.table("user_topics")
        .select("topic_id, self_reported_status")
        .eq("user_id", user["id"])
        .execute()
    )

    selection_map = {
        s["topic_id"]: s["self_reported_status"] for s in selections.data
    }

    return {
        "user_id": user["id"],
        "selections": selection_map,
        "total_selected": len(selection_map),
    }


@router.post("/select")
async def save_topic_selections(
    request: TopicSelectionRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    client = get_supabase_admin()

    for sel in request.selections:
        topic_id = sel.get("topic_id")
        status = sel.get("status")

        if not topic_id or status not in ("known", "unknown"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid selection: topic_id={topic_id}, status={status}",
            )

    rows = [
        {
            "user_id": user["id"],
            "topic_id": sel["topic_id"],
            "self_reported_status": sel["status"],
        }
        for sel in request.selections
    ]

    client.table("user_topics").upsert(
        rows,
        on_conflict="user_id,topic_id",
    ).execute()

    return {
        "status": "saved",
        "count": len(rows),
    }
