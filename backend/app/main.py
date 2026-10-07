import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes.chat import router as chat_router
from app.routes.auth import router as auth_router
from app.routes.topics import router as topics_router
from app.routes.assessment import router as assessment_router
from app.routes.coding_assessment import router as coding_router
from app.routes.learning import router as learning_router
from app.routes.final_assessment import router as final_assessment_router
from app.routes.certificate import router as certificate_router

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)

app = FastAPI(
    title="AI Agent",
    version="2.0.0",
)

allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
]
if settings.frontend_url and settings.frontend_url not in allowed_origins:
    allowed_origins.insert(0, settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(topics_router)
app.include_router(assessment_router)
app.include_router(coding_router)
app.include_router(learning_router)
app.include_router(final_assessment_router)
app.include_router(certificate_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logging.getLogger("uvicorn.error").error("Unhandled exception on %s %s:\n%s", request.method, request.url.path, tb)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/")
async def root():
    return {"message": "AI Agent API v2.0", "docs": "/docs"}
