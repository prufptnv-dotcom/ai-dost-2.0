"""Unit tests for format-only benchmark scoring; no network is required."""
import unittest

from benchmark_scoring import EVALUATION_TYPE, evaluate_response


class BenchmarkScoringTests(unittest.TestCase):
    def test_long_wrong_answer_is_not_labeled_as_correct(self):
        answer = "This explanation is confidently written but factually wrong. " * 8
        result = evaluate_response(
            {"prompt": "Explain gravity.", "cat": "General knowledge", "diff": "Easy"},
            answer,
        )
        self.assertEqual(result["score"], 10)
        self.assertEqual(result["format_status"], "FORMAT_PASS")
        self.assertEqual(result["evaluation_type"], EVALUATION_TYPE)
        self.assertFalse(result["correctness_evaluated"])
        self.assertFalse(result["is_accuracy_metric"])
        self.assertIn("NOT evaluated", result["eval_note"])

    def test_code_request_without_code_fails_format_even_if_score_is_above_six(self):
        result = evaluate_response(
            {
                "prompt": "Write a Python function to add two numbers.",
                "cat": "Python, Algorithms & Data Structures",
                "diff": "Easy",
            },
            "Here is a detailed explanation of how addition works. " * 3,
        )
        self.assertEqual(result["score"], 7)
        self.assertEqual(result["format_status"], "FORMAT_FAIL")
        self.assertFalse(result["correctness_evaluated"])

    def test_code_block_only_proves_format_not_code_correctness(self):
        result = evaluate_response(
            {
                "prompt": "Implement a Python function.",
                "cat": "Python, Algorithms & Data Structures",
                "diff": "Easy",
            },
            "```python\ndef wrong():\n    return 999\n```",
        )
        self.assertEqual(result["format_status"], "FORMAT_PASS")
        self.assertFalse(result["correctness_evaluated"])
        self.assertFalse(result["is_accuracy_metric"])

    def test_short_response_is_format_failure(self):
        result = evaluate_response(
            {"prompt": "Explain a concept.", "cat": "General", "diff": "Easy"},
            "Too short.",
        )
        self.assertEqual(result["format_status"], "FORMAT_FAIL")
        self.assertLess(result["score"], 10)

    def test_sql_prompt_without_sql_marker_fails_format(self):
        result = evaluate_response(
            {
                "prompt": "Write SQL to select every user.",
                "cat": "Database and SQL",
                "diff": "Easy",
            },
            "This is a detailed description of how databases store and retrieve rows. " * 4,
        )
        self.assertEqual(result["format_status"], "FORMAT_FAIL")
        self.assertFalse(result["correctness_evaluated"])


if __name__ == "__main__":
    unittest.main()
