---
name: codebase-scout
description: "Map an existing codebase before changing it. Use for repository onboarding or when the user already has a backend."
compatibility: "Forge Agent Skills format; load tools only when authorized and needed."
metadata:
  bundle: "forge-core"
  version: "1.0.0"
  managed: "platform"
  locked: "true"
---

# Codebase Scout

1. Read manifests, scripts, environment examples, entry points, routes, and README.
2. Identify frontend/backend framework, build/test commands, auth/data layer, and deployment shape.
3. Trace the relevant UI → API → persistence flow with targeted searches.
4. Mark protected files and smallest safe integration seam.

Do not guess endpoints or replace infrastructure. State what remains unknown.
