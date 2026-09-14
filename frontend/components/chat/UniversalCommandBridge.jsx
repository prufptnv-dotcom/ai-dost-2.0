import { useEffect } from 'react';
import { classifyUniversalIntent } from './universalIntent';

const COMPOSER_SELECTOR = 'textarea[aria-label="Ask AI-Dost anything"]';

export default function UniversalCommandBridge({ onNavigate, onNewChat, onDeleteChat }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || !target.matches(COMPOSER_SELECTOR)) return;

      const intent = classifyUniversalIntent(target.value);
      if (intent.kind !== 'command' || intent.confidence < 0.9) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      if (intent.action === 'new-chat') {
        onNewChat?.();
      } else if (intent.action === 'delete-chat') {
        onDeleteChat?.();
      } else if (intent.action === 'chat') {
        onNavigate?.('chat');
      } else {
        onNavigate?.(intent.action);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onDeleteChat, onNavigate, onNewChat]);

  return null;
}
