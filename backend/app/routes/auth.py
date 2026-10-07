import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.services.supabase_client import get_supabase_admin, create_anon_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")


class SignUpRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    display_name: str = Field(default="")


class SignInRequest(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)


@router.post("/signup")
async def signup(request: SignUpRequest) -> dict[str, Any]:
    client = get_supabase_admin()
    try:
        result = client.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True,
        })
    except Exception as e:
        logger.error("Signup failed: %s", e)
        raise HTTPException(status_code=400, detail=str(e))

    if result.user is None:
        raise HTTPException(status_code=400, detail="Signup failed")

    if request.display_name:
        try:
            client.table("user_profiles").upsert({
                "id": result.user.id,
                "display_name": request.display_name,
            }).execute()
        except Exception as e:
            logger.warning("Failed to update profile: %s", e)

    return {
        "user": {"id": result.user.id, "email": result.user.email},
    }


@router.post("/signin")
async def signin(request: SignInRequest) -> dict[str, Any]:
    client = create_anon_client()
    try:
        result = client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
    except Exception as e:
        logger.error("Signin failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if result.user is None or result.session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user": {"id": result.user.id, "email": result.user.email},
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
    }


@router.get("/progress")
async def get_user_progress(user: dict = Depends(get_current_user)) -> dict[str, Any]:
    """Return the appropriate page route based on user's current progress."""
    db = get_supabase_admin()
    uid = user["id"]

    topics = db.table("user_topics").select("topic_id").eq("user_id", uid).limit(1).execute()
    if not topics.data:
        return {"route": "/topics", "stage": "topics"}

    mcq = db.table("assessments").select("id").eq("user_id", uid).eq("status", "completed").limit(1).execute()
    if not mcq.data:
        active_mcq = db.table("assessments").select("id").eq("user_id", uid).in_("status", ["generating", "in_progress"]).limit(1).execute()
        return {"route": "/assessment", "stage": "assessment"}

    coding = db.table("coding_assessments").select("id").eq("user_id", uid).eq("status", "completed").limit(1).execute()
    if not coding.data:
        return {"route": "/coding-assessment", "stage": "coding"}

    classification = db.table("skill_classifications").select("level").eq("user_id", uid).limit(1).execute()
    if not classification.data:
        return {"route": "/results", "stage": "results"}

    prog = db.table("level_progression").select("current_phase").eq("user_id", uid).limit(1).execute()
    if not prog.data:
        return {"route": "/learning", "stage": "learning"}

    current_phase = prog.data[0]["current_phase"]

    if current_phase == "COMPLETE":
        return {"route": "/certificate", "stage": "complete"}

    from app.services.progression import check_learning_complete
    learning_check = check_learning_complete(uid)
    if learning_check["complete"]:
        return {"route": "/final-assessment", "stage": "final_assessment"}

    return {"route": "/learning", "stage": "learning"}


@router.post("/refresh")
async def refresh_token(body: dict[str, str]) -> dict[str, Any]:
    refresh = body.get("refresh_token", "")
    if not refresh:
        raise HTTPException(status_code=400, detail="Missing refresh_token")

    client = create_anon_client()
    try:
        result = client.auth.refresh_session(refresh)
    except Exception as e:
        logger.error("Token refresh failed: %s", e)
        raise HTTPException(status_code=401, detail="Token refresh failed")

    if result.session is None:
        raise HTTPException(status_code=401, detail="Token refresh failed")

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
    }
