import json
import logging
from typing import Any

from app.tools.base import Tool
from app.services.search import search

logger = logging.getLogger(__name__)


class WebSearchTool(Tool):
    @property
    def name(self) -> str:
        return "search_web"

    @property
    def description(self) -> str:
        return (
            "Search the web for current information. Use this when the user asks about "
            "recent events, current contests, specific problems from coding platforms, "
            "or anything that requires up-to-date information not in your training data."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to look up on the web",
                },
            },
            "required": ["query"],
        }

    async def execute(self, **kwargs: Any) -> str:
        query = kwargs.get("query", "")
        if not query:
            return json.dumps({"error": "Empty search query"})
        logger.info("Searching web for: %s", query)
        results = await search(query)
        if not results:
            return json.dumps({"message": "No search results found", "results": []})
        return json.dumps({"results": results}, ensure_ascii=False)
