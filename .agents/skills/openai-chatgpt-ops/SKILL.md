---
name: openai-chatgpt-ops
description: >-
  Use this skill to integrate OpenAI ChatGPT (GPT-4o, GPT-4o-mini) and manage OpenAI free tier tokens.
---

# OpenAI ChatGPT Operations

ChatGPT models (like `gpt-4o-mini`) can be used for fast generation in AI-Dost.

## Free Tier Access
OpenAI provides free credits occasionally, but primarily GPT-4o-mini is heavily subsidized or available free via OpenRouter (`openai/gpt-4o-mini:free`).
You can also use GitHub Models for free OpenAI inference.

## Implementation Details
1. **Fallback Service:** Use `backend/services/openaiService.js`.
2. **Parameters:** Always use `response_format: { type: 'json_object' }` when you need structured data, as OpenAI's JSON mode is highly reliable.
3. **Embeddings:** If the user requests ChatGPT, you might also want to use `text-embedding-3-small` in the Python AI Engine. Update the Python script `ai-engine/main.py` to support OpenAI embeddings if keys are present.
