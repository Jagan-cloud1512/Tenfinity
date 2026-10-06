import json
import pytest
from app.tools.web_search import WebSearchTool
from app.tools.web_fetch import WebFetchTool, _is_valid_url
from app.tools.problems import SearchCodingProblemsTool
from app.tools.contests import SearchContestsTool
from app.tools.time_tool import GetCurrentTimeTool
from app.agent.registry import ToolRegistry, create_default_registry


def test_registry_creates_with_all_tools():
    registry = create_default_registry()
    names = registry.list_names()
    assert "search_web" in names
    assert "fetch_webpage" in names
    assert "search_coding_problems" in names
    assert "search_contests" in names
    assert "get_current_time" in names
    assert len(names) == 5


def test_registry_get_tool():
    registry = create_default_registry()
    tool = registry.get("search_web")
    assert tool is not None
    assert tool.name == "search_web"


def test_registry_get_nonexistent():
    registry = create_default_registry()
    assert registry.get("nonexistent_tool") is None


def test_openai_tool_format():
    tool = WebSearchTool()
    schema = tool.to_openai_tool()
    assert schema["type"] == "function"
    assert schema["function"]["name"] == "search_web"
    assert "parameters" in schema["function"]


def test_url_validation():
    assert _is_valid_url("https://example.com") is True
    assert _is_valid_url("http://example.com/path") is True
    assert _is_valid_url("ftp://example.com") is False
    assert _is_valid_url("not-a-url") is False
    assert _is_valid_url("") is False
    assert _is_valid_url("file:///etc/passwd") is False
    assert _is_valid_url("javascript:alert(1)") is False


@pytest.mark.asyncio
async def test_time_tool():
    tool = GetCurrentTimeTool()
    result = await tool.execute()
    data = json.loads(result)
    assert "datetime" in data
    assert "date" in data
    assert "time" in data
    assert "day_of_week" in data


@pytest.mark.asyncio
async def test_web_search_empty_query():
    tool = WebSearchTool()
    result = await tool.execute(query="")
    data = json.loads(result)
    assert "error" in data


@pytest.mark.asyncio
async def test_web_fetch_invalid_url():
    tool = WebFetchTool()
    result = await tool.execute(url="not-a-url")
    data = json.loads(result)
    assert "error" in data


@pytest.mark.asyncio
async def test_web_fetch_disallowed_scheme():
    tool = WebFetchTool()
    result = await tool.execute(url="file:///etc/passwd")
    data = json.loads(result)
    assert "error" in data


@pytest.mark.asyncio
async def test_coding_problems_empty_query():
    tool = SearchCodingProblemsTool()
    result = await tool.execute(query="")
    data = json.loads(result)
    assert "error" in data
