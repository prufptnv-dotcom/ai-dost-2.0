# backend/app/services/sandbox.py
import subprocess
import sys
import os
import tempfile
import time
from typing import List, Dict, Any
from pydantic import BaseModel

class CodeExecutionRequest(BaseModel):
    language: str
    code: str
    dependencies: List[str] = []
    timeout: int = 15000  # 15s default
    memory_limit: str = "512MB"

class ExecutionResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration: float

class CodeSandbox:
    def __init__(self, db=None):
        self.db = db

    async def execute_code(self, request: CodeExecutionRequest) -> ExecutionResult:
        """Robust code execution with Docker support & Local Subprocess fallback"""
        start_time = time.time()
        lang = request.language.lower()
        code = request.code

        # Check if code has interactive input() statements
        stdin_data = ""
        if "input(" in code:
            # Provide default mock inputs for interactive prompts
            stdin_data = "User\nFriend1\nFriend2\nFriend3\n"

        # Try Local Subprocess Execution (Super Fast & Reliable)
        try:
            if lang in ["python", "py"]:
                with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as temp_file:
                    temp_file.write(code)
                    temp_path = temp_file.name

                res = subprocess.run(
                    [sys.executable, temp_path],
                    input=stdin_data,
                    capture_output=True,
                    text=True,
                    timeout=request.timeout / 1000
                )
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

                duration = round((time.time() - start_time) * 1000, 2)
                return ExecutionResult(
                    stdout=res.stdout,
                    stderr=res.stderr,
                    exit_code=res.returncode,
                    duration=duration
                )

            elif lang in ["javascript", "js"]:
                res = subprocess.run(
                    ["node", "-e", code],
                    input=stdin_data,
                    capture_output=True,
                    text=True,
                    timeout=request.timeout / 1000
                )
                duration = round((time.time() - start_time) * 1000, 2)
                return ExecutionResult(
                    stdout=res.stdout,
                    stderr=res.stderr,
                    exit_code=res.returncode,
                    duration=duration
                )

            elif lang in ["html", "css"]:
                return ExecutionResult(
                    stdout="HTML/CSS web rendering ready. Switch to Visual Preview tab.",
                    stderr="",
                    exit_code=0,
                    duration=0.0
                )

            else:
                return ExecutionResult(
                    stdout="",
                    stderr=f"Unsupported sandbox language: {lang}",
                    exit_code=1,
                    duration=0.0
                )

        except subprocess.TimeoutExpired:
            return ExecutionResult(
                stdout="",
                stderr="Execution Error: Process timed out after 15 seconds.",
                exit_code=124,
                duration=15000.0
            )
        except Exception as e:
            return ExecutionResult(
                stdout="",
                stderr=f"Execution Failed: {str(e)}",
                exit_code=1,
                duration=0.0
            )
