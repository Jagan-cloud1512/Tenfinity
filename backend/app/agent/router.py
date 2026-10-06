import asyncio
import logging
import time
from typing import Any, AsyncIterator

from app.providers.base import LLMProvider, ProviderError, ProviderResponse

logger = logging.getLogger(__name__)


class ProviderRouter:
    def __init__(self, providers: dict[str, LLMProvider], priority: list[str]):
        self._providers = providers
        self._default_priority = priority
        self._health_cache: dict[str, dict[str, Any]] = {}
        self._latency_history: dict[str, list[float]] = {name: [] for name in providers}
        self._failure_counts: dict[str, int] = {name: 0 for name in providers}

    def get_provider(self, name: str) -> LLMProvider | None:
        return self._providers.get(name)

    def list_providers(self) -> list[str]:
        return list(self._providers.keys())

    def _avg_latency(self, name: str) -> float:
        history = self._latency_history.get(name, [])
        if not history:
            return float("inf")
        return sum(history) / len(history)

    def _record_latency(self, name: str, ms: float) -> None:
        history = self._latency_history.setdefault(name, [])
        history.append(ms)
        if len(history) > 10:
            history.pop(0)

    def _record_failure(self, name: str) -> None:
        self._failure_counts[name] = self._failure_counts.get(name, 0) + 1

    def _record_success(self, name: str) -> None:
        self._failure_counts[name] = 0

    def _get_ordered_providers(self, mode: str) -> list[str]:
        if mode == "ollama":
            return ["ollama"] if "ollama" in self._providers else []
        if mode == "groq":
            return ["groq"] if "groq" in self._providers else []
        if mode == "openrouter":
            return ["openrouter"] if "openrouter" in self._providers else []

        if mode == "local":
            order = ["ollama", "groq", "openrouter"]
        elif mode == "fast":
            order = ["groq", "openrouter", "ollama"]
        elif mode == "auto":
            order = sorted(
                self._default_priority,
                key=lambda n: (self._failure_counts.get(n, 0), self._avg_latency(n)),
            )
        else:
            order = self._default_priority

        return [p for p in order if p in self._providers]

    async def check_all_health(self) -> dict[str, dict[str, Any]]:
        tasks = {
            name: provider.health_check()
            for name, provider in self._providers.items()
        }
        results = {}
        for name, coro in tasks.items():
            try:
                results[name] = await coro
            except Exception as e:
                results[name] = {"provider": name, "reachable": False, "error": str(e)}
        self._health_cache = results
        return results

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        mode: str = "auto",
    ) -> ProviderResponse:
        ordered = self._get_ordered_providers(mode)
        if not ordered:
            raise ProviderError("router", "No providers configured")

        errors: list[str] = []

        for provider_name in ordered:
            provider = self._providers[provider_name]
            try:
                logger.info("Trying provider: %s", provider_name)
                response = await provider.chat(messages, tools, temperature)
                self._record_success(provider_name)
                self._record_latency(provider_name, response.latency_ms)
                return response
            except ProviderError as e:
                logger.warning("Provider %s failed: %s", provider_name, e)
                self._record_failure(provider_name)
                errors.append(f"{provider_name}: {e}")
                if not e.retriable:
                    continue
                continue

        raise ProviderError(
            "router",
            f"All providers failed: {'; '.join(errors)}",
            retriable=False,
        )

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
        mode: str = "auto",
    ) -> tuple[str, AsyncIterator[str]]:
        ordered = self._get_ordered_providers(mode)
        if not ordered:
            raise ProviderError("router", "No providers configured")

        errors: list[str] = []

        for provider_name in ordered:
            provider = self._providers[provider_name]
            try:
                logger.info("Trying stream provider: %s", provider_name)
                stream = provider.chat_stream(messages, tools, temperature)
                first_chunk = await stream.__anext__()
                self._record_success(provider_name)

                async def _prepend(first: str, rest: AsyncIterator[str]) -> AsyncIterator[str]:
                    yield first
                    async for chunk in rest:
                        yield chunk

                return provider_name, _prepend(first_chunk, stream)
            except StopAsyncIteration:
                self._record_success(provider_name)

                async def _empty() -> AsyncIterator[str]:
                    return
                    yield  # noqa: make it a generator

                return provider_name, _empty()
            except ProviderError as e:
                logger.warning("Provider %s stream failed: %s", provider_name, e)
                self._record_failure(provider_name)
                errors.append(f"{provider_name}: {e}")
                continue

        raise ProviderError(
            "router",
            f"All providers failed for streaming: {'; '.join(errors)}",
            retriable=False,
        )
