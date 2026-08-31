export const PROCESSING_STATES = {
  IDLE: {
    key: 'idle',
    label: 'Ready',
    detail: 'AI-Dost is ready',
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
  ERROR: {
    key: 'error',
    label: 'Needs attention',
    detail: 'The request could not be completed',
  },
};

export function getProcessingState({
  isStreaming,
  contentLength = 0,
  hasActions = false,
  hasVerification = false,
}) {
  if (!isStreaming && hasVerification) {
    return PROCESSING_STATES.VERIFYING;
  }
  if (!isStreaming) {
    return PROCESSING_STATES.IDLE;
  }
  if (hasActions) {
    return PROCESSING_STATES.GENERATING;
  }
  if (contentLength < 100) {
    return PROCESSING_STATES.UNDERSTANDING;
  }
  if (contentLength < 300) {
    return PROCESSING_STATES.CONTEXT;
  }
  return PROCESSING_STATES.GENERATING;
}
