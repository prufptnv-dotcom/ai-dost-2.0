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
    <header className="h-12 shrink-0 px-4 md:px-6 border-b border-border-subtle bg-canvas-base flex items-center justify-between gap-3 select-none" role="banner">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ai-dost-open-mobile-nav'))} className="sm:hidden p-1 -ml-1 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer" aria-label="Open sidebar" title="Open sidebar"><AiDostMark size={18} /></button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('ai_dost_toggle_sidebar'))} className="hidden sm:inline-flex p-1 -ml-1 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer transition-colors" title="Toggle sidebar (Ctrl+B)" aria-label="Toggle sidebar"><AppIcon name="collapse" size={16} /></button>
        <span className="text-sm font-medium text-paper-200 shrink-0">AI-Dost</span>
        {(projectName || (sessionName && sessionName !== 'New conversation')) && <><span className="text-ink-muted text-sm shrink-0">/</span><span className="text-sm font-medium text-paper-100 truncate max-w-[180px] sm:max-w-[220px]">{projectName || sessionName}</span></>}
      </div>
      <div className="flex items-center gap-1.5 text-ink-muted">
        <button type="button" onClick={() => setIsLiveOpen(true)} className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer mr-2" title="Start Live Session (GPT-4o Voice)" aria-label="Start Live Voice">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          <span className="hidden sm:inline">Live Call</span>
        </button>
        {onNewSession && <button type="button" onClick={onNewSession} className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-paper-200 hover:bg-canvas-elevated hover:text-paper-100 transition-colors cursor-pointer" title="New conversation" aria-label="New conversation"><AppIcon name="plus" size={14} /><span className="hidden sm:inline">New</span></button>}
        <button type="button" onClick={handleOpenSearch} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-canvas-elevated hover:text-paper-100 transition-colors cursor-pointer" title="Search chats (Ctrl+K)" aria-label="Search chats"><AppIcon name="search" size={15} /></button>
      </div>

      {isLiveOpen && <LiveMultimodalExperience onClose={() => setIsLiveOpen(false)} />}
    </header>
  );
}
