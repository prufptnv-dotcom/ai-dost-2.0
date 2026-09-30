'use strict';
// P3 #191: single source of truth for the Ollama endpoint. Previously
// .env.example documented OLLAMA_BASE_URL (read by NOTHING), routes/chat.js +
// services/geminiService.js hard-coded 127.0.0.1:11434, and routes/agent.js
// read an undocumented OLLAMA_HOST treated as a bare hostname — so Ollama
// config was unusable in Docker.
//
// Accepts either form:
//   OLLAMA_HOST=http://host.docker.internal:11434   (URL)
//   OLLAMA_HOST=host.docker.internal:11434          (bare host[:port], Ollama's own convention)
// OLLAMA_BASE_URL is honoured as a legacy alias.

function ollamaBaseUrl() {
  const raw = String(process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || '').trim();
  if (!raw) return 'http://127.0.0.1:11434';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    if (!u.port) u.port = '11434';
    return `${u.protocol}//${u.hostname}:${u.port}`;
  } catch {
    return 'http://127.0.0.1:11434';
  }
}

function ollamaHostPort() {
  const u = new URL(ollamaBaseUrl());
  return { host: u.hostname, port: Number(u.port || 11434) };
}

module.exports = { ollamaBaseUrl, ollamaHostPort };
