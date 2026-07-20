export const initWebSocket = (projectId, token, onMessage, onError, onDisconnect) => {
  // Use ws:// prefix for WebSocket connections
  const wsUrl = `ws://localhost:5000/api/v1/realtime/project/${projectId}?token=${token}`;
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to WebSocket server successfully');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket connection error:', err);
    if (onError) onError(err);
  };

  ws.onclose = (event) => {
    console.log(`WebSocket connection closed: ${event.reason || 'No reason specified'}`);
    if (onDisconnect) onDisconnect(event.reason);
  };

  return ws;
};
