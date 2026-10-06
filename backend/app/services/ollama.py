import httpx
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

OLLAMA_TIMEOUT = 120.0


async def check_health() -> dict[str, Any]:
    settings = get_settings()
    result = {"ollama_reachable": False, "model_available": False, "model": settings.ollama_model}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            resp.raise_for_status()
            result["ollama_reachable"] = True
            models = [m["name"] for m in resp.json().get("models", [])]
            result["model_available"] = settings.ollama_model in models
            result["available_models"] = models
    except Exception as e:
        logger.error("Ollama health check failed: %s", e)
    return result


async def chat(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.7,
) -> dict[str, Any]:
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if tools:
        payload["tools"] = tools

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def chat_stream(
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    temperature: float = 0.7,
):
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature},
    }
    if tools:
        payload["tools"] = tools

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_base_url}/api/chat",
            json=payload,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.strip():
                    yield line
