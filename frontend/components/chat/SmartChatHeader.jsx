import React from 'react';
import AppIcon from '../ui/AppIcon';
import { AiDostMark } from '../brand/AiDostMark';
import LiveMultimodalExperience from './LiveMultimodalExperience';

export default function SmartChatHeader({
  sessionName = 'New conversation',
  projectName,
  onNewSession,
}) {
  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('ai-dost-open-command-palette'));
  };

  React.useEffect(() => {
    const handleDocClick = (e) => {
      const btn = e.target?.closest?.('button');
      if (!btn) return;
      const label = btn.getAttribute('aria-label');
      if (label === 'Voice input') {
        window.dispatchEvent(new CustomEvent('ai_dost_chat_voice_toggle'));
      } else if (label === 'Attach file') {
        window.dispatchEvent(new CustomEvent('ai_dost_chat_attach'));
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const [isLiveOpen, setIsLiveOpen] = React.useState(false);

  return (
    <header className="h-[54px] shrink-0 px-5 border-b border-border-subtle bg-canvas-base/80 backdrop-blur-md flex items-center justify-between select-none" role="banner">
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ai-dost-open-mobile-nav'))} className="sm:hidden p-1 -ml-1 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer" aria-label="Open sidebar" title="Open sidebar">
          <AiDostMark size={18} />
        </button>
        <span className="text-[14px] font-semibold text-paper-100 truncate max-w-[200px] sm:max-w-[300px] tracking-tight">
          {projectName || sessionName}
        </span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-400">Session active</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-ink-muted">
        {/* Mockup specific header icons (e.g. split view toggles) */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-canvas-surface border border-border-subtle hover:text-paper-100 hover:border-border transition-all">
          <AppIcon name="columns" size={14} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-canvas-surface border border-border-subtle hover:text-paper-100 hover:border-border transition-all">
          <AppIcon name="code" size={14} />
        </button>
      </div>

      {isLiveOpen && <LiveMultimodalExperience onClose={() => setIsLiveOpen(false)} />}
    </header>
  );
}
