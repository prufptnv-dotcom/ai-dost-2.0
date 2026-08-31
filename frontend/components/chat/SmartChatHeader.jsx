import React from 'react';
import { Search, MoreHorizontal } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export default function SmartChatHeader({
  sessionName,
  projectName,
}) {
  return (
    <div className="h-12 shrink-0 px-4 md:px-6 border-b border-border-subtle bg-canvas-base flex items-center justify-between gap-2 select-none">
      <div className="flex items-center gap-2">
        <AiDostMark size={16} className="text-ink-muted" />
        <span className="text-sm font-medium text-paper-200">AI-Dost</span>
        {(projectName || sessionName !== 'New conversation') && (
          <>
            <span className="text-ink-muted text-sm">/</span>
            <span className="text-sm font-medium text-paper-100 truncate max-w-[200px]">
              {projectName || sessionName}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 text-ink-muted">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-canvas-elevated hover:text-paper-100 transition-colors">
          <Search size={16} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-canvas-elevated hover:text-paper-100 transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
