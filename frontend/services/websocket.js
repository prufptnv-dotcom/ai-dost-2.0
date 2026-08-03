/**
 * WebSocket service for real-time collaboration.
 * Uses NEXT_PUBLIC_GO_WS_URL env var so the URL works in
 * local dev (ws://) and production (wss://) without code changes.
 */

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_GO_WS_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `wss://${typeof window !== 'undefined' ? window.location.host : ''}`
    : 'ws://localhost:5000');

export const initWebSocket = (projectId, token, onMessage, onError, onDisconnect) => {
  if (!projectId) {
    console.warn('[WebSocket] No projectId provided — skipping connection.');
    return null;
  }

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const wsUrl = `${WS_BASE_URL}/api/v1/realtime/project/${projectId}${tokenParam}`;

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error('[WebSocket] Failed to create WebSocket:', err.message);
    if (onError) onError(err);
    return null;
  }

  ws.onopen = () => {
    // Connected — no console noise in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[WebSocket] Connected: ${wsUrl}`);
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('[WebSocket] Failed to parse message:', e.message);
    }
  };

  ws.onerror = (err) => {
    console.error('[WebSocket] Connection error:', err?.message || err);
    if (onError) onError(err);
  };

  ws.onclose = (event) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[WebSocket] Closed: ${event.reason || 'Connection closed'} (code ${event.code})`);
    }
    if (onDisconnect) onDisconnect(event.reason);
  };

  return ws;
};
