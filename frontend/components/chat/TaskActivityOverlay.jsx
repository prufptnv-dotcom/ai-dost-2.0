import { useEffect, useMemo, useState } from 'react';
import { Check, CircleAlert, Loader2 } from 'lucide-react';

const MAX_ITEMS = 10;

const phaseIcon = (status) => {
  if (status === 'success') return Check;
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
    status: event.type === 'task_error' ? 'error' : event.type === 'task_complete' ? 'success' : 'running',
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
      terminal: event.type === 'task_complete' || event.type === 'task_error',
    },
  };
}

export default function TaskActivityOverlay() {
  const [tasks, setTasks] = useState({});
  const active = useMemo(() => Object.values(tasks).filter((task) => !task.terminal).at(-1), [tasks]);

  useEffect(() => {
    const handle = (event) => {
      const detail = event?.detail;
      if (!detail?.taskId) return;
      setTasks((prev) => mergeEvent(prev, detail));
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

  if (!active) return null;

  return (
    <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[75] w-[min(92vw,420px)] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl px-3 py-2.5" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold text-paper-100">AI-Dost is working</div>
        <div className="text-[10px] text-ink-muted">{active.phase}</div>
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
