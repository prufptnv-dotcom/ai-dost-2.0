import React, { useRef } from 'react';
import { Send, Square, Paperclip, Mic } from 'lucide-react';

export function ComposerDock({
  input = '',
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  onAttachFile,
  onOpenVoice,
  model = 'auto',
  onModelChange,
  modelOptions = [],
  placeholder = 'Type a message, ask a question, or command an agent...',
  className = '',
}) {
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isStreaming) {
        onSend && onSend();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onAttachFile) {
      onAttachFile(file);
    }
  };

  return (
    <div className={`p-4 bg-canvas-base border-t border-border select-none ${className}`}>
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="relative rounded-md bg-canvas-surface border border-border focus-within:border-accent-primary transition-fast">
          <textarea
            value={input}
            onChange={(e) => onChange && onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.min(5, Math.max(1, input.split('\n').length))}
            placeholder={placeholder}
            className="w-full bg-transparent resize-none text-sm text-paper-100 placeholder:text-ink-muted leading-relaxed px-3.5 pt-3 pb-2 focus:outline-none font-sans"
          />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Bottom Dock Controls */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border-subtle">
            <div className="flex items-center gap-1.5">
              {modelOptions && modelOptions.length > 0 && (
                <select
                  value={model}
                  onChange={(e) => onModelChange && onModelChange(e.target.value)}
                  className="px-2 py-1 rounded-xs text-[11px] font-mono bg-canvas-elevated border border-border text-paper-200 cursor-pointer focus:outline-none"
                  title="Select Model"
                >
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="p-1.5 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-fast cursor-pointer focus-ring"
                title="Attach file"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              {onOpenVoice && (
                <button
                  type="button"
                  onClick={onOpenVoice}
                  className="p-1.5 rounded-xs text-ink-muted hover:text-accent-primary hover:bg-canvas-elevated transition-fast cursor-pointer focus-ring"
                  title="Voice input"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-muted font-sans hidden sm:inline">
                <kbd className="font-mono text-[10px]">Enter</kbd> to send
              </span>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xs bg-signal-error text-paper-100 hover:opacity-90 text-xs font-sans transition-fast cursor-pointer focus-ring"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!input.trim()}
                  className="flex items-center justify-center w-7 h-7 rounded-xs bg-accent-primary hover:bg-accent-primary-strong disabled:opacity-30 disabled:cursor-not-allowed text-paper-100 transition-fast cursor-pointer shadow-sm focus-ring"
                  title="Send message"
                >
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComposerDock;
