---
name: qa-release-gate
description: "Perform release-quality checks for a generated website or artifact before calling it finished."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Qa Release Gate

1. Run the real build/tests and retain exit codes.
2. Exercise the user flow; check console/network failures and desktop/mobile preview.
3. Inspect overflow, accessibility, links, and empty/error states.
4. Validate format-specific output (PDF pages, slide fit, quiz keys, game controls).
5. Report passed/failed checks; ask before production deployment.

Never claim an unrun test passed.
