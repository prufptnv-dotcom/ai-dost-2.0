import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp,
  CircleDot, Loader2, Pause, Play, RotateCcw, Send, ShieldCheck,
  Sparkles, Wrench, X, Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const CopilotIDE = dynamic(() => import('./CopilotIDE'), { ssr: false });

const ROLE_LABELS = {
  REQUIREMENTS: 'Requirements',
  RESEARCH: 'Research',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  INTEGRATION: 'Integration',
  TEST: 'Testing',
  VERIFIER: 'Verifier',
  VISUAL_QA: 'Visual QA',
  REPAIR: 'Repair',
};

const PLANNER_PROMPT = `You are the Director/Boss agent of an autonomous software factory.\n\nGiven a user's request, decide the minimum and sufficient number of implementation tasks. Do NOT use a fixed pipeline. A trivial change can be one task. A complex project can require many tasks. Existing-project changes must target the affected subsystem instead of rebuilding unrelated code.\n\nAvailable logical worker roles: REQUIREMENTS, RESEARCH, FRONTEND, BACKEND, INTEGRATION, TEST, VERIFIER, VISUAL_QA. Workers must inspect existing code before editing, use surgical diffs for existing files, run relevant tests, and report concrete evidence.\n\nReturn ONLY valid JSON:\n{\n  "goal":"...",\n  "mode":"NEW_PROJECT|MODIFY_EXISTING|DEBUG|VERIFY_ONLY",\n  "confidence":0.0,\n  "tasks":[{"id":"T1","role":"REQUIREMENTS","title":"...","objective":"...","dependsOn":[]}]\n}\nRules: include only tasks that add real value; keep independent research/read-only work parallel conceptually but execution order is serialized in this client to avoid mutation races; always include a final VERIFIER for multi-step work; include VISUAL_QA when the request creates or changes UI; include TEST for non-trivial code changes.`;

const FALLBACK_TASKS = (prompt) => {
  const text = prompt.toLowerCase();
  const isDebug = /\b(debug|fix|broken|error|bug|crash|doesn't work|not working)\b/.test(text);
  const isUi = /\b(ui|frontend|page|screen|component|design|button|responsive|dashboard|website|web app)\b/.test(text);
  const isBackend = /\b(api|backend|server|database|db|auth|login|endpoint|express|node|python)\b/.test(text);
  const isIntegration = /\b(integrat|connect|payment|stripe|github|mcp|webhook|oauth|third[- ]party)\b/.test(text);
  const complex = prompt.length > 180 || [isUi, isBackend, isIntegration].filter(Boolean).length >= 2;
  if (!complex && !isDebug) {
    return [{ id: 'T1', role: isUi ? 'FRONTEND' : isBackend ? 'BACKEND' : 'INTEGRATION', title: 'Implement requested change', objective: prompt, dependsOn: [] }];
  }
  const tasks = [
    { id: 'T1', role: isDebug ? 'RESEARCH' : 'REQUIREMENTS', title: isDebug ? 'Locate root cause' : 'Inspect requirements and architecture', objective: `Inspect the existing workspace and identify the exact files, dependencies, routes, and constraints relevant to: ${prompt}`, dependsOn: [] },
  ];
  if (isBackend) tasks.push({ id: 'T2', role: 'BACKEND', title: 'Implement backend changes', objective: `Implement and validate backend/data/API changes required for: ${prompt}`, dependsOn: ['T1'] });
  if (isUi) tasks.push({ id: isBackend ? 'T3' : 'T2', role: 'FRONTEND', title: 'Implement frontend changes', objective: `Implement the UI/client behavior required for: ${prompt}`, dependsOn: ['T1'] });
  if (isIntegration) tasks.push({ id: 'T4', role: 'INTEGRATION', title: 'Wire integrations', objective: `Connect and validate the affected integrations for: ${prompt}`, dependsOn: tasks.map((t) => t.id) });
  tasks.push({ id: `T${tasks.length + 1}`, role: 'TEST', title: 'Run tests and build checks', objective: `Run the relevant test suite, type/lint/build checks, diagnose failures, and make safe fixes for: ${prompt}`, dependsOn: tasks.map((t) => t.id) });
  tasks.push({ id: `T${tasks.length + 1}`, role: isUi ? 'VISUAL_QA' : 'VERIFIER', title: isUi ? 'Verify live preview' : 'Final verification', objective: isUi ? `Start/inspect the live preview, check runtime errors, blank states, responsive layout, and interact with important UI controls where browser tooling permits. Fix anything found. Goal: ${prompt}` : `Perform final production-readiness verification of the completed change, including regression checks and targeted repairs. Goal: ${prompt}`, dependsOn: tasks.map((t) => t.id) });
  return tasks;
};

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch (_) { return null; }
}

export function normalizeDirectorPlan(plan, prompt) {
  const rawTasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const tasks = rawTasks
    .filter((task) => task && typeof task === 'object' && task.objective)
    .map((task, index) => ({
      id: String(task.id || `T${index + 1}`),
      role: ROLE_LABELS[task.role] ? task.role : 'INTEGRATION',
      title: String(task.title || `Task ${index + 1}`),
      objective: String(task.objective),
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(String) : [],
      status: 'queued',
      attempts: 0,
      error: '',
      evidence: '',
    }));
  const fallback = tasks.length ? tasks : FALLBACK_TASKS(prompt).map((task) => ({ ...task, status: 'queued', attempts: 0, error: '', evidence: '' }));
  const ids = new Set(fallback.map((task) => task.id));
  return {
    goal: String(plan?.goal || prompt),
    mode: String(plan?.mode || 'MODIFY_EXISTING'),
    confidence: Number.isFinite(Number(plan?.confidence)) ? Number(plan.confidence) : 0,
    tasks: fallback.map((task) => ({ ...task, dependsOn: task.dependsOn.filter((id) => ids.has(id) && id !== task.id) })),
  };
}

async function readResponseBody(response, onEvent) {
  if (!response.body) return '';
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      onEvent?.(json);
      return json.message || json.answer || json.result || text;
    } catch (_) {
      return text;
    }
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const event = JSON.parse(payload);
        onEvent?.(event);
        if (event.answer || event.message || event.content) finalText += String(event.answer || event.message || event.content);
      } catch (_) {
        finalText += payload;
      }
    }
  }
  return finalText;
}

export default function AutonomousCopilotWorkspace({ projectId = 'copilot-workspace', projectName = 'Copilot Workspace', onToast }) {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [plan, setPlan] = useState(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef(null);
  const stopRef = useRef(false);

  const log = useCallback((text, type = 'info') => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, text, type, ts: Date.now() }]);
  }, []);

  const runAgent = useCallback(async (task, retryContext = '') => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('No active controller');
    const instruction = [
      `COPILOT DIRECTOR TASK ${task.id}`,
      `ROLE: ${task.role}`,
      `OBJECTIVE: ${task.objective}`,
      'You are one specialist worker inside a supervised autonomous build.',
      'First inspect the existing workspace and identify the exact change surface.',
      'Do not rebuild unrelated parts of the project.',
      'Use existing MCP tools, registered skills, web research, graphics/media capabilities, database tools, and sandbox/browser tools when they materially help the task.',
      'For existing files prefer surgical diffs. For new files create complete runnable implementations.',
      'Run the most relevant tests/build/lint checks before declaring success.',
      'For UI work use preview/screenshot/DOM verification when available.',
      retryContext ? `PREVIOUS FAILURE / REPAIR CONTEXT: ${retryContext}` : '',
      'Return a concise result containing: status, evidence, changed files, remaining blockers.',
    ].filter(Boolean).join('\\n\\n');
    const response = await fetch('/api/agent/run', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt: instruction, projectId, forceLocal: false }),
    });
    if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
    let text = '';
    const eventLog = [];
    text = await readResponseBody(response, (event) => {
      eventLog.push(event);
      if (event?.type === 'step') {
        const action = event.stepLog?.action || event.action;
        if (action) log(`${ROLE_LABELS[task.role] || task.role}: ${action}`, 'step');
      }
      if (event?.error) log(String(event.error), 'error');
    });
    const parsed = extractJson(text);
    const status = parsed?.status || parsed?.verification_status || (parsed?.action === 'FINAL_ANSWER' ? 'COMPLETED' : 'COMPLETED');
    const evidence = parsed?.evidence || parsed?.answer || parsed?.summary || text.slice(-1600);
    const hasExplicitFailure = /\\b(failed|error|unable|cannot|blocked)\\b/i.test(String(status)) || Boolean(parsed?.error);
    return { ok: !hasExplicitFailure, evidence, raw: text, events: eventLog };
  }, [log, projectId]);

  const runDirector = useCallback(async () => {
    const text = prompt.trim();
    if (!text || running) return;
    stopRef.current = false;
    controllerRef.current = new AbortController();
    setRunning(true);
    setPaused(false);
    setAttempt(0);
    setMessages([]);
    setPlan(null);
    log('Director: verifying request and selecting the minimum sufficient task graph…');
    try {
      const planningResponse = await fetch('/api/chat/', {
        method: 'POST',
        signal: controllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${PLANNER_PROMPT}\\n\\nUSER REQUEST:\\n${text}`,
          model: 'auto', section: 'copilot', history: [], mode: 'chat', persona: 'auto',
        }),
      });
      const planningText = planningResponse.ok ? await planningResponse.text() : '';
      let plannerPayload = null;
      try {
        const parsed = JSON.parse(planningText);
        plannerPayload = parsed?.reply ? extractJson(parsed.reply) : parsed;
      } catch (_) {
        plannerPayload = extractJson(planningText);
      }
      const nextPlan = normalizeDirectorPlan(plannerPayload, text);
      setPlan(nextPlan);
      log(`Director approved ${nextPlan.tasks.length} task${nextPlan.tasks.length === 1 ? '' : 's'} for ${nextPlan.mode}.`, 'plan');
      log('Director rule: affected code only; no blind rebuilds.');

      for (let index = 0; index < nextPlan.tasks.length; index += 1) {
        if (stopRef.current) throw new Error('Stopped by user');
        while (paused && !stopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const task = nextPlan.tasks[index];
        setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, status: 'running', attempts: item.attempts + 1 } : item) } : prev);
        log(`Task ${index + 1}/${nextPlan.tasks.length}: ${ROLE_LABELS[task.role] || task.role} → ${task.title}`, 'task');

        let lastError = '';
        let success = false;
        for (let cycle = 1; cycle <= 3 && !success; cycle += 1) {
          setAttempt(cycle);
          try {
            const result = await runAgent(task, lastError);
            if (result.ok) {
              success = true;
              setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, status: 'completed', evidence: result.evidence } : item) } : prev);
              log(`✓ ${task.id} verified by worker: ${result.evidence.slice(0, 700)}`, 'success');
            } else {
              lastError = result.evidence || 'Worker reported failure';
              log(`↻ ${task.id} failed; Director is starting repair cycle ${cycle}/3.`, 'repair');
              setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, status: 'repairing', error: lastError, attempts: cycle } : item) } : prev);
            }
          } catch (error) {
            lastError = error?.message || String(error);
            if (stopRef.current || error?.name === 'AbortError') throw error;
            log(`↻ ${task.id}: ${lastError}. Repair cycle ${cycle}/3…`, 'repair');
          }
        }
        if (!success) {
          setPlan((prev) => prev ? { ...prev, tasks: prev.tasks.map((item) => item.id === task.id ? { ...item, status: 'failed', error: lastError } : item) } : prev);
          throw new Error(`${task.id} could not be completed after 3 repair cycles: ${lastError}`);
        }
      }

      log('Director: all planned tasks completed. Running final production verification…', 'verify');
      const finalTask = { id: 'FINAL', role: nextPlan.mode === 'VERIFY_ONLY' ? 'VERIFIER' : 'VERIFIER', title: 'Production readiness gate', objective: `Verify the complete result for the user request: ${text}. Inspect changed files, dependencies, build/tests, runtime behavior, and for UI changes use live preview, screenshot/DOM inspection and interaction-oriented checks. Fix any discovered defect instead of merely reporting it. Repeat verification until the workspace is production-ready or a concrete external blocker remains.` };
      const finalResult = await runAgent(finalTask, 'This is the final gate. Do not stop after discovering a fixable defect; repair it and re-verify.');
      if (!finalResult.ok) throw new Error(`Final verifier reported a blocker: ${finalResult.evidence}`);
      log(`✓ Production gate passed: ${finalResult.evidence.slice(0, 900)}`, 'success');
      log('DIRECTOR COMPLETE — workspace is ready for user review.', 'success');
      onToast?.('Copilot Director completed the autonomous build and verification.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError' || stopRef.current || error?.message === 'Stopped by user') {
        log('Director stopped. Completed work remains in the workspace.', 'warning');
      } else {
        log(`Director stopped on a non-recoverable blocker: ${error?.message || error}`, 'error');
        onToast?.(error?.message || 'Autonomous build stopped', 'error');
      }
    } finally {
      controllerRef.current = null;
      setRunning(false);
      setPaused(false);
    }
  }, [log, onToast, paused, prompt, runAgent, running]);

  const stop = useCallback(() => {
    stopRef.current = true;
    controllerRef.current?.abort();
  }, []);

  const taskSummary = useMemo(() => {
    if (!plan) return { done: 0, total: 0, failed: 0 };
    return plan.tasks.reduce((acc, task) => {
      acc.total += 1;
      if (task.status === 'completed') acc.done += 1;
      if (task.status === 'failed') acc.failed += 1;
      return acc;
    }, { done: 0, total: 0, failed: 0 });
  }, [plan]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas-base">
      <CopilotIDE projectId={projectId} projectName={projectName} onToast={onToast} />

      <motion.aside
        initial={false}
        animate={{ x: panelOpen ? 0 : 'calc(100% - 38px)' }}
        className="absolute top-3 right-3 z-[80] w-[min(390px,calc(100%-24px))] rounded-xl border border-border bg-canvas-surface/95 shadow-2xl backdrop-blur-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-canvas-elevated/70">
          <button type="button" onClick={() => setPanelOpen((v) => !v)} className="flex items-center gap-2 text-left min-w-0">
            <BrainCircuit size={15} className="text-accent shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-paper-100 truncate">Director / Autonomous Build</div>
              <div className="text-[8px] text-ink-muted font-mono">adaptive DAG • repair • verify • preview QA</div>
            </div>
          </button>
          {panelOpen ? <ChevronUp size={14} className="text-ink-muted" /> : <ChevronDown size={14} className="text-ink-muted" />}
        </div>

        {panelOpen && (
          <div className="flex flex-col max-h-[calc(100vh-70px)]">
            <div className="p-2.5 space-y-2 border-b border-border">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runDirector(); } }}
                rows={5}
                disabled={running}
                placeholder="Tell Director what to build, fix, upgrade, integrate or verify…"
                className="w-full resize-none rounded-lg border border-border bg-canvas-base px-2.5 py-2 text-[10px] leading-[1.35] text-paper-100 placeholder:text-ink-muted outline-none focus:border-accent/50"
              />
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={runDirector} disabled={running || !prompt.trim()} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold bg-accent text-black disabled:opacity-40">
                  {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />}
                  {running ? `Running · repair ${attempt}/3` : 'Build autonomously'}
                </button>
                {running ? (
                  <button type="button" onClick={() => setPaused((v) => !v)} className="rounded-lg px-2 py-1.5 text-[9px] border border-border text-paper-200">
                    <Pause size={11} />
                  </button>
                ) : null}
                <button type="button" onClick={stop} disabled={!running} title="Stop current run" className="rounded-lg px-2 py-1.5 text-[9px] border border-border text-paper-200 disabled:opacity-30">
                  <X size={11} />
                </button>
                <button type="button" onClick={() => { setPrompt(''); setPlan(null); setMessages([]); }} disabled={running} title="Reset Director panel" className="rounded-lg px-2 py-1.5 text-[9px] border border-border text-paper-200 disabled:opacity-30">
                  <RotateCcw size={11} />
                </button>
              </div>
            </div>

            <div className="px-2.5 py-2 border-b border-border flex items-center justify-between text-[8px] font-mono text-ink-muted">
              <span>{plan ? `${taskSummary.done}/${taskSummary.total} tasks complete` : 'No active plan'}</span>
              <span className="flex items-center gap-1">
                <CircleDot size={9} className={running ? 'text-accent animate-pulse' : 'text-ink-muted'} />
                {running ? 'AUTONOMOUS' : 'IDLE'}
              </span>
            </div>

            <div className="overflow-y-auto p-2.5 space-y-2 text-[9px]">
              {plan && (
                <div className="rounded-lg border border-border bg-canvas-base p-2">
                  <div className="flex items-center gap-1.5 mb-1.5 text-paper-100 font-semibold">
                    <Sparkles size={10} className="text-accent" /> Director plan · {plan.mode}
                  </div>
                  <div className="text-[8px] text-ink-muted leading-[1.35]">{plan.goal}</div>
                </div>
              )}

              {plan?.tasks.map((task, index) => (
                <div key={task.id} className="rounded-lg border border-border bg-canvas-base p-2">
                  <div className="flex items-center gap-1.5">
                    {task.status === 'completed' ? <CheckCircle2 size={11} className="text-accent" /> : task.status === 'failed' ? <AlertCircle size={11} className="text-signal-error" /> : task.status === 'running' || task.status === 'repairing' ? <Loader2 size={11} className="animate-spin text-accent" /> : <CircleDot size={11} className="text-ink-muted" />}
                    <span className="text-[8px] font-mono text-ink-muted">{index + 1}. {ROLE_LABELS[task.role] || task.role}</span>
                    <span className="ml-auto text-[8px] font-mono text-ink-muted">{task.id}</span>
                  </div>
                  <div className="mt-1 text-[9px] font-semibold text-paper-100">{task.title}</div>
                  {task.error ? <div className="mt-1 text-[8px] text-signal-error break-words">{task.error.slice(0, 500)}</div> : null}
                  {task.evidence ? <div className="mt-1 text-[8px] text-ink-muted whitespace-pre-wrap break-words">{task.evidence.slice(0, 700)}</div> : null}
                </div>
              ))}

              <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left text-[8px] text-accent py-1">{expanded ? 'Hide' : 'Show'} Director log</button>
              {expanded && messages.slice(-60).map((message) => (
                <div key={message.id} className={`rounded-md border px-2 py-1.5 font-mono leading-[1.25] ${message.type === 'error' ? 'border-red-500/20 text-red-300 bg-red-500/5' : message.type === 'success' ? 'border-accent/20 text-accent bg-accent/5' : 'border-border text-ink-muted bg-canvas-elevated/30'}`}>
                  <span className="mr-1 opacity-60">{new Date(message.ts).toLocaleTimeString()}</span>{message.text}
                </div>
              ))}
            </div>

            <div className="border-t border-border px-2.5 py-2 text-[8px] text-ink-muted flex items-center gap-1.5">
              <ShieldCheck size={10} className="text-accent" />
              <span>Changes stay inside the existing Copilot sandbox/workspace. Director retries fixable failures automatically.</span>
            </div>
          </div>
        )}
      </motion.aside>
    </div>
  );
}
