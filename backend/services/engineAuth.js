/**
 * Shared auth headers for calls to the Python AI Engine (FastAPI :8001).
 * When AI_ENGINE_API_KEY is set, ai-engine's origin_guard middleware rejects
 * any request that does not present it (X-API-Key or Bearer). Every backend
 * caller must attach the key or the sidecar goes 401 once auth is enabled.
 */
function engineHeaders(extra = {}) {
  const key = process.env.AI_ENGINE_API_KEY;
  return key ? { ...extra, 'X-API-Key': key } : { ...extra };
}

module.exports = { engineHeaders };
