export const TASK_EVENT_TYPES = {
  START: 'task_started',
  PHASE: 'task_phase',
  TOOL: 'task_tool',
  SOURCE: 'task_source',
  CHUNK: 'task_chunk',
  COMPLETE: 'task_complete',
  ERROR: 'task_error',
};

const PHASE_BY_SERVER_EVENT = {
  language_lock: 'understanding',
  assessment_creating: 'planning',
  assessment_created: 'executing',
  web_search_start: 'searching',
  web_search_sources: 'reading',
  web_search_done: 'reading',
  web_search_error: 'error',
};

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

  if (payload.error && !payload.chunk && !payload.done) {
    return { ...base, type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: String(payload.error) };
  }
  if (payload.done) {
    return { ...base, type: TASK_EVENT_TYPES.COMPLETE, phase: 'success', label: 'Completed' };
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
