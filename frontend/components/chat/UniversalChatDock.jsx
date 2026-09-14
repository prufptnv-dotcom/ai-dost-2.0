import { useCallback } from 'react';
import { useRouter } from 'next/router';
import ChatExperienceLayer from './ChatExperienceLayerV4';
import UniversalCommandBridge from './UniversalCommandBridge';

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

function clickNewConversationButton() {
  if (typeof document === 'undefined') return false;
  const button = document.querySelector('button[aria-label="New conversation"]');
  if (!button) return false;
  button.click();
  return true;
}

function resetChatState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('ai_dost_messages_chat');
    localStorage.setItem('ai_dost_session_id', 'default');
  } catch (_) {}
  if (!clickNewConversationButton()) window.location.assign('/dashboard');
}

function deleteCurrentChatState() {
  if (typeof window === 'undefined') return;
  try {
    const sessionId = localStorage.getItem('ai_dost_session_id') || 'default';
    localStorage.removeItem(sessionId === 'default' ? 'ai_dost_messages_chat' : `ai_dost_messages_${sessionId}`);
    localStorage.setItem('ai_dost_session_id', 'default');
  } catch (_) {}
  if (!clickNewConversationButton()) window.location.assign('/dashboard');
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
  }, []);

  const onDeleteChat = useCallback(() => {
    deleteCurrentChatState();
  }, []);

  if (router.pathname !== '/dashboard') return null;

  return (
    <>
      <UniversalCommandBridge
        onNavigate={onNavigate}
        onNewChat={onNewChat}
        onDeleteChat={onDeleteChat}
      />
      <ChatExperienceLayer
        onNavigate={onNavigate}
        onNewChat={onNewChat}
        onDeleteChat={onDeleteChat}
      />
    </>
  );
}
