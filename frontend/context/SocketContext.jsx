import React, { createContext, useContext, useEffect, useState } from 'react';
import { initWebSocket } from '../services/websocket';
import { logger } from '../utils/logger';

export const SocketContext = createContext(null);

const INITIAL_CONNECTION_STATE = 'idle';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [connectionState, setConnectionState] = useState(INITIAL_CONNECTION_STATE);
  const [connectionMeta, setConnectionMeta] = useState({});

  useEffect(() => {
    // Never carry collaboration state from the previous project into the next one.
    setCollaborators([]);
    setRemoteCursors({});
    setSocket(null);
    setConnectionMeta({});

    if (!projectId) {
      setConnectionState('idle');
      return undefined;
    }

    const token = localStorage.getItem('ai_dost_token');
    // If no real auth token exists, skip WebSocket — server will reject fake tokens.
    if (!token) {
      setConnectionState('unauthenticated');
      return undefined;
    }

    let isMounted = true;
    const ws = initWebSocket(
      projectId,
      token,
      (message) => {
        if (!isMounted || !message) return;

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
      (error) => {
        if (isMounted) logger.error('WebSocket error:', error);
      },
      (reason) => {
        if (isMounted) logger.log('WebSocket disconnected:', reason);
      },
      (status, meta) => {
        if (!isMounted) return;
        setConnectionState(status);
        setConnectionMeta(meta || {});
      }
    );

    if (ws) {
      setSocket(ws);
    } else {
      setConnectionState('failed');
    }

    return () => {
      isMounted = false;
      if (ws) ws.close(1000, 'Project changed or component unmounted');
    };
  }, [projectId]);

  const sendMessage = (data) => {
    if (!socket) return false;
    return socket.send(JSON.stringify(data));
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        sendMessage,
        setProjectId,
        collaborators,
        remoteCursors,
        connectionState,
        connectionMeta,
      }}
    >
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
