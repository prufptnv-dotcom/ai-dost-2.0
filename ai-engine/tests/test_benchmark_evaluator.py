"""
Regression Suite for Benchmark Evaluation System
Tests all 5 critical evaluation behaviors:
1. Correct code passes.
2. Plausible but incorrect code fails (including the Q004 stack-with-2-queues bug).
3. Incomplete code fails (placeholders / stubs).
4. Missing edge-case handling is detected.
5. Fenced blocks without working implementations fail.
"""

import unittest
import sys
import os

# Add parent directory to path so benchmark_evaluator can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from benchmark_evaluator.evaluator import evaluate_response_verified
from benchmark_evaluator.code_extractor import get_executable_code, has_placeholders

class TestBenchmarkEvaluator(unittest.TestCase):

    def test_1_correct_code_passes(self):
        """Case 1: Correct code passes verified evaluation."""
        item = {
            "qid": "Q002",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Write a Python function that checks whether a string is a palindrome without using slicing."
        }
        correct_reply = """Here is the solution using two pointers:
```python
def is_palindrome(s):
    # Two-pointer approach without slicing
    left = 0
    right = len(s) - 1
    while left < right:
        if s[left] != s[right]:
            return False
        left += 1
        right -= 1
    return True
```
This runs in O(n) time and O(1) space.
"""
        res = evaluate_response_verified(item, correct_reply, 1.2, model_id="test_model")
        self.assertEqual(res["pass_fail"], "PASS")
        self.assertEqual(res["status"], "VERIFIED_PASS")
        self.assertEqual(res["score"], 10)
        self.assertTrue(res["is_executable"])

    def test_2_plausible_but_incorrect_code_fails(self):
        """Case 2: Plausible but incorrect code fails (reproducing verbatim Q004 bug from historical benchmark)."""
        item = {
            "qid": "Q004",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Implement a stack using two queues. State the complexity of push and pop."
        }
        # This was awarded 10/10 PASS in the historical unverified benchmark!
        plausible_broken_reply = """To implement a stack with two queues (LIFO):
```python
class Stack:
    def __init__(self):
        self.queue1 = []
        self.queue2 = []

    def push(self, value):
        self.queue1.append(value)

    def pop(self):
        # BUG: It pops from queue2 without transferring elements from queue1!
        if len(self.queue2) > 0:
            return self.queue2.pop()
        return None
```
"""
        res = evaluate_response_verified(item, plausible_broken_reply, 2.0, model_id="test_model")
        self.assertEqual(res["pass_fail"], "FAIL")
        self.assertIn(res["status"], ["TEST_FAILURE", "RUNTIME_ERROR"])
        self.assertLess(res["score"], 5)
        self.assertEqual(res["failure_type"], "TEST_FAILURE")

    def test_3_incomplete_code_fails(self):
        """Case 3: Incomplete code with TODO or pass stubs fails immediately."""
        item = {
            "qid": "Q002",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Write a Python function that checks whether a string is a palindrome without using slicing."
        }
        incomplete_reply = """```python
def is_palindrome(s):
    # TODO: implement two-pointer check here
    pass
```
"""
        res = evaluate_response_verified(item, incomplete_reply, 0.5, model_id="test_model")
        self.assertEqual(res["pass_fail"], "FAIL")
        self.assertEqual(res["status"], "INCOMPLETE_IMPLEMENTATION")
        self.assertEqual(res["failure_type"], "INCOMPLETE_CODE")

    def test_4_missing_edge_case_handling_detected(self):
        """Case 4: Missing edge-case handling is detected (e.g. negative numbers for second largest)."""
        item = {
            "qid": "Q005",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Given an array of integers, find the second largest distinct value in one pass."
        }
        # Naive implementation assuming non-negative integers only (defaults max to 0)
        naive_reply = """```python
def second_largest(arr):
    first = 0
    second = 0
    for x in arr:
        if x > first:
            second = first
            first = x
        elif x > second and x != first:
            second = x
    return second
```
"""
        res = evaluate_response_verified(item, naive_reply, 1.0, model_id="test_model")
        self.assertEqual(res["pass_fail"], "FAIL")
        self.assertEqual(res["failure_type"], "TEST_FAILURE")

    def test_5_fenced_block_without_working_implementation_fails(self):
        """Case 5: Code containing a fenced block with superficial/fake logic does not earn a pass."""
        item = {
            "qid": "Q002",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Write a Python function that checks whether a string is a palindrome without using slicing."
        }
        faked_reply = """Here is the palindrome code:
```python
def check_palindrome(s):
    # Always returns True to fool naive tests
    return True
```
This is fully implemented.
"""
        res = evaluate_response_verified(item, faked_reply, 0.8, model_id="test_model")
        self.assertEqual(res["pass_fail"], "FAIL")
        self.assertEqual(res["failure_type"], "TEST_FAILURE")
        self.assertIn("hello", res["evaluator_note"])

    def test_ast_rule_violation_forbidden_slicing(self):
        """Bonus verification: Using forbidden slicing [::-1] when explicitly banned fails with AST violation."""
        item = {
            "qid": "Q002",
            "cat": "Python, Algorithms & Data Structures",
            "prompt": "Write a Python function that checks whether a string is a palindrome without using slicing."
        }
        slicing_reply = """```python
def check_palindrome(s):
    return s == s[::-1]
```
"""
        res = evaluate_response_verified(item, slicing_reply, 0.5, model_id="test_model")
        self.assertEqual(res["pass_fail"], "FAIL")
        self.assertEqual(res["status"], "RULE_VIOLATION")
        self.assertEqual(res["failure_type"], "AST_CONSTRAINT_FAILED")

if __name__ == "__main__":
    unittest.main()
