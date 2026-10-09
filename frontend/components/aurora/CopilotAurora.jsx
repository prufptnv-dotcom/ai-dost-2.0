import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AgentStream from './AgentStream';
import AuroraPalette from './AuroraPalette';
import AuroraRail from './AuroraRail';
import AuroraStage from './AuroraStage';
import useAuroraRun from './useAuroraRun';
import { detectMention, filePathOf, parseMentionPaths } from '../../lib/copilotMentions';
import s from './Aurora.module.css';

/**
 * P11 A2 — "Aurora" cockpit on the REAL run stream.
 *
 * Layout: rail (plan) │ run spine + composer │ stage (preview/files).
 * The run header is the one instrument; the spine is the one signature.
 * A1 shipped this shell on mock data — A2 wires it to POST /api/agent/run
 * (SSE) via useAuroraRun: live plan, live file diffs, real stop, approval gate.
 * Props contract matches CopilotIDE: projectId / projectName / onToast.
 *
 * P11 A4 — command layer: Ctrl/⌘K palette (commands + run-file quick jump),
 * Alt+P/Alt+F stage tabs, Alt+S preview server toggle, Esc closes palette or
 * the narrow-viewport stage overlay (the header Stage button toggles it when
 * the media query hides the third column).
 */

const PERMISSIONS = ['ask', 'auto', 'turbo'];
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// A5 model picker — keep in sync with views/CopilotIDE.jsx MODEL_OPTIONS;
// both UIs share localStorage key `ai_dost_copilot_model` so the preference
// follows the user across Classic/Aurora (preferred provider rotates
// server-side cascade; fallback always on).
const MODEL_OPTIONS = [
  { v: 'auto', l: 'Auto (cascade)' },
  { v: 'gemini', l: 'Gemini first' },
  { v: 'groq', l: 'Groq first' },
  { v: 'opencode', l: 'OpenCode (free gateway)' },
  { v: 'openrouter', l: 'OpenRouter first' },
  { v: 'openrouter:nemotron_3_super', l: 'Nemotron 3 Super' },
  { v: 'openrouter:north_mini_code', l: 'Cohere North Code' },
  { v: 'openrouter:laguna_s', l: 'Laguna-S Agent' },
  { v: 'openrouter:lfm_reasoning', l: 'Liquid LFM 2.5' },
  { v: 'ollama', l: 'Ollama local' },
];

function fmt(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export default function CopilotAurora({
  projectId = 'default',
  projectName = 'Untitled project',
  onToast,
}) {
  const run = useAuroraRun({ projectId, onToast });
  const [input, setInput] = useState('');
  const [permission, setPermission] = useState('auto');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [stageTab, setStageTab] = useState('preview');
  const [stageOpen, setStageOpen] = useState(false); // narrow-viewport overlay
  const [focusPath, setFocusPath] = useState(null); // palette → file diff jump
  const [model, setModel] = useState('auto'); // A5 picker (localStorage-shared)
  const [modelMenu, setModelMenu] = useState(false);
  const [wsFiles, setWsFiles] = useState([]); // A5: workspace list for @mentions
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const inputRef = useRef(null);
  const paletteOpenRef = useRef(false);
  const stageOpenRef = useRef(false);
  const modelWrapRef = useRef(null);
  const wasRunningRef = useRef(false);

  // A5: shared model preference — read AFTER mount so server/first paint is
  // always 'auto' (no hydration mismatch, same pattern as the UI flag).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('ai_dost_copilot_model');
      if (saved && MODEL_OPTIONS.some((o) => o.v === saved)) setModel(saved);
    } catch (_) {
      /* private mode: default stays auto */
    }
  }, []);

  // Workspace file list → @file mention suggestions + projectFiles for the
  // director (classic parity: mentioned files first, then the rest).
  const loadWsFiles = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/v1/memory/project/${encodeURIComponent(projectId)}`);
      if (!res || typeof res.json !== 'function') return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data && data.files) ? data.files : [];
      const seen = new Set();
      const next = [];
      list.forEach((f) => {
        const p = filePathOf(f);
        if (p && !seen.has(p)) {
          seen.add(p);
          next.push({ path: p, content: f.content || '' });
        }
      });
      if (next.length) setWsFiles(next); // empty response → keep last good list
    } catch (_) {
      /* offline → mentions degrade to plain text, runs still work */
    }
  }, [projectId]);

  useEffect(() => {
    loadWsFiles();
  }, [loadWsFiles]);

  // A run can create files — refresh the mention list when it finishes.
  useEffect(() => {
    if (wasRunningRef.current && !run.running) loadWsFiles();
    wasRunningRef.current = run.running;
  }, [run.running, loadWsFiles]);

  // Model menu: Esc (shared window map) + outside click close.
  useEffect(() => {
    if (!modelMenu) return undefined;
    function onDown(e) {
      if (modelWrapRef.current && !modelWrapRef.current.contains(e.target)) setModelMenu(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [modelMenu]);

  useEffect(() => {
    paletteOpenRef.current = paletteOpen;
  }, [paletteOpen]);
  useEffect(() => {
    stageOpenRef.current = stageOpen;
  }, [stageOpen]);

  const live = run.devServer.state === 'READY';

  // Palette + keyboard actions (A4). `showStage` opens the overlay too — on
  // wide screens the class is a no-op (media-scoped CSS), on narrow ones it
  // surfaces the panel the user just asked for.
  const showStage = useCallback((tab) => {
    setStageTab(tab);
    setStageOpen(true);
  }, []);

  const goClassic = useCallback(() => {
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
  }, []);

  // A5: @file mention suggestions (lib/copilotMentions — shared with classic).
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return wsFiles.map(filePathOf).filter((p) => p && p.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, wsFiles]);

  const insertMention = useCallback(
    (filePath) => {
      const el = inputRef.current;
      const value = input;
      const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
      const before = value.slice(0, caret);
      const after = value.slice(caret);
      const token = before.match(/@[^\s@]*$/);
      const start = token ? before.length - token[0].length : before.length;
      const next = `${before.slice(0, start)}@${filePath} ${after}`;
      setInput(next);
      setMentionQuery(null);
      setMentionIdx(0);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const pos = start + filePath.length + 2;
        if (typeof el.setSelectionRange === 'function') el.setSelectionRange(pos, pos);
      });
    },
    [input]
  );

  // A5: one submit path — @file context (mentioned-first projectFiles +
  // contextFiles) + permission/model → run.send. Retry reuses it verbatim.
  const submitPrompt = useCallback(
    (raw) => {
      const text = String(raw || '').trim();
      if (!text || run.running) return;
      const mentionedFiles = parseMentionPaths(text);
      const mentionedSet = new Set(mentionedFiles);
      const orderedFiles = wsFiles.length
        ? mentionedFiles.length
          ? [
              ...wsFiles.filter((f) => mentionedSet.has(f.path)),
              ...wsFiles.filter((f) => !mentionedSet.has(f.path)),
            ]
          : wsFiles
        : null;
      setInput('');
      setMentionQuery(null);
      run.send(text, {
        permissionLevel: permission,
        preferredModel: model,
        ...(orderedFiles ? { projectFiles: orderedFiles } : {}),
        ...(mentionedFiles.length ? { contextFiles: mentionedFiles } : {}),
      });
    },
    [model, permission, run, wsFiles]
  );

  const retryLast = useCallback(() => {
    if (run.running || !run.lastPrompt) return;
    submitPrompt(run.lastPrompt);
  }, [run, submitPrompt]);

  const paletteActions = useMemo(() => {
    const acts = [
      {
        id: 'preview-start',
        group: 'preview',
        label: 'Preview: start dev server',
        icon: 'play',
        hint: live ? 'already live' : run.previewBusy ? 'starting…' : '⌥S',
        disabled: live || run.previewBusy,
        run: run.startPreview,
      },
      {
        id: 'preview-stop',
        group: 'preview',
        label: 'Preview: stop dev server',
        icon: 'square',
        hint: live ? '⌥S' : 'not running',
        disabled: !live,
        run: run.stopPreview,
      },
      { id: 'stage-preview', group: 'stage', label: 'Stage: open Preview', icon: 'eye', hint: '⌥P', run: () => showStage('preview') },
      { id: 'stage-files', group: 'stage', label: 'Stage: open Files', icon: 'folderTree', hint: '⌥F', run: () => showStage('files') },
      {
        id: 'run-stop',
        group: 'run',
        label: 'Run: stop',
        icon: 'square',
        disabled: !run.running,
        run: run.stop,
      },
      {
        id: 'run-retry',
        group: 'run',
        label: 'Run: retry last prompt',
        icon: 'refresh',
        hint: run.lastPrompt ? '' : 'no prompt yet',
        disabled: run.running || !run.lastPrompt,
        run: retryLast,
      },
      ...PERMISSIONS.map((p) => ({
        id: `perm-${p}`,
        group: 'permission',
        label: `Permission: ${p}`,
        icon: 'shield',
        hint: permission === p ? 'active' : '',
        run: () => setPermission(p),
      })),
      { id: 'classic', group: 'ui', label: 'UI: switch to Classic UI', icon: 'columns', run: goClassic },
      ...run.files.map((f) => ({
        id: `file-${f.path}`,
        group: 'file',
        label: f.path,
        icon: f.isNew ? 'file' : 'fileDiff',
        hint: f.isNew ? 'NEW' : `+${f.add} −${f.del}`,
        run: () => {
          setFocusPath(f.path);
          showStage('files');
        },
      })),
    ];
    return acts;
  }, [goClassic, live, permission, retryLast, run, showStage]);

  // Window-level command map (A4): palette toggle works from anywhere
  // (including inside the composer), Alt+mnemonics drive the stage/preview,
  // Esc closes the palette (owned by its input) or the narrow stage overlay.
  // CAPTURE phase + stopImmediatePropagation on the handled keys: the app-wide
  // "Search & actions" palette listens on the bubble path through React's root,
  // so a plain window listener + preventDefault lets BOTH palettes open.
  useEffect(() => {
    function onKey(e) {
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setPaletteOpen((o) => !o);
        return;
      }
      if (paletteOpenRef.current) return; // palette input owns Esc/arrows
      if (k === 'Escape' && modelMenu) {
        setModelMenu(false);
        return;
      }
      if (k === 'Escape' && stageOpenRef.current) {
        setStageOpen(false);
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (k === 'p' || k === 'P') {
          e.preventDefault();
          e.stopImmediatePropagation();
          showStage('preview');
        } else if (k === 'f' || k === 'F') {
          e.preventDefault();
          e.stopImmediatePropagation();
          showStage('files');
        } else if (k === 's' || k === 'S') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (run.devServer.state === 'READY') run.stopPreview();
          else if (run.devServer.state !== 'STARTING' && !run.previewBusy) run.startPreview();
        }
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modelMenu, run, showStage]);

  const planDone = run.plan.filter((p) => p.status === 'done').length;
  const hasPlan = run.plan.length > 0;
  const pct = hasPlan ? Math.round((planDone / run.plan.length) * 100) : 0;
  const planLabel = hasPlan ? `plan ${planDone}/${run.plan.length}` : run.running ? 'running' : 'ready';

  function handleSend() {
    submitPrompt(input);
  }

  return (
    <div
      className={`${s.shell} ${stageOpen ? s.stageOpen : ''}`}
      data-testid="aurora-shell"
      data-project={projectId}
      data-stage-open={stageOpen ? 'true' : 'false'}
    >
      <AuroraRail projectName={projectName} plan={run.plan} onClassic={goClassic} />

      <div className={s.main}>
        <header className={s.head} data-testid="aurora-head">
          <span
            className={`${s.liveDot} ${run.running ? s.liveDotRun : s.liveDotIdle}`}
            aria-hidden="true"
          />
          <span className={s.headLabel} data-testid="aurora-plan-count">
            {planLabel}
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
          {(run.running || run.stepCount > 0) && (
            <span className={s.headStep} data-testid="aurora-steps">
              steps {run.stepCount}
            </span>
          )}
          {(run.running || run.elapsed > 0) && (
            <span className={s.headTimer} data-testid="aurora-timer">
              {fmt(run.elapsed)}
            </span>
          )}
          {/* A5: preferred-model picker (shared localStorage with classic) */}
          <div className={s.modelWrap} ref={modelWrapRef}>
            <button
              type="button"
              className={s.modelChip}
              data-testid="model-chip"
              aria-haspopup="listbox"
              aria-expanded={modelMenu}
              onClick={() => setModelMenu((o) => !o)}
            >
              <AppIcon name="cpu" size={11} />
              <span data-testid="model-chip-label">{MODEL_OPTIONS.find((o) => o.v === model)?.l || 'auto'}</span>
              <AppIcon name="chevronDown" size={9} />
            </button>
            {modelMenu && (
              <div className={s.modelMenu} role="listbox" aria-label="Preferred model" data-testid="model-menu">
                {MODEL_OPTIONS.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="option"
                    aria-selected={model === o.v}
                    data-testid={`model-opt-${o.v}`}
                    className={`${s.modelOpt} ${model === o.v ? s.modelOptOn : ''}`}
                    onClick={() => {
                      setModel(o.v);
                      setModelMenu(false);
                      try {
                        window.localStorage.setItem('ai_dost_copilot_model', o.v);
                      } catch (_) {
                        /* private mode: preference just won't persist */
                      }
                      if (typeof onToast === 'function') onToast(`Model: ${o.l}`);
                    }}
                  >
                    <span>{o.l}</span>
                    {model === o.v && <AppIcon name="check" size={10} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={s.stageToggle}
            data-testid="stage-toggle"
            aria-pressed={stageOpen}
            aria-label="Toggle preview stage"
            onClick={() => setStageOpen((o) => !o)}
          >
            <AppIcon name="columns" size={12} />
            Stage
          </button>
          <button
            type="button"
            className={s.stopBtn}
            data-testid="aurora-stop"
            disabled={!run.running}
            onClick={run.stop}
          >
            <AppIcon name="square" size={9} />
            Stop
          </button>
        </header>

        <AgentStream
          events={run.rows}
          running={run.running}
          onRetry={run.lastPrompt && !run.running ? retryLast : null}
        />

        <div className={s.composer} data-testid="aurora-composer">
          {run.approval && (
            <div className={s.approvalBar} data-testid="approval-banner" role="alert">
              <AppIcon name="shield" size={13} />
              <span className={s.approvalMsg}>Approval needed to continue this run</span>
              <button
                type="button"
                className={s.approveBtn}
                data-testid="approve-btn"
                onClick={run.approve}
              >
                Approve
              </button>
              <button
                type="button"
                className={s.rejectBtn}
                data-testid="reject-btn"
                onClick={run.dismissApproval}
              >
                Reject
              </button>
            </div>
          )}

          <div className={s.composerBox}>
            <textarea
              ref={inputRef}
              className={s.composerInput}
              data-testid="aurora-composer-input"
              rows={1}
              value={input}
              placeholder={run.running ? 'Run in progress — Stop to interrupt…' : 'Message the copilot… (@ for files)'}
              onChange={(e) => {
                setInput(e.target.value);
                const caret = e.target.selectionStart ?? e.target.value.length;
                setMentionQuery(detectMention(e.target.value, caret));
                setMentionIdx(0);
              }}
              onKeyDown={(e) => {
                // A5: mention dropdown owns ↑↓/Tab/Enter while it is open
                if (mentionQuery !== null && mentionMatches.length) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIdx((i) => (i + 1) % mentionMatches.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                    return;
                  }
                  if (e.key === 'Tab' || e.key === 'Enter') {
                    e.preventDefault();
                    insertMention(mentionMatches[mentionIdx]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMentionQuery(null);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {mentionQuery !== null && mentionMatches.length > 0 && (
              <div className={s.mentionPop} role="listbox" aria-label="File mentions" data-testid="mention-pop">
                {mentionMatches.map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={i === mentionIdx}
                    data-testid="mention-item"
                    className={`${s.mentionItem} ${i === mentionIdx ? s.mentionItemOn : ''}`}
                    onMouseEnter={() => setMentionIdx(i)}
                    // mousedown before click: click would move the caret first
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(p);
                    }}
                  >
                    <AppIcon name="file" size={11} />
                    <span className={s.mentionPath}>{p}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={s.sendBtn}
              data-testid="aurora-send"
              aria-label="Send message"
              disabled={!input.trim() || run.running}
              onClick={handleSend}
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

      <AuroraStage
        files={run.files}
        contents={run.contents}
        projectId={projectId}
        devServer={run.devServer}
        previewBusy={run.previewBusy}
        tab={stageTab}
        onTabChange={setStageTab}
        focusPath={focusPath}
        onStartPreview={run.startPreview}
        onStopPreview={run.stopPreview}
      />

      {/* narrow-viewport backdrop (CSS shows it only under the media query) */}
      {stageOpen && (
        <div
          className={s.backdrop}
          data-testid="stage-backdrop"
          aria-hidden="true"
          onClick={() => setStageOpen(false)}
        />
      )}

      <AuroraPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}
