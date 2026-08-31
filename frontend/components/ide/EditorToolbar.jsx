import React from 'react';
import {
  Save, Play, Eye, GitCompareArrows, Sparkles,
  AlignLeft, Bot, Check, Loader2, Zap, Bug, Code2
} from 'lucide-react';
import { LANG_BY_EXT } from '../views/CopilotTree';

export function EditorToolbar({
  activePath = '',
  isModified = false,
  isSaving = false,
  onSave,
  onFormat,
  onTogglePreview,
  showPreview = false,
  onToggleDiff,
  showDiff = false,
  onAiAction,
  className = '',
}) {
  const ext = activePath.split('.').pop()?.toLowerCase() || '';
  const lang = LANG_BY_EXT[ext] || 'plaintext';
  const pathParts = activePath.split('/');

  return (
    <div className={`flex items-center justify-between px-3 h-8 bg-canvas-base border-b border-border text-xs font-mono select-none flex-shrink-0 ${className}`}>
      {/* Breadcrumb Path & Save State */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 text-ink-muted truncate">
          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <span className={index === pathParts.length - 1 ? 'text-paper-100 font-medium' : 'hover:text-paper-200'}>
                {part}
              </span>
              {index < pathParts.length - 1 && <span className="text-ink-muted/50">/</span>}
            </React.Fragment>
          ))}
        </div>

        {/* State Indicator */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-canvas-surface border border-border-subtle text-[10px]">
          {isSaving ? (
            <span className="text-accent-primary flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving
            </span>
          ) : isModified ? (
            <span className="text-signal-warning flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-warning" /> Modified
            </span>
          ) : (
            <span className="text-signal-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-signal-success" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Toolbar Actions */}
      <div className="flex items-center gap-1.5">
        {/* Format Action */}
        {onFormat && (
          <button
            type="button"
            onClick={onFormat}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
            title="Format Code (Shift+Alt+F)"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Save Action */}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={!isModified || isSaving}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-sans transition-fast cursor-pointer ${
              isModified
                ? 'bg-accent-primary hover:bg-accent-primary-strong text-paper-100 font-medium'
                : 'text-ink-muted bg-canvas-surface hover:text-paper-100 opacity-60'
            }`}
            title="Save File (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            <span className="hidden sm:inline">Save</span>
          </button>
        )}

        {/* Diff Toggle */}
        {onToggleDiff && (
          <button
            type="button"
            onClick={onToggleDiff}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-sans border transition-fast cursor-pointer ${
              showDiff
                ? 'bg-canvas-elevated border-accent-primary text-accent-primary font-medium'
                : 'border-border bg-canvas-surface text-ink-muted hover:text-paper-100'
            }`}
            title="Toggle Git Diff"
          >
            <GitCompareArrows className="w-3 h-3" />
            <span className="hidden sm:inline">Diff</span>
          </button>
        )}

        {/* Live Preview Toggle */}
        {onTogglePreview && (
          <button
            type="button"
            onClick={onTogglePreview}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-sans border transition-fast cursor-pointer ${
              showPreview
                ? 'bg-canvas-elevated border-accent-primary text-accent-primary font-medium'
                : 'border-border bg-canvas-surface text-ink-muted hover:text-paper-100'
            }`}
            title="Toggle Live WebContainer Preview"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden sm:inline">Preview</span>
          </button>
        )}

        {/* Contextual AI Quick Action Button */}
        {onAiAction && (
          <div className="flex items-center gap-1 pl-1 border-l border-border">
            <button
              type="button"
              onClick={() => onAiAction('explain')}
              className="px-2 py-0.5 rounded-xs text-[11px] font-sans bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast cursor-pointer"
              title="Explain active selection"
            >
              Explain
            </button>
            <button
              type="button"
              onClick={() => onAiAction('fix')}
              className="px-2 py-0.5 rounded-xs text-[11px] font-sans bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast cursor-pointer"
              title="Find and fix issues"
            >
              Fix
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
