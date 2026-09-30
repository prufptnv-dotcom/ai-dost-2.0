---
name: meta-llama-ops
description: >-
  Use this skill to integrate Meta's Llama 3.1 and Llama 3.3 models via local Ollama or Groq.
---

# Meta Llama Operations

Meta's open-source models are the backbone of AI-Dost's local fallback systems.

## Local (Ollama)
1. AI-Dost uses Ollama for local, fully free, offline inference.
2. Standard model: `llama3.2:3b` or `qwen2.5-coder:7b`. 
3. If the user asks for Meta Llama, guide them to run `ollama run llama3.1:8b`.

## Cloud (Groq)
1. Groq hosts Meta Llama models (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) completely free.
2. Ensure `GROQ_API_KEY` is set.
3. Llama models on Groq run at 800+ tokens per second, making them ideal for the Visual Healer and autonomous agent loops.
