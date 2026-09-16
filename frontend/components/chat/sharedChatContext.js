const STORAGE_KEY = 'ai_dost_shared_chat_context_v1';
const MAX_ITEMS = 15;
const MAX_TOTAL_CHARS = 90000;
const MAX_ITEM_CHARS = 12000;

function sanitizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name || item.file || 'Attached file').slice(0, 240);
  const content = String(item.content || item.reply || '').trim().slice(0, MAX_ITEM_CHARS);
  if (!content) return null;
  return {
    name,
    content,
    updatedAt: Number(item.updatedAt) || Date.now(),
    mime: item.mime ? String(item.mime).slice(0, 120) : undefined,
  };
}

function readItems() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizeItem).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function writeItems(items) {
  if (typeof window === 'undefined') return false;
  try {
    const normalized = [];
    let total = 0;
    for (const item of items.slice(0, MAX_ITEMS)) {
      const safe = sanitizeItem(item);
      if (!safe) continue;
      if (normalized.length > 0 && total + safe.content.length > MAX_TOTAL_CHARS) break;
      total += safe.content.length;
      normalized.push(safe);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch (_) {
    return false;
  }
}

export function saveSharedAnalysis({ name, content, mime }) {
  const safe = sanitizeItem({ name, content, mime });
  if (!safe) return false;
  const existing = readItems().filter((item) => item.name !== safe.name);
  return writeItems([safe, ...existing]);
}

export function readSharedContext() {
  return readItems();
}

export function clearSharedContext() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

export function buildUploadedDocsContext(items = readSharedContext()) {
  return items
    .map((item) => ({
      name: item.name,
      content: item.content,
      mime: item.mime,
    }))
    .filter((item) => item.content);
}

export const SHARED_CONTEXT_STORAGE_KEY = STORAGE_KEY;
export const SHARED_CONTEXT_LIMITS = {
  maxItems: MAX_ITEMS,
  maxTotalChars: MAX_TOTAL_CHARS,
  maxItemChars: MAX_ITEM_CHARS,
};
