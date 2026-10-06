import logging
from typing import Any

from app.tools.base import Tool

logger = logging.getLogger(__name__)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool
        logger.info("Registered tool: %s", tool.name)

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def get_all(self) -> list[Tool]:
        return list(self._tools.values())

    def get_openai_tools(self) -> list[dict[str, Any]]:
        return [tool.to_openai_tool() for tool in self._tools.values()]

    def list_names(self) -> list[str]:
        return list(self._tools.keys())


def create_default_registry() -> ToolRegistry:
    from app.tools.web_search import WebSearchTool
    from app.tools.web_fetch import WebFetchTool
    from app.tools.problems import SearchCodingProblemsTool
    from app.tools.contests import SearchContestsTool
    from app.tools.time_tool import GetCurrentTimeTool

    registry = ToolRegistry()
    registry.register(WebSearchTool())
    registry.register(WebFetchTool())
    registry.register(SearchCodingProblemsTool())
    registry.register(SearchContestsTool())
    registry.register(GetCurrentTimeTool())
    return registry
