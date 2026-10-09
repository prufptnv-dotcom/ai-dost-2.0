import { useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AgentStream from './AgentStream';
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
  const inputRef = useRef(null);

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
        onStartPreview={run.startPreview}
        onStopPreview={run.stopPreview}
      />
    </div>
  );
}
