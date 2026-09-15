const VIEW_ALIASES = [
  { view: 'projects', words: ['project', 'projects'], actions: ['open', 'show', 'list', 'khol', 'kholo', 'dikha', 'dikhao', 'dekh'] },
  { view: 'history', words: ['history', 'chat history', 'old chats', 'purani chat', 'purani baatein'], actions: ['open', 'show', 'list', 'khol', 'kholo', 'dikha', 'dikhao', 'dekh'] },
  { view: 'copilot', words: ['copilot', 'ide', 'editor', 'code editor'], actions: ['open', 'show', 'khol', 'kholo', 'dikha', 'dikhao', 'start', 'use'] },
  { view: 'agent', words: ['agent', 'agent mode', 'workbench', 'autonomous agent'], actions: ['open', 'show', 'khol', 'kholo', 'dikha', 'dikhao', 'start', 'run', 'chala', 'chal'] },
  { view: 'research', words: ['research', 'deep research'], actions: ['open', 'show', 'khol', 'kholo', 'start', 'run'] },
  { view: 'images', words: ['image generator', 'image gallery', 'gallery'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'resume', words: ['resume', 'cv'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'artifacts', words: ['artifacts', 'artifact'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'analytics', words: ['analytics', 'data analytics'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'automations', words: ['automations', 'watchers', 'automation'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'settings', words: ['settings', 'setting'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'voice', words: ['voice assistant', 'voice view'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'start', 'use'] },
];

const normalized = (value) => String(value || '')
  .toLowerCase()
  .replace(/[.,!?;:()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const includesAny = (text, words) => words.some((word) => text.includes(word));

export function classifyUniversalIntent(input) {
  const text = normalized(input);
  if (!text) return { kind: 'chat', confidence: 0 };

  if (/(?:^|\s)(new|start)\s+(?:a\s+)?(?:new\s+)?(?:chat|conversation)(?:\s+please)?$/.test(text)
    || /(?:new chat|start new chat|nayi chat|naya chat|nayi conversation)/.test(text)) {
    return { kind: 'command', action: 'new-chat', confidence: 0.99 };
  }

  if (/(?:delete|remove|clear|erase|hatao|mitao)\b.*\b(?:chat|conversation|current chat|old chat)/.test(text)
    || /(?:delete chat|current chat hatao|chat delete karo|purani chat hatao)/.test(text)) {
    return { kind: 'command', action: 'delete-chat', confidence: 0.99 };
  }

  for (const entry of VIEW_ALIASES) {
    const hasView = includesAny(text, entry.words);
    if (!hasView) continue;
    const hasAction = includesAny(text, entry.actions);
    const directPhrase = new RegExp(`^(?:open|show|list|${entry.words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\s+please)?$`).test(text);
    if (hasAction || directPhrase) {
      return { kind: 'command', action: entry.view, confidence: 0.96, view: entry.view };
    }
  }

  if (/^(?:go|take me|le chalo|jao|open)\b/.test(text) && /\b(home|dashboard|chat)\b/.test(text)) {
    return { kind: 'command', action: 'chat', confidence: 0.95, view: 'chat' };
  }

  return { kind: 'chat', confidence: 0.4 };
}

export const UNIVERSAL_VIEW_ALIASES = VIEW_ALIASES;
