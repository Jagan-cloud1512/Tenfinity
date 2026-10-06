import json
import logging
import time
from typing import Any, AsyncIterator

import httpx

from app.providers.base import LLMProvider, ProviderError, ProviderResponse

logger = logging.getLogger(__name__)

OLLAMA_TIMEOUT = 120.0
HEALTH_TIMEOUT = 5.0


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str, model: str):
        self._base_url = base_url.rstrip("/")
        self._model = model

    @property
    def name(self) -> str:
        return "ollama"

    def get_model(self) -> str:
        return self._model

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> ProviderResponse:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if tools:
            payload["tools"] = tools

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
                resp = await client.post(
                    f"{self._base_url}/api/chat",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.ConnectError as e:
            raise ProviderError("ollama", f"Connection failed: {e}")
        except httpx.TimeoutException:
            raise ProviderError("ollama", "Request timed out")
        except httpx.HTTPStatusError as e:
            raise ProviderError("ollama", f"HTTP {e.response.status_code}")
        except Exception as e:
            raise ProviderError("ollama", str(e))

        elapsed = (time.monotonic() - start) * 1000
        message = data.get("message", {})

        tool_calls = []
        if message.get("tool_calls"):
            for tc in message["tool_calls"]:
                func = tc.get("function", {})
                tool_calls.append({
                    "name": func.get("name", ""),
                    "arguments": func.get("arguments", {}),
                })

        return ProviderResponse(
            content=message.get("content", ""),
            tool_calls=tool_calls,
            provider="ollama",
            model=self._model,
            latency_ms=elapsed,
        )

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        if tools:
            payload["tools"] = tools

        try:
            async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/api/chat",
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if chunk.get("message", {}).get("tool_calls"):
                            raw_calls = chunk["message"]["tool_calls"]
                            normalized = []
                            for tc in raw_calls:
                                func = tc.get("function", {})
                                normalized.append({
                                    "name": func.get("name", ""),
                                    "arguments": func.get("arguments", {}),
                                })
                            yield json.dumps({"type": "tool_calls", "tool_calls": normalized})
                            return

                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content

                        if chunk.get("done"):
                            return
        except httpx.ConnectError as e:
            raise ProviderError("ollama", f"Connection failed: {e}")
        except httpx.TimeoutException:
            raise ProviderError("ollama", "Stream timed out")
        except Exception as e:
            raise ProviderError("ollama", str(e))

    async def health_check(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "provider": "ollama",
            "reachable": False,
            "model_available": False,
            "model": self._model,
            "latency_ms": None,
        }
        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                resp.raise_for_status()
                result["reachable"] = True
                result["latency_ms"] = round((time.monotonic() - start) * 1000)
                models = [m["name"] for m in resp.json().get("models", [])]
                result["model_available"] = self._model in models
                result["available_models"] = models
        except Exception as e:
            logger.debug("Ollama health check failed: %s", e)
        return result
