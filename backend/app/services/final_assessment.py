"""Final assessment: difficulty-aware coding problem generation for level progression."""
import json
import logging
import re

from app.services.llm import get_provider_router

logger = logging.getLogger(__name__)

DIFFICULTY_PROMPTS = {
    "Easy": "The problem should be straightforward, solvable in under 15 lines of Python. Use basic operations on the data structure.",
    "Medium": "The problem should require understanding of the data structure's key properties. Involve 1-2 algorithmic steps. Solvable in 15-30 lines of Python.",
    "Hard": "The problem should require deeper understanding, edge case handling, and efficient algorithm design. May involve combining multiple techniques. Solvable in 20-40 lines of Python.",
}


FINAL_PROBLEM_PROMPT = """You are a DSA coding problem generator for a final assessment. Generate exactly 1 {difficulty} Python coding problem for the given topic.

Difficulty guidance: {difficulty_detail}

The problem must:
- Read input from stdin and print output to stdout
- Have a clear problem statement with Input/Output format and examples
- Have exactly 4 test cases: 2 visible (shown to user), 2 hidden (for grading)
- Include Python starter code that is ONLY a skeleton — input reading + a TODO comment. NEVER include any solution logic.

Rules:
- The problem MUST directly test the student's understanding of the given DSA topic
- Input/output must be simple (integers, lists, strings)
- Test case expected_output must match EXACTLY what the correct solution prints
- The starter_code must ONLY read the input and have a "# TODO: solve and print result" comment

Respond with ONLY valid JSON, no markdown fences, no extra text:
{{
  "title": "Short Problem Title",
  "description": "Full problem description with Input Format, Output Format, and Examples clearly labeled.",
  "starter_code": "# Read input\\nn = int(input())\\narr = list(map(int, input().split()))\\n\\n# TODO: solve and print result\\n",
  "test_cases": [
    {{"input": "...", "expected_output": "...", "visible": true}},
    {{"input": "...", "expected_output": "...", "visible": true}},
    {{"input": "...", "expected_output": "...", "visible": false}},
    {{"input": "...", "expected_output": "...", "visible": false}}
  ]
}}"""


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


async def generate_final_problem(topic_name: str, topic_description: str, difficulty: str) -> dict:
    """Generate a coding problem at a specific difficulty level."""
    router = get_provider_router()

    difficulty_detail = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["Easy"])
    system_prompt = FINAL_PROBLEM_PROMPT.format(
        difficulty=difficulty,
        difficulty_detail=difficulty_detail,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Topic: {topic_name} — {topic_description}"},
    ]

    for attempt in range(2):
        try:
            response = await router.chat(
                messages=messages,
                tools=None,
                temperature=0.4,
                mode="fast",
            )
            data = _extract_json(response.content)
            problem = _validate_problem(data)
            logger.info(
                "Generated %s final problem '%s' for '%s' via %s",
                difficulty, problem["title"], topic_name, response.provider,
            )
            return problem
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(
                "Final problem generation attempt %d failed for '%s' (%s): %s",
                attempt + 1, topic_name, difficulty, e,
            )
            if attempt == 0:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": "Your response was not valid JSON. Please try again with ONLY valid JSON.",
                })

    logger.error("Failed to generate %s final problem for '%s' after retries", difficulty, topic_name)
    return _fallback_problem(topic_name, difficulty)


def _fallback_problem(topic_name: str, difficulty: str) -> dict:
    if difficulty == "Easy":
        return {
            "title": f"Basic {topic_name} Operation",
            "description": (
                f"Write a program that reads a list of integers and performs a basic {topic_name} operation.\n\n"
                "Input Format:\nFirst line: N (number of elements)\nSecond line: N space-separated integers\n\n"
                "Output Format:\nPrint the elements in reverse order, space-separated."
            ),
            "starter_code": "# Read input\nn = int(input())\narr = list(map(int, input().split()))\n\n# TODO: solve and print result\n",
            "test_cases": [
                {"input": "5\n1 2 3 4 5", "expected_output": "5 4 3 2 1", "visible": True},
                {"input": "3\n10 20 30", "expected_output": "30 20 10", "visible": True},
                {"input": "1\n42", "expected_output": "42", "visible": False},
                {"input": "4\n-1 0 1 2", "expected_output": "2 1 0 -1", "visible": False},
            ],
        }
    else:
        return {
            "title": f"Advanced {topic_name} Challenge",
            "description": (
                f"Write a program that processes a list using {topic_name} concepts.\n\n"
                "Input Format:\nFirst line: N (number of elements)\nSecond line: N space-separated integers\n\n"
                "Output Format:\nPrint the maximum subarray sum."
            ),
            "starter_code": "# Read input\nn = int(input())\narr = list(map(int, input().split()))\n\n# TODO: solve and print result\n",
            "test_cases": [
                {"input": "5\n-2 1 -3 4 -1", "expected_output": "4", "visible": True},
                {"input": "4\n1 2 3 4", "expected_output": "10", "visible": True},
                {"input": "3\n-1 -2 -3", "expected_output": "-1", "visible": False},
                {"input": "6\n2 -1 3 -2 5 -4", "expected_output": "7", "visible": False},
            ],
        }
