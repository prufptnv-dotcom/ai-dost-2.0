---
name: token-budget-router
description: "Reduce context and tool payloads while preserving quality. Use for large repos, multi-step tasks, many MCP servers, or explicit token/cost goals."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Token Budget Router

1. Classify task complexity/risk; route simple retrieval to a fast model and escalate only for ambiguity, architecture, or failed checks.
2. Search locally; send relevant paths/excerpts rather than whole repos, logs, or documents.
3. Select one primary skill and at most two relevant support skills; load full instructions only after activation.
4. Discover/filter MCP tools just in time; keep a small allowed-tool set.
5. Keep reusable provider prompt prefixes stable; measure cache hits and token/cost per successful task.

Never remove user requirements, security context, evidence, or QA just to reduce tokens.
