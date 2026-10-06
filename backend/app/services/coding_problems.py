import json
import logging
import re

from app.services.llm import get_provider_router

logger = logging.getLogger(__name__)

CODING_PROBLEM_PROMPT = """You are a DSA coding problem generator. Generate exactly 1 easy Python coding problem for the given topic.

The problem must:
- Read input from stdin and print output to stdout
- Be solvable in under 20 lines of Python
- Have a clear problem statement with Input/Output format and examples
- Have exactly 4 test cases: 2 visible (shown to user), 2 hidden (for grading)
- Include Python starter code that is ONLY a skeleton — input reading + a TODO comment. NEVER include any solution logic, loops, or algorithms in the starter code.

Rules:
- The problem MUST directly use the given DSA topic
- Input/output must be simple (integers, lists, strings)
- Test case expected_output must match EXACTLY what the correct solution prints (including spacing/newlines)
- Do NOT include option labels or numbering in test cases
- The starter_code must ONLY read the input and have a "# TODO: solve and print result" comment. Do NOT write ANY solution code.

Respond with ONLY valid JSON, no markdown fences, no extra text:
{
  "title": "Short Problem Title",
  "description": "Full problem description with Input Format, Output Format, and Examples clearly labeled.",
  "starter_code": "# Read input\\nn = int(input())\\narr = list(map(int, input().split()))\\n\\n# TODO: solve and print result\\n",
  "test_cases": [
    {"input": "...", "expected_output": "...", "visible": true},
    {"input": "...", "expected_output": "...", "visible": true},
    {"input": "...", "expected_output": "...", "visible": false},
    {"input": "...", "expected_output": "...", "visible": false}
  ]
}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    return json.loads(text)


def _validate_problem(data: dict) -> dict:
    for field in ("title", "description", "starter_code", "test_cases"):
        if field not in data:
            raise ValueError(f"Missing field: {field}")

    tcs = data["test_cases"]
    if not isinstance(tcs, list) or len(tcs) < 4:
        raise ValueError(f"Expected 4 test cases, got {len(tcs) if isinstance(tcs, list) else 'non-list'}")

    for i, tc in enumerate(tcs[:4]):
        if "input" not in tc or "expected_output" not in tc:
            raise ValueError(f"Test case {i+1} missing input or expected_output")
        if "visible" not in tc:
            tc["visible"] = i < 2

    return {
        "title": data["title"],
        "description": data["description"],
        "starter_code": data["starter_code"],
        "test_cases": tcs[:4],
    }


async def generate_coding_problem(topic_name: str, topic_description: str) -> dict:
    router = get_provider_router()

    messages = [
        {"role": "system", "content": CODING_PROBLEM_PROMPT},
        {"role": "user", "content": f"Topic: {topic_name} — {topic_description}"},
    ]

    for attempt in range(2):
        try:
            response = await router.chat(
                messages=messages,
                tools=None,
                temperature=0.3,
                mode="fast",
            )
            data = _extract_json(response.content)
            problem = _validate_problem(data)
            logger.info(
                "Generated coding problem '%s' for '%s' via %s",
                problem["title"], topic_name, response.provider,
            )
            return problem
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(
                "Coding problem generation attempt %d failed for '%s': %s",
                attempt + 1, topic_name, e,
            )
            if attempt == 0:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": "Your response was not valid JSON. Please try again with ONLY valid JSON.",
                })

    logger.error("Failed to generate coding problem for '%s' after retries", topic_name)
    return _fallback_problem(topic_name)


def _fallback_problem(topic_name: str) -> dict:
    return {
        "title": f"Basic {topic_name} Operation",
        "description": (
            f"Write a program that reads a list of integers from stdin and performs a basic {topic_name} operation.\n\n"
            "Input Format:\nFirst line: N (number of elements)\nSecond line: N space-separated integers\n\n"
            "Output Format:\nPrint the elements in reverse order, space-separated."
        ),
        "starter_code": (
            "# Read input\nn = int(input())\narr = list(map(int, input().split()))\n\n"
            "# TODO: Process and print result\n"
        ),
        "test_cases": [
            {"input": "5\n1 2 3 4 5", "expected_output": "5 4 3 2 1", "visible": True},
            {"input": "3\n10 20 30", "expected_output": "30 20 10", "visible": True},
            {"input": "1\n42", "expected_output": "42", "visible": False},
            {"input": "4\n-1 0 1 2", "expected_output": "2 1 0 -1", "visible": False},
        ],
    }
