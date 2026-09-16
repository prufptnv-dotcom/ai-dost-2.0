export const CHAT_WORKSPACE_KEY = '__aiDostChatWorkspace';

export const WORKSPACE_TYPES = Object.freeze({
  artifact: 'artifact',
  document: 'document',
  files: 'files',
});

export function createWorkspaceState({ type = WORKSPACE_TYPES.artifact, title = '', source = 'chat', payload = null } = {}) {
  return {
    version: 1,
    open: true,
    type,
    title: String(title || '').slice(0, 160),
    source,
    payload,
    updatedAt: Date.now(),
  };
}

export function persistWorkspaceState(state) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CHAT_WORKSPACE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('ai_dost_chat_workspace', { detail: state }));
  } catch (_) {}
}

export function readWorkspaceState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHAT_WORKSPACE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && state.version === 1 ? state : null;
  } catch (_) {
    return null;
  }
}

export function clearWorkspaceState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CHAT_WORKSPACE_KEY);
    window.dispatchEvent(new CustomEvent('ai_dost_chat_workspace', { detail: null }));
  } catch (_) {}
}

export default {
  CHAT_WORKSPACE_KEY,
  WORKSPACE_TYPES,
  createWorkspaceState,
  persistWorkspaceState,
  readWorkspaceState,
  clearWorkspaceState,
};
