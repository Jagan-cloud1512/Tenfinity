import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

LANGUAGE_IDS = {
    "python": 71,
    "c": 50,
    "cpp": 54,
}


async def execute_code(
    source_code: str,
    language: str = "python",
    stdin: str = "",
    timeout: float = 30,
) -> dict:
    settings = get_settings()
    lang_id = LANGUAGE_IDS.get(language, 71)

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{settings.judge0_url}/submissions?base64_encoded=false&wait=true",
            json={
                "source_code": source_code,
                "language_id": lang_id,
                "stdin": stdin,
                "memory_limit": 512000,
                "cpu_time_limit": 10,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    status = data.get("status", {})
    return {
        "stdout": (data.get("stdout") or "").rstrip(),
        "stderr": data.get("stderr") or "",
        "compile_output": data.get("compile_output") or "",
        "status_id": status.get("id", 0),
        "status_description": status.get("description", ""),
        "time": data.get("time"),
        "memory": data.get("memory"),
    }


async def run_against_test_cases(
    source_code: str,
    language: str,
    test_cases: list[dict],
) -> list[dict]:
    results = []
    for tc in test_cases:
        try:
            result = await execute_code(
                source_code=source_code,
                language=language,
                stdin=tc["input"],
            )
            actual = result["stdout"]
            expected = tc["expected_output"].strip()
            passed = actual == expected

            if result["status_id"] == 6:
                results.append({
                    "input": tc["input"],
                    "expected_output": expected,
                    "actual_output": result["compile_output"],
                    "passed": False,
                    "error": "Compilation Error",
                    "time": result["time"],
                    "memory": result["memory"],
                })
            elif result["status_id"] >= 7:
                results.append({
                    "input": tc["input"],
                    "expected_output": expected,
                    "actual_output": result["stderr"] or result["status_description"],
                    "passed": False,
                    "error": result["status_description"],
                    "time": result["time"],
                    "memory": result["memory"],
                })
            else:
                results.append({
                    "input": tc["input"],
                    "expected_output": expected,
                    "actual_output": actual,
                    "passed": passed,
                    "error": None,
                    "time": result["time"],
                    "memory": result["memory"],
                })
        except Exception as e:
            logger.error("Judge0 execution failed: %s", e)
            results.append({
                "input": tc["input"],
                "expected_output": tc["expected_output"].strip(),
                "actual_output": "",
                "passed": False,
                "error": f"Execution error: {e}",
                "time": None,
                "memory": None,
            })
    return results
