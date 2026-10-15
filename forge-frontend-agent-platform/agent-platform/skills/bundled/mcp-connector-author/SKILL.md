---
name: mcp-connector-author
description: "Design/configure MCP connectors with discoverable tools, minimal scopes, and safe approval behavior."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Mcp Connector Author

Record owner/source/transport/auth/scopes/data class/version. Discover tools/resources/prompts; allowlist the minimum and label read/write/destructive. Validate server/TLS/redirects/token audience/network egress/timeouts. Require explicit consent; approve high-risk calls per action and audit them. Test connect, harmless read, denial, revoke, reconnect, and errors. Never store secrets in code/prompts.
