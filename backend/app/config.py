from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:latest"

    # Groq
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.1-8b-instruct:free"

    # Provider routing
    default_mode: str = "auto"
    provider_priority: str = "groq,openrouter,ollama"

    # Search
    search_backend: str = "duckduckgo"
    searxng_base_url: str = "http://localhost:8080"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Judge0
    judge0_url: str = "http://localhost:2358"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    frontend_url: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
