import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.tools.base import Tool

logger = logging.getLogger(__name__)

ALLOWED_SCHEMES = {"http", "https"}
MAX_CONTENT_LENGTH = 8000
FETCH_TIMEOUT = 15.0


def _is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)
    except Exception:
        return False


def _extract_text(html: str, max_length: int = MAX_CONTENT_LENGTH) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    if len(text) > max_length:
        text = text[:max_length] + "\n... [content truncated]"
    return text


class WebFetchTool(Tool):
    @property
    def name(self) -> str:
        return "fetch_webpage"

    @property
    def description(self) -> str:
        return (
            "Fetch and extract readable text content from a specific URL. "
            "Use this after search_web to read the full content of a promising result."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL of the webpage to fetch",
                },
            },
            "required": ["url"],
        }

    async def execute(self, **kwargs: Any) -> str:
        url = kwargs.get("url", "")
        if not url or not _is_valid_url(url):
            return json.dumps({"error": "Invalid or disallowed URL"})
        logger.info("Fetching webpage: %s", url)
        try:
            async with httpx.AsyncClient(
                timeout=FETCH_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LearningBot/1.0)"},
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            text = _extract_text(resp.text)
            return json.dumps({
                "url": url,
                "content": text,
                "status": resp.status_code,
            }, ensure_ascii=False)
        except httpx.TimeoutException:
            return json.dumps({"error": f"Timeout fetching {url}"})
        except httpx.HTTPStatusError as e:
            return json.dumps({"error": f"HTTP {e.response.status_code} for {url}"})
        except Exception as e:
            logger.error("Fetch failed for %s: %s", url, e)
            return json.dumps({"error": f"Failed to fetch {url}"})
