import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.providers.base import ProviderError, ProviderResponse
from app.providers.ollama import OllamaProvider
from app.providers.groq_provider import GroqProvider
from app.providers.openrouter import OpenRouterProvider


class TestOllamaProvider:
    def setup_method(self):
        self.provider = OllamaProvider("http://localhost:11434", "qwen3:latest")

    def test_name(self):
        assert self.provider.name == "ollama"

    def test_get_model(self):
        assert self.provider.get_model() == "qwen3:latest"

    @pytest.mark.asyncio
    async def test_health_check_unreachable(self):
        provider = OllamaProvider("http://localhost:99999", "test")
        result = await provider.health_check()
        assert result["reachable"] is False

    @pytest.mark.asyncio
    async def test_chat_connection_error(self):
        provider = OllamaProvider("http://localhost:99999", "test")
        with pytest.raises(ProviderError) as exc_info:
            await provider.chat([{"role": "user", "content": "hi"}])
        assert "ollama" in str(exc_info.value)


class TestGroqProvider:
    def setup_method(self):
        self.provider = GroqProvider("test-key", "test-model")

    def test_name(self):
        assert self.provider.name == "groq"

    def test_get_model(self):
        assert self.provider.get_model() == "test-model"

    @pytest.mark.asyncio
    async def test_chat_no_api_key(self):
        provider = GroqProvider("", "test-model")
        with pytest.raises(ProviderError) as exc_info:
            await provider.chat([{"role": "user", "content": "hi"}])
        assert "not configured" in str(exc_info.value)
        assert exc_info.value.retriable is False

    @pytest.mark.asyncio
    async def test_stream_no_api_key(self):
        provider = GroqProvider("", "test-model")
        with pytest.raises(ProviderError):
            async for _ in provider.chat_stream([{"role": "user", "content": "hi"}]):
                pass

    @pytest.mark.asyncio
    async def test_health_check_no_key(self):
        provider = GroqProvider("", "test-model")
        result = await provider.health_check()
        assert result["configured"] is False
        assert result["reachable"] is False


class TestOpenRouterProvider:
    def setup_method(self):
        self.provider = OpenRouterProvider("test-key", "test-model")

    def test_name(self):
        assert self.provider.name == "openrouter"

    def test_get_model(self):
        assert self.provider.get_model() == "test-model"

    @pytest.mark.asyncio
    async def test_chat_no_api_key(self):
        provider = OpenRouterProvider("", "test-model")
        with pytest.raises(ProviderError) as exc_info:
            await provider.chat([{"role": "user", "content": "hi"}])
        assert "not configured" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_health_check_no_key(self):
        provider = OpenRouterProvider("", "test-model")
        result = await provider.health_check()
        assert result["configured"] is False
