# Benchmark validity and competition-ready evaluation

## What the existing 300-question runner measures

The current runner records request completion, latency, a character-based token estimate, and a lightweight response-format heuristic. The heuristic checks response length, a few refusal phrases, fenced code blocks for some code prompts, and a minimal SQL marker. It does **not** evaluate whether an answer is true, code compiles, generated code passes tests, or an autonomous agent completed the requested change.

Treat its numeric score and format-threshold rate as diagnostics only—not model accuracy, coding success, or proof that AI Dost is better than another product. The dataset lives in this repository, so it is not a blind test set.

## Required protocol before making superiority claims

1. **Separate the systems being measured.** Measure the conversational assistant separately from Forge Studio Copilot. A strong UI or model answer does not prove an agent can safely modify and ship software.
2. **Freeze the test set.** Version the prompts, record a SHA-256 hash, and keep an undisclosed holdout set for final evaluation. Avoid tuning on that holdout.
3. **Use equal conditions.** For each competitor, use fresh sessions, the same task description, the same starter repository, equivalent tool permissions, equal time/token budgets, and record model/product versions plus date.
4. **Grade executable coding tasks objectively.** Run formatting, lint, type checks, unit tests, integration tests, browser tests, security checks, and a clean build. A task passes only when its predeclared acceptance criteria pass.
5. **Grade open-ended answers with a rubric.** Define category-specific criteria before running the test. Use two independent, blinded reviewers for a sample and adjudicate disagreements. Keep format scores separate from factual correctness.
6. **Report the entire outcome.** Include attempted tasks, pass/fail by category and difficulty, partial successes, regressions, latency, estimated/actual cost, tool-call failures, and safety/security failures. Publish the exact command, environment, dataset version, raw results, and limitations.
7. **Do not overclaim.** A benchmark result supports only the tasks and conditions actually tested. Do not claim general superiority over ChatGPT, Devin, Replit, or Bolt from a response-length score or a single demo.

## Current limitations to disclose

- The response score is heuristic and can award a high score to a long, incorrect answer.
- The current runner estimates tokens from response characters; it does not measure provider token usage.
- The runner itself does not collect peak VRAM telemetry.
- A successful HTTP response is not the same as a successful task.
- Historical results were produced before explicit score-type metadata was added. Their prior `PASS`/`FAIL` field is interpreted only as a format-threshold result, never as correctness.

## Unit tests

Run the pure-Python scoring tests without model access:

```bash
python -m unittest discover -s ai-engine -p 'test_*.py' -v
```
