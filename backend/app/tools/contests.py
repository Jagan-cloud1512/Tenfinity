import json
import logging
from typing import Any

from app.tools.base import Tool
from app.services.search import search

logger = logging.getLogger(__name__)


class SearchContestsTool(Tool):
    @property
    def name(self) -> str:
        return "search_contests"

    @property
    def description(self) -> str:
        return (
            "Search for current or upcoming competitive programming contests on platforms "
            "like Codeforces, LeetCode, AtCoder, HackerRank, and others. Use this when the "
            "user asks about upcoming contests, ongoing competitions, or contest schedules."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "description": "Optional: filter by platform (codeforces, leetcode, atcoder, hackerrank)",
                },
            },
            "required": [],
        }

    async def execute(self, **kwargs: Any) -> str:
        platform = kwargs.get("platform", "")

        if platform:
            query = f"upcoming {platform} programming contests 2026"
        else:
            query = "upcoming competitive programming contests 2026 codeforces leetcode atcoder"

        logger.info("Searching contests: %s", query)
        results = await search(query, max_results=10)

        contests = []
        for r in results:
            contests.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("snippet", ""),
            })

        return json.dumps({"contests": contests}, ensure_ascii=False)
