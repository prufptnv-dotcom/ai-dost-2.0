import { useState, useEffect } from 'react';
import api from '../services/api';

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';
const getMsgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: 'Namaste! Main AI-Dost hoon. Aap kya karna chahte hain aaj?',
  timestamp: new Date().toISOString(),
};

export function useChatHistory() {
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('ai_dost_session_id') || 'default';
      } catch (_) {}
    }
    return 'default';
  });

  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const sid = localStorage.getItem('ai_dost_session_id') || 'default';
        const saved = localStorage.getItem(getMsgKey(sid));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return [WELCOME];
  });

  const [sessions, setSessions] = useState([]);
  const [backendHistory, setBackendHistory] = useState(null);
  const [persona, setPersona] = useState('auto');

  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSONA_KEY);
      if (p && p !== 'hinglish') setPersona(p);
      else setPersona('auto');
      const s = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
      if (Array.isArray(s) && s.length > 0) setSessions(s);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let stale = false;
    api.get(`/chat/history?session_id=${sessionId}`, { signal: controller.signal })
      .then((res) => {
        if (stale) return;
        const rows = Array.isArray(res.data) ? res.data : (res.data?.messages || res.data?.history || []);
        if (rows.length > 0) {
          setBackendHistory(rows);
          setMessages((current) => {
            const isEmptyOrWelcome = !current || current.length === 0 || (current.length === 1 && current[0].id === 'welcome');
            if (isEmptyOrWelcome) {
              const restored = [];
              for (const row of rows) {
                const userMsg = row.user_message || row.prompt || (row.role === 'user' ? row.content : null);
                const reply = row.response || (row.role === 'assistant' ? row.content : null);
                if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg, timestamp: row.timestamp || row.created_at });
                else if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply, timestamp: row.timestamp || row.created_at });
                else if (row.role && row.content) restored.push({ id: Date.now() + restored.length, role: row.role, content: row.content, timestamp: row.timestamp || row.created_at });
              }
              if (restored.length > 0) return restored;
            }
            return current;
          });
        }
      })
      .catch(() => {});
    return () => {
      stale = true;
      controller.abort();
    };
  }, [sessionId]);

  const loadBackendHistory = () => {
    if (!backendHistory || backendHistory.length === 0) return;
    const restored = [];
    for (const row of backendHistory) {
      const userMsg = row.user_message || row.prompt || (row.role === 'user' ? row.content : null);
      const reply = row.response || (row.role === 'assistant' ? row.content : null);
      if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg, timestamp: row.timestamp || row.created_at });
      else if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply, timestamp: row.timestamp || row.created_at });
      else if (row.role && row.content) restored.push({ id: Date.now() + restored.length, role: row.role, content: row.content, timestamp: row.timestamp || row.created_at });
    }
    if (restored.length > 0) {
      setMessages(restored);
      setBackendHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: `History loaded (${restored.length} messages)` } }));
      }
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const isOnlyWelcome = messages.length === 1 && messages[0].id === 'welcome';
      const isStreaming = messages.some((m) => m.isStreaming);
      if (!isOnlyWelcome && !isStreaming) {
        try { localStorage.setItem(getMsgKey(sessionId), JSON.stringify(messages)); } catch (_) {}
      }
    }
  }, [messages, sessionId]);

  const switchSession = (newSessionId) => {
    setSessionId(newSessionId);
    try {
      localStorage.setItem('ai_dost_session_id', newSessionId);
    } catch (_) {}
  };
  
  const createNewChat = () => {
    const newId = 'chat_' + Math.random().toString(36).slice(2, 9);
    switchSession(newId);
    setMessages([WELCOME]);
    setBackendHistory(null);
    return newId;
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setBackendHistory(null);
    if (sessionId) {
      try {
        localStorage.removeItem(getMsgKey(sessionId));
      } catch (_) {}
    }
  };

  return {
    messages,
    setMessages,
    sessionId,
    setSessionId,
    switchSession,
    sessions,
    setSessions,
    persona,
    setPersona,
    backendHistory,
    setBackendHistory,
    loadBackendHistory,
    createNewChat,
    clearChat
  };
}
