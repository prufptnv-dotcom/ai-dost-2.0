import api from './api';

// #101-#103: provider API keys & deploy tokens moved out of browser
// localStorage (plaintext, XSS-readable) into the backend secret store.
// The browser only ever receives MASKED status — raw values never round-trip.

// legacy localStorage key → canonical server provider name
export const LEGACY_SECRET_LS_MAP = [
  ['customGeminiKey', 'gemini'],
  ['customGroqKey', 'groq'],
  ['customDeepSeekKey', 'deepseek'],
  ['customNvidiaKey', 'nvidia'],
  ['customOpenRouterKey', 'openrouter'],
  ['GEMINI_API_KEY', 'gemini'],
  ['GROQ_API_KEY', 'groq'],
  ['TAVILY_API_KEY', 'tavily'],
  ['ai_dost_vercel_token', 'vercel'],
  ['ai_dost_netlify_token', 'netlify'],
];

/** Masked status map: { gemini: { configured, masked }, ... } — never raw keys. */
export async function getSecretStatus() {
  try {
    const res = await api.get('/settings/keys');
    return res.data?.keys || {};
  } catch {
    return {};
  }
}

/** Store (or clear with '') one secret server-side. Returns fresh status. */
export async function saveSecret(provider, key) {
  const res = await api.put('/settings/keys', { provider, key: String(key ?? '') });
  return res.data?.keys || {};
}

/** Remove one stored secret. Returns fresh status. */
export async function deleteSecret(provider) {
  const res = await api.delete(`/settings/keys/${encodeURIComponent(provider)}`);
  return res.data?.keys || {};
}

/**
 * One-time migration: push legacy plaintext secrets from localStorage to the
 * server store, then purge them from the browser. Keeps the legacy copy if the
 * server is unreachable (retry next load) so the key is never lost.
 * Returns the refreshed masked status ({} on failure).
 */
export async function migrateLegacySecrets() {
  if (typeof window === 'undefined') return {};
  for (const [lsKey, provider] of LEGACY_SECRET_LS_MAP) {
    let value;
    try {
      value = localStorage.getItem(lsKey);
    } catch {
      continue;
    }
    if (!value) continue;
    try {
      await api.put('/settings/keys', { provider, key: value });
      localStorage.removeItem(lsKey);
    } catch {
      // server down — keep legacy value for a later retry
    }
  }
  return getSecretStatus();
}
