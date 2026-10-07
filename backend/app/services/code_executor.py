from app.config import get_settings


async def execute_code(
    source_code: str,
    language: str = "python",
    stdin: str = "",
    timeout: float = 30,
) -> dict:
    settings = get_settings()
    if settings.code_executor == "judge0":
        from app.services.judge0 import execute_code as _exec
    else:
        from app.services.piston import execute_code as _exec
    return await _exec(source_code=source_code, language=language, stdin=stdin, timeout=timeout)


async def run_against_test_cases(
    source_code: str,
    language: str,
    test_cases: list[dict],
) -> list[dict]:
    settings = get_settings()
    if settings.code_executor == "judge0":
        from app.services.judge0 import run_against_test_cases as _run
    else:
        from app.services.piston import run_against_test_cases as _run
    return await _run(source_code=source_code, language=language, test_cases=test_cases)
