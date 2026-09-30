const VIEW_ALIASES = [
  { view: 'projects', words: ['project', 'projects', 'mere projects'], actions: ['open', 'show', 'list', 'khol', 'kholo', 'dikha', 'dikhao', 'dekh'] },
  { view: 'history', words: ['history', 'chat history', 'old chats', 'purani chat', 'purani baatein'], actions: ['open', 'show', 'list', 'khol', 'kholo', 'dikha', 'dikhao', 'dekh'] },
  { view: 'copilot', words: ['copilot', 'ide', 'editor', 'code editor', 'coding', 'workspace'], actions: ['open', 'show', 'khol', 'kholo', 'dikha', 'dikhao', 'start', 'use', 'chalao'] },
  { view: 'agent', words: ['agent', 'agent mode', 'workbench', 'autonomous agent', 'planner'], actions: ['open', 'show', 'khol', 'kholo', 'dikha', 'dikhao', 'start', 'run', 'chala', 'chal', 'chalao'] },
  { view: 'research', words: ['research', 'deep research', 'khoj'], actions: ['open', 'show', 'khol', 'kholo', 'start', 'run', 'karo'] },
  { view: 'images', words: ['image generator', 'image gallery', 'gallery', 'photos', 'tasveerein'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'banao'] },
  { view: 'resume', words: ['resume', 'cv', 'biodata'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'banao'] },
  { view: 'artifacts', words: ['artifacts', 'artifact'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'analytics', words: ['analytics', 'data analytics', 'charts', 'data'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'automations', words: ['automations', 'watchers', 'automation'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'settings', words: ['settings', 'setting', 'preferences', 'configuration'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'voice', words: ['voice assistant', 'voice view', 'voice mode', 'bol kar'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'start', 'use'] },
  { view: 'bharat', words: ['bharat', 'bharat hub', 'pincode', 'ifsc', 'mandi', 'isro', 'bhashini'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'chalao'] },
  { view: 'security', words: ['security', 'security hub', 'owasp', 'vulnerability', 'audit', 'code audit', 'stride'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'karo', 'check'] },
  { view: 'writing', words: ['writing studio', 'writing', 'copywriter', 'email writer', 'letter', 'script'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'banao', 'likho'] },
  { view: 'travel', words: ['travel', 'travel assistant', 'hotel', 'restaurant', 'trip', 'itinerary', 'packing'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'plan'] },
  { view: 'decision', words: ['decision', 'decision matrix', 'problem solving', 'tradeoffs', 'rice', 'compare'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
  { view: 'language', words: ['language', 'translation', 'translate', 'grammar', 'vocab', 'anuvad'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao', 'karo'] },
  { view: 'capabilities', words: ['capabilities', 'all tools', 'studios', 'tools', 'master hub', 'saare tools'], actions: ['open', 'show', 'khol', 'kholo', 'dikhao'] },
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

  // 1. 3D Simulation & Interactive Canvas
  if (/(?:3d|threejs|three\.js|solar system|galaxy|planetary|simulation|canvas|orbit)\b/i.test(text)
    && /(?:open|show|run|start|launch|create|make|khol|kholo|dikha|dikhao|chala|chalao|banao)/i.test(text)
    || /^(?:3d simulation|show 3d|open canvas|solar system|open 3d|3d dikhao)$/i.test(text)) {
    return { kind: 'canvas', action: '3d-simulation', confidence: 0.99 };
  }

  // 2. Theme Switching (Dark / Light)
  if (/(?:dark mode|dark theme|black theme|kaala mode)/i.test(text) && /(?:switch|enable|set|karo|lagao|turn on|badlo)/i.test(text)
    || /^(?:dark mode|dark theme)$/i.test(text)) {
    return { kind: 'theme', action: 'dark', confidence: 0.99 };
  }
  if (/(?:light mode|light theme|white theme|safed mode)/i.test(text) && /(?:switch|enable|set|karo|lagao|turn on|badlo)/i.test(text)
    || /^(?:light mode|light theme)$/i.test(text)) {
    return { kind: 'theme', action: 'light', confidence: 0.99 };
  }
  if (/(?:toggle theme|switch theme|change theme|theme badlo|theme change karo)/i.test(text)) {
    return { kind: 'theme', action: 'toggle', confidence: 0.99 };
  }

  // 3. Command Palette / Search
  if (/(?:command palette|search commands|open palette|shortcuts|commands)/i.test(text)
    && /(?:open|show|khol|kholo|dikhao)/i.test(text)
    || /^(?:command palette|open search)$/i.test(text)) {
    return { kind: 'palette', action: 'open', confidence: 0.98 };
  }

  // 4. New Chat / Conversation
  if (/(?:^|\s)(new|start)\s+(?:a\s+)?(?:new\s+)?(?:chat|conversation)(?:\s+please)?$/.test(text)
    || /(?:new chat|start new chat|nayi chat|naya chat|nayi conversation|fresh chat)/.test(text)) {
    return { kind: 'command', action: 'new-chat', confidence: 0.99 };
  }

  // 5. Delete / Clear Chat
  if (/(?:delete|remove|clear|erase|hatao|mitao)\b.*\b(?:chat|conversation|current chat|old chat)/.test(text)
    || /(?:delete chat|current chat hatao|chat delete karo|purani chat hatao)/.test(text)) {
    return { kind: 'command', action: 'delete-chat', confidence: 0.99 };
  }

  // 6. Navigation Aliases (All 15 Studios & Core Views)
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
