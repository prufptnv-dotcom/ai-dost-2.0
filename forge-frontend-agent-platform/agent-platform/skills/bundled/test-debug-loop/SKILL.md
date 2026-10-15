---
name: test-debug-loop
description: "Diagnose and fix failures with a reproduce–isolate–patch–verify loop. Use for build errors, failing tests, or broken interactions."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Test Debug Loop

1. Reproduce and capture the exact command, error, and environment.
2. Isolate the smallest failing route/component/test; trace the root cause.
3. Make the smallest patch and add a regression check.
4. Re-run focused tests, then relevant full build/test suite; inspect adjacent behavior.

Do not suppress errors, weaken assertions without reason, or rewrite unrelated code.
