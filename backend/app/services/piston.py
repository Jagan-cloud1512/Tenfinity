import asyncio
import logging
import os
import sys
import tempfile

logger = logging.getLogger(__name__)

LANGUAGES = {
    "python": {
        "ext": "py",
        "compile": None,
        "run": [sys.executable, "-I", "{file}"],
    },
    "c": {
        "ext": "c",
        "compile": ["gcc", "-o", "{out}", "-lm", "{file}"],
        "run": ["{out}"],
    },
    "cpp": {
        "ext": "cpp",
        "compile": ["g++", "-o", "{out}", "-lm", "{file}"],
        "run": ["{out}"],
    },
}


async def execute_code(
    source_code: str,
    language: str = "python",
    stdin: str = "",
    timeout: float = 10,
) -> dict:
    config = LANGUAGES.get(language, LANGUAGES["python"])

    with tempfile.TemporaryDirectory() as tmpdir:
        src_file = os.path.join(tmpdir, f"main.{config['ext']}")
        out_file = os.path.join(tmpdir, "main.out")

        with open(src_file, "w") as f:
            f.write(source_code)

        if config["compile"]:
            cmd = [
                c.replace("{file}", src_file).replace("{out}", out_file)
                for c in config["compile"]
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return _result("", "", "Compilation timed out", 6, "Compilation Error")

            if proc.returncode != 0:
                return _result("", "", stderr.decode(errors="replace"), 6, "Compilation Error")

            run_cmd = [c.replace("{out}", out_file) for c in config["run"]]
        else:
            run_cmd = [c.replace("{file}", src_file) for c in config["run"]]

        proc = await asyncio.create_subprocess_exec(
            *run_cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=tmpdir,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=stdin.encode()),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return _result("", "Time Limit Exceeded", "", 9, "Time Limit Exceeded")

        stdout_str = stdout.decode(errors="replace").rstrip()
        stderr_str = stderr.decode(errors="replace")

        if proc.returncode != 0:
            return _result(stdout_str, stderr_str, "", 11, "Runtime Error (NZEC)")

        return _result(stdout_str, stderr_str, "", 3, "Accepted")


def _result(stdout, stderr, compile_output, status_id, status_description):
    return {
        "stdout": stdout,
        "stderr": stderr,
        "compile_output": compile_output,
        "status_id": status_id,
        "status_description": status_description,
        "time": None,
        "memory": None,
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
            logger.error("Code execution failed: %s", e)
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
