import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { initWebSocket } from '../services/websocket';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});

  useEffect(() => {
    if (!projectId) return;
    
    const token = localStorage.getItem('ai_dost_token');
    // If no real auth token exists, skip WebSocket — server will reject fake tokens
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SocketContext] No auth token — WebSocket connection skipped.');
      }
      return;
    }
    let isMounted = true;
    
    const ws = initWebSocket(
      projectId, 
      token,
      (message) => {
        if (!message) return;
        
        switch (message.type) {
          case 'project_init':
            if (message.data) {
              setCollaborators(prev => {
                if (prev.some(c => c.userId === message.data.user_id)) return prev;
                return [...prev, {
                  userId: message.data.user_id,
                  username: message.data.user_name || 'Collaborator',
                  color: message.data.user_color || '#06b6d4'
                }];
              });
            }
            break;
            
          case 'user_joined':
            setCollaborators(prev => {
              if (prev.some(c => c.userId === message.user_id)) return prev;
              return [...prev, {
                userId: message.user_id,
                username: message.user_name || 'Collaborator',
                color: message.user_color || '#8b5cf6'
              }];
            });
            break;
            
          case 'user_left':
            setCollaborators(prev => prev.filter(c => c.userId !== message.user_id));
            setRemoteCursors(prev => {
              const copy = { ...prev };
              delete copy[message.user_id];
              return copy;
            });
            break;
            
          case 'cursor_move':
            if (message.user_id && message.position) {
              setRemoteCursors(prev => ({
                ...prev,
                [message.user_id]: {
                  userId: message.user_id,
                  username: message.user_name || 'Collaborator',
                  color: message.user_color || '#06b6d4',
                  position: message.position
                }
              }));
            }
            break;
            
          default:
            break;
        }
      },
      (error) => console.error('WebSocket error:', error),
      (reason) => console.log('WebSocket disconnected:', reason)
    );
    
    const timer = setTimeout(() => {
      if (isMounted) setSocket(ws);
    }, 0);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      setSocket(null);
    };
  }, [projectId]);

  const sendMessage = (data) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  };

  return (
    <SocketContext.Provider value={{ socket, sendMessage, setProjectId, collaborators, remoteCursors }}>
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
