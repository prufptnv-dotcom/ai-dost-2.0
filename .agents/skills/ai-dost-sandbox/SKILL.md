---
name: ai-dost-sandbox
description: >-
  Use this skill to debug Docker container sandboxes, WebContainers, and the Visual Healer environments used by AI-Dost.
---

# Sandbox & Visual Healer Debugging

AI-Dost uses `dockerode` in the backend to spawn secure sandboxes for autonomous agents and code preview.

## Verifying Docker State
First, check if Docker is running properly on the host machine:
```powershell
docker ps
```

## Checking Active Sandboxes
List all containers created by AI-Dost (they usually have a specific naming convention or label):
```powershell
docker ps -a --filter "name=aidost"
```

## Debugging a Sandbox Crash
If the Visual Healer fails to connect to a sandbox or the preview goes blank:
1. Find the container ID.
2. Check the logs:
   ```powershell
   docker logs <container_id>
   ```
3. Look for port mapping issues. AI-Dost expects the sandbox to expose a development server port (e.g., 5173 for Vite or 3000 for Next.js) which is proxied back to the user.

## Note on WebContainers
If the environment is purely browser-based (WebContainers in Next.js), Docker will not show any containers. In that case, check the browser console logs instead.
