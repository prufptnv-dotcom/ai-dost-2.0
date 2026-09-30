import React from 'react';
import { Paperclip, Mic, Send, Square } from 'lucide-react';

export default function ChatComposerDock({
  input,
  setInput,
  attachments = [],
  setAttachments,
  thinking = false,
  selectedModel = 'auto',
  onModelChange,
  modelOptions = [],
  onSend,
  onStop,
  stopActive = false,
  onKeyDown,
  onPaste,
  onFileSelect,
  fileInputRef,
  inputRef,
  onOpenVoice,
}) {
  return (
    <div className="px-4 md:px-6 pb-4 pt-2 bg-canvas-base border-t border-border-subtle shrink-0">
      <div className="max-w-3xl mx-auto w-full">
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs bg-canvas-surface border border-border shadow-xs"
              >
                {att.type === 'image' && att.base64 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`data:${att.mime || 'image/png'};base64,${att.base64}`}
                    alt="Attachment"
                    className="w-5 h-5 rounded object-cover border border-border shrink-0"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-accent" />
                )}
                <span className="truncate max-w-[140px] sm:max-w-[200px] text-paper-100 font-medium text-[11px]">
                  {att.name}
                </span>
                <span className="text-[9px] text-ink-muted uppercase font-mono px-1 py-0.2 rounded bg-canvas-elevated">
                  {att.ext || att.type}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-0.5 rounded text-ink-muted hover:text-paper-100 cursor-pointer hover:bg-canvas-elevated transition-fast"
                  aria-label="Remove attachment"
                  title="Remove attachment"
                >
                  ✕
                </button>
              </div>
            ))}
            {attachments.length > 1 && (
              <button
                type="button"
                onClick={() => setAttachments([])}
                className="text-[11px] text-ink-muted hover:text-paper-100 hover:underline px-1 py-0.5 cursor-pointer"
              >
                Clear all ({attachments.length})
              </button>
            )}
          </div>
        )}

        <div
          className={`relative rounded-2xl bg-canvas-surface/90 backdrop-blur-xl border shadow-xl transition-all duration-300 ${
            stopActive
              ? 'border-accent/60 shadow-[0_0_34px_-8px_rgba(99,102,241,0.6)]'
              : 'border-border hover:border-border-strong focus-within:border-accent/50 focus-within:shadow-[0_0_24px_-4px_rgba(99,102,241,0.25)]'
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={Math.min(4, Math.max(1, input.split('\n').length))}
            placeholder="Ask AI-Dost anything, or paste an image (Ctrl+V)…"
            style={{ color: 'var(--paper-100, var(--color-text-primary, #0f172a))' }}
            className="w-full bg-transparent resize-none text-sm focus:outline-none placeholder:text-ink-muted text-paper-100 leading-relaxed px-4 pt-3 pb-1 font-sans min-h-[40px] max-h-[140px]"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.java,.c,.cpp,.go,.rs"
            className="hidden"
            onChange={onFileSelect}
          />

          <div className="flex items-center justify-between px-3 pb-2 pt-0.5 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                title="Attach file"
                aria-label="Attach file"
                className="p-1.5 rounded-lg hover:bg-canvas-elevated text-paper-300 hover:text-paper-100 transition-fast cursor-pointer focus-ring"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={onOpenVoice}
                  title="Voice input"
                  aria-label="Voice input"
                  className="p-1.5 rounded-lg hover:bg-canvas-elevated text-paper-300 hover:text-accent transition-fast cursor-pointer focus-ring"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={onModelChange}
                title="Select model"
                aria-label="Select model"
                className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-canvas-elevated/80 hover:bg-canvas-elevated border border-border hover:border-border-strong text-paper-100 cursor-pointer focus:outline-none focus:border-accent transition-fast"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {stopActive ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop generating (Stop)"
                  aria-label="Stop generating"
                  className="group/stop flex items-center justify-center w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-[0_0_14px_-2px_rgba(239,68,68,0.6)] active:scale-95 transition-all duration-150 cursor-pointer focus-ring animate-pulse hover:animate-none"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!input.trim() || thinking}
                  title="Send (Enter)"
                  aria-label="Send message"
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer focus-ring ${
                    input.trim() && !thinking
                      ? 'bg-accent text-white hover:bg-accent-hover shadow-[0_0_14px_-2px_rgba(99,102,241,0.5)] active:scale-95'
                      : 'bg-canvas-elevated text-ink-muted opacity-40 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-center text-ink-muted mt-1.5 select-none">
          AI-Dost can make mistakes. Verify important information.
        </div>
      </div>
    </div>
  );
}
