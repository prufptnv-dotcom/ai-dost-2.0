---
name: minimal-input-planner
description: "Turn vague website/product requests into a practical plan with few follow-up questions. Use for minimal briefs or one-click build requests."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Minimal Input Planner

1. Inspect project, stack, backend boundaries, and explicit constraints before planning a rewrite.
2. Separate requirements from assumptions; use safe reversible defaults and ask only blocking questions.
3. Write a short acceptance checklist and plan inspect → implement → test → review.
4. Report what can and cannot be done from current context; never call a UI demo real execution.

Quality gate: scope, assumptions, output, and tests are clear without an unnecessary questionnaire.
