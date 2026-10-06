import json
import logging
import time
from typing import Any, AsyncIterator

import httpx

from app.providers.base import LLMProvider, ProviderError, ProviderResponse

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_TIMEOUT = 60.0
HEALTH_TIMEOUT = 10.0


class OpenRouterProvider(LLMProvider):
    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    @property
    def name(self) -> str:
        return "openrouter"

    def get_model(self) -> str:
        return self._model

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "AI Agent",
        }

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None,
        temperature: float,
        stream: bool,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        return payload

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> ProviderResponse:
        if not self._api_key:
            raise ProviderError("openrouter", "API key not configured", retriable=False)

        payload = self._build_payload(messages, tools, temperature, stream=False)
        start = time.monotonic()

        try:
            async with httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.ConnectError as e:
            raise ProviderError("openrouter", f"Connection failed: {e}")
        except httpx.TimeoutException:
            raise ProviderError("openrouter", "Request timed out")
        except httpx.HTTPStatusError as e:
            body = e.response.text
            if e.response.status_code == 401:
                raise ProviderError("openrouter", "Invalid API key", retriable=False)
            if e.response.status_code == 429:
                raise ProviderError("openrouter", f"Rate limited: {body}")
            raise ProviderError("openrouter", f"HTTP {e.response.status_code}: {body}")
        except Exception as e:
            raise ProviderError("openrouter", str(e))

        elapsed = (time.monotonic() - start) * 1000
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})

        tool_calls = []
        if message.get("tool_calls"):
            for tc in message["tool_calls"]:
                func = tc.get("function", {})
                args = func.get("arguments", "{}")
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                tool_calls.append({
                    "name": func.get("name", ""),
                    "arguments": args,
                })

        return ProviderResponse(
            content=message.get("content", "") or "",
            tool_calls=tool_calls,
            provider="openrouter",
            model=data.get("model", self._model),
            finish_reason=choice.get("finish_reason", ""),
            latency_ms=elapsed,
        )

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        if not self._api_key:
            raise ProviderError("openrouter", "API key not configured", retriable=False)

        payload = self._build_payload(messages, tools, temperature, stream=True)

        try:
            async with httpx.AsyncClient(timeout=OPENROUTER_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                ) as resp:
                    resp.raise_for_status()

                    tool_call_buffer: dict[int, dict] = {}

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        delta = chunk.get("choices", [{}])[0].get("delta", {})

                        if delta.get("tool_calls"):
                            for tc_delta in delta["tool_calls"]:
                                idx = tc_delta.get("index", 0)
                                if idx not in tool_call_buffer:
                                    tool_call_buffer[idx] = {
                                        "name": tc_delta.get("function", {}).get("name", ""),
                                        "arguments": "",
                                    }
                                tool_call_buffer[idx]["arguments"] += tc_delta.get("function", {}).get("arguments", "")
                            continue

                        content = delta.get("content", "")
                        if content:
                            yield content

                    if tool_call_buffer:
                        calls = []
                        for tc in tool_call_buffer.values():
                            try:
                                args = json.loads(tc["arguments"])
                            except json.JSONDecodeError:
                                args = {}
                            calls.append({"name": tc["name"], "arguments": args})
                        yield json.dumps({"type": "tool_calls", "tool_calls": calls})

        except httpx.ConnectError as e:
            raise ProviderError("openrouter", f"Connection failed: {e}")
        except httpx.TimeoutException:
            raise ProviderError("openrouter", "Stream timed out")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise ProviderError("openrouter", "Invalid API key", retriable=False)
            raise ProviderError("openrouter", f"HTTP {e.response.status_code}")
        except ProviderError:
            raise
        except Exception as e:
            raise ProviderError("openrouter", str(e))

    async def health_check(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "provider": "openrouter",
            "reachable": False,
            "configured": bool(self._api_key),
            "model": self._model,
            "latency_ms": None,
        }
        if not self._api_key:
            return result

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT) as client:
                resp = await client.get(
                    f"{OPENROUTER_BASE_URL}/models",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                result["reachable"] = True
                result["latency_ms"] = round((time.monotonic() - start) * 1000)
        except Exception as e:
            logger.debug("OpenRouter health check failed: %s", e)
        return result
