import pytest
from unittest.mock import AsyncMock, MagicMock

from app.providers.base import LLMProvider, ProviderError, ProviderResponse
from app.agent.router import ProviderRouter


def _make_mock_provider(name: str, should_fail: bool = False, latency: float = 100):
    provider = MagicMock(spec=LLMProvider)
    provider.name = name
    provider.get_model.return_value = f"{name}-model"

    if should_fail:
        provider.chat = AsyncMock(side_effect=ProviderError(name, "test failure"))
        provider.chat_stream = AsyncMock(side_effect=ProviderError(name, "test failure"))
    else:
        resp = ProviderResponse(
            content="hello",
            provider=name,
            model=f"{name}-model",
            latency_ms=latency,
        )
        provider.chat = AsyncMock(return_value=resp)

    provider.health_check = AsyncMock(return_value={
        "provider": name,
        "reachable": not should_fail,
        "latency_ms": latency if not should_fail else None,
    })

    return provider


class TestProviderRouter:
    def test_list_providers(self):
        p1 = _make_mock_provider("groq")
        p2 = _make_mock_provider("ollama")
        router = ProviderRouter({"groq": p1, "ollama": p2}, ["groq", "ollama"])
        assert set(router.list_providers()) == {"groq", "ollama"}

    def test_get_provider(self):
        p1 = _make_mock_provider("groq")
        router = ProviderRouter({"groq": p1}, ["groq"])
        assert router.get_provider("groq") == p1
        assert router.get_provider("nonexistent") is None

    @pytest.mark.asyncio
    async def test_chat_uses_first_available(self):
        groq = _make_mock_provider("groq")
        ollama = _make_mock_provider("ollama")
        router = ProviderRouter({"groq": groq, "ollama": ollama}, ["groq", "ollama"])

        result = await router.chat([{"role": "user", "content": "hi"}], mode="auto")
        assert result.provider == "groq"
        groq.chat.assert_called_once()
        ollama.chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_chat_falls_back_on_failure(self):
        groq = _make_mock_provider("groq", should_fail=True)
        ollama = _make_mock_provider("ollama")
        router = ProviderRouter({"groq": groq, "ollama": ollama}, ["groq", "ollama"])

        result = await router.chat([{"role": "user", "content": "hi"}], mode="auto")
        assert result.provider == "ollama"

    @pytest.mark.asyncio
    async def test_chat_all_fail(self):
        groq = _make_mock_provider("groq", should_fail=True)
        ollama = _make_mock_provider("ollama", should_fail=True)
        router = ProviderRouter({"groq": groq, "ollama": ollama}, ["groq", "ollama"])

        with pytest.raises(ProviderError) as exc_info:
            await router.chat([{"role": "user", "content": "hi"}], mode="auto")
        assert "All providers failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_specific_provider_mode(self):
        groq = _make_mock_provider("groq")
        ollama = _make_mock_provider("ollama")
        router = ProviderRouter({"groq": groq, "ollama": ollama}, ["groq", "ollama"])

        result = await router.chat([{"role": "user", "content": "hi"}], mode="ollama")
        assert result.provider == "ollama"
        groq.chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_health_check_all(self):
        groq = _make_mock_provider("groq")
        ollama = _make_mock_provider("ollama")
        router = ProviderRouter({"groq": groq, "ollama": ollama}, ["groq", "ollama"])

        results = await router.check_all_health()
        assert "groq" in results
        assert "ollama" in results
        assert results["groq"]["reachable"] is True

    def test_ordering_fast_mode(self):
        groq = _make_mock_provider("groq")
        ollama = _make_mock_provider("ollama")
        openrouter = _make_mock_provider("openrouter")
        router = ProviderRouter(
            {"groq": groq, "ollama": ollama, "openrouter": openrouter},
            ["groq", "openrouter", "ollama"],
        )
        order = router._get_ordered_providers("fast")
        assert order == ["groq", "openrouter", "ollama"]

    def test_ordering_local_mode(self):
        groq = _make_mock_provider("groq")
        ollama = _make_mock_provider("ollama")
        openrouter = _make_mock_provider("openrouter")
        router = ProviderRouter(
            {"groq": groq, "ollama": ollama, "openrouter": openrouter},
            ["groq", "openrouter", "ollama"],
        )
        order = router._get_ordered_providers("local")
        assert order[0] == "ollama"
