---
name: secure-code-review
description: "Review agent-built code and integrations for security risks before approval or deployment."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Secure Code Review

Check auth/tenant isolation, secret storage and redaction, injection/XSS/CSRF/SSRF/path traversal/command execution, dependency risks, MCP scopes/consent/tool trust, data sharing, and destructive actions.

Rank findings by impact; include evidence and a minimal fix. Never execute a destructive action to prove a finding.
