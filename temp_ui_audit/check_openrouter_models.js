/**
 * P10.2 — OpenRouter "sabhi model check" reproducible probe.
 *
 * 1) Reports key tier (free tier vs credits) WITHOUT printing the key.
 * 2) Live-pings every free chat model on OpenRouter (from the public /models
 *    list) plus the slugs hardcoded in backend/services/openrouterService.js,
 *    so dead catalog entries are caught instead of silently falling back.
 *
 * Run:  node temp_ui_audit/check_openrouter_models.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY = (() => {
  try {
    const env = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8');
    const m = env.match(/^OPENROUTER_API_KEY\s*=\s*(.+)\s*$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch (_) { return ''; }
})();

const OpenRouterService = require(path.join(ROOT, 'backend', 'services', 'openrouterService'));

async function keyStatus() {
  if (!KEY) { console.log('KEY: MISSING'); return; }
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()).data || {};
  const usage = Number(data.usage || 0);
  const limit = Number(data.limit || 0);
  console.log(`KEY: status=${res.status} free_tier=${data.is_free_tier} limit=${limit === 0 ? 'none' : limit} usage=${usage} remaining=${limit ? (limit - usage).toFixed(4) : 'n/a'}`);
  if (!data.is_free_tier && limit > 0 && usage >= limit) console.log('KEY: EXHAUSTED — only free models will work');
}

async function liveList() {
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
  const all = ((await res.json()).data) || [];
  return all.filter((m) => {
    const p = m.pricing || {};
    return (String(p.prompt) === '0' && String(p.completion) === '0');
  });
}

async function ping(model) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI-Dost',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
        max_tokens: 200,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const ms = Date.now() - t0;
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const text = ((msg?.content || msg?.reasoning || '') + '').trim().slice(0, 40);
    if (res.ok && text) return { model, ok: true, ms, text };
    return { model, ok: false, ms, err: (data.error?.message || `HTTP ${res.status} empty=${!text}`).slice(0, 90) };
  } catch (e) {
    return { model, ok: false, ms: Date.now() - t0, err: e.message.slice(0, 90) };
  }
}

(async () => {
  console.log('=== KEY STATUS ===');
  await keyStatus();

  const live = await liveList();
  // Chat-suitable free models only (Lyria = music generation API, not chat).
  const liveChat = live.filter((m) => !m.id.startsWith('google/lyria')).map((m) => m.id);
  const catalog = [...new Set(Object.values(OpenRouterService.FREE_MODELS))];
  const suspects = catalog.filter((s) => s !== 'openrouter/free' && !liveChat.includes(s)); // hardcoded-but-not-live
  const missing = liveChat.filter((id) => !catalog.includes(id)); // live-but-not-in-catalog

  console.log(`\n=== LIVE FREE CHAT MODELS: ${liveChat.length} ===`);
  console.log(`in catalog: ${liveChat.filter((i) => catalog.includes(i)).length} | missing from catalog: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`catalog slugs NOT live-free: ${suspects.length ? suspects.join(', ') : 'none'}`);

  const worklist = [...liveChat, ...suspects];
  console.log(`\n=== LIVE PING (${worklist.length} models) ===`);
  const results = [];
  for (const m of worklist) {
    const r = await ping(m);
    results.push(r);
    console.log(`${r.ok ? '✅' : '❌'} ${r.model}  ${r.ms}ms  ${r.ok ? JSON.stringify(r.text) : r.err}`);
  }

  const working = results.filter((r) => r.ok).map((r) => r.model);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY ===`);
  console.log(`working: ${working.length}/${results.length}`);
  console.log(`failed: ${failed.length ? failed.map((f) => `${f.model} (${f.err})`).join(' | ') : 'none'}`);
  console.log(`missing-from-catalog-but-working: ${missing.filter((m) => working.includes(m)).join(', ') || 'none'}`);
  console.log(`in-catalog-but-dead: ${catalog.filter((c) => c !== 'openrouter/free' && !working.includes(c)).join(', ') || 'none'}`);
})();
