---
name: ai-dost-db
description: >-
  Use this skill to interact with the backend SQLite database (app.db).
---

# Database Administration

AI-Dost uses a SQLite database to persist Chats, Projects, Resumes, and Sandbox states.
The database file is located at `backend/data/app.db`.

## Connection
You are equipped with a `sqlite-mcp-server` that directly points to this database. You can use the standard MCP tool calls to execute SQL queries.

## Common Schema Structures (Reference)
- **Chats**: Likely contains `id`, `conversation_id`, `messages` (JSON), `created_at`.
- **Projects**: Contains `id`, `name`, `files` (JSON mapping), `framework`, `created_at`.

## Usage
If the user asks you to "clear my chat history" or "delete a corrupted project", use the MCP tool to run a `DELETE` query. Always run a `SELECT` first to verify the schema and data before mutating.
