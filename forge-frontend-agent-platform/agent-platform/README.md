# Agent Platform Pack

An integration-ready architecture, protected skill bundle, MCP catalog, and evaluation plan for the Forge website builder. This is a **blueprint and starter pack**, not a live MCP runtime: no credentials, network endpoints, external servers, or backend API contract have been invented.

## Start here

1. Read [`RESEARCH_AND_ROADMAP.md`](./RESEARCH_AND_ROADMAP.md) for the research, security decisions, and phased implementation plan; see [`FEATURE-GAP.md`](./FEATURE-GAP.md) for the concise missing-feature list.
2. Browse [`skills/bundled/`](./skills/bundled/) for portable `SKILL.md` workflows.
3. Inspect [`mcps/registry.json`](./mcps/registry.json) for connector candidates, safe defaults, and permission expectations.
4. Use [`providers/support-matrix.json`](./providers/support-matrix.json) to build provider-specific adapters rather than assuming MCP features are identical.
5. Use [`FRONTEND_CONNECT_SPEC.md`](./FRONTEND_CONNECT_SPEC.md) to map UI concepts onto existing Node endpoints/events.
6. Use [`evals/`](./evals/) before calling any skill or provider “best.”

## Protected additions

- `skills/bundled/` and `mcps/registry.json` are platform-owned defaults. End users may enable, disable, connect, or authorize a protected item, but cannot edit or delete it.
- New custom skills/MCPs enter `skills/pending/` or `mcps/pending/` for owner/admin review. After validation and signing, an admin promotes them into the protected catalog. Normal members cannot edit/delete promoted entries.
- If self-managed plugins are later needed, create a separate user-owned namespace. Never mix it with the protected catalog or silently elevate its permissions.
- UI-level hiding is not protection. Enforce owner/admin ACLs in the backend/storage API, validate every mutation server-side, keep immutable versions/hashes, and audit changes.

## Integration boundary

The existing app is still a frontend prototype. This folder intentionally contains no secret values, executable MCP commands, guessed service URLs, OAuth credentials, or provider API keys. Connect it to your existing Node backend after you share its endpoint/event contract.
