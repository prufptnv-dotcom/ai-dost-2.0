'use strict';

/**
 * Server-side secret/settings store (#101-#103).
 *
 * Provider API keys and deploy tokens used to live in browser localStorage
 * (plaintext, readable by any XSS). They now live HERE — a small JSON file
 * under backend/data/ — and are only ever exposed to the browser as masks.
 *
 * Raw values leave this module only for:
 *   - backend internal use (customKeys merge, deploy token fallback)
 *   - the loopback/Docker-only PUT/DELETE routes (behind execGuard)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'local-settings.json');

// Canonical secret names. Aliases (GEMINI_API_KEY etc.) normalize to these.
const SECRET_NAMES = ['gemini', 'groq', 'deepseek', 'nvidia', 'openrouter', 'vercel', 'netlify', 'tavily'];
const ALIASES = {
  GEMINI_API_KEY: 'gemini',
  GROQ_API_KEY: 'groq',
  DEEPSEEK_API_KEY: 'deepseek',
  NVIDIA_API_KEY: 'nvidia',
  OPENROUTER_API_KEY: 'openrouter',
  VERCEL_TOKEN: 'vercel',
  NETLIFY_TOKEN: 'netlify',
  TAVILY_API_KEY: 'tavily',
};

function normalizeName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  const lower = key.toLowerCase();
  if (SECRET_NAMES.includes(lower)) return lower;
  if (ALIASES[key]) return ALIASES[key];
  if (ALIASES[lower.toUpperCase()]) return ALIASES[lower.toUpperCase()];
  return null;
}

function load() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const clean = {};
    for (const name of SECRET_NAMES) {
      const v = parsed && parsed[name];
      if (typeof v === 'string' && v) clean[name] = v;
    }
    return clean;
  } catch (_) {
    return {};
  }
}

function persist(secrets) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
    try {
      fs.chmodSync(STORE_FILE, 0o600); // no-op on win32, meaningful on POSIX
    } catch (_) {}
    return true;
  } catch (err) {
    logger.error('[SettingsStore] persist failed:', err.message);
    return false;
  }
}

/** Raw values for backend-internal use ONLY — never serialize to clients. */
function getSecrets() {
  return load();
}

function getSecret(name) {
  const n = normalizeName(name);
  if (!n) return '';
  return load()[n] || '';
}

function setSecret(name, value) {
  const n = normalizeName(name);
  if (!n) return { ok: false, error: 'unknown provider' };
  const secrets = load();
  const v = typeof value === 'string' ? value.trim() : '';
  if (v) secrets[n] = v;
  else delete secrets[n];
  const ok = persist(secrets);
  logger.info(`[SettingsStore] ${v ? 'set' : 'cleared'} '${n}'`);
  return { ok };
}

function setSecrets(obj) {
  const results = {};
  for (const [name, value] of Object.entries(obj || {})) {
    results[name] = setSecret(name, value);
  }
  return results;
}

function deleteSecret(name) {
  return setSecret(name, '');
}

function maskSecret(value) {
  const v = String(value || '');
  if (!v) return '';
  if (v.length <= 8) return '••••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

/** Client-safe status: which keys are configured + masked preview. NEVER raw. */
function status() {
  const secrets = load();
  const out = {};
  for (const name of SECRET_NAMES) {
    const v = secrets[name] || '';
    out[name] = { configured: !!v, masked: maskSecret(v) };
  }
  return out;
}

/**
 * Merge stored secrets under client-provided customKeys (request body wins —
 * it reflects the current form input; the store is the persistent fallback).
 */
function mergeCustomKeys(customKeys) {
  const merged = { ...(customKeys || {}) };
  try {
    const secrets = load();
    for (const name of ['gemini', 'groq', 'deepseek', 'nvidia', 'openrouter']) {
      if (!merged[name] && secrets[name]) merged[name] = secrets[name];
    }
  } catch (_) {}
  return merged;
}

module.exports = {
  SECRET_NAMES,
  normalizeName,
  getSecret,
  getSecrets,
  setSecret,
  setSecrets,
  deleteSecret,
  maskSecret,
  status,
  mergeCustomKeys,
};
