/**
 * Python AI Engine bridge — FastAPI sidecar (port 8001)
 * Hosts Python-only AI: LlamaIndex RAG (semantic Q&A over workspace files)
 * All calls fail-safe: engine down -> return null, caller falls back.
 */
const BASE = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001';
const TIMEOUT_MS = 120000;

async function engineFetch(path, body, timeoutMs = TIMEOUT_MS) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `engine ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function health() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/**
 * Semantic Q&A over a directory's files.
 * @returns {{ok:boolean, data?:{answer:string,sources:Array}, error?:string}}
 */
async function queryRag(directory, question, topK = 4, rebuild = false) {
  return engineFetch('/ai/rag/query', { directory, question, top_k: topK, rebuild });
}

/** Pre-build index for a directory (no LLM call). */
async function buildIndex(directory) {
  return engineFetch('/ai/rag/index', { directory }, 600000);
}

/**
 * CrewAI multi-agent crew run (Researcher -> Coder -> Reviewer).
 * @param {string} prompt
 * @param {object} [opts] { mode: 'dev'|'research'|'content', model: 'ollama'|'gemini'|'groq', directory }
 * @returns {{ok:boolean, data?:{status,result,crew_output,agents}, error?:string}}
 */
async function runCrew(prompt, opts = {}) {
  const { mode = 'dev', model = 'ollama', directory = '' } = opts || {};
  return engineFetch('/ai/crew/run', { prompt, mode, model, directory }, 600000);
}

/**
 * Edge TTS (free, no key) via AI engine — returns MP3 bytes.
 * @param {string} text
 * @param {string} [voice]
 * @returns {{ok:boolean, data?:Buffer, error?:string}}
 */
async function tts(text, voice = 'en-IN-PrabhatNeural', rate = '+0%') {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(`${BASE}/ai/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `engine ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, data: buf };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { health, queryRag, buildIndex, runCrew, tts, BASE };