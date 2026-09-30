---
name: nvidia-nim-ops
description: >-
  Use this skill to integrate NVIDIA NIM Microservices (Nemotron, Llama 3) for free inferencing.
---

# NVIDIA NIM Operations

NVIDIA provides high-speed, free tier APIs via build.nvidia.com.

## Free Models Available
- `nvidia/llama-3.1-nemotron-70b-instruct`
- `meta/llama-3.1-70b-instruct` (hosted by NVIDIA)

## Setup in AI-Dost
1. Add `NVIDIA_API_KEY` to `.env`.
2. Update `backend/services/chatAgentRouteBridge.js` or the existing NVIDIA service to use the base URL `https://integrate.api.nvidia.com/v1`.
3. The format is 100% compatible with the OpenAI SDK. Simply swap the `baseURL` and `apiKey`.
4. NVIDIA NIM is extremely fast and great for generating the 3D Canvas or Document Markdown quickly.
