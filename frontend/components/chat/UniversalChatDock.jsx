import { useCallback } from 'react';
import { useRouter } from 'next/router';
import ChatExperienceLayer from './ChatExperienceLayerV4';

const VIEW_IDS = new Set([
  'chat',
  'projects',
  'copilot',
  'agent',
  'research',
  'images',
  'resume',
  'artifacts',
  'analytics',
  'automations',
  'settings',
  'history',
  'voice',
]);

function resetChatState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('ai_dost_messages_chat');
    localStorage.setItem('ai_dost_session_id', 'default');
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('ai_dost_force_new_chat'));
}

function deleteCurrentChatState() {
  if (typeof window === 'undefined') return;
  try {
    const sessionId = localStorage.getItem('ai_dost_session_id') || 'default';
    localStorage.removeItem(sessionId === 'default' ? 'ai_dost_messages_chat' : `ai_dost_messages_${sessionId}`);
    localStorage.setItem('ai_dost_session_id', 'default');
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('ai_dost_force_new_chat'));
}

export default function UniversalChatDock() {
  const router = useRouter();

  const onNavigate = useCallback((action) => {
    if (!VIEW_IDS.has(action)) return;
    if (action === 'chat') {
      router.push('/dashboard');
      return;
    }
    router.push({ pathname: '/dashboard', query: { view: action } });
  }, [router]);

  const onNewChat = useCallback(() => {
    resetChatState();
    router.push('/dashboard?view=chat');
  }, [router]);

  const onDeleteChat = useCallback(() => {
    deleteCurrentChatState();
    router.push('/dashboard?view=chat');
  }, [router]);

  if (router.pathname !== '/dashboard') return null;

  return (
    <ChatExperienceLayer
      onNavigate={onNavigate}
      onNewChat={onNewChat}
      onDeleteChat={onDeleteChat}
    />
  );
}
