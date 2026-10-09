import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AgentStream from './AgentStream';
import AuroraPalette from './AuroraPalette';
import AuroraRail from './AuroraRail';
import AuroraStage from './AuroraStage';
import useAuroraRun from './useAuroraRun';
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
  const inputRef = useRef(null);
  const paletteOpenRef = useRef(false);
  const stageOpenRef = useRef(false);

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
  }, [goClassic, live, permission, run, showStage]);

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
  }, [run, showStage]);

  const planDone = run.plan.filter((p) => p.status === 'done').length;
  const hasPlan = run.plan.length > 0;
  const pct = hasPlan ? Math.round((planDone / run.plan.length) * 100) : 0;
  const planLabel = hasPlan ? `plan ${planDone}/${run.plan.length}` : run.running ? 'running' : 'ready';

  function handleSend() {
    const text = input.trim();
    if (!text || run.running) return;
    setInput('');
    run.send(text, { permissionLevel: permission });
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

        <AgentStream events={run.rows} running={run.running} />

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
              placeholder={run.running ? 'Run in progress — Stop to interrupt…' : 'Message the copilot…'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
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
