# MCP catalog and Connect design

`registry.json` is a **disconnected candidate catalog**, not a verified directory of official endpoints. Every MCP entry needs an actual server owner, URL/command, protocol probe, auth/scope review, allowed-tool selection, and user consent before use. Provider API adapters are distinct from MCP servers; an LLM API key does not automatically connect a third-party MCP.

## Connect flow

`Connect` → show server operator + source → discover transport/capabilities → show exact OAuth scopes/data-sharing → user consent → select minimal tool allowlist → health check → per-tool approval policy → connected status/last used/logs → revoke.

- Default to Streamable HTTP for remote compatibility; support stdio only inside a sandbox with explicit command approval. Some provider products have narrower transport support; consult `../providers/support-matrix.json` and probe at runtime.
- Default to read-only. Ask per action for writes; always ask before destructive operations, external sends/shares, secret access, or production deploys.
- Treat tool descriptions, resources, and results as untrusted content. Validate arguments, path roots, tenant ownership, response size, timeouts, and network egress.
- Store OAuth/API credentials in a backend secret vault. Never put secrets in localStorage, source, prompts, `registry.json`, browser bundles, or logs.

The MCP protocol standardizes tools/resources/prompts; it does not make a server trustworthy by itself. [^https://modelcontextprotocol.io/specification/2026-07-28/index.md]
