"""
Calibrated Rubric & Knowledge Evaluator for Non-Executable Benchmarks
Applies domain-specific criteria, explicit answer keys, and misconception penalties.
"""

import re
from typing import Dict, Any, List, Optional

# Explicit answer keys for well-defined puzzles, mathematics, and systems theory
ANSWER_KEYS = {
    "Q001": {
        "required_concepts": [
            (r"\blist\b.*?\border(ed)?\b.*?\bmutab(le|ility)\b", "List is ordered and mutable"),
            (r"\btuple\b.*?\bimmutab(le|ility)\b", "Tuple is immutable"),
            (r"\bset\b.*?\b(unique|duplicate|unorder)\b", "Set contains unique elements"),
            (r"\bdict(ionary)?\b.*?\b(key[- ]value|hash|mapping)\b", "Dict is key-value mapping")
        ],
        "forbidden_misconceptions": [
            (r"tuples are mutable", "Claimed tuple is mutable"),
            (r"sets allow duplicate", "Claimed set allows duplicates")
        ]
    },
    "Q003": {
        "required_concepts": [
            (r"O\(\s*log\s*n\s*\)", "Time complexity is O(log n)"),
            (r"\b(halv|half|divide|split|binary)\b", "Explained dividing search space in half each step")
        ],
        "forbidden_misconceptions": [
            (r"O\(\s*n\s*\)", "Claimed complexity is linear O(n)"),
            (r"O\(\s*n\^2\s*\)", "Claimed complexity is quadratic")
        ]
    },
    "Q007": {
        "required_concepts": [
            (r"\bshallow\b.*?\b(reference|pointer|nested)\b", "Shallow copy copies references for nested objects"),
            (r"\bdeep\b.*?\b(recursiv|independent|new object)\b", "Deep copy recursively copies all nested objects")
        ],
        "forbidden_misconceptions": []
    }
}

def evaluate_rubric(item: Dict[str, Any], reply: str) -> Dict[str, Any]:
    """
    Evaluates non-executable responses against domain-calibrated criteria.
    """
    qid = item.get("qid", "")
    prompt = item.get("prompt", "")
    cat = item.get("cat", "")
    diff = item.get("diff", "Medium")

    reply_clean = reply.strip()
    if not reply_clean:
        return {
            "score": 0,
            "pass_fail": "FAIL",
            "eval_note": "Empty reply",
            "is_executable": False,
            "criteria_met": []
        }

    # Refusal check
    refusal_patterns = [
        r"I'm sorry, but I can't assist",
        r"as an AI, I don't have access",
        r"I cannot fulfill this"
    ]
    if any(re.search(pat, reply_clean, re.IGNORECASE) for pat in refusal_patterns):
        return {
            "score": 1,
            "pass_fail": "FAIL",
            "eval_note": "False refusal detected",
            "is_executable": False,
            "criteria_met": []
        }

    score = 7  # Baseline for coherent response
    notes = []
    criteria_met = []

    # Check explicit answer key if registered
    if qid in ANSWER_KEYS:
        key_spec = ANSWER_KEYS[qid]
        for pat, desc in key_spec["required_concepts"]:
            if re.search(pat, reply_clean, re.IGNORECASE):
                criteria_met.append(desc)
            else:
                score -= 2
                notes.append(f"Missing essential concept: {desc}")

        for pat, desc in key_spec["forbidden_misconceptions"]:
            if re.search(pat, reply_clean, re.IGNORECASE):
                score -= 4
                notes.append(f"Detected factual error: {desc}")

    # Category-specific criteria
    if "System Design" in cat:
        if not re.search(r"\b(trade[- ]off|scalab|bottleneck|latency|throughput|single point of failure|spof|sharding|cache)\b", reply_clean, re.IGNORECASE):
            score -= 2
            notes.append("Lacks engineering trade-offs or scalability considerations")
        else:
            criteria_met.append("Included architectural trade-offs")

    elif "Databases" in cat or "SQL" in cat:
        if "sql" in prompt.lower() and not re.search(r"\b(select|insert|update|create|alter|with)\b", reply_clean, re.IGNORECASE):
            score -= 3
            notes.append("Requested SQL but did not include SQL query")
        else:
            criteria_met.append("Included SQL structure")

    elif "Mathematics" in cat or "Statistics" in cat:
        if not re.search(r"(=|\\frac|\+|-|\*|\\sqrt|formula|theorem|derivat|integral|probability)", reply_clean, re.IGNORECASE):
            score -= 2
            notes.append("Lacks mathematical formulation or step-by-step derivation")
        else:
            criteria_met.append("Included mathematical formulations")

    # Length calibration
    if len(reply_clean) < 80:
        score -= 3
        notes.append("Superficial brevity")
    elif len(reply_clean) > 300:
        score = min(10, score + 1)

    score = max(1, min(10, score))
    pass_fail = "PASS" if score >= 6 else "FAIL"

    return {
        "score": score,
        "pass_fail": pass_fail,
        "eval_note": "; ".join(notes) if notes else "Domain rubric criteria fulfilled",
        "is_executable": False,
        "criteria_met": criteria_met
    }
