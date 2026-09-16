const CANCEL_PATH = '/api/chat/tasks';
const ORIGINAL_KEY = '__aiDostOriginalCancelTask';

export function installServerCancelBridge() {
  if (typeof window === 'undefined') return () => {};
  if (window[ORIGINAL_KEY]) return () => {};

  const original = window.aiDostCancelTask;
  if (typeof original !== 'function') return () => {};

  window[ORIGINAL_KEY] = original;
  window.aiDostCancelTask = (taskId) => {
    if (!taskId) return false;

    // Fire server cancellation first. The local AbortController is still the
    // authoritative immediate UX path, so a slow/unavailable endpoint never
    // blocks the user's Stop action.
    try {
      void fetch(`${CANCEL_PATH}/${encodeURIComponent(taskId)}/cancel`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}

    return original(taskId);
  };

  return () => {
    if (window.aiDostCancelTask && window[ORIGINAL_KEY] === original) {
      window.aiDostCancelTask = original;
    }
    delete window[ORIGINAL_KEY];
  };
}
