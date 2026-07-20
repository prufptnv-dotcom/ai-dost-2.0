import React, { createContext, useContext, useEffect, useState } from 'react';
import { initWebSocket } from '../services/websocket';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [projectId, setProjectId] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    
    const token = localStorage.getItem('ai_dost_token') || 'demo_token';
    const ws = initWebSocket(
      projectId, 
      token,
      (message) => {
        // Log all inbound messages
        console.log('Received WebSocket message:', message);
      },
      (error) => console.error('WebSocket error:', error),
      (reason) => console.log('WebSocket disconnected:', reason)
    );
    
    setSocket(ws);
    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [projectId]);

  const sendMessage = (data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  return (
    <SocketContext.Provider value={{ socket, sendMessage, setProjectId }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
