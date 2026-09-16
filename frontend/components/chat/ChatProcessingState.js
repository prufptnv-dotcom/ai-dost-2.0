export const PROCESSING_STATES = {
  IDLE: {
    key: 'idle',
    label: 'Ready',
    detail: 'AI-Dost is ready',
    busy: false,
    terminal: true,
  },
  QUEUED: {
    key: 'queued',
    label: 'Queued',
    detail: 'Your request is waiting for an execution slot',
    busy: true,
    terminal: false,
  },
  UNDERSTANDING: {
    key: 'understanding',
    label: 'Understanding',
    detail: 'Interpreting your request',
    busy: true,
    terminal: false,
  },
  CONTEXT: {
    key: 'context',
    label: 'Using context',
    detail: 'Connecting relevant project knowledge',
    busy: true,
    terminal: false,
  },
  PLANNING: {
    key: 'planning',
    label: 'Planning',
    detail: 'Selecting the best execution path',
    busy: true,
    terminal: false,
  },
  GENERATING: {
    key: 'generating',
    label: 'Generating',
    detail: 'Building the response',
    busy: true,
    terminal: false,
  },
  STREAMING: {
    key: 'streaming',
    label: 'Streaming',
    detail: 'Receiving the response',
    busy: true,
    terminal: false,
  },
  VERIFYING: {
    key: 'verifying',
    label: 'Verifying',
    detail: 'Checking the result',
    busy: true,
    terminal: false,
  },
  SUCCESS: {
    key: 'success',
    label: 'Complete',
    detail: 'Response completed successfully',
    busy: false,
    terminal: true,
  },
  CANCELED: {
    key: 'canceled',
    label: 'Canceled',
    detail: 'The request was canceled',
    busy: false,
    terminal: true,
  },
  ERROR: {
    key: 'error',
    label: 'Needs attention',
    detail: 'The request could not be completed',
    busy: false,
    terminal: true,
  },
};

const PHASE_ALIASES = {
  running: PROCESSING_STATES.UNDERSTANDING,
  executing: PROCESSING_STATES.GENERATING,
  generating: PROCESSING_STATES.GENERATING,
  streaming: PROCESSING_STATES.STREAMING,
  complete: PROCESSING_STATES.SUCCESS,
  completed: PROCESSING_STATES.SUCCESS,
  success: PROCESSING_STATES.SUCCESS,
  failed: PROCESSING_STATES.ERROR,
  failure: PROCESSING_STATES.ERROR,
  cancelled: PROCESSING_STATES.CANCELED,
};

const PHASE_MAP = {
  queued: PROCESSING_STATES.QUEUED,
  understanding: PROCESSING_STATES.UNDERSTANDING,
  context: PROCESSING_STATES.CONTEXT,
  planning: PROCESSING_STATES.PLANNING,
  generating: PROCESSING_STATES.GENERATING,
  streaming: PROCESSING_STATES.STREAMING,
  verifying: PROCESSING_STATES.VERIFYING,
  success: PROCESSING_STATES.SUCCESS,
  complete: PROCESSING_STATES.SUCCESS,
  completed: PROCESSING_STATES.SUCCESS,
  canceled: PROCESSING_STATES.CANCELED,
  cancelled: PROCESSING_STATES.CANCELED,
  error: PROCESSING_STATES.ERROR,
  failed: PROCESSING_STATES.ERROR,
};

export function normalizeProcessingPhase(phase) {
  if (!phase || typeof phase !== 'string') return null;
  const normalized = phase.trim().toLowerCase();
  const state = PHASE_ALIASES[normalized] || PHASE_MAP[normalized];
  return state ? state.key : null;
}

/**
 * Prefer an explicit backend/agent phase. The legacy content-length heuristic
 * remains as a fallback so older callers keep working during the migration.
 */
export function getProcessingState({
  phase,
  isStreaming,
  contentLength = 0,
  hasActions = false,
  hasVerification = false,
  isCanceled = false,
  hasError = false,
}) {
  if (hasError) return PROCESSING_STATES.ERROR;
  if (isCanceled) return PROCESSING_STATES.CANCELED;

  const normalizedPhase = normalizeProcessingPhase(phase);
  if (normalizedPhase && PHASE_MAP[normalizedPhase]) {
    return PHASE_MAP[normalizedPhase];
  }

  if (!isStreaming && hasVerification) return PROCESSING_STATES.VERIFYING;
  if (!isStreaming) return PROCESSING_STATES.IDLE;
  if (hasActions) return PROCESSING_STATES.GENERATING;
  if (contentLength < 100) return PROCESSING_STATES.UNDERSTANDING;
  if (contentLength < 300) return PROCESSING_STATES.CONTEXT;
  return PROCESSING_STATES.STREAMING;
}

export function getProcessingAriaProps(state) {
  const current = state || PROCESSING_STATES.IDLE;
  return {
    'aria-busy': current.busy,
    'aria-live': current.busy ? 'polite' : 'off',
  };
}
