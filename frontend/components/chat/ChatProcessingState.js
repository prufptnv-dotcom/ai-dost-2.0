export const PROCESSING_STATES = {
  IDLE: {
    key: 'idle',
    label: 'Ready',
    detail: 'AI-Dost is ready',
  },
  QUEUED: {
    key: 'queued',
    label: 'Queued',
    detail: 'Your request is waiting for an execution slot',
  },
  UNDERSTANDING: {
    key: 'understanding',
    label: 'Understanding',
    detail: 'Interpreting your request',
  },
  CONTEXT: {
    key: 'context',
    label: 'Using context',
    detail: 'Connecting relevant project knowledge',
  },
  PLANNING: {
    key: 'planning',
    label: 'Planning',
    detail: 'Selecting the best execution path',
  },
  GENERATING: {
    key: 'generating',
    label: 'Generating',
    detail: 'Building the response',
  },
  VERIFYING: {
    key: 'verifying',
    label: 'Verifying',
    detail: 'Checking the result',
  },
  CANCELED: {
    key: 'canceled',
    label: 'Canceled',
    detail: 'The request was canceled',
  },
  ERROR: {
    key: 'error',
    label: 'Needs attention',
    detail: 'The request could not be completed',
  },
};

const PHASE_MAP = {
  queued: PROCESSING_STATES.QUEUED,
  understanding: PROCESSING_STATES.UNDERSTANDING,
  context: PROCESSING_STATES.CONTEXT,
  planning: PROCESSING_STATES.PLANNING,
  generating: PROCESSING_STATES.GENERATING,
  verifying: PROCESSING_STATES.VERIFYING,
  canceled: PROCESSING_STATES.CANCELED,
  error: PROCESSING_STATES.ERROR,
  failed: PROCESSING_STATES.ERROR,
};

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
  if (phase && PHASE_MAP[phase]) return PHASE_MAP[phase];
  if (!isStreaming && hasVerification) return PROCESSING_STATES.VERIFYING;
  if (!isStreaming) return PROCESSING_STATES.IDLE;
  if (hasActions) return PROCESSING_STATES.GENERATING;
  if (contentLength < 100) return PROCESSING_STATES.UNDERSTANDING;
  if (contentLength < 300) return PROCESSING_STATES.CONTEXT;
  return PROCESSING_STATES.GENERATING;
}
