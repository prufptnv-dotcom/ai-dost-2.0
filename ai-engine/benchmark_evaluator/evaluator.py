"""
Unified Versioned Benchmark Evaluator (v2.0.0-verified)
Accurately assesses AI model responses using sandboxed test execution,
AST inspection, independent oracles, and calibrated domain rubrics.
"""

import os
import sys
import platform
import subprocess
import ast
from typing import Dict, Any, Optional

from .sandbox import execute_python, execute_javascript
from .code_extractor import get_executable_code, has_placeholders
from .oracle_verifier import AlgorithmOracleRegistry
from .rubric_evaluator import evaluate_rubric

EVALUATOR_VERSION = "2.0.0-verified"
DATASET_VERSION = "1.0.0"

def get_git_revision() -> str:
    try:
        rev = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            universal_newlines=True
        ).strip()
        return rev
    except Exception:
        return "unknown"

def evaluate_response_verified(
    item: Dict[str, Any],
    reply: str,
    latency_s: float,
    model_id: str = "unknown"
) -> Dict[str, Any]:
    """
    Main evaluation entry point. Returns verified structured report.
    """
    qid = item.get("qid", "")
    cat = item.get("cat", "")
    prompt = item.get("prompt", "")
    diff = item.get("diff", "Medium")

    oracle_spec = AlgorithmOracleRegistry.get_verifier(qid, prompt)
    is_coding_request = oracle_spec is not None or any(
        kw in prompt.lower() for kw in [
            "write a python", "implement", "write a javascript", "function", "write sql", "write code"
        ]
    )

    git_rev = get_git_revision()
    env_info = {
        "os": platform.platform(),
        "python": platform.python_version(),
        "processor": platform.processor() or "unknown"
    }

    base_record = {
        "qid": qid,
        "cat": cat,
        "diff": diff,
        "prompt": prompt,
        "evaluator_version": EVALUATOR_VERSION,
        "dataset_version": DATASET_VERSION,
        "git_revision": git_rev,
        "model_id": model_id,
        "environment": env_info,
        "latency_s": round(latency_s, 2),
    }

    # ── CASE 1: Executable Coding Evaluation with Specific Oracle ──
    if oracle_spec:
        lang = oracle_spec.get("lang", "python")
        extracted = get_executable_code(reply, preferred_lang=lang)

        if not extracted["has_code"]:
            return {
                **base_record,
                "is_executable": True,
                "score": 0,
                "pass_fail": "FAIL",
                "status": "NO_CODE_FOUND",
                "failure_type": "NO_CODE",
                "evaluator_note": "Expected working code implementation, but no code block was provided",
                "tests_passed": 0,
                "tests_failed": 1
            }

        code = extracted["code"]

        # Check completeness / placeholders
        if extracted["is_incomplete"]:
            return {
                **base_record,
                "is_executable": True,
                "score": 1,
                "pass_fail": "FAIL",
                "status": "INCOMPLETE_IMPLEMENTATION",
                "failure_type": "INCOMPLETE_CODE",
                "evaluator_note": f"Code is incomplete or contains placeholder stub: {extracted.get('placeholder_warning')}",
                "tests_passed": 0,
                "tests_failed": 1
            }

        # Check AST constraints if specified (e.g. no slicing)
        if lang == "python" and oracle_spec.get("ast_checks"):
            try:
                tree = ast.parse(code)
                for check in oracle_spec["ast_checks"]:
                    if not check["check"](tree):
                        return {
                            **base_record,
                            "is_executable": True,
                            "score": 2,
                            "pass_fail": "FAIL",
                            "status": "RULE_VIOLATION",
                            "failure_type": "AST_CONSTRAINT_FAILED",
                            "evaluator_note": check["failure_message"],
                            "tests_passed": 0,
                            "tests_failed": 1
                        }
            except SyntaxError as e:
                return {
                    **base_record,
                    "is_executable": True,
                    "score": 1,
                    "pass_fail": "FAIL",
                    "status": "SYNTAX_ERROR",
                    "failure_type": "SYNTAX_ERROR",
                    "evaluator_note": f"SyntaxError parsing code: {str(e)}",
                    "tests_passed": 0,
                    "tests_failed": 1
                }

        # Execute in Sandbox
        harness = oracle_spec["harness"]
        if lang == "python":
            exec_res = execute_python(code, harness, timeout=4.0)
        else:
            exec_res = execute_javascript(code, harness, timeout=4.0)

        if exec_res["status"] == "SUCCESS" and "ALL_TESTS_PASSED" in exec_res["stdout"]:
            return {
                **base_record,
                "is_executable": True,
                "score": 10,
                "pass_fail": "PASS",
                "status": "VERIFIED_PASS",
                "failure_type": None,
                "evaluator_note": f"Verified: All public, hidden, and property test cases passed in {exec_res['duration_ms']}ms",
                "execution_duration_ms": exec_res["duration_ms"],
                "tests_passed": 1,
                "tests_failed": 0
            }
        else:
            status = exec_res["status"]
            error_msg = exec_res.get("error") or "Test assertion failed"
            return {
                **base_record,
                "is_executable": True,
                "score": 2 if status == "TEST_FAILURE" else 1,
                "pass_fail": "FAIL",
                "status": status,
                "failure_type": status,
                "evaluator_note": f"Execution failed ({status}): {error_msg}",
                "execution_duration_ms": exec_res.get("duration_ms", 0),
                "tests_passed": 0,
                "tests_failed": 1
            }

    # ── CASE 2: General Coding Question (No dedicated oracle, but has code) ──
    elif is_coding_request and ("```" in reply or "def " in reply or "function " in reply):
        extracted = get_executable_code(reply)
        code = extracted["code"]

        if extracted["is_incomplete"]:
            return {
                **base_record,
                "is_executable": True,
                "score": 2,
                "pass_fail": "FAIL",
                "status": "INCOMPLETE_IMPLEMENTATION",
                "failure_type": "INCOMPLETE_CODE",
                "evaluator_note": f"Code contains unfinished placeholders: {extracted.get('placeholder_warning')}",
                "tests_passed": 0,
                "tests_failed": 1
            }

        # Validate syntax
        if extracted["lang"] == "python":
            try:
                ast.parse(code)
                syntax_ok = True
                syntax_err = None
            except SyntaxError as e:
                syntax_ok = False
                syntax_err = str(e)

            if not syntax_ok:
                return {
                    **base_record,
                    "is_executable": True,
                    "score": 1,
                    "pass_fail": "FAIL",
                    "status": "SYNTAX_ERROR",
                    "failure_type": "SYNTAX_ERROR",
                    "evaluator_note": f"SyntaxError in generated Python code: {syntax_err}",
                    "tests_passed": 0,
                    "tests_failed": 1
                }

            # Run in sandbox with clean harness to check for runtime errors upon import/definition
            exec_res = execute_python(code, "# Smoke test\nprint('SYNTAX_AND_EXECUTION_SMOKE_PASS')", timeout=3.0)
            if exec_res["status"] == "SUCCESS":
                return {
                    **base_record,
                    "is_executable": True,
                    "score": 8,
                    "pass_fail": "PASS",
                    "status": "CODE_VALIDATED_SMOKE_PASS",
                    "failure_type": None,
                    "evaluator_note": "Syntactically valid and executes without error (no specific oracle suite)",
                    "execution_duration_ms": exec_res["duration_ms"],
                    "tests_passed": 1,
                    "tests_failed": 0
                }
            else:
                return {
                    **base_record,
                    "is_executable": True,
                    "score": 2,
                    "pass_fail": "FAIL",
                    "status": exec_res["status"],
                    "failure_type": exec_res["status"],
                    "evaluator_note": f"Runtime error in code: {exec_res.get('error')}",
                    "execution_duration_ms": exec_res.get("duration_ms", 0),
                    "tests_passed": 0,
                    "tests_failed": 1
                }

    # ── CASE 3: Non-Executable Knowledge / Reasoning Evaluation ──
    rubric_res = evaluate_rubric(item, reply)
    return {
        **base_record,
        "is_executable": False,
        "score": rubric_res["score"],
        "pass_fail": rubric_res["pass_fail"],
        "status": "NON_EXECUTABLE_RUBRIC_" + rubric_res["pass_fail"],
        "failure_type": None if rubric_res["pass_fail"] == "PASS" else "RUBRIC_CRITERIA_UNMET",
        "evaluator_note": rubric_res["eval_note"],
        "criteria_met": rubric_res.get("criteria_met", []),
        "tests_passed": 1 if rubric_res["pass_fail"] == "PASS" else 0,
        "tests_failed": 0 if rubric_res["pass_fail"] == "PASS" else 1
    }
