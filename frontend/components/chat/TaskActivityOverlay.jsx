import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import { diffLines, diffStats } from '../../lib/lineDiff';

const MAX_ITEMS = 10;
const MAX_FILE_CHARS = 200000;
const MAX_DIFF_LINES = 400;
const RECOVERY_KEY = '__aiDostInterruptedTask';
const RECOVERY_TTL_MS = 15 * 60 * 1000;
const TERMINAL_CLEANUP_MS = 6000;
const COMPOSER_SELECTOR = 'textarea[aria-label="Ask AI-Dost anything"]';

const phaseIcon = (status) => {
  if (status === 'success') return 'check';
  if (status === 'canceled') return 'errorCircle';
  if (status === 'error') return 'alertCircle';
  return 'loader';
};

function emptyTask(taskId) {
  return {
    taskId,
    items: [],
    phase: 'idle',
    terminal: false,
    plan: null,
    files: [],
    screenshot: null,
    approval: null,
    summary: null,
    verification: null,
  };
}

function upsertFile(files, filePath, kind, extra = {}) {
  if (!filePath) return files;
  const base = { path: filePath, kind };
  if (typeof extra.content === 'string') base.content = extra.content.slice(0, MAX_FILE_CHARS);
  if (extra.previous !== undefined) {
    base.previous = typeof extra.previous === 'string' ? extra.previous.slice(0, MAX_FILE_CHARS) : null;
  }
  if (typeof extra.isNew === 'boolean') base.isNew = extra.isNew;
  const existing = files.find((f) => f.path === filePath);
  if (existing) {
    return files.map((f) => (f.path === filePath ? { ...f, ...base, kind: f.kind === 'create' ? 'create' : kind } : f));
  }
  return [...files, base].slice(-20);
}

function FileDiffView({ file }) {
  const ops = useMemo(() => diffLines(file.isNew ? '' : file.previous || '', file.content || ''), [file.isNew, file.previous, file.content]);
  const stats = useMemo(() => diffStats(ops), [ops]);
  const shown = ops.slice(0, MAX_DIFF_LINES);
  const hidden = ops.length - shown.length;
  return (
    <div className="mt-1 mb-1 overflow-hidden rounded-md border border-border bg-black/40" data-testid="file-diff">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1 text-[9px] text-ink-muted">
        <AppIcon name="fileDiff" className="w-3 h-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>{file.path}</span>
        <span className="text-emerald-400">+{stats.added}</span>
        <span className="text-red-400">-{stats.removed}</span>
        <span className={`rounded px-1 ${file.isNew ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
          {file.isNew ? 'NEW' : 'MODIFIED'}
        </span>
      </div>
      <div className="max-h-48 overflow-auto px-1 py-1 font-mono text-[10px] leading-[1.35]">
        {shown.map((op, idx) => (
          <div
            key={idx}
            className={
              op.type === 'add'
                ? 'bg-emerald-500/10 text-emerald-200 whitespace-pre-wrap break-all'
                : op.type === 'del'
                  ? 'bg-red-500/10 text-red-200 whitespace-pre-wrap break-all'
                  : 'text-ink-muted whitespace-pre-wrap break-all'
            }
          >
            {op.type === 'add' ? '+ ' : op.type === 'del' ? '- ' : '  '}
            {op.text || ' '}
          </div>
        ))}
        {hidden > 0 ? <div className="px-1 pt-1 text-ink-muted">... {hidden} more lines</div> : null}
      </div>
    </div>
  );
}

function planStepTitle(step) {
  if (!step) return '';
  if (typeof step === 'string') return step;
  const base = step.title || step.action || step.label || step.id || '';
  const target = step.target || step.file || '';
  return target && base !== target ? `${base}: ${target}` : String(base);
}

function planSteps(plan) {
  if (!plan) return [];
  const raw = plan.tasks || plan.steps || [];
  return raw.map((step, idx) => ({
    key: step?.id || step?.title || step?.action || idx,
    title: planStepTitle(step),
    done: Boolean(step?.done) || ['done', 'completed', 'success'].includes(String(step?.status || '').toLowerCase()),
  })).filter((step) => step.title);
}

function mergeEvent(prev, event) {
  if (!event?.taskId) return prev;
  const current = prev[event.taskId] || emptyTask(event.taskId);
  const labelRaw = event.label || event.phase || 'Processing';
  const safeLabel = typeof labelRaw === 'object' && labelRaw !== null
    ? (labelRaw.label || labelRaw.title || labelRaw.action || labelRaw.id || 'Processing')
    : String(labelRaw);

  const item = {
    id: event.id,
    label: safeLabel,
    phase: event.phase || 'processing',
    ts: event.ts || Date.now(),
    status: event.type === 'task_canceled'
      ? 'canceled'
      : event.type === 'task_error'
        ? 'error'
        : event.type === 'task_complete'
          ? 'success'
          : 'running',
  };
  const items = event.type === 'task_chunk'
    ? current.items
    : [...current.items.filter((entry) => entry.label !== item.label), item].slice(-MAX_ITEMS);

  const isTerminal = event.type === 'task_complete' || event.type === 'task_error' || event.type === 'task_canceled';
  const payload = event.payload || {};
  const next = {
    ...current,
    items,
    phase: event.phase || current.phase,
    terminal: current.terminal || isTerminal,
  };

  if (event.type === 'task_approval') {
    next.approval = event.approval || { token: null };
  } else if (event.resumed || isTerminal) {
    next.approval = null;
  }

  if (event.type === 'task_complete' && (event.summary || safeLabel !== 'Completed')) {
    next.summary = event.summary || safeLabel;
  }

  if (event.serverType === 'plan' && payload.plan) {
    next.plan = payload.plan;
  }
  if (event.serverType === 'file_written') {
    const isNew = payload.isNew !== false;
    next.files = upsertFile(current.files, payload.file || payload.path, isNew ? 'create' : 'modify', {
      content: typeof payload.content === 'string' ? payload.content : null,
      previous: payload.previous,
      isNew,
    });
  }
  if (event.serverType === 'tool_call') {
    const tool = String(payload.action || payload.tool || '');
    if (/write|create|edit/i.test(tool)) {
      const filePath = payload.parameters?.filePath || payload.parameters?.path || payload.arguments?.filePath;
      if (filePath) next.files = upsertFile(current.files, filePath, /create/i.test(tool) ? 'create' : 'modify');
    }
  }
  if (event.screenshotUrl) {
    next.screenshot = event.screenshotUrl;
  }
  if (event.serverType === 'verification' && payload.result?.verdict) {
    next.verification = payload.result.verdict;
  }

  return { ...prev, [event.taskId]: next };
}

function readRecovery() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value?.message || !value?.startedAt || Date.now() - Number(value.startedAt) > RECOVERY_TTL_MS) {
      localStorage.removeItem(RECOVERY_KEY);
      return null;
    }
    return value;
  } catch (_) {
    try { localStorage.removeItem(RECOVERY_KEY); } catch (_) {}
    return null;
  }
}

function clearRecovery() {
  try { localStorage.removeItem(RECOVERY_KEY); } catch (_) {}
}

function retryInComposer(message) {
  const composer = document.querySelector(COMPOSER_SELECTOR);
  if (!composer) return false;

  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(composer, message);
  else composer.value = message;
  composer.dispatchEvent(new Event('input', { bubbles: true }));
  composer.focus();
  window.setTimeout(() => {
    composer.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
    }));
  }, 60);
  return true;
}

export default function TaskActivityOverlay() {
  const [tasks, setTasks] = useState({});
  const [recovery, setRecovery] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);
  const [openFile, setOpenFile] = useState(null);
  // Last task (including a just-terminated one — the cleanup timer removes it
  // after TERMINAL_CLEANUP_MS so the completion summary/error stays readable).
  const active = useMemo(() => Object.values(tasks).at(-1), [tasks]);
  const activeHasApproval = Boolean(active?.approval);

  useEffect(() => {
    setRecovery(readRecovery());
    const handle = (event) => {
      const detail = event?.detail;
      if (!detail?.taskId) return;
      setTasks((prev) => mergeEvent(prev, detail));
      if (detail.type === 'task_started') setRecovery(null);
      if (detail.type === 'task_approval') setExpanded(true);
      if (detail.type === 'task_complete' || detail.type === 'task_canceled') {
        clearRecovery();
        setRecovery(null);
      }
      if (detail.type === 'task_error') setRecovery(readRecovery());
    };
    const handleIntentPlan = (event) => {
      const detail = event?.detail;
      if (!detail?.taskId || !detail.plan) return;
      setTasks((prev) => {
        const current = prev[detail.taskId] || emptyTask(detail.taskId);
        if (current.plan) return prev;
        return { ...prev, [detail.taskId]: { ...current, plan: detail.plan } };
      });
    };
    const handleClearRecovery = () => {
      setRecovery(null);
    };

    const handleStorage = (e) => {
      if (e.key === RECOVERY_KEY && !e.newValue) {
        setRecovery(null);
      }
    };

    window.addEventListener('ai_dost_task_event', handle);
    window.addEventListener('ai_dost_intent_plan', handleIntentPlan);
    window.addEventListener('ai_dost_clear_recovery', handleClearRecovery);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('ai_dost_task_event', handle);
      window.removeEventListener('ai_dost_intent_plan', handleIntentPlan);
      window.removeEventListener('ai_dost_clear_recovery', handleClearRecovery);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (activeHasApproval) setExpanded(true);
    if (!activeHasApproval) setApproving(false);
  }, [activeHasApproval]);

  useEffect(() => {
    setOpenFile(null);
  }, [active?.taskId]);

  useEffect(() => {
    const newTimers = [];
    Object.values(tasks).forEach((task) => {
      if (task.terminal && !window[`__aiDostCleanup_${task.taskId}`]) {
        window[`__aiDostCleanup_${task.taskId}`] = true;
        const timer = window.setTimeout(() => {
          setTasks((prev) => {
            const next = { ...prev };
            delete next[task.taskId];
            return next;
          });
          delete window[`__aiDostCleanup_${task.taskId}`];
        }, TERMINAL_CLEANUP_MS);
        newTimers.push({ id: task.taskId, timer });
      }
    });

    return () => {
      newTimers.forEach(({ id, timer }) => {
        window.clearTimeout(timer);
        delete window[`__aiDostCleanup_${id}`];
      });
    };
  }, [tasks]);

  const cancel = () => {
    if (active && typeof window !== 'undefined' && typeof window.aiDostCancelTask === 'function') {
      window.aiDostCancelTask(active.taskId);
    }
  };

  const approve = () => {
    if (!active || approving) return;
    if (typeof window === 'undefined' || typeof window.aiDostApproveTask !== 'function') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'Approval unavailable — page refresh karein.' },
      }));
      return;
    }
    setApproving(true);
    const ok = window.aiDostApproveTask(active.taskId);
    if (!ok) {
      setApproving(false);
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'Approval resume nahi ho paya. Task dobara bhejein.' },
      }));
    }
  };

  const reject = () => {
    if (!active) return;
    if (typeof window !== 'undefined' && typeof window.aiDostRejectTask === 'function') {
      window.aiDostRejectTask(active.taskId);
    }
  };

  const retry = () => {
    if (!recovery?.message) return;
    const submitted = retryInComposer(recovery.message);
    if (submitted) {
      clearRecovery();
      setRecovery(null);
    } else {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'Chat composer abhi available nahi hai. Chat view open karke Retry karein.' },
      }));
    }
  };

  const dismissRecovery = () => {
    clearRecovery();
    setRecovery(null);
  };

  if (!active && !recovery) return null;

  if (!active && recovery) {
    return (
      <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[75] w-[min(92vw,500px)] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl px-4 py-3" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <AppIcon name="rotate" size={16} className="mt-0.5 shrink-0 text-paper-200" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-paper-100">Pichla task ruk gaya tha</div>
            <div className="mt-1 text-[11px] text-ink-muted line-clamp-2">{recovery.message}</div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-medium text-paper-100 hover:bg-canvas-elevated" aria-label="Retry interrupted task">
                <AppIcon name="rotate" size={12} /> Retry
              </button>
              <button type="button" onClick={dismissRecovery} className="rounded-md px-2.5 py-1.5 text-[10px] text-ink-muted hover:text-paper-100" aria-label="Dismiss interrupted task recovery">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = planSteps(active.plan);
  const title = active.approval
    ? 'Approval chahiye'
    : active.terminal
      ? (active.phase === 'success' ? 'Task poora hua' : active.phase === 'canceled' ? 'Task rok diya' : 'Task fail hua')
      : 'AI-Dost is working';
  const titleTone = active.approval
    ? 'text-amber-300'
    : active.terminal
      ? (active.phase === 'success' ? 'text-emerald-300' : 'text-red-300')
      : 'text-paper-100';

  return (
    <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[75] w-[min(92vw,420px)] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl px-3 py-2.5" role="status" aria-live="polite" aria-busy={!active.terminal}>
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${titleTone}`}>
          {active.approval ? <AppIcon name="alert" size={14} /> : null}
          {title}
          {active.files.length > 0 ? (
            <span className="text-[10px] font-normal text-ink-muted">· {active.files.length} file{active.files.length === 1 ? '' : 's'}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-ink-muted">{active.phase}</div>
          <button type="button" onClick={cancel} disabled={active.terminal} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated disabled:opacity-40" aria-label="Stop AI-Dost task" title="Stop task">
            <AppIcon name="square" size={12} /> Stop
          </button>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated" aria-label={expanded ? 'Collapse task session' : 'Expand task session'} aria-expanded={expanded}>
            {expanded ? <AppIcon name="chevronDown" size={12} /> : <AppIcon name="chevronUp" size={12} />}
          </button>
        </div>
      </div>

      {active.approval ? (
        <div className="mb-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-2" data-testid="approval-banner">
          <div className="flex items-start gap-2 text-[11px] text-amber-200">
            <AppIcon name="alert" size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{active.approval.reason || 'Sensitive operation blocked'}</div>
              {active.approval.capabilities?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {active.approval.capabilities.slice(0, 6).map((cap) => (
                    <span key={cap} className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] text-amber-200">{cap}</span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={approve} disabled={approving} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60" aria-label="Approve task">
                  {approving ? <AppIcon name="loader" size={12} /> : <AppIcon name="check" size={12} />}
                  {approving ? 'Resuming...' : 'Approve'}
                </button>
                <button type="button" onClick={reject} disabled={approving} className="rounded-md border border-border px-2.5 py-1.5 text-[10px] text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated" aria-label="Reject task">
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expanded && steps.length > 0 ? (
        <div className="mb-2 rounded-lg border border-border bg-canvas-elevated/60 px-2.5 py-2" data-testid="plan-checklist">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <AppIcon name="clipboard" size={12} /> Plan
          </div>
          <ol className="space-y-1">
            {steps.slice(0, 8).map((step, idx) => (
              <li key={step.key} className="flex items-center gap-1.5 text-[11px] text-paper-200">
                {step.done ? (
                  <AppIcon name="check" size={12} className="shrink-0 text-emerald-400" />
                ) : (
                  <span className="w-3 shrink-0 text-center text-[9px] text-ink-muted">{idx + 1}</span>
                )}
                <span className={`truncate ${step.done ? 'text-ink-muted line-through' : ''}`}>{step.title}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {expanded && active.files.length > 0 ? (
        <div className="mb-2 rounded-lg border border-border bg-canvas-elevated/60 px-2.5 py-2" data-testid="files-list">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            <AppIcon name="filePlus" size={12} /> Files changed
          </div>
          <div className="space-y-1">
            {active.files.slice(-8).map((file) => {
              const canDiff = typeof file.content === 'string';
              const isOpen = openFile === file.path;
              return (
                <div key={file.path}>
                  <button
                    type="button"
                    onClick={canDiff ? () => setOpenFile(isOpen ? null : file.path) : undefined}
                    disabled={!canDiff}
                    aria-expanded={canDiff ? isOpen : undefined}
                    data-testid={canDiff ? 'file-row' : undefined}
                    className="flex w-full items-center gap-1.5 text-[11px] text-paper-200 hover:text-white disabled:cursor-default text-left"
                    title={canDiff ? `${isOpen ? 'Hide' : 'Show'} diff — ${file.path}` : file.path}
                  >
                    <span className={`shrink-0 rounded px-1 text-[9px] ${file.kind === 'create' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
                      {file.kind === 'create' ? 'new' : 'edit'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>{file.path}</span>
                    {canDiff ? (
                      isOpen ? <AppIcon name="chevronUp" size={12} className="shrink-0 text-ink-muted" /> : <AppIcon name="chevronDown" size={12} className="shrink-0 text-ink-muted" />
                    ) : null}
                  </button>
                  {isOpen && canDiff ? <FileDiffView file={file} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {expanded && active.screenshot ? (
        <div className="mb-2 overflow-hidden rounded-lg border border-border" data-testid="session-screenshot">
          {/* transient agent screenshot (data: URL) — next/image can't optimize dynamic data URLs */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.screenshot} alt="Live preview screenshot" className="h-24 w-full object-cover object-top" />
        </div>
      ) : null}

      <div className={expanded ? 'space-y-1.5 max-h-[34vh] overflow-y-auto pr-1' : 'space-y-1.5'}>
        {(expanded ? active.items : active.items.slice(-3)).map((item, idx) => {
          const iconName = phaseIcon(item.status);
          return (
            <div key={`${item.id || item.label || 'phase'}-${item.ts || ''}-${idx}`} className="flex items-center gap-2 text-[11px] text-paper-200">
              <AppIcon name={iconName} size={14} className={`shrink-0 ${item.status === 'running' ? 'animate-spin' : ''}`} />
              <span className="truncate" title={item.label}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {active.verification ? (
        <div className={`mt-1.5 text-[10px] ${active.verification === 'FAIL' ? 'text-red-400' : 'text-emerald-400'}`} data-testid="verification-verdict">
          Verification: {active.verification}
        </div>
      ) : null}

      {active.terminal && active.summary ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-2 text-[11px] text-emerald-200" data-testid="completion-summary">
          <AppIcon name="check" size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{active.summary}{active.files.length > 0 ? ` · ${active.files.length} file${active.files.length === 1 ? '' : 's'} created/edited` : ''}</span>
        </div>
      ) : null}
    </div>
  );
}
