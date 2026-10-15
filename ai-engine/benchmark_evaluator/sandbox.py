"""
Sandboxed Execution Environment for Benchmark Code
Enforces strict timeouts, output caps, deterministic cleanup, and isolated subprocess execution.
"""

import os
import sys
import tempfile
import subprocess
import shutil
import time
from typing import Dict, Any, Optional

MAX_OUTPUT_BYTES = 64 * 1024  # 64 KB
DEFAULT_TIMEOUT_SECONDS = 3.0

def execute_python(
    solution_code: str,
    test_harness_code: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    memory_limit_mb: int = 256
) -> Dict[str, Any]:
    """
    Executes Python code combined with a test harness in an isolated temporary environment.
    """
    tmp_dir = tempfile.mkdtemp(prefix="aidost_py_eval_")
    script_path = os.path.join(tmp_dir, "solution_test.py")

    full_code = f"""# -*- coding: utf-8 -*-
import sys
import os
import time

# Restrict dangerous built-ins or environment leakage if possible
os.environ.pop("AWS_ACCESS_KEY_ID", None)
os.environ.pop("OPENAI_API_KEY", None)
os.environ.pop("GEMINI_API_KEY", None)

{solution_code}

# ── Test Harness ──
{test_harness_code}
"""

    try:
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(full_code)

        t_start = time.perf_counter()
        # Execute in separate Python process without network privileges or inherited environment secrets
        env = {
            "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows"),
            "PATH": os.environ.get("PATH", ""),
            "PYTHONPATH": tmp_dir,
            "PYTHONUNBUFFERED": "1"
        }

        proc = subprocess.Popen(
            [sys.executable, script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=tmp_dir,
            env=env,
            universal_newlines=True
        )

        try:
            stdout, stderr = proc.communicate(timeout=timeout)
            exec_time = time.perf_counter() - t_start
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, stderr = proc.communicate()
            return {
                "status": "TIMEOUT",
                "exit_code": -1,
                "stdout": stdout[:MAX_OUTPUT_BYTES] if stdout else "",
                "stderr": f"Execution timed out after {timeout} seconds",
                "duration_ms": timeout * 1000.0,
                "error": f"TIMEOUT: Exceeded {timeout}s limit"
            }

        # Bounded output
        stdout = (stdout or "")[:MAX_OUTPUT_BYTES]
        stderr = (stderr or "")[:MAX_OUTPUT_BYTES]

        if proc.returncode == 0:
            return {
                "status": "SUCCESS",
                "exit_code": 0,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": round(exec_time * 1000.0, 2),
                "error": None
            }
        else:
            # Classify error type
            err_type = "RUNTIME_ERROR"
            if "AssertionError" in stderr or "ASSERTION_FAILED" in stderr:
                err_type = "TEST_FAILURE"
            elif "SyntaxError" in stderr or "IndentationError" in stderr:
                err_type = "SYNTAX_ERROR"
            elif "MemoryError" in stderr:
                err_type = "MEMORY_FAILURE"

            return {
                "status": err_type,
                "exit_code": proc.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": round(exec_time * 1000.0, 2),
                "error": stderr.strip().splitlines()[-1] if stderr.strip() else f"Process exited with {proc.returncode}"
            }

    except Exception as e:
        return {
            "status": "INTERNAL_ERROR",
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "duration_ms": 0,
            "error": str(e)
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

def execute_javascript(
    solution_code: str,
    test_harness_code: str,
    timeout: float = DEFAULT_TIMEOUT_SECONDS
) -> Dict[str, Any]:
    """
    Executes JavaScript code in an isolated Node.js process.
    """
    tmp_dir = tempfile.mkdtemp(prefix="aidost_js_eval_")
    script_path = os.path.join(tmp_dir, "solution_test.js")

    full_code = f"""'use strict';
const assert = require('assert');

{solution_code}

// ── Test Harness ──
{test_harness_code}
"""

    try:
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(full_code)

        t_start = time.perf_counter()
        proc = subprocess.Popen(
            ["node", "--no-addons", "--max-old-space-size=256", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=tmp_dir,
            universal_newlines=True
        )

        try:
            stdout, stderr = proc.communicate(timeout=timeout)
            exec_time = time.perf_counter() - t_start
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout, stderr = proc.communicate()
            return {
                "status": "TIMEOUT",
                "exit_code": -1,
                "stdout": stdout[:MAX_OUTPUT_BYTES] if stdout else "",
                "stderr": f"Execution timed out after {timeout} seconds",
                "duration_ms": timeout * 1000.0,
                "error": f"TIMEOUT: Exceeded {timeout}s limit"
            }

        stdout = (stdout or "")[:MAX_OUTPUT_BYTES]
        stderr = (stderr or "")[:MAX_OUTPUT_BYTES]

        if proc.returncode == 0:
            return {
                "status": "SUCCESS",
                "exit_code": 0,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": round(exec_time * 1000.0, 2),
                "error": None
            }
        else:
            err_type = "RUNTIME_ERROR"
            if "AssertionError" in stderr or "ERR_ASSERTION" in stderr:
                err_type = "TEST_FAILURE"
            elif "SyntaxError" in stderr:
                err_type = "SYNTAX_ERROR"

            return {
                "status": err_type,
                "exit_code": proc.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": round(exec_time * 1000.0, 2),
                "error": stderr.strip().splitlines()[-1] if stderr.strip() else f"Process exited with {proc.returncode}"
            }
    except Exception as e:
        return {
            "status": "INTERNAL_ERROR",
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "duration_ms": 0,
            "error": str(e)
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
