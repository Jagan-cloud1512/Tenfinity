import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.orchestrator import AgentOrchestrator
from app.agent.registry import create_default_registry
from app.config import get_settings
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationInfo,
    HealthResponse,
    ProviderHealth,
    SourceItem,
)
from app.services.conversation import conversation_store
from app.services.llm import get_provider_router

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

_registry = create_default_registry()
_provider_router = get_provider_router()
_orchestrator = AgentOrchestrator(registry=_registry, router=_provider_router)


@router.post("/chat")
async def chat(request: ChatRequest):
    conv = conversation_store.get_or_create(request.conversation_id)
    conversation_store.add_message(conv.id, "user", request.message)
    history = conversation_store.get_recent_messages(conv.id, limit=20)
    history = history[:-1]

    if request.stream:
        return StreamingResponse(
            _stream_response(conv.id, request.message, history, request.mode),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        result = await _orchestrator.run(
            user_message=request.message,
            conversation_history=history,
            mode=request.mode,
        )
    except Exception as e:
        logger.error("Agent error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable. Please try again.")

    answer = result.get("answer", "Sorry, I could not generate a response.")
    sources = [SourceItem(**s) for s in result.get("sources", [])]
    tools_used = result.get("tools_used", [])
    search_performed = result.get("search_performed", False)
    provider = result.get("provider", "")
    model = result.get("model", "")

    conversation_store.add_message(
        conv.id, "assistant", answer,
        sources=[s.model_dump() for s in sources],
        tools_used=tools_used,
    )

    return ChatResponse(
        conversation_id=conv.id,
        answer=answer,
        sources=sources,
        tools_used=tools_used,
        search_performed=search_performed,
        provider=provider,
        model=model,
    )


async def _stream_response(
    conv_id: str,
    user_message: str,
    history: list[dict[str, str]],
    mode: str,
):
    full_answer = ""
    final_sources: list[dict[str, Any]] = []
    final_tools: list[str] = []
    final_provider = ""
    final_model = ""

    try:
        async for event in _orchestrator.run_stream(
            user_message=user_message,
            conversation_history=history,
            mode=mode,
        ):
            event_type = event.get("type", "")

            if event_type == "provider":
                final_provider = event.get("provider", "")
                final_model = event.get("model", "")
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "token":
                full_answer += event.get("content", "")
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "tool_start":
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "tool_done":
                yield f"data: {json.dumps(event)}\n\n"

            elif event_type == "done":
                final_sources = event.get("sources", [])
                final_tools = event.get("tools_used", [])
                done_event = {
                    "type": "done",
                    "conversation_id": conv_id,
                    "sources": final_sources,
                    "tools_used": final_tools,
                    "search_performed": event.get("search_performed", False),
                    "provider": event.get("provider", final_provider),
                    "model": event.get("model", final_model),
                }
                yield f"data: {json.dumps(done_event)}\n\n"

            elif event_type == "error":
                yield f"data: {json.dumps(event)}\n\n"

    except Exception as e:
        logger.error("Stream error: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'error': 'AI service temporarily unavailable.'})}\n\n"

    if full_answer:
        conversation_store.add_message(
            conv_id, "assistant", full_answer,
            sources=final_sources,
            tools_used=final_tools,
        )

    yield "data: [DONE]\n\n"


@router.get("/conversations", response_model=list[ConversationInfo])
async def list_conversations() -> list[ConversationInfo]:
    convs = conversation_store.list_conversations()
    return [ConversationInfo(**c) for c in convs]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str) -> dict[str, Any]:
    conv = conversation_store.get(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = []
    for m in conv.messages:
        messages.append({
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp,
            "sources": m.sources,
            "tools_used": m.tools_used,
        })
    return {"conversation_id": conversation_id, "title": conv.title, "messages": messages}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str) -> dict[str, str]:
    if not conversation_store.delete(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    health_results = await _provider_router.check_all_health()
    settings = get_settings()

    providers = []
    any_reachable = False
    for name, data in health_results.items():
        reachable = data.get("reachable", False)
        if reachable:
            any_reachable = True
        providers.append(ProviderHealth(
            provider=name,
            reachable=reachable,
            configured=data.get("configured", True),
            model=data.get("model", ""),
            latency_ms=data.get("latency_ms"),
        ))

    search_available = True
    try:
        from app.services.search import search
        results = await search("test", max_results=1)
        search_available = len(results) > 0
    except Exception:
        search_available = False

    return HealthResponse(
        status="ok" if any_reachable else "degraded",
        providers=providers,
        search_available=search_available,
        available_tools=_registry.list_names(),
        default_mode=settings.default_mode,
    )


@router.get("/providers")
async def list_providers():
    health_results = await _provider_router.check_all_health()
    return {"providers": health_results}
