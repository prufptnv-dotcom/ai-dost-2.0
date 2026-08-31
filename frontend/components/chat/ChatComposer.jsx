import React, { useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Square, Sparkles } from 'lucide-react';
import { IconButton } from '../ui/Button';

export function ChatComposer({
  input = '',
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  onOpenVoice,
  placeholder = 'Ask anything, generate code, or orchestrate agent...',
  persona,
  onSelectPersona,
  className = '',
}) {
  const textareaRef = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend && onSend();
      }
    }
  };

  return (
    <div className={`relative w-full rounded-xl bg-canvas-surface border border-border focus-within:border-border-focus focus-within:shadow-md transition-fast ${className}`}>
      {/* Input Area */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-transparent text-sm text-txt-primary placeholder-txt-muted px-4 pt-3.5 pb-2 resize-none focus:outline-none max-h-44 leading-relaxed font-sans"
      />

      {/* Action Toolbar */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border-subtle select-none">
        {/* Left Actions: Voice, Persona */}
        <div className="flex items-center gap-1.5">
          {onOpenVoice && (
            <button
              type="button"
              onClick={onOpenVoice}
              className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs text-txt-muted hover:text-txt-primary hover:bg-canvas-elevated transition-fast cursor-pointer focus-ring"
              title="Voice Input"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Voice</span>
            </button>
          )}

          {persona && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-canvas-elevated text-txt-muted border border-border-subtle">
              {persona}
            </span>
          )}
        </div>

        {/* Right Actions: Hints & Send/Stop button */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-txt-muted hidden sm:inline">
            <kbd className="font-mono">Enter</kbd> to send
          </span>

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-status-error text-white hover:bg-status-error/90 transition-fast cursor-pointer shadow-xs focus-ring"
              title="Stop Generation"
              aria-label="Stop Generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || disabled}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-fast cursor-pointer shadow-xs focus-ring"
              title="Send Message"
              aria-label="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatComposer;
