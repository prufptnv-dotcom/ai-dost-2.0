# Phase 2P — Backend P0 Hardening

## Completed controls

- Production CORS is deny-by-default and driven by `CORS_ORIGINS` or `FRONTEND_URL`.
- JSON parsing is bounded to `2mb` by default, with an explicit larger-route allowlist.
- The AI concurrency queue's response lifecycle release is protected against duplicate `finish`/`close` callbacks.
- Production project authorization no longer trusts `x-user-id` as caller identity.
- Owner-less legacy projects are restricted to local development identity; production project access requires `req.user.id`.
- Deterministic regression suites cover CORS, payload limits, response lifecycle release, production identity boundaries, and SSRF IP/URL policy.
- Existing safe URL fetching validates protocols, DNS results, private/reserved IPs, and redirect hops before following them.
- CI runs the deterministic security suites on every pull request.

## Production configuration

```text
NODE_ENV=production
CORS_ORIGINS=https://your-frontend.example
JSON_BODY_LIMIT=2mb
JSON_LARGE_BODY_LIMIT=50mb
JSON_LARGE_ROUTE_PREFIXES=/api/image,/api/v1/image,/api/pdf,/api/v1/pdf
MAX_CONCURRENT_AI=20
```

Do not set `CORS_ORIGINS=*` in production. A real authentication middleware must populate `req.user.id` before project-authorized routes are exposed publicly.
