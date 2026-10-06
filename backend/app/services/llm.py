from functools import lru_cache

from app.agent.router import ProviderRouter
from app.config import get_settings
from app.providers import OllamaProvider, GroqProvider, OpenRouterProvider


@lru_cache
def get_provider_router() -> ProviderRouter:
    settings = get_settings()
    providers = {
        "ollama": OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
        ),
        "groq": GroqProvider(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
        ),
        "openrouter": OpenRouterProvider(
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
        ),
    }
    priority = [p.strip() for p in settings.provider_priority.split(",") if p.strip()]
    return ProviderRouter(providers=providers, priority=priority)
