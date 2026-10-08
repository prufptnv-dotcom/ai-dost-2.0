import { useEffect, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AgentStream from './AgentStream';
import AuroraRail from './AuroraRail';
import AuroraStage from './AuroraStage';
import s from './Aurora.module.css';

/**
 * P11 A1 — "Aurora": from-scratch copilot cockpit.
 *
 * Layout: rail (plan) │ run spine + composer │ stage (preview/files).
 * The run header is the one instrument; the spine is the one signature.
 * A1 ships the full shell on mock run data — real SSE wiring lands in A2
 * (same props contract as CopilotIDE: projectId / projectName / onToast).
 */

const MOCK_PLAN = [
  { id: 'p1', label: 'Scaffold Vite + React app', status: 'done' },
  { id: 'p2', label: 'Install dependencies', status: 'done' },
  { id: 'p3', label: 'Green production build', status: 'done' },
  { id: 'p4', label: 'Style the UI — Obsidian indigo', status: 'active' },
  { id: 'p5', label: 'Wire the tasks API', status: 'todo' },
  { id: 'p6', label: 'Verify preview + screenshot', status: 'todo' },
];

const MOCK_FILES = [
  { path: 'src/App.jsx', add: 48, del: 2, isNew: false },
  { path: 'src/index.css', add: 12, del: 0, isNew: true },
  { path: 'package.json', add: 6, del: 1, isNew: false },
];

const MOCK_EVENTS = [
  {
    id: 'm1',
    kind: 'thought',
    label: 'think',
    detail: 'Plan: scaffold → install → build → style → wire API → verify',
    meta: '2s',
    tone: 'muted',
  },
  {
    id: 'm2',
    kind: 'write',
    label: 'write',
    detail: 'package.json + vite.config.js + src/main.jsx',
    meta: '+124',
    tone: 'accent',
  },
  {
    id: 'm3',
    kind: 'read',
    label: 'read',
    detail: 'src/App.jsx',
    meta: '1.2s',
    tone: 'info',
  },
  {
    id: 'm4',
    kind: 'build',
    label: 'build',
    detail: 'npm run build — exit 1 · Unexpected token }',
    meta: '3.1s',
    tone: 'err',
  },
  {
    id: 'm5',
    kind: 'fix',
    label: 'fix',
    detail: 'src/App.jsx +4 -1',
    meta: '',
    tone: 'accent',
  },
  {
    id: 'm6',
    kind: 'build',
    label: 'build',
    detail: 'npm run build — exit 0',
    meta: '2.8s',
    tone: 'ok',
  },
  {
    id: 'm7',
    kind: 'reply',
    label: 'aurora',
    detail: 'Build is green. Preview spins up next — check the Stage panel.',
    meta: 'now',
    tone: 'ok',
  },
];

const PERMISSIONS = ['ask', 'auto', 'turbo'];

function fmt(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CopilotAurora({ projectId = 'default', projectName = 'Untitled project', onToast }) {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(47);
  const [input, setInput] = useState('');
  const [permission, setPermission] = useState('auto');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const planDone = MOCK_PLAN.filter((p) => p.status === 'done').length;
  const pct = Math.round((planDone / MOCK_PLAN.length) * 100);

  function append(event) {
    setEvents((prev) => [...prev, event]);
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    append({ id: `u${Date.now()}`, kind: 'user', label: 'you', detail: text, meta: stamp(), tone: 'user' });
    setInput('');
    if (inputRef.current) inputRef.current.focus();
  }

  function stopRun() {
    if (!running) return;
    setRunning(false);
    append({
      id: `s${Date.now()}`,
      kind: 'status',
      label: 'stop',
      detail: 'run stopped',
      meta: fmt(elapsed),
      tone: 'muted',
    });
    if (typeof onToast === 'function') onToast('Run stopped');
  }

  function goClassic() {
    try {
      localStorage.setItem('ai_dost_copilot_ui', 'classic');
    } catch (_) {
      /* private mode: flag just won't persist */
    }
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      try {
        window.location.reload();
      } catch (_) {
        /* jsdom: reload is not implemented — flag write above is the contract */
      }
    }
  }

  return (
    <div className={s.shell} data-testid="aurora-shell" data-project={projectId}>
      <AuroraRail projectName={projectName} plan={MOCK_PLAN} onClassic={goClassic} />

      <div className={s.main}>
        <header className={s.head} data-testid="aurora-head">
          <span className={`${s.liveDot} ${running ? s.liveDotRun : s.liveDotIdle}`} aria-hidden="true" />
          <span className={s.headLabel} data-testid="aurora-plan-count">
            plan {planDone}/{MOCK_PLAN.length}
          </span>
          <div
            className={s.track}
            role="progressbar"
            aria-label="Plan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className={s.trackFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={s.headStep} data-testid="aurora-step">
            step 4/9
          </span>
          <span className={s.headTimer} data-testid="aurora-timer">
            {fmt(elapsed)}
          </span>
          <button
            type="button"
            className={s.stopBtn}
            data-testid="aurora-stop"
            disabled={!running}
            onClick={stopRun}
          >
            <AppIcon name="square" size={9} />
            Stop
          </button>
        </header>

        <AgentStream events={events} running={running} />

        <div className={s.composer} data-testid="aurora-composer">
          <div className={s.composerBox}>
            <textarea
              ref={inputRef}
              className={s.composerInput}
              data-testid="aurora-composer-input"
              rows={1}
              value={input}
              placeholder="Message the copilot…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="button"
              className={s.sendBtn}
              data-testid="aurora-send"
              aria-label="Send message"
              disabled={!input.trim()}
              onClick={send}
            >
              <AppIcon name="send" size={13} />
            </button>
          </div>

          <div className={s.chipRow}>
            <span className={s.chip}>
              <AppIcon name="sparkles" size={10} />
              Auto
            </span>
            <div className={s.seg} role="group" aria-label="Permission level">
              {PERMISSIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={permission === p}
                  data-testid={`perm-${p}`}
                  className={`${s.segBtn} ${permission === p ? s.segBtnOn : ''}`}
                  onClick={() => setPermission(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className={s.kbdHint}>↵ send · ⇧↵ newline</span>
          </div>
        </div>
      </div>

      <AuroraStage files={MOCK_FILES} />
    </div>
  );
}
