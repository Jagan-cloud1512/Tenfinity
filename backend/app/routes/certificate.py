import hashlib
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.services.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/certificate")


def _generate_certificate_id(user_id: str) -> str:
    digest = hashlib.sha256(f"dsa-cert-{user_id}".encode()).hexdigest()[:12].upper()
    return f"DSA-{digest[:4]}-{digest[4:8]}-{digest[8:12]}"


@router.get("")
async def get_certificate(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    db = get_supabase_admin()
    uid = user["id"]

    prog = (
        db.table("level_progression")
        .select("current_phase, initial_level, phases_completed, promoted_at, created_at")
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    if not prog.data or prog.data[0]["current_phase"] != "COMPLETE":
        raise HTTPException(status_code=403, detail="Certificate not available — complete all phases first")

    progression = prog.data[0]

    profile = (
        db.table("user_profiles")
        .select("display_name")
        .eq("id", uid)
        .limit(1)
        .execute()
    )

    display_name = ""
    if profile.data and profile.data[0].get("display_name"):
        display_name = profile.data[0]["display_name"]
    if not display_name:
        display_name = user.get("email", "").split("@")[0].title()

    return {
        "certificate_id": _generate_certificate_id(uid),
        "user_name": display_name,
        "completion_date": progression["promoted_at"] or progression["created_at"],
    }
