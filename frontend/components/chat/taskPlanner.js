const ACTION_PATTERNS = [
  { action: 'navigate', words: ['open', 'show', 'khol', 'kholo', 'dikhao', 'dikha', 'go to', 'le chalo', 'jao'] },
  { action: 'create', words: ['create', 'make', 'build', 'generate', 'banao', 'bana do', 'tayyar karo'] },
  { action: 'edit', words: ['edit', 'modify', 'update', 'change', 'fix', 'improve', 'sudhar', 'badlo'] },
  { action: 'understand', words: ['understand', 'explain', 'summarize', 'analyse', 'analyze', 'samjhao', 'samjha do', 'review'] },
  { action: 'convert', words: ['convert', 'transform', 'export', 'change into', 'badal do', 'convert karo'] },
  { action: 'search', words: ['search', 'find', 'look up', 'lookup', 'dhundo', 'khojo'] },
  { action: 'run', words: ['run', 'execute', 'test', 'chalao', 'chala do', 'execute karo'] },
];

const TARGETS = [
  { target: 'pdf', words: ['pdf', 'document', 'doc', 'report'] },
  { target: 'code', words: ['code', 'app', 'website', 'project', 'script', 'program'] },
  { target: 'image', words: ['image', 'photo', 'picture', 'banner', 'logo'] },
  { target: 'data', words: ['data', 'csv', 'excel', 'spreadsheet', 'table', 'analytics'] },
  { target: 'chat', words: ['chat', 'conversation', 'message'] },
];

const normalized = (value) => String(value || '')
  .toLowerCase()
  .replace(/[.,!?;:()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const findMatch = (text, entries) => entries.find((entry) => entry.words.some((word) => text.includes(word)));

export function inferIntent(message) {
  const text = normalized(message);
  if (!text) {
    return { type: 'chat', action: 'answer', target: 'chat', confidence: 0 };
  }

  if (/^(?:new chat|start new chat|nayi chat|naya chat)$/.test(text)) {
    return { type: 'command', action: 'new-chat', target: 'chat', confidence: 0.99 };
  }
  if (/(?:delete|remove|clear|erase|hatao|mitao)\b.*\b(?:chat|conversation)/.test(text)) {
    return { type: 'command', action: 'delete-chat', target: 'chat', confidence: 0.99 };
  }

  const action = findMatch(text, ACTION_PATTERNS);
  const target = findMatch(text, TARGETS);

  if (action) {
    const confidence = target ? 0.82 : 0.7;
    return {
      type: 'task',
      action: action.action,
      target: target?.target || null,
      confidence,
      requiresTool: action.action !== 'understand',
      originalMessage: String(message || ''),
    };
  }

  return {
    type: 'chat',
    action: 'answer',
    target: 'chat',
    confidence: 0.4,
    originalMessage: String(message || ''),
  };
}

export function createTaskPlan(message, context = {}) {
  const intent = inferIntent(message);
  const steps = [];

  if (intent.type === 'command') {
    steps.push({ id: 'command', kind: 'command', action: intent.action, status: 'ready' });
  } else if (intent.type === 'task') {
    steps.push({ id: 'understand', kind: 'reason', action: 'understand-intent', status: 'ready' });
    if (intent.requiresTool) steps.push({ id: 'tool', kind: 'tool', action: intent.action, target: intent.target, status: 'ready' });
    steps.push({ id: 'verify', kind: 'verify', action: 'verify-result', status: 'ready' });
    steps.push({ id: 'answer', kind: 'answer', action: 'present-result', status: 'ready' });
  } else {
    steps.push({ id: 'answer', kind: 'answer', action: 'respond', status: 'ready' });
  }

  return {
    version: 1,
    planId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    intent,
    steps,
    context: {
      hasFiles: Boolean(context.hasFiles),
      fileCount: Number(context.fileCount || 0),
      hasSharedContext: Boolean(context.hasSharedContext),
    },
  };
}

export function summarizePlan(plan) {
  return plan.steps.map((step) => step.action).join(' → ');
}

export const TASK_ACTIONS = ACTION_PATTERNS.map(({ action }) => action);
export const TASK_TARGETS = TARGETS.map(({ target }) => target);
