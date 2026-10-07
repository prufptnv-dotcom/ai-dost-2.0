/**
 * End-to-end P0 proof: drive the REAL /api/agent/run SSE endpoint with a
 * greenfield prompt and print every runtime/verification event it emits.
 * Proves the awaited install + real build + real browser check actually fire
 * inside the product, not just in the isolated unit test.
 */
const PROJECT_ID = process.argv[2] || 'p0-e2e-proof';
const PROMPT = process.argv[3] || 'create a new app called Pomodoro timer with a start, pause and reset button';

const started = Date.now();
const t = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`;

(async () => {
  const res = await fetch('http://localhost:5000/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt: PROMPT, projectId: PROJECT_ID, permissionLevel: 'turbo' }),
  });

  console.log(`HTTP ${res.status}  projectId=${PROJECT_ID}\nprompt="${PROMPT}"\n`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let sawInstall = false, sawBuild = false, sawVerdict = false, sawDone = false;
  let fileCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop() || '';

    for (const line of parts) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') { console.log(`[${t()}] [DONE]`); return finish(); }
      let ev;
      try { ev = JSON.parse(raw); } catch { continue; }

      switch (ev.type) {
        case 'agent_status':
          console.log(`[${t()}] ${ev.agent}: ${ev.message}`);
          if (/DevOps/.test(ev.agent || '') && /install|rebuild|Dependencies/.test(ev.message || '')) sawInstall = true;
          if (/Vision QA/.test(ev.agent || '') && /build|Runtime/.test(ev.message || '')) sawVerdict = true;
          break;
        case 'code_context':
          console.log(`[${t()}] 🗂️ code_context: ${(ev.hits||[]).length} hit(s) ${JSON.stringify((ev.hits||[]).map(h=>h.file))}`);
          console.log(`         stats: ${JSON.stringify(ev.stats)}`);
          break;
        case 'verification':
          console.log(`[${t()}] 🧪 verification: verified=${ev.verified} skipped=${ev.verificationSkipped}`);
          console.log(`         ${String(ev.summary||'').split('\n').join('\n         ')}`);
          break;
        case 'dev_server':
          console.log(`[${t()}] 🌐 dev_server: ${ev.state} url=${ev.url} reused=${ev.reused}${ev.reason ? ' reason=' + ev.reason : ''}`);
          if (ev.url) global.__liveUrl = ev.url;
          break;
        case 'run_started':
          console.log(`[${t()}] ▶ run_started budget=${JSON.stringify(ev.budget)}`);
          break;
        case 'file_written':
          fileCount++;
          break;
        case 'screenshot':
          console.log(`[${t()}] 📸 screenshot: ${ev.screenshot ? Math.round(ev.screenshot.length * 0.75 / 1024) + 'KB' : 'none'} — ${ev.message || ''}`);
          break;
        case 'error':
          console.log(`[${t()}] ❌ ERROR: ${ev.message}`);
          break;
        case 'done':
          sawDone = true;
          console.log(`\n[${t()}] ═══ DONE ═══`);
          console.log(ev.message || '(no message)');
          console.log(`\n── steps in stepLog: ${(ev.steps || []).length}`);
          return finish();
      }
    }
  }
  finish();

  function finish() {
    console.log(`\n══════ P0 E2E SUMMARY ══════`);
    console.log(`files written      : ${fileCount}`);
    console.log(`install events seen: ${sawInstall}`);
    console.log(`verification verdict: ${sawVerdict}`);
    console.log(`done event         : ${sawDone}`);
    console.log(`total time         : ${t()}`);
    if (global.__liveUrl) {
      console.log(`live preview URL   : ${global.__liveUrl}`);
      // Probe the live preview through the backend's own preview route.
      fetch(`http://localhost:5000/api/preview/${PROJECT_ID}/status`)
        .then(r => r.json().catch(() => null))
        .then(s => {
          console.log(`preview status     : ${JSON.stringify(s)}`);
          return fetch(`http://localhost:5000/api/preview/${PROJECT_ID}/`);
        })
        .then(r => console.log(`preview HTTP       : ${r.status} content-type=${r.headers.get('content-type')}`))
        .catch(e => console.log(`preview probe err  : ${e.message}`))
        .finally(() => process.exit(0));
    } else {
      console.log('live preview URL   : (none emitted)');
      process.exit(0);
    }
  }
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });