import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, BrainCircuit, CheckCircle2, Loader2, Play, RotateCcw, ShieldCheck, Terminal, Wrench, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const CopilotIDE = dynamic(() => import('./CopilotIDE'), { ssr: false });

const DIRECTOR_INSTRUCTION = `You are the Director/Boss agent for AI-Dost Copilot. The user provides ONE outcome request and you own the entire delivery. Automatically inspect the existing workspace and decide the minimum sufficient number of tasks and execution steps. Do not expose a manual task-selection workflow to the user. Decompose only as much as needed; a trivial request may be one task while a complex project may require many specialist phases. Delegate according to need (requirements, research, frontend, backend, integration, data, testing, verification, visual QA, repair). Reuse existing code and start from the affected subsystem for upgrades/fixes. Never rebuild unrelated code. Use registered MCP tools, skills, web research, graphics/media tools, database tools, sandbox tooling, terminal tooling, and browser/preview verification when they materially help. For fixable failures, diagnose the root cause, repair it, and re-run the affected checks automatically. For UI work, inspect the live preview and interact with important controls when browser tooling permits. Continue until the requested outcome is working and the final verification gate passes, or a concrete external blocker truly prevents completion. Return evidence and remaining blockers only after the autonomous run ends.`;

function parseEventPayload(raw, onEvent) {
  if (!raw) return;
  const lines = raw.split(/\n\n+/);
  for (const block of lines) {
    const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine) continue;
    const payload = dataLine.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try { onEvent(JSON.parse(payload)); } catch (_) {}
  }
}

export default function AutonomousCopilotDirector({ projectId = 'copilot-workspace', projectName = 'Copilot Workspace', onToast }) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle');
  const controllerRef = useRef(null);

  const log = useCallback((text, type = 'info') => {
    setEvents((prev) => [...prev.slice(-99), { id: `${Date.now()}-${Math.random()}`, text, type }]);
  }, []);

  const run = useCallback(async () => {
    const request = input.trim();
    if (!request || running) return;

    const taskId = `copilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setStatus('planning');
    setEvents([]);
    log('Director received the request. Inspecting workspace and selecting the optimal execution path…', 'plan');

    const plan = {
      taskId,
      intent: {
        type: 'task',
        requiresTool: true,
        originalMessage: `${DIRECTOR_INSTRUCTION}\n\nUSER OUTCOME REQUEST:\n${request}`,
      },
    };

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-AI-Dost-Task-Id': taskId },
        body: JSON.stringify({
          chatTaskPlan: plan,
          taskId,
          projectId,
          userPrompt: request,
          projectName,
        }),
      });

      if (!response.ok) throw new Error(`Director request failed (${response.status})`);
      setStatus('running');

      if (!response.body) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.message || payload?.error || 'Autonomous run completed.';
        log(message, payload?.success === false ? 'error' : 'success');
        setStatus(payload?.success === false ? 'error' : 'success');
        onToast?.(message, payload?.success === false ? 'error' : 'success');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\n\n+/);
        buffer = chunks.pop() || '';
        for (const chunk of chunks) {
          parseEventPayload(chunk, (event) => {
            const phase = event.phase || event.type || '';
            if (phase) setStatus(phase);
            if (event.type === 'task_phase') log(`${event.phase || 'task'}: ${event.status || ''}`.trim(), event.phase === 'error' ? 'error' : event.phase === 'success' ? 'success' : 'step');
            else if (event.type === 'task_error') log(event.error || 'Autonomous task failed', 'error');
            else if (event.type === 'task_canceled') log('Autonomous task canceled.', 'warning');
            else if (event.type === 'task_complete') log(`Director finished: ${event.status || 'completed'}`, event.status === 'SUCCEEDED' ? 'success' : 'error');
            else if (event.action || event.stepLog?.action) log(`${event.stepLog?.action || event.action}${event.stepLog?.result?.message ? ` — ${event.stepLog.result.message}` : ''}`, 'step');
          });
        }
      }

      log('Director run ended. Final workspace state is available in the IDE.', 'success');
      setStatus('complete');
      onToast?.('Copilot Director finished the autonomous run.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') {
        log('Run stopped. Completed changes remain in the workspace.', 'warning');
        setStatus('stopped');
      } else {
        log(error?.message || 'Autonomous run failed.', 'error');
        setStatus('error');
        onToast?.(error?.message || 'Autonomous run failed.', 'error');
      }
    } finally {
      controllerRef.current = null;
      setRunning(false);
    }
  }, [input, log, onToast, projectId, projectName, running]);

  const stop = useCallback(() => controllerRef.current?.abort(), []);
  const reset = useCallback(() => {
    if (running) return;
    setInput('');
    setEvents([]);
    setStatus('idle');
  }, [running]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas-base">
      <CopilotIDE projectId={projectId} projectName={projectName} onToast={onToast} />

      <motion.aside
        initial={false}
        className="absolute top-3 right-3 z-[80] w-[min(400px,calc(100%-24px))] rounded-xl border border-border bg-canvas-surface/95 shadow-2xl backdrop-blur-xl overflow-hidden"
      >
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-canvas-elevated/70">
          <BrainCircuit size={15} className="text-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-paper-100">Copilot Director</div>
            <div className="text-[8px] font-mono text-ink-muted">one input → plan → build → repair → verify</div>
          </div>
          <span className="text-[8px] font-mono text-ink-muted uppercase">{running ? status : status}</span>
        </div>

        <div className="p-2.5 space-y-2 border-b border-border">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                run();
              }
            }}
            disabled={running}
            rows={6}
            placeholder="Bas batao kya banana, fix, upgrade, integrate ya verify karna hai…"
            className="w-full resize-none rounded-lg border border-border bg-canvas-base px-2.5 py-2 text-[10px] leading-[1.35] text-paper-100 placeholder:text-ink-muted outline-none focus:border-accent/50"
          />
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={run} disabled={running || !input.trim()} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold bg-accent text-black disabled:opacity-40">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />}
              {running ? 'Autonomous run in progress…' : 'Build / Fix / Upgrade'}
            </button>
            {running ? (
              <button type="button" onClick={stop} className="rounded-lg px-2 py-1.5 border border-border text-paper-200" title="Stop autonomous run">
                <X size={11} />
              </button>
            ) : null}
            <button type="button" onClick={reset} disabled={running} className="rounded-lg px-2 py-1.5 border border-border text-paper-200 disabled:opacity-30" title="Reset">
              <RotateCcw size={11} />
            </button>
          </div>
        </div>

        <div className="px-2.5 py-2 border-b border-border text-[8px] font-mono text-ink-muted flex items-center justify-between">
          <span>{running ? 'Director owns the run — no manual task management required.' : 'Ready for one outcome request.'}</span>
          <span className="flex items-center gap-1"><ShieldCheck size={9} className="text-accent" /> supervised</span>
        </div>

        <div className="max-h-[42vh] overflow-y-auto p-2.5 space-y-1.5">
          <AnimatePresence initial={false}>
            {events.length === 0 ? (
              <div className="rounded-lg border border-border bg-canvas-base p-3 text-[9px] text-ink-muted leading-[1.4]">
                <div className="flex items-center gap-1.5 text-paper-100 font-semibold mb-1.5"><Terminal size={10} /> What happens automatically</div>
                Request interpretation → workspace inspection → adaptive execution → automatic repair → tests/build → preview/interaction QA when needed → final verification.
              </div>
            ) : events.map((event) => (
              <div key={event.id} className={`rounded-md border px-2 py-1.5 text-[8px] font-mono leading-[1.3] ${event.type === 'error' ? 'border-red-500/20 text-red-300 bg-red-500/5' : event.type === 'success' ? 'border-accent/20 text-accent bg-accent/5' : event.type === 'warning' ? 'border-amber-500/20 text-amber-300 bg-amber-500/5' : 'border-border text-ink-muted bg-canvas-elevated/30'}`}>
                {event.text}
              </div>
            ))}
          </AnimatePresence>
        </div>

        <div className="border-t border-border px-2.5 py-2 flex items-center gap-1.5 text-[8px] text-ink-muted">
          <CheckCircle2 size={10} className="text-accent shrink-0" />
          <span>User only supplies the outcome. Director owns planning, execution, debugging, testing and verification.</span>
        </div>
      </motion.aside>
    </div>
  );
}
