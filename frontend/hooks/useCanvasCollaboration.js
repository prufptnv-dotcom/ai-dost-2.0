import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : '');

/**
 * useCanvasCollaboration - Enterprise Real-Time Multiplayer Canvas Hook
 * Handles multi-user presence, remote cursors, low-latency code synchronization,
 * and AI virtual co-editing.
 */
export function useCanvasCollaboration({
  roomId = 'default-canvas-room',
  initialCode = '',
  language = 'html',
  title = 'Interactive Canvas',
  onRemoteSync = () => {},
  userName,
}) {
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAiCoEditing, setIsAiCoEditing] = useState(false);

  const socketRef = useRef(null);
  const lastCursorEmitRef = useRef(0);
  const onRemoteSyncRef = useRef(onRemoteSync);

  useEffect(() => {
    onRemoteSyncRef.current = onRemoteSync;
  }, [onRemoteSync]);

  // P2 #75: latest join params live in a ref — the socket effect depends ONLY
  // on roomId. Previously initialCode/language/title/userName were deps, so a
  // parent re-render with live content tore the socket down and reconnected.
  const joinParamsRef = useRef({ initialCode, language, title, userName });
  useEffect(() => {
    joinParamsRef.current = { initialCode, language, title, userName };
  }, [initialCode, language, title, userName]);

  // Connect and join room
  useEffect(() => {
    if (typeof window === 'undefined' || !roomId) return;

    const socket = io(`${BACKEND_URL}/canvas`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      const params = joinParamsRef.current;
      const localName =
        params.userName ||
        (() => {
          try {
            return localStorage.getItem('ai_dost_user_name') || `User-${socket.id.slice(0, 4)}`;
          } catch (_) {
            return `User-${socket.id.slice(0, 4)}`;
          }
        })();

      // Join room
      socket.emit(
        'canvas:join',
        {
          roomId,
          user: { name: localName },
          initialContent: { code: params.initialCode, language: params.language, title: params.title },
        },
        (res) => {
          if (res?.success) {
            setCurrentUser(res.currentUser);
            if (res.snapshot?.participants) {
              setParticipants(res.snapshot.participants.filter((p) => p.socketId !== socket.id));
            }
          }
        }
      );
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setParticipants([]);
    });

    // Remote peer joined
    socket.on('canvas:user_joined', ({ user }) => {
      if (!user || user.socketId === socket.id) return;
      setParticipants((prev) => {
        const existing = prev.filter((p) => p.socketId !== user.socketId);
        return [...existing, user];
      });
    });

    // Remote peer left
    socket.on('canvas:user_left', ({ socketId }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      if (socketId === 'ai-dost-copilot') {
        setIsAiCoEditing(false);
      }
    });

    // Remote cursor update
    socket.on('canvas:cursor_update', (data) => {
      if (!data || data.socketId === socket.id) return;
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === data.socketId
            ? { ...p, cursor: data.cursor, selection: data.selection }
            : p
        )
      );
    });

    // Remote typing indicator
    socket.on('canvas:user_typing', ({ socketId, isTyping }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isTyping } : p))
      );
    });

    // Remote code sync
    socket.on('canvas:sync', ({ fullContent, senderId, senderName }) => {
      if (senderId === socket.id) return;
      if (typeof onRemoteSyncRef.current === 'function' && fullContent !== undefined) {
        onRemoteSyncRef.current(fullContent, { senderId, senderName });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // P2 #75: only room identity re-creates the socket (join params read from ref).
  }, [roomId]);

  // Throttled cursor broadcast (max 25fps / 40ms)
  const broadcastCursor = useCallback(
    (cursor, selection = null) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      const now = Date.now();
      if (now - lastCursorEmitRef.current < 40) return;
      lastCursorEmitRef.current = now;

      socket.emit('canvas:cursor', {
        roomId,
        cursor,
        selection,
      });
    },
    [roomId]
  );

  // Broadcast code edit
  const broadcastEdit = useCallback(
    (fullContent, delta = null) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      socket.emit('canvas:edit', {
        roomId,
        fullContent,
        delta,
      });
    },
    [roomId]
  );

  // Broadcast typing status
  const broadcastTyping = useCallback(
    (isTyping) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      socket.emit('canvas:typing', {
        roomId,
        isTyping: Boolean(isTyping),
      });
    },
    [roomId]
  );

  // Trigger AI Virtual Collaborator to co-edit code live in room
  const triggerAiCoEdit = useCallback(
    (instruction, currentCode) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return Promise.reject(new Error('Socket offline'));

      setIsAiCoEditing(true);
      return new Promise((resolve, reject) => {
        socket.emit(
          'canvas:ai_coedit',
          { roomId, instruction, currentCode },
          (res) => {
            setIsAiCoEditing(false);
            if (res?.success) {
              resolve(res.code);
            } else {
              reject(new Error(res?.error || 'AI Co-Edit failed'));
            }
          }
        );
      });
    },
    [roomId]
  );

  return {
    connected,
    participants,
    currentUser,
    isAiCoEditing,
    broadcastCursor,
    broadcastEdit,
    broadcastTyping,
    triggerAiCoEdit,
  };
}
