export const TASK_EVENT_TYPES = {
  START: 'task_started',
  PHASE: 'task_phase',
  TOOL: 'task_tool',
  SOURCE: 'task_source',
  CHUNK: 'task_chunk',
  COMPLETE: 'task_complete',
  CANCELED: 'task_canceled',
  ERROR: 'task_error',
  APPROVAL: 'task_approval',
};

// Window key shared with useChatStream: when a chat request is answered by an
// agent run (kind:'agent') or a canceled task, the REST fallback must NOT fire
// a duplicate cascade — useChatStream awaits marker.done for the real reply.
export const BLOCK_FALLBACK_KEY = '__aiDostBlockNextChatFallback';

const PHASE_BY_SERVER_EVENT = {
  language_lock: 'understanding',
  assessment_creating: 'planning',
  assessment_created: 'executing',
  web_search_start: 'searching',
  web_search_sources: 'reading',
  web_search_done: 'reading',
  web_search_error: 'error',
};

function firstLine(text, max = 160) {
  return String(text || '')
    .replace(/[#*_`>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function basename(filePath) {
  const parts = String(filePath || '').split(/[\\/]/);
  return parts[parts.length - 1] || String(filePath || '');
}

export function createTaskId(prefix = 'task') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeServerEvent(taskId, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const type = String(payload.type || '');
  const base = {
    id: `${taskId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    ts: Date.now(),
    serverType: type || undefined,
    payload,
  };

  const errorMessage = String(payload.error || '');
  if (payload.canceled || /^task\s+(?:was\s+)?cancel(?:ed|led)|^canceled\b|^cancelled\b/i.test(errorMessage)) {
    return { ...base, type: TASK_EVENT_TYPES.CANCELED, phase: 'canceled', label: errorMessage || 'Task canceled' };
  }
  if (payload.error && !payload.chunk && !payload.done) {
    return { ...base, type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: errorMessage };
  }
  if (type === 'gate_approval_required' || type === 'waiting_for_user') {
    const capabilities = (payload.gate?.capabilities || []).map((c) => c.capability_id || c).filter(Boolean);
    return {
      ...base,
      type: TASK_EVENT_TYPES.APPROVAL,
      phase: 'approval',
      label: firstLine(payload.message || 'Approval chahiye — sensitive operation blocked', 200),
      approval: {
        token: payload.gate?.approval_token || payload.approvalToken || null,
        capabilities,
        decision: payload.gate?.decision || null,
        reason: firstLine((payload.gate?.capabilities || []).map((c) => c.reason).join('; ') || payload.message || '', 240),
      },
    };
  }
  if (type === 'gate_approval_invalid') {
    return { ...base, type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: firstLine(payload.message || 'Approval token invalid ya expire ho gaya', 200) };
  }
  if (type === 'gate_blocked') {
    return { ...base, type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: firstLine(payload.message || 'Security policy blocked this operation', 200) };
  }
  if (payload.done || type === 'task_complete' || type === 'done') {
    const summary = type === 'done' ? firstLine(payload.message, 220) : '';
    return {
      ...base,
      type: TASK_EVENT_TYPES.COMPLETE,
      phase: 'success',
      label: summary || 'Completed',
      ...(summary ? { summary } : {}),
      ...(payload.plan ? { plan: payload.plan } : {}),
    };
  }
  if (type === 'gate_approved') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'resuming', label: 'Approval mil gayi — resume ho raha hai', resumed: true };
  }
  if (type === 'run_started') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'planning', label: `Run shuru${payload.runId ? ` (${payload.runId})` : ''}` };
  }
  if (type === 'start') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'understanding', label: firstLine(payload.message, 140) || 'Analyzing prompt...' };
  }
  if (type === 'plan') {
    const tasks = payload.plan?.tasks || [];
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'planning', label: `Plan taiyar — ${tasks.length} step${tasks.length === 1 ? '' : 's'}` };
  }
  if (type === 'agent_status') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'processing', label: firstLine(payload.message, 140) };
  }
  if (type === 'file_written') {
    const filePath = String(payload.file || payload.path || 'file');
    return {
      ...base,
      type: TASK_EVENT_TYPES.TOOL,
      phase: 'processing',
      label: `Likh diya: ${basename(filePath)}`,
      filePath,
      ...(payload.progress ? { fileProgress: payload.progress } : {}),
    };
  }
  if (type === 'screenshot') {
    const shot = payload.data
      ? `data:${payload.mimeType || 'image/png'};base64,${payload.data}`
      : (payload.url || null);
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'verifying', label: 'Screenshot capture — UI verify', screenshotUrl: shot };
  }
  if (type === 'verification') {
    const verdict = payload.result?.verdict || 'PASS';
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: verdict === 'FAIL' ? 'error' : 'success', label: `Verification: ${verdict}` };
  }
  if (type === 'thinking') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'thinking', label: firstLine(payload.message, 140) || 'Thinking...' };
  }
  if (type === 'step') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'processing', label: firstLine(payload.stepLog?.action || payload.stepLog?.thought, 140) || 'Step' };
  }
  if (type === 'tool_call' || type === 'tool_result') {
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'processing', label: `Tool: ${payload.action || payload.tool || 'run'}` };
  }
  if (type === 'task_canceled') {
    return { ...base, type: TASK_EVENT_TYPES.CANCELED, phase: 'canceled', label: errorMessage || 'Task canceled' };
  }
  if (type === 'task_error' || type === 'error') {
    return { ...base, type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: firstLine(payload.message || errorMessage, 200) || 'Task failed' };
  }
  if (payload.chunk) {
    return { ...base, type: TASK_EVENT_TYPES.CHUNK, phase: 'generating', label: 'Writing' };
  }
  if (payload.sources) {
    return {
      ...base,
      type: TASK_EVENT_TYPES.SOURCE,
      phase: 'reading',
      label: `${payload.sources.length} source${payload.sources.length === 1 ? '' : 's'} found`,
      metadata: { count: payload.sources.length },
    };
  }
  if (type === 'task_phase' || type === 'task_tool' || type === 'task_source') {
    return { ...base, type, phase: payload.phase || 'processing', label: payload.label || payload.status || (type === 'task_tool' ? 'Running tool' : 'Processing') };
  }
  if (PHASE_BY_SERVER_EVENT[type]) {
    const phase = PHASE_BY_SERVER_EVENT[type];
    const label = payload.status
      || ({ understanding: 'Understanding', planning: 'Planning', executing: 'Executing', searching: 'Searching', reading: 'Reading', error: 'Error' }[phase] || phase);
    return { ...base, type: TASK_EVENT_TYPES.PHASE, phase, label };
  }

  return { ...base, type: TASK_EVENT_TYPES.PHASE, phase: 'processing', label: type ? type.replace(/_/g, ' ') : 'Processing' };
}

export function parseSseLines(buffer, onEvent) {
  const lines = buffer.split('\n');
  const remainder = lines.pop() || '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      onEvent(JSON.parse(data));
    } catch (_) {}
  }
  return remainder;
}
