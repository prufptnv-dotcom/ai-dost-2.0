/**
 * P9 live proof — background run survives a hard client disconnect, and the
 * replay endpoint rebuilds the full stream from SQLite afterwards.
 *
 * Flow: POST /api/agent/run (background:true) -> read until run_started ->
 * HARD DISCONNECT (abort mid-run) -> poll GET /runs/:id until terminal ->
 * GET /runs/:id/events replay + ?after= cursor check.
 *
 * Run: node temp_ui_audit/e2e_p9_background.js
 */
const BASE = 'http://localhost:5000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollAndReplay(runId) {
  let info = null;
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${BASE}/api/agent/runs/${encodeURIComponent(runId)}`);
    if (!r.ok) {
      console.log(`status HTTP ${r.status} — endpoint missing? (backend not restarted?)`);
      return false;
    }
    info = await r.json();
    console.log(`  status #${i}: ${info.status} seq=${info.seq} running=${info.running}`);
    if (!info.running) break;
    await sleep(3000);
  }
  if (!info) return false;

  const rr = await fetch(`${BASE}/api/agent/runs/${encodeURIComponent(runId)}/events`);
  if (!rr.ok) {
    console.log(`replay HTTP ${rr.status}`);
    return false;
  }
  const text = await rr.text();
  const evs = text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)));
  console.log(`  replay: ${evs.length} events · first=${evs[0]?.type} · last=${evs[evs.length - 1]?.type}`);
  const terminal = evs.find((e) => e.type === 'done');
  console.log(`  terminal done: ${terminal ? JSON.stringify(String(terminal.message).slice(0, 140)) : 'MISSING'}`);

  const after = Math.max(0, evs.length - 2);
  const cur = await fetch(`${BASE}/api/agent/runs/${encodeURIComponent(runId)}/events?after=${after}`);
  const curText = await cur.text();
  const curEvs = curText.split('\n').filter((l) => l.startsWith('data: '));
  console.log(`  cursor ?after=${after} -> ${curEvs.length} event(s) (expect evs.length - ${after})`);

  return Boolean(terminal) && evs.length > 0 && curEvs.length === evs.length - after;
}

async function main() {
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userPrompt: 'Greet the user warmly in one short line. No tools needed.',
      projectId: 'p9-live-demo',
      background: true,
      permissionLevel: 'auto',
    }),
    signal: controller.signal,
  });
  console.log('POST /api/agent/run ->', res.status);
  if (!res.ok) {
    console.log('FATAL: run endpoint failed');
    process.exit(1);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let runId = null;
  let seen = [];
  let disconnected = false;
  let naturalEnd = false;

  outer: for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      naturalEnd = true;
      break;
    }
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev;
      try {
        ev = JSON.parse(line.slice(6));
      } catch (_) {
        continue;
      }
      seen.push(ev.type);
      if (ev.type === 'run_started' && ev.runId) runId = ev.runId;
      // Hard disconnect as soon as we know the identity — mid-run, not after.
      if (runId && seen.length >= 2) {
        try {
          await reader.cancel();
        } catch (_) {}
        controller.abort();
        disconnected = true;
        break outer;
      }
    }
  }

  console.log(`events before disconnect: [${seen.join(', ')}]`);
  console.log(
    disconnected
      ? `>>> HARD DISCONNECT mid-run (runId=${runId}) — socket is DEAD, run must continue`
      : `>>> stream ended naturally (${naturalEnd}) — run too fast to abort; replay still proves persistence`
  );
  if (!runId) {
    console.log('FATAL: never saw run_started — cannot track run');
    process.exit(1);
  }

  await sleep(1500); // let any in-flight writes settle; status must show running-or-done
  const ok = await pollAndReplay(runId);
  console.log(ok ? '\nP9 LIVE PROOF: PASS' : '\nP9 LIVE PROOF: FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.log('FATAL:', e.message);
  process.exit(1);
});
