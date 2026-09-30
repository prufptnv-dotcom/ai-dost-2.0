---
name: anthropic-claude-ops
description: >-
  Use this skill to integrate Claude 3.5 Sonnet and Haiku via the Anthropic SDK or OpenRouter free tiers.
---

# Anthropic Claude Operations

AI-Dost can route complex reasoning tasks to Claude via OpenRouter.

## Free Tier Access
Since Anthropic's native API is paid, the system cascades to OpenRouter's free variants if available, or Claude via free promotional keys. 

## Integration
1. If the user requests Claude specifically, set `model="anthropic/claude-3.5-sonnet"` or `model="anthropic/claude-3-haiku"` via OpenRouter.
2. For coding tasks, Claude Sonnet is highly recommended. Update the cascade logic in `backend/services/chatAgentRouteBridge.js` to prioritize Claude when `model="claude"` is specified.

## MCP Support
Claude officially supports the Model Context Protocol (MCP). Ensure that any system prompt sent to Claude includes tool definitions following the JSON Schema format.
