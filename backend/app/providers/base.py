from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator


class ProviderError(Exception):
    def __init__(self, provider: str, message: str, retriable: bool = True):
        self.provider = provider
        self.retriable = retriable
        super().__init__(f"[{provider}] {message}")


@dataclass
class ProviderResponse:
    content: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    provider: str = ""
    model: str = ""
    finish_reason: str = ""
    latency_ms: float = 0


class LLMProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> ProviderResponse:
        ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        ...

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        ...

    @abstractmethod
    def get_model(self) -> str:
        ...
