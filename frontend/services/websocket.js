/**
 * WebSocket service for real-time collaboration.
 * Keeps the existing API surface while adding bounded reconnects with
 * exponential backoff + jitter, online recovery, and an explicit close().
 */

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
let defaultWs = 'ws://localhost:5000';

if (apiBase) {
  defaultWs = apiBase.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '');
} else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  defaultWs = `wss://${window.location.host}`;
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_GO_WS_URL || defaultWs;
const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 15000;

const computeReconnectDelay = (attempt) => {
  const exponential = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
};

export const initWebSocket = (projectId, token, onMessage, onError, onDisconnect, onStatus) => {
  if (!projectId) {
    console.warn('[WebSocket] No projectId provided — skipping connection.');
    return null;
  }

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const wsUrl = `${WS_BASE_URL}/api/v1/realtime/project/${projectId}${tokenParam}`;
  let currentSocket = null;
  let closedByCaller = false;
  let reconnectTimer = null;
  let reconnectAttempt = 0;

  const emitStatus = (status, meta = {}) => {
    if (typeof onStatus === 'function') onStatus(status, meta);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closedByCaller || reconnectTimer || reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        emitStatus('failed', { attempt: reconnectAttempt });
      }
      return;
    }

    reconnectAttempt += 1;
    const delay = computeReconnectDelay(reconnectAttempt);
    emitStatus('reconnecting', { attempt: reconnectAttempt, delay });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closedByCaller) return;

    emitStatus('connecting', { attempt: reconnectAttempt });
    try {
      currentSocket = new WebSocket(wsUrl);
    } catch (err) {
      currentSocket = null;
      if (onError) onError(err);
      emitStatus('error', { error: err });
      scheduleReconnect();
      return;
    }

    currentSocket.onopen = () => {
      reconnectAttempt = 0;
      emitStatus('connected');
      if (process.env.NODE_ENV === 'development') {
        console.log('[WebSocket] Connected');
      }
    };

    currentSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err.message);
        emitStatus('protocol_error', { error: err });
      }
    };

    currentSocket.onerror = (err) => {
      if (onError) onError(err);
      emitStatus('error', { error: err });
      // Browsers generally follow an error with close; reconnect is scheduled there.
    };

    currentSocket.onclose = (event) => {
      currentSocket = null;
      if (onDisconnect) onDisconnect(event.reason || 'Connection closed', event);
      if (closedByCaller) {
        emitStatus('closed', { code: event.code });
        return;
      }
      emitStatus('disconnected', { code: event.code, reason: event.reason || 'Connection closed' });
      scheduleReconnect();
    };
  };

  connect();

  // Adapter object keeps existing consumers simple while allowing reconnects to
  // replace the underlying native WebSocket instance transparently.
  return {
    get readyState() {
      return currentSocket?.readyState ?? WebSocket.CLOSED;
    },
    send(data) {
      if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) return false;
      currentSocket.send(data);
      return true;
    },
    close(code = 1000, reason = 'Client closed connection') {
      closedByCaller = true;
      clearReconnectTimer();
      if (currentSocket) {
        try {
          currentSocket.close(code, reason);
        } catch (_) {
          // Ignore close errors during unmount/navigation.
        }
      } else {
        emitStatus('closed', { code });
      }
    },
  };
};

export const __testables = {
  computeReconnectDelay,
  MAX_RECONNECT_ATTEMPTS,
};
