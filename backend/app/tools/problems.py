import json
import logging
from typing import Any

from app.tools.base import Tool
from app.services.search import search

logger = logging.getLogger(__name__)

PLATFORM_DOMAINS = {
    "leetcode": "leetcode.com",
    "codeforces": "codeforces.com",
    "atcoder": "atcoder.jp",
    "hackerrank": "hackerrank.com",
    "geeksforgeeks": "geeksforgeeks.org",
}


class SearchCodingProblemsTool(Tool):
    @property
    def name(self) -> str:
        return "search_coding_problems"

    @property
    def description(self) -> str:
        return (
            "Search for coding practice problems from platforms like LeetCode, Codeforces, "
            "AtCoder, HackerRank, and GeeksforGeeks. Use this when the user asks for "
            "practice problems, problem recommendations, or problems on specific topics."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Topic or keyword for the problems (e.g. 'binary search', 'arrays', 'dynamic programming')",
                },
                "platform": {
                    "type": "string",
                    "description": "The platform to search on: leetcode, codeforces, atcoder, hackerrank, geeksforgeeks",
                    "enum": ["leetcode", "codeforces", "atcoder", "hackerrank", "geeksforgeeks"],
                },
                "difficulty": {
                    "type": "string",
                    "description": "Difficulty level: easy, medium, hard",
                    "enum": ["easy", "medium", "hard"],
                },
            },
            "required": ["query"],
        }

    async def execute(self, **kwargs: Any) -> str:
        query = kwargs.get("query", "")
        platform = kwargs.get("platform", "")
        difficulty = kwargs.get("difficulty", "")

        if not query:
            return json.dumps({"error": "Empty query"})

        search_parts = [query, "coding problems"]
        if platform:
            domain = PLATFORM_DOMAINS.get(platform, platform)
            search_parts.append(f"site:{domain}")
        if difficulty:
            search_parts.append(difficulty)

        search_query = " ".join(search_parts)
        logger.info("Searching coding problems: %s", search_query)

        results = await search(search_query, max_results=10)

        problems = []
        for r in results:
            url = r.get("url", "")
            detected_platform = "unknown"
            for pname, domain in PLATFORM_DOMAINS.items():
                if domain in url:
                    detected_platform = pname
                    break
            problems.append({
                "title": r.get("title", ""),
                "url": url,
                "platform": detected_platform,
                "snippet": r.get("snippet", ""),
                "difficulty": difficulty if difficulty else "unknown",
            })

        return json.dumps({"problems": problems}, ensure_ascii=False)
