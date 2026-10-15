'use strict';
// P12 live E2E: give the copilot (director path — same contract as the Aurora
// composer) a full-stack portfolio prompt and capture the whole SSE stream.
// P12.3: approval gates auto-re-POST with the minted token (up to 5 passes),
// every line is flushed synchronously (crash-safe JSONL), and the terminal
// event is printed in FULL (honesty check for P12.1/P12.3 fields).
// Usage: node temp_ui_audit/e2e_portfolio_run.js <projectId>
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:5000';
const PROJECT_ID = process.argv[2] || 'default'; // created via POST /api/v1/memory/project
const TASK_ID = `aurora-${Date.now().toString(36)}`;
const LOG = path.join(__dirname, 'portfolio_e2e_log.jsonl');
const MAX_APPROVAL_PASSES = 5;
const PROMPT = [
  'Ek complete full-stack portfolio website banao (React + Vite frontend, Express backend).',
  'Requirements:',
  '1) Frontend: Home, About, Projects, Contact sections — responsive, modern dark theme, navigation bar.',
  '2) Backend: Express REST API — GET /api/projects (sample projects JSON) aur POST /api/contact (validates + saves to memory).',
  '3) Frontend fetch se API integrate karo (projects section me data dikhao).',
  '4) package.json me scripts: dev (frontend+backend together) aur build.',
  '5) npm install chala kar npm run build se verify karo — errors theek karo.',
  '6) README.md likho (setup instructions).'
].join('\n');

function summarize(ev) {
  switch (ev.type) {
    case 'director_plan':
      return `plan=${ev.taskCount || (ev.plan && ev.plan.tasks && ev.plan.tasks.length) || '?'} tasks` +
        (Array.isArray(ev.plan && ev.plan.tasks)
          ? ` :: ${ev.plan.tasks.map(t => t.objective || t.specialty || t).slice(0, 6).join(' | ').slice(0, 220)}` : '');
    case 'step':
      return `${ev.status || ''} ${ev.tool || ''} ${ev.description || (ev.stepLog && ev.stepLog.action) || ''}`.slice(0, 160);
    case 'file_written':
    case 'file_changed':
      return `${ev.path || ev.file || ''}${ev.isNew ? ' [NEW]' : ''}${ev.previous != null ? ` (rewrite ${String(ev.previous).length}->${String(ev.content || '').length})` : ''}`;
    case 'agent_status':
      return `${ev.agent || ''} :: ${String(ev.message || '').slice(0, 140)}`;
    case 'terminal_output':
      return String(ev.output || ev.message || '').trim().slice(0, 100);
    case 'verification':
      return `verdict=${ev.verdict || ev.status || '?'} ${String(ev.message || ev.summary || '').slice(0, 140)}`;
    case 'dev_server':
      return `state=${ev.state} url=${ev.url || ''} port=${ev.hostPort || ''}`;
    case 'code_context':
      return `hits=${ev.hits} stats=${JSON.stringify(ev.stats || {}).slice(0, 140)}`;
    case 'gate_approval_required':
    case 'gate_approval_invalid':
    case 'gate_blocked':
      return JSON.stringify(ev.gate || ev.message || ev).slice(0, 300);
    case 'done':
    case 'director_complete':
    case 'director_canceled':
    case 'error':
    case 'director_error':
      return `MSG: ${ev.message || ''} | filesWritten=${ev.filesWritten} writeAttempts=${ev.writeAttempts} changedPaths=${JSON.stringify(ev.changedPaths)} tasksSkipped=${ev.tasksSkipped} | verified=${ev.verified}` +
        (ev.verification ? ` | verification=${JSON.stringify(ev.verification).slice(0, 300)}` : '');
    case 'thinking':
    case 'notice':
      return String(ev.message || '').slice(0, 120);
    default:
      return String(ev.message || ev.action || '').slice(0, 120);
  }
}

// Reads ONE SSE stream to its end (or terminal event) and returns
// { terminal: <event|null>, gate: <event|null>, counts, files }.
async function readStream(res, started, counts, files) {
  const terminalTypes = new Set(['done', 'error', 'director_complete', 'director_canceled', 'director_error']);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let terminal = null;
  let gate = null;

  outer: while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
      if (!dataLine) continue;
      let ev;
      try { ev = JSON.parse(dataLine.slice(6)); } catch { continue; }
      const t = ev.type || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
      // Sync flush: a crash/timeout mid-run must still leave a full JSONL.
      fs.writeSync(LOG_FD, JSON.stringify(ev) + '\n');
      if (t === 'file_written' || t === 'file_changed') {
        if (ev.path && !files.includes(ev.path)) files.push(ev.path);
      }
      const ts = new Date(Date.now() - started).toISOString().slice(14, 19);
      console.log(`${ts} [pass] [${t}] ${summarize(ev)}`);
      if (t === 'gate_approval_required') gate = ev;
      if (t === 'gate_blocked' || t === 'gate_approval_invalid') { terminal = ev; break outer; }
      // Keep reading past the gate — the stream ends with a paused `done`
      // (P12.3) and we want its full JSON before re-POSTing the approval.
      if (terminalTypes.has(t)) { terminal = ev; break outer; }
    }
  }
  return { terminal, gate };
}

let LOG_FD = -1;

// ── Serialization lock (P12.x) ──────────────────────────────────────────────
// Runs #10/#11 were accidentally launched CONCURRENTLY against the SAME
// workspace — steps of two runs interleaved and the forensic picture (who
// wrote what, when) became undecidable. One run at a time, enforced by a PID
// lockfile: a second runner exits immediately with a clear message.
const LOCK = path.join(__dirname, '.portfolio_e2e.lock');

function acquireLock() {
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    try {
      process.kill(held.pid, 0); // alive → another run is streaming right now
      console.error(`E2E LOCK: another run (pid ${held.pid}, started ${held.started || '?'}) holds ${LOCK}.`);
      console.error('Wait for it to finish, or delete the lock file if that process is really gone.');
      process.exit(10);
    } catch (_) {
      // holder is dead → stale lock, reclaim it
    }
  } catch (_) {
    // no/corrupt lock → take it
  }
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, started: new Date().toISOString(), projectId: PROJECT_ID }));
}

function releaseLock() {
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    if (held.pid === process.pid) fs.unlinkSync(LOCK);
  } catch (_) {}
}

process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

async function main() {
  acquireLock();
  LOG_FD = fs.openSync(LOG, 'w');
  console.log(`POST ${BASE}/api/agent/run  projectId=${PROJECT_ID} task=${TASK_ID}`);
  console.log(`log: ${LOG}`);
  const started = Date.now();
  const counts = {};
  const files = [];

  const timer = setTimeout(() => {
    console.error('\nTIMEOUT after 60 min — aborting stream.');
    process.exit(3);
  }, 30 * 60 * 1000);

  let approvalToken = null;
  let pass = 0;
  let result = null;

  while (pass < MAX_APPROVAL_PASSES) {
    pass += 1;
    const body = {
      userPrompt: PROMPT,
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      chatHistory: [],
      copilotDirector: true,
      permissionLevel: 'auto',
      preferredModel: 'auto',
    };
    if (approvalToken) body.approvalToken = approvalToken;
    if (pass > 1) console.log(`\n>>> pass ${pass}: re-POST with approvalToken=${String(approvalToken).slice(0, 24)}…\n`);

    const res = await fetch(`${BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-dost-task-id': TASK_ID, 'x-user-id': 'demo_user_id' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 600)}`);
      process.exit(2);
    }

    const { terminal, gate } = await readStream(res, started, counts, files);
    result = { terminal, gate };
    if (!terminal && !gate) break; // stream ended without anything (disconnect)

    const token = gate && gate.gate && gate.gate.approval_token;
    const pausedDone = terminal && terminal.type === 'done' && terminal.approvalGate;
    if (token && (pausedDone || !terminal)) {
      approvalToken = token;
      continue; // approved automatically — resume the SAME run with the token
    }
    break; // real completion / error / blocked
  }

  clearTimeout(timer);
  fs.closeSync(LOG_FD);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log('\n================ E2E RUN SUMMARY ================');
  console.log(`duration: ${secs}s | approval passes: ${pass}`);
  console.log(`event counts: ${JSON.stringify(counts)}`);
  console.log(`files touched (${files.length}): ${files.join(', ')}`);

  const terminal = result && result.terminal;
  if (terminal) {
    console.log(`\n----- FULL TERMINAL EVENT (${terminal.type}) -----`);
    console.log(JSON.stringify(terminal, null, 2));
    console.log('----- END TERMINAL EVENT -----');
    const ok = ['done', 'director_complete'].includes(terminal.type) && terminal.type !== 'error';
    process.exit(ok ? 0 : 5);
  } else if (result && result.gate) {
    console.log('terminal: GATE without completion (approval never resolved)');
    console.log(JSON.stringify(result.gate, null, 2).slice(0, 1200));
    process.exit(4);
  } else {
    console.log('terminal: stream ended WITHOUT a terminal event (client disconnect?)');
    process.exit(5);
  }
}

main().catch((err) => { console.error('RUNNER ERROR:', err); process.exit(9); });
