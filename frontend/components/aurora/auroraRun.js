/**
 * P11 A2 — pure SSE-event → Aurora run-action mapper for POST /api/agent/run.
 *
 * No React, no fetch: `useAuroraRun` feeds parsed `data` objects here and
 * applies the returned actions. Field names verified against the live consumer
 * (`CopilotIDE.jsx` run loop) and the backend stream shapes:
 *
 *   run_started/director_start · director_plan/task/verification/complete/
 *   error/canceled · plan/plan_tasks · thinking/thought/agent_status ·
 *   tool_call · file_written/file_changed/file · director_file_diff · step ·
 *   screenshot/vision · terminal_output · self_heal · gate_* · done/error ·
 *   unknown (catch-all: first 2 per type as rows, then counted — never drop).
 *
 * Action shapes:
 *   { op:'row', row:{kind,label,detail,tone} }   append a spine row
 *   { op:'plan', tasks:[{id,label,status}] }     replace plan checklist
 *   { op:'task', id, status }                    patch one plan task
 *   { op:'planAllDone' }                         mark every task done
 *   { op:'file', path, content, previous, isNew }  file written (hook diffs)
 *   { op:'devServer', server:{state,url,hostPort,...} }  P5 live preview
 *   { op:'runId', runId }                        run identity
 *   { op:'approval', token, gate }               approval gate → banner
 *   { op:'unknown', type, row }                  deduped catch-all
 *   { op:'end', ok }                             terminal event (stop loop)
 */

const MAX_DETAIL = 400;

// Tool action → spine vocabulary (mono, lowercase, no emoji — quiet chrome).
const TOOL_LABEL = {
  write_file: { label: 'write', tone: 'accent' },
  create_file: { label: 'write', tone: 'accent' },
  apply_diff: { label: 'diff', tone: 'accent' },
  read_file: { label: 'read', tone: 'info' },
  list_directory: { label: 'list', tone: 'muted' },
  run_terminal: { label: 'run', tone: 'warn' },
  run_terminal_auto: { label: 'run', tone: 'warn' },
  run_tests: { label: 'test', tone: 'warn' },
  search_codebase: { label: 'search', tone: 'muted' },
  generate_project_from_prompt: { label: 'scaffold', tone: 'accent' },
  git_init: { label: 'git', tone: 'muted' },
  git_add: { label: 'git', tone: 'muted' },
  git_commit: { label: 'git', tone: 'muted' },
  git_branch: { label: 'git', tone: 'muted' },
  git_log: { label: 'git', tone: 'muted' },
  web_search: { label: 'web', tone: 'muted' },
  fetch_webpage: { label: 'web', tone: 'muted' },
  sandbox_create: { label: 'sandbox', tone: 'info' },
  sandbox_exec: { label: 'sandbox', tone: 'info' },
  sandbox_dev_start: { label: 'sandbox', tone: 'info' },
  sandbox_write: { label: 'write', tone: 'accent' },
  figma_mcp: { label: 'figma', tone: 'info' },
  db_query: { label: 'db', tone: 'muted' },
};

function firstText(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function safeStr(v) {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}

function row(kind, label, detail, tone) {
  return {
    op: 'row',
    row: { kind, label, detail: String(detail || '').slice(0, MAX_DETAIL), tone },
  };
}

/** director/plan task status → rail status (done|active|error|todo). */
export function mapPlanStatus(status, idx) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'succeeded' || s === 'done') return 'done';
  if (s === 'failed' || s === 'error') return 'error';
  if (s === 'in_progress' || s === 'running' || s === 'active') return 'active';
  // Backend silent on first task → treat as started (same as classic copilot).
  if (idx === 0) return 'active';
  return 'todo';
}

export function normPlanTasks(list) {
  return (Array.isArray(list) ? list : []).map((t, i) => {
    // Task shapes across emitters: generateTaskPlan {title}, director_plan
    // {id, specialty, role} (CopilotDirector.js — NO objective/title!), ReAct
    // todoList {title}, or plain strings. First truthy wins, else Task N.
    const label =
      typeof t === 'string'
        ? t
        : String(
            (t &&
              (t.objective || t.title || t.name || t.specialty || t.description || t.text)) ||
              `Task ${i + 1}`
          );
    return {
      id: (typeof t === 'object' && t && t.id) || `task-${i + 1}`,
      label: label.slice(0, 120),
      status: mapPlanStatus(typeof t === 'object' && t ? t.status : '', i),
    };
  });
}

/** Spine rows → chat history for the run body (role/user+assistant, capped). */
export function buildChatHistory(rows = []) {
  return rows
    .filter((r) => r.kind === 'user' || r.kind === 'reply' || r.kind === 'done')
    .slice(-8)
    .map((r) => ({
      role: r.kind === 'user' ? 'user' : 'assistant',
      content: String(r.detail || '').slice(0, 500),
    }));
}

export function mapRunEvent(data) {
  const t = (data && data.type) || '';
  const msg = firstText(
    data && data.message,
    data && data.thought,
    data && data.error,
    data && data.reason
  );

  switch (t) {
    case 'run_started':
    case 'director_start':
      return [{ op: 'runId', runId: (data.runId || data.taskId || null) }];

    case 'start':
      return [row('start', 'start', msg || 'Analyzing prompt & planning...', 'info')];

    case 'director_plan': {
      const tasks = normPlanTasks(data.tasks);
      return [
        { op: 'plan', tasks },
        row(
          'plan',
          'plan',
          msg || data.summary || `${data.taskCount || tasks.length} tasks planned`,
          'accent'
        ),
      ];
    }

    case 'plan':
    case 'plan_tasks': {
      const list = Array.isArray(data.tasks) ? data.tasks : (data.plan && data.plan.tasks) || [];
      const tasks = normPlanTasks(list);
      return tasks.length ? [{ op: 'plan', tasks }] : [];
    }

    case 'director_task': {
      const status = String(data.status || 'RUNNING').toUpperCase();
      const tone = status === 'SUCCEEDED' ? 'ok' : status === 'FAILED' ? 'err' : 'info';
      const label = String(data.specialty || data.role || 'task').toLowerCase();
      const detail = [
        status,
        data.objective ? String(data.objective).slice(0, 90) : '',
        data.error ? String(data.error).slice(0, 90) : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const acts = [{ op: 'task', id: data.taskId, status }];
      if (data.taskId) acts.push(row('task', label, detail, tone));
      return acts;
    }

    case 'director_verification': {
      const st = String(data.status || 'running');
      const tone = st === 'SUCCEEDED' ? 'ok' : st === 'DELEGATING' ? 'info' : 'warn';
      return [row('verify', 'verify', `verification ${st}`, tone)];
    }

    case 'thinking':
    case 'thought':
    case 'agent_status':
      return msg ? [row('think', 'think', msg, 'muted')] : [];

    case 'tool_call': {
      const m = TOOL_LABEL[data.action] || {
        label: String(data.action || 'tool').toLowerCase(),
        tone: 'muted',
      };
      const detail = firstText(data.thought, data.target, data.path, data.command, data.action);
      return [row('tool', m.label, detail || data.action, m.tone)];
    }

    case 'file_written':
    case 'file_changed':
    case 'file': {
      const path = data.path || data.file;
      if (!path) return [];
      const content =
        typeof data.content === 'string'
          ? data.content
          : typeof data.contents === 'string'
            ? data.contents
            : '';
      // previous/isNew (agent.js:927) power the run-scope diff baseline;
      // events without them fall back to the hook's local stream state.
      return [
        {
          op: 'file',
          path: String(path),
          content,
          previous: typeof data.previous === 'string' ? data.previous : null,
          isNew: typeof data.isNew === 'boolean' ? data.isNew : undefined,
        },
      ];
    }

    case 'dev_server': {
      // P5: ensureLivePreview emits this after verification — READY flips the
      // stage to a real iframe, FAILED keeps the static fallback + red chip.
      const st = String(data.state || 'STARTING');
      const detail =
        st === 'READY'
          ? `live preview on :${data.hostPort ?? '?'}${data.reused ? ' (reused)' : ''}`
          : st === 'FAILED'
            ? `preview server failed — ${data.reason || 'unknown reason'}`
            : 'preview server starting…';
      return [
        row('dev', 'preview', detail, st === 'READY' ? 'ok' : st === 'FAILED' ? 'err' : 'info'),
        {
          op: 'devServer',
          server: {
            state: st,
            url: data.url || null,
            hostPort: data.hostPort ?? null,
            framework: data.framework || null,
            reason: data.reason || null,
          },
        },
      ];
    }

    case 'director_file_diff': {
      const path = data.file || data.fullPath;
      return path ? [row('diff', 'diff', `${path} · ${data.summary || 'patched'}`, 'accent')] : [];
    }

    case 'step': {
      // TWO emitters, different shapes:
      //  - agent.js: {type:'step', stepLog:{thought, action, parameters}}
      //  - PlannerExecutionLoop.js: {type:'step', tool, description, status}
      //    (top-level, NO stepLog!) — and it fires once running + once done;
      //    render only the final frame to keep the spine quiet.
      if (data.status === 'running') return [];
      const log = data.stepLog || {};
      const detail = firstText(
        safeStr(log.thought),
        safeStr(log.action),
        data.tool ? `${data.tool}${data.description ? ` · ${data.description}` : ''}` : '',
        safeStr(data.description),
        safeStr(data.action),
        msg,
        'step'
      );
      return [row('step', 'step', detail, data.status && data.status !== 'done' ? 'warn' : 'muted')];
    }

    case 'terminal_output': {
      const out = String(data.output || data.text || '').trim();
      if (!out) return [];
      const head = out.split('\n').slice(0, 3).join(' ⏎ ').slice(0, 240);
      return [row('term', 'term', head, 'muted')];
    }

    case 'self_heal':
      return [row('fix', 'self-heal', msg || 'detected a failure — repairing...', 'accent')];

    case 'gate_approval_required':
    case 'gate_blocked':
    case 'gate_approved':
    case 'gate_approval_invalid': {
      const tone =
        t === 'gate_approved' ? 'ok' : t === 'gate_blocked' ? 'err' : 'warn';
      const acts = [row('gate', 'gate', msg || t.replace(/_/g, ' '), tone)];
      const token = data.gate && data.gate.approval_token;
      if (t === 'gate_approval_required' && token) {
        acts.push({ op: 'approval', token, gate: data.gate });
      }
      return acts;
    }

    case 'screenshot':
      return [row('shot', 'shot', msg || data.url || 'ui snapshot', 'info')];

    case 'vision':
      return [row('vision', 'vision', msg || 'vision qa', 'info')];

    case 'done': {
      const steps = Array.isArray(data.steps) ? data.steps.length : data.steps;
      return [
        row('done', 'done', msg || (steps ? `${steps} steps` : 'run complete'), 'ok'),
        { op: 'planAllDone' },
        { op: 'end', ok: true },
      ];
    }

    case 'director_complete': {
      const n = data.taskCount;
      return [
        row('done', 'done', msg || `${n || ''} task(s) completed with verification`, 'ok'),
        { op: 'planAllDone' },
        { op: 'end', ok: true },
      ];
    }

    case 'error':
    case 'director_error':
      return [
        row('error', 'error', msg || 'agent run failed', 'err'),
        { op: 'end', ok: false },
      ];

    case 'director_canceled':
      return [
        row('stop', 'stop', 'run canceled — completed changes remain', 'muted'),
        { op: 'end', ok: true },
      ];

    default: {
      const type = String(t || 'event');
      // Unknown types: hand the hook a PLAIN row (not a row-action wrapper) so
      // it can dedupe — first 2 as rows, then counted. Never silently drop.
      return [
        {
          op: 'unknown',
          type,
          row: {
            kind: 'event',
            label: type.slice(0, 12),
            detail: (msg || '').slice(0, MAX_DETAIL),
            tone: 'muted',
          },
        },
      ];
    }
  }
}
