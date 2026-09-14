import { useEffect, useMemo, useState } from 'react';
import { Check, CircleAlert, Loader2, RotateCcw, Square, XCircle } from 'lucide-react';

const MAX_ITEMS = 10;
const RECOVERY_KEY = '__aiDostInterruptedTask';
const RECOVERY_TTL_MS = 15 * 60 * 1000;
const COMPOSER_SELECTOR = 'textarea[aria-label="Ask AI-Dost anything"]';

const phaseIcon = (status) => {
  if (status === 'success') return Check;
  if (status === 'canceled') return XCircle;
  if (status === 'error') return CircleAlert;
  return Loader2;
};

function mergeEvent(prev, event) {
  if (!event?.taskId) return prev;
  const current = prev[event.taskId] || { taskId: event.taskId, items: [], phase: 'idle', terminal: false };
  const item = {
    id: event.id,
    label: event.label || event.phase || 'Processing',
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
  return {
    ...prev,
    [event.taskId]: {
      ...current,
      items,
      phase: event.phase || current.phase,
      terminal: event.type === 'task_complete' || event.type === 'task_error' || event.type === 'task_canceled',
    },
  };
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
  const active = useMemo(() => Object.values(tasks).filter((task) => !task.terminal).at(-1), [tasks]);

  useEffect(() => {
    setRecovery(readRecovery());
    const handle = (event) => {
      const detail = event?.detail;
      if (!detail?.taskId) return;
      setTasks((prev) => mergeEvent(prev, detail));
      if (detail.type === 'task_started') setRecovery(null);
      if (detail.type === 'task_complete' || detail.type === 'task_canceled') {
        clearRecovery();
        setRecovery(null);
      }
      if (detail.type === 'task_error') setRecovery(readRecovery());
    };
    window.addEventListener('ai_dost_task_event', handle);
    return () => window.removeEventListener('ai_dost_task_event', handle);
  }, []);

  useEffect(() => {
    const timers = Object.values(tasks)
      .filter((task) => task.terminal)
      .map((task) => window.setTimeout(() => {
        setTasks((prev) => {
          const next = { ...prev };
          delete next[task.taskId];
          return next;
        });
      }, 3500));
    return () => timers.forEach(window.clearTimeout);
  }, [tasks]);

  const cancel = () => {
    if (active && typeof window !== 'undefined' && typeof window.aiDostCancelTask === 'function') {
      window.aiDostCancelTask(active.taskId);
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
          <RotateCcw className="w-4 h-4 mt-0.5 shrink-0 text-paper-200" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-paper-100">Pichla task ruk gaya tha</div>
            <div className="mt-1 text-[11px] text-ink-muted line-clamp-2">{recovery.message}</div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-medium text-paper-100 hover:bg-canvas-elevated" aria-label="Retry interrupted task">
                <RotateCcw className="w-3 h-3" /> Retry
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

  return (
    <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[75] w-[min(92vw,420px)] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl px-3 py-2.5" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="text-[11px] font-semibold text-paper-100">AI-Dost is working</div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-ink-muted">{active.phase}</div>
          <button type="button" onClick={cancel} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated" aria-label="Stop AI-Dost task" title="Stop task">
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {active.items.slice(-5).map((item) => {
          const Icon = phaseIcon(item.status);
          return (
            <div key={item.id} className="flex items-center gap-2 text-[11px] text-paper-200">
              <Icon className={`w-3.5 h-3.5 shrink-0 ${item.status === 'running' ? 'animate-spin' : ''}`} />
              <span className="truncate">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
