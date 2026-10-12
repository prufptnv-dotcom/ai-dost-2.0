---
name: context-pruner
description: "Maintain compact, accurate memory for long-running projects without losing requirements. Use before context compaction or on large tasks."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Context Pruner

Maintain a concise ledger of: goal/acceptance criteria; stack and key paths; constraints and decisions; assumptions/provenance; files changed; latest test results; remaining work and risks.

Deduplicate, link to files/line ranges rather than copying source, preserve unresolved questions, and never promote a guess to a fact. Do not store credentials or unnecessary personal data. After compaction, verify the next action against the original request.
