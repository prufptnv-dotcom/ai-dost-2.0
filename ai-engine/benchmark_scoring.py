"""Transparent response-format heuristic scoring for the AI Dost benchmark.

This module deliberately does not claim to assess factual correctness or whether
a task was completed successfully. Open-ended answers require a separate rubric,
a verified reference, execution-based tests, or a documented human review.
"""
from __future__ import annotations

import re
from typing import Any, Mapping

EVALUATION_TYPE = "response_format_heuristic_v1"

_REFUSAL_PATTERNS = (
    r"I'm sorry, but I can't assist",
    r"as a text-based AI, I don't have access",
    r"I cannot fulfill",
)


def normalize_result_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Migrate saved legacy rows so old heuristic PASS values never imply correctness."""
    normalized = dict(record)
    normalized["correctness_evaluated"] = False
    normalized["is_accuracy_metric"] = False

    if not normalized.get("success"):
        normalized["pass_fail"] = "NOT_EVALUATED"
        normalized["format_status"] = "NOT_EVALUATED"
        normalized["evaluation_type"] = EVALUATION_TYPE
        normalized["evaluator_note"] = (
            "Request failed before a model response could be evaluated; "
            "this is not a model-correctness failure."
        )
        return normalized

    answer = normalized.get("model_answer")
    if answer is None:
        # A success marker without an answer is corrupt/incomplete evidence.
        normalized["success"] = False
        normalized["pass_fail"] = "NOT_EVALUATED"
        normalized["format_status"] = "NOT_EVALUATED"
        normalized["evaluation_type"] = EVALUATION_TYPE
        normalized["evaluator_note"] = "Saved result had no model answer; marked as incomplete."
        return normalized

    evaluation = evaluate_response(
        normalized,
        str(answer),
        float(normalized.get("latency_s", 0) or 0),
    )
    normalized.update({
        "score": evaluation["score"],
        "pass_fail": "NOT_EVALUATED",
        "format_status": evaluation["format_status"],
        "evaluation_type": evaluation["evaluation_type"],
        "correctness_evaluated": False,
        "is_accuracy_metric": False,
        "evaluator_note": evaluation["eval_note"],
        "estimated_tokens": evaluation["tokens_est"],
        "estimated_tokens_per_sec": round(
            evaluation["tokens_est"] / float(normalized.get("latency_s", 0) or 1), 1
        ),
        "token_count_method": "response_characters_divided_by_3.8",
    })
    return normalized

def evaluate_response(item: Mapping[str, Any], reply: str, latency: float = 0.0) -> dict[str, Any]:
    """Return a format-only score; never present this result as accuracy."""
    del latency  # Reserved for future instrumentation; not part of the score.

    prompt = str(item.get("prompt", ""))
    category = str(item.get("cat", ""))
    text = str(reply or "")
    prompt_lower = prompt.lower()
    category_lower = category.lower()

    refusal_detected = any(
        re.search(pattern, text, re.IGNORECASE) is not None
        for pattern in _REFUSAL_PATTERNS
    )
    has_code = "```" in text
    length = len(text)
    notes: list[str] = []
    violations: list[str] = []
    score = 10

    if refusal_detected:
        score -= 6
        violations.append("A configured refusal pattern matched")
    if length < 60:
        score -= 4
        violations.append("Response is shorter than the 60-character format threshold")

    code_categories = (
        "algorithm",
        "web development",
        "web dev",
        "python",
        "javascript",
        "frontend",
    )
    code_intent = any(
        marker in prompt_lower
        for marker in (
            "implement",
            "write a python",
            "write a javascript",
            "function",
            "write code",
            "code for",
            "algorithm",
            "class ",
        )
    )
    requires_code = any(label in category_lower for label in code_categories) and code_intent
    if requires_code and not has_code:
        score -= 3
        violations.append("A code-oriented prompt did not produce a fenced code block")

    requires_sql = (
        ("database" in category_lower or "sql" in category_lower)
        and "write sql" in prompt_lower
    )
    if requires_sql and not any(keyword in text.lower() for keyword in ("select", "with")):
        score -= 2
        violations.append("A SQL-oriented prompt did not include a SELECT/WITH marker")

    score = max(1, min(10, score))
    if length > 250:
        notes.append("Response is longer than 250 characters; length is not evidence of correctness")
    if violations:
        notes.extend(violations)
    else:
        notes.append("No configured response-format checks failed")

    notes.append("Correctness and end-to-end task success were NOT evaluated")
    format_status = "FORMAT_FAIL" if violations else "FORMAT_PASS"

    return {
        "score": score,
        "format_status": format_status,
        "tokens_est": max(1, int(length / 3.8)),
        "eval_note": "; ".join(notes),
        "evaluation_type": EVALUATION_TYPE,
        "correctness_evaluated": False,
        "is_accuracy_metric": False,
    }
