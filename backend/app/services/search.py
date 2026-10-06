import asyncio
import logging
from typing import Any

from duckduckgo_search import DDGS

from app.config import get_settings

logger = logging.getLogger(__name__)

MAX_RESULTS = 8


async def search(query: str, max_results: int = MAX_RESULTS) -> list[dict[str, Any]]:
    settings = get_settings()
    if settings.search_backend == "duckduckgo":
        return await _search_ddg(query, max_results)
    elif settings.search_backend == "searxng":
        return await _search_searxng(query, max_results)
    else:
        raise ValueError(f"Unknown search backend: {settings.search_backend}")


def _ddg_sync(query: str, max_results: int) -> list[dict[str, Any]]:
    with DDGS() as ddgs:
        raw = list(ddgs.text(query, max_results=max_results))
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("href", ""),
            "snippet": r.get("body", ""),
        }
        for r in raw
    ]


async def _search_ddg(query: str, max_results: int) -> list[dict[str, Any]]:
    try:
        return await asyncio.to_thread(_ddg_sync, query, max_results)
    except Exception as e:
        logger.error("DuckDuckGo search failed: %s", e)
        return []


async def _search_searxng(query: str, max_results: int) -> list[dict[str, Any]]:
    import httpx

    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.searxng_base_url}/search",
                params={"q": query, "format": "json", "categories": "general"},
            )
            resp.raise_for_status()
            data = resp.json()
        results = []
        for r in data.get("results", [])[:max_results]:
            results.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", ""),
            })
        return results
    except Exception as e:
        logger.error("SearXNG search failed: %s", e)
        return []
