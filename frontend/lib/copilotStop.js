// Devin-style Stop for the Copilot IDE agent run loop.
//
// Aborts the local SSE stream AND cancels the run server-side (the backend's
// wrapStreamHandler registers the task; POST /api/chat/tasks/:id/cancel aborts
// the AbortController that the CopilotDirector loop checks via signal.aborted).
// Without the server call, the director would keep running headless after the
// browser dropped the stream. Extracted so it can be unit-tested with a fake
// fetch (see frontend/tests/copilotStop.test.js).

/**
 * @param {object} p
 * @param {string} [p.backend] base URL ('' = same-origin Next proxy)
 * @param {string} [p.taskId] run task id sent with POST /api/agent/run
 * @param {{abort?: Function}} [p.controller] the run's AbortController
 * @param {Function} [p.fetchImpl] injectable fetch (defaults to global)
 * @returns {boolean} true if a server cancel was attempted
 */
export function cancelAgentRun({ backend = '', taskId, controller, fetchImpl } = {}) {
  try { controller?.abort(); } catch (_) {}
  if (!taskId) return false;
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return false;
  try {
    const p = doFetch(`${backend}/api/chat/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      keepalive: true,
    });
    // Cancel is best-effort: a finished run 404s and a dead network must never
    // block or surface as an error on the Stop path.
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
  return true;
}
