import React from 'react';
import AppIcon from '../ui/AppIcon';

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
                  <AppIcon name="paperclip" className="w-3.5 h-3.5 text-accent" />
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
          className={`relative rounded-2xl bg-canvas-elevated/80 backdrop-blur-xl border shadow-lg transition-all duration-300 ${
            stopActive
              ? 'border-accent/50 shadow-[0_0_30px_-6px_rgba(99,102,241,0.4)]'
              : 'border-border hover:border-border-strong focus-within:border-accent/40 focus-within:shadow-[0_0_24px_-6px_rgba(99,102,241,0.25)]'
          }`}
        >
          <textarea
            ref={inputRef}
            aria-label="Ask AI-Dost anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={Math.min(4, Math.max(1, input.split('\n').length))}
            placeholder="Reply ya kuch bhi poocho — image bhi paste kar sakte ho (Ctrl+V)..."
            style={{ color: 'var(--paper-100, var(--color-text-primary, #0f172a))' }}
            className="w-full bg-transparent resize-none text-sm focus:outline-none placeholder:text-ink-muted text-paper-100 leading-relaxed px-5 pt-4 pb-1 font-sans min-h-[44px] max-h-[140px]"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx,.pptx,.xlsx,.xls,.csv,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.java,.c,.cpp,.go,.rs"
            className="hidden"
            onChange={onFileSelect}
          />

          <div className="flex items-center justify-between px-4 pb-3 pt-1 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                title="Attach file"
                aria-label="Attach file"
                className="p-2 rounded-lg hover:bg-canvas-surface text-paper-300 hover:text-paper-100 transition-fast cursor-pointer focus-ring"
              >
                <AppIcon name="paperclip" className="w-4 h-4" />
              </button>
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={onOpenVoice}
                  title="Voice input"
                  aria-label="Voice input"
                  className="p-2 rounded-lg hover:bg-canvas-surface text-paper-300 hover:text-accent transition-fast cursor-pointer focus-ring"
                >
                  <AppIcon name="mic" className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative group/model">
                <select
                  value={selectedModel}
                  onChange={onModelChange}
                  title="Select model"
                  aria-label="Select model"
                  className="appearance-none pl-7 pr-8 py-1.5 rounded-full text-[11px] font-semibold bg-canvas-surface hover:bg-canvas-elevated border border-border text-paper-200 cursor-pointer focus:outline-none focus:border-accent/40 transition-fast"
                >
                  {(() => {
                    const ungrouped = modelOptions.filter((m) => !m.group);
                    const groupedMap = new Map();
                    modelOptions.forEach((m) => {
                      if (m.group) {
                        if (!groupedMap.has(m.group)) groupedMap.set(m.group, []);
                        groupedMap.get(m.group).push(m);
                      }
                    });

                    return (
                      <>
                        {ungrouped.map((m) => (
                          <option key={m.id} value={m.id} className="bg-canvas-surface text-paper-100">
                            {m.label === 'Auto' ? 'Auto · cascade' : m.label}
                          </option>
                        ))}
                        {Array.from(groupedMap.entries()).map(([groupName, items]) => (
                          <optgroup key={groupName} label={groupName} className="bg-canvas-surface font-semibold text-accent">
                            {items.map((m) => (
                              <option key={m.id} value={m.id} className="bg-canvas-surface text-paper-100 font-normal">
                                {m.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </>
                    );
                  })()}
                </select>
                <AppIcon name="zap" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-accent pointer-events-none" />
                <AppIcon name="chevronDown" className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-muted pointer-events-none opacity-70" />
              </div>
              {stopActive ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop generating (Stop)"
                  aria-label="Stop generating"
                  className="group/stop flex items-center justify-center w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-[0_0_16px_-2px_rgba(239,68,68,0.55)] active:scale-95 transition-all duration-150 cursor-pointer focus-ring animate-pulse hover:animate-none"
                >
                  <AppIcon name="square" className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!input.trim() || thinking}
                  title="Send (Enter)"
                  aria-label="Send message"
                  className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150 cursor-pointer focus-ring ${
                    input.trim() && !thinking
                      ? 'bg-accent text-white hover:bg-accent-hover shadow-[0_0_16px_-2px_rgba(99,102,241,0.55)] active:scale-95'
                      : 'bg-canvas-surface text-ink-muted opacity-40 cursor-not-allowed'
                  }`}
                >
                  <AppIcon name="arrowUp" className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-center text-ink-muted mt-2.5 select-none flex items-center justify-center gap-1.5">
          <span>AI-Dost galti kar sakta hai — important code verify kar lein.</span>
          <span className="opacity-40">·</span>
          <span>Enter = send</span>
          <span className="opacity-40">·</span>
          <span>Shift+Enter = newline</span>
        </div>
      </div>
    </div>
  );
}
