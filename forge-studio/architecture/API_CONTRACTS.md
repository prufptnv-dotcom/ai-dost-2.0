# Forge Studio — API Contracts & Streaming Protocol

## 1. Primary Endpoints

### 1.1 `POST /api/agent/run`
Primary autonomous agent entry point with streaming SSE response.

**Headers:**
- `Content-Type: application/json`
- `x-ai-dost-task-id: <taskId>` (optional)
- `x-approval-token: <token>` (optional, for resuming gated runs)

**Request Body:**
```json
{
  "userPrompt": "Create a modern portfolio with dark/light mode",
  "projectId": "proj_123456",
  "taskId": "forge-1791710943837",
  "copilotDirector": true,
  "permissionLevel": "auto",
  "preferredModel": "auto",
  "contextFiles": ["src/App.jsx"],
  "plan": null
}
```

**SSE Events Streamed:**
| Event Type | Payload Fields | Purpose |
| :--- | :--- | :--- |
| `: ping` | None (comment) | Keep-alive heartbeat every 10s to prevent proxy timeouts |
| `run_started` | `{ runId, taskId }` | Acknowledges job creation |
| `director_start` | `{ phase, status, taskId, runId }` | Run accepted |
| `director_plan` | `{ summary, taskCount, tasks: [...] }` | Emits planned specialist tasks |
| `director_task` | `{ taskId, specialty, role, status, attempt }` | Specialist state transition |
| `thinking` | `{ message }` | Model reasoning stream |
| `step` | `{ tool, status, input }` | Individual tool execution event |
| `director_file_diff` | `{ file, fullPath, action, taskId, summary }` | Real-time file write / diff update |
| `director_verification`| `{ status, result }` | Pre-commit QA gate status |
| `director_complete` | `{ status, filesWritten, changedPaths, message }` | Completion summary |
| `director_error` | `{ status: "FAILED", error, message }` | Detailed failure diagnostics |
| `data: [DONE]` | Stream terminator | Standard SSE stream completion |

---

### 1.2 `GET /api/preview/:projectId/status`
Checks if a sandboxed dev server container is running for the project.

**Response (200 OK):**
```json
{
  "state": "READY",
  "url": "http://localhost:5173",
  "hostPort": 5173
}
```

---

### 1.3 `POST /api/preview/:projectId/dev/start`
Starts a sandboxed Vite/Node server container for live preview.

**Request Body:**
```json
{
  "projectPath": "."
}
```

---

### 1.4 `POST /api/terminal/exec`
Executes real shell commands in the project directory.

**Request Body:**
```json
{
  "command": "npm test",
  "projectId": "proj_123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "stdout": "...",
  "stderr": "",
  "exitCode": 0
}
```
