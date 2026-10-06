import json
import logging
import re
from typing import Any, AsyncIterator

from app.agent.prompts import DSA_DOUBT_PROMPT, SYSTEM_PROMPT
from app.agent.registry import ToolRegistry
from app.agent.router import ProviderRouter
from app.providers.base import ProviderError

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5


def _strip_thinking_tags(text: str, strip_whitespace: bool = True) -> str:
    result = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return result.strip() if strip_whitespace else result


def _format_tool_messages(
    provider: str,
    round_num: int,
    tool_calls: list[dict[str, Any]],
    content: str,
) -> tuple[dict[str, Any], list[tuple[str, dict]]]:
    """Build assistant + tool-result message skeletons per provider format."""
    if provider == "ollama":
        assistant_msg: dict[str, Any] = {
            "role": "assistant",
            "content": content or "",
            "tool_calls": [
                {"function": {"name": tc["name"], "arguments": tc["arguments"]}}
                for tc in tool_calls
            ],
        }
        tool_msg_template = lambda i, tc: {"role": "tool", "content": ""}  # noqa: E731
    else:
        assistant_msg = {
            "role": "assistant",
            "content": content or "",
            "tool_calls": [
                {
                    "id": f"call_{round_num}_{i}",
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]),
                    },
                }
                for i, tc in enumerate(tool_calls)
            ],
        }
        tool_msg_template = lambda i, tc: {  # noqa: E731
            "role": "tool",
            "tool_call_id": f"call_{round_num}_{i}",
            "content": "",
        }

    tool_templates = [(tc["name"], tool_msg_template(i, tc)) for i, tc in enumerate(tool_calls)]
    return assistant_msg, tool_templates


class AgentOrchestrator:
    def __init__(self, registry: ToolRegistry, router: ProviderRouter) -> None:
        self.registry = registry
        self.router = router

    def _build_messages(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]],
        mode: str = "auto",
    ) -> list[dict[str, Any]]:
        prompt = DSA_DOUBT_PROMPT if mode == "doubt" else SYSTEM_PROMPT
        messages = [{"role": "system", "content": prompt}]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_message})
        return messages

    def _collect_sources(self, tool_name: str, tool_result: str, sources: list, search_performed_ref: list):
        if tool_name in ("search_web", "search_coding_problems", "search_contests"):
            search_performed_ref[0] = True
            try:
                parsed = json.loads(tool_result)
                for item in (
                    parsed.get("results", [])
                    + parsed.get("problems", [])
                    + parsed.get("contests", [])
                ):
                    if item.get("url"):
                        sources.append({
                            "title": item.get("title", ""),
                            "url": item["url"],
                        })
            except (json.JSONDecodeError, AttributeError):
                pass

    async def _execute_tool(self, tool_name: str, tool_args: dict) -> tuple[str, str]:
        tool = self.registry.get(tool_name)
        if not tool:
            return json.dumps({"error": f"Unknown tool: {tool_name}"}), ""
        try:
            result = await tool.execute(**tool_args)
            return result, tool_name
        except Exception as e:
            logger.error("Tool %s failed: %s", tool_name, e)
            return json.dumps({"error": f"Tool execution failed: {str(e)}"}), ""

    async def run(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]],
        mode: str = "auto",
    ) -> dict[str, Any]:
        messages = self._build_messages(user_message, conversation_history, mode=mode)

        tools_used: list[str] = []
        sources: list[dict[str, Any]] = []
        search_performed = [False]
        provider_used = ""
        model_used = ""

        use_tools = mode not in ("doubt",)
        openai_tools = self.registry.get_openai_tools() if use_tools else []
        max_rounds = MAX_TOOL_ROUNDS if use_tools else 1

        for round_num in range(max_rounds):
            logger.info("Agent round %d", round_num + 1)

            response = await self.router.chat(
                messages=messages,
                tools=openai_tools if (use_tools and round_num < max_rounds - 1) else None,
                mode=mode,
            )

            provider_used = response.provider
            model_used = response.model

            if not response.tool_calls:
                content = _strip_thinking_tags(response.content)
                return {
                    "answer": content,
                    "sources": sources,
                    "tools_used": tools_used,
                    "search_performed": search_performed[0],
                    "provider": provider_used,
                    "model": model_used,
                }

            assistant_msg, tool_templates = _format_tool_messages(
                provider_used, round_num, response.tool_calls, response.content,
            )
            messages.append(assistant_msg)

            for tool_name, tool_tmpl in tool_templates:
                tc = next(tc for tc in response.tool_calls if tc["name"] == tool_name)
                tool_args = tc["arguments"]

                logger.info("Tool call: %s(%s)", tool_name, json.dumps(tool_args))
                tool_result, executed_name = await self._execute_tool(tool_name, tool_args)

                if executed_name:
                    tools_used.append(executed_name)
                    self._collect_sources(tool_name, tool_result, sources, search_performed)

                tool_tmpl["content"] = tool_result
                messages.append(tool_tmpl)

        return {
            "answer": "I was unable to complete the request within the allowed number of steps. Please try rephrasing your question.",
            "sources": sources,
            "tools_used": tools_used,
            "search_performed": search_performed[0],
            "provider": provider_used,
            "model": model_used,
        }

    async def run_stream(
        self,
        user_message: str,
        conversation_history: list[dict[str, str]],
        mode: str = "auto",
    ) -> AsyncIterator[dict[str, Any]]:
        messages = self._build_messages(user_message, conversation_history, mode=mode)

        tools_used: list[str] = []
        sources: list[dict[str, Any]] = []
        search_performed = [False]
        use_tools = mode not in ("doubt",)
        openai_tools = self.registry.get_openai_tools() if use_tools else []
        max_rounds = MAX_TOOL_ROUNDS if use_tools else 1

        for round_num in range(max_rounds):
            logger.info("Stream agent round %d", round_num + 1)

            try:
                provider_name, stream = await self.router.chat_stream(
                    messages=messages,
                    tools=openai_tools if (use_tools and round_num < max_rounds - 1) else None,
                    mode=mode,
                )
            except ProviderError as e:
                yield {"type": "error", "error": str(e)}
                return

            provider_obj = self.router.get_provider(provider_name)
            model_name = provider_obj.get_model() if provider_obj else "unknown"

            if round_num == 0:
                yield {
                    "type": "provider",
                    "provider": provider_name,
                    "model": model_name,
                }

            full_content = ""
            tool_calls_data = None

            try:
                async for chunk in stream:
                    if chunk.startswith("{") and '"type": "tool_calls"' in chunk:
                        try:
                            tool_calls_data = json.loads(chunk)
                        except json.JSONDecodeError:
                            pass
                        continue

                    cleaned = _strip_thinking_tags(chunk, strip_whitespace=False)
                    if cleaned:
                        full_content += cleaned
                        yield {"type": "token", "content": cleaned}
            except ProviderError as e:
                yield {"type": "error", "error": str(e)}
                return

            if not tool_calls_data or not tool_calls_data.get("tool_calls"):
                yield {
                    "type": "done",
                    "sources": sources,
                    "tools_used": tools_used,
                    "search_performed": search_performed[0],
                    "provider": provider_name,
                    "model": model_name,
                }
                return

            tc_list = tool_calls_data["tool_calls"]
            assistant_msg, tool_templates = _format_tool_messages(
                provider_name, round_num, tc_list, full_content,
            )
            messages.append(assistant_msg)

            for (tool_name, tool_tmpl), tc in zip(tool_templates, tc_list):
                tool_args = tc["arguments"]

                yield {"type": "tool_start", "tool": tool_name, "args": tool_args}

                tool_result, executed_name = await self._execute_tool(tool_name, tool_args)

                if executed_name:
                    tools_used.append(executed_name)
                    self._collect_sources(tool_name, tool_result, sources, search_performed)

                tool_tmpl["content"] = tool_result
                messages.append(tool_tmpl)

                yield {"type": "tool_done", "tool": tool_name}

        yield {
            "type": "done",
            "answer": "I was unable to complete the request within the allowed number of steps.",
            "sources": sources,
            "tools_used": tools_used,
            "search_performed": search_performed[0],
        }
