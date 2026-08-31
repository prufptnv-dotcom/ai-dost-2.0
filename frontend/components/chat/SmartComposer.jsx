import React, { useRef, useState } from 'react';
import {
  Paperclip,
  Bot,
  FolderKanban,
  Wrench,
  Send,
  Sparkles,
  ChevronDown,
  Mic,
  Square,
  Globe,
  FileCode2,
  Image as ImageIcon,
  Cpu,
} from 'lucide-react';

export default function SmartComposer({
  input = '',
  setInput,
  onSend,
  onStop,
  isStreaming = false,
  model = 'auto',
  onModelChange,
  onOpenVoice,
  onAttachFile,
  attachments = [],
  onRemoveAttachment,
  activeProject,
  disabled = false,
}) {
  const textareaRef = useRef(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const models = [
    { id: 'auto', label: 'Auto (Smart Pick)', desc: 'Best multi-model cascade' },
    { id: 'gemini', label: 'Gemini 1.5 Flash', desc: 'Google AI Studio (1500 req/day)' },
    { id: 'groq', label: 'Groq (Llama 3.3 70B)', desc: 'Ultra-fast inference' },
    { id: 'cerebras', label: 'Cerebras (Llama 3.1)', desc: 'Instant hardware speed' },
    { id: 'ollama', label: 'Ollama Local (qwen2.5)', desc: '100% offline & private' },
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !disabled && !isStreaming) {
        onSend();
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttachFile?.(e.target.files);
    }
  };

  return (
    <div className="p-4 bg-canvas-base border-t border-border z-20">
      <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-canvas-surface focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 shadow-md transition-fast">
        {/* Attachment preview pills if any */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-border">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-canvas-elevated border border-border text-xs text-paper-200"
              >
                <Paperclip className="w-3 h-3 text-indigo-400" />
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment?.(i)}
                  className="text-ink-muted hover:text-status-error ml-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI-Dost anything, generate code, or orchestrate agents... Shift+Enter for new line"
          rows={2}
          disabled={disabled}
          className="w-full px-4 pt-3.5 pb-2 bg-transparent text-sm text-paper-100 placeholder:text-paper-400 resize-none outline-none"
        />

        {/* Bottom Toolbar */}
        <div className="px-3 pb-3 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Attach button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-canvas-elevated hover:bg-canvas-overlay text-xs text-paper-300 hover:text-paper-100 transition-fast cursor-pointer focus-ring shadow-sm"
              title="Attach File or Image"
            >
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
              <span>Attach</span>
            </button>

            {/* Agent shortcut */}
            <button
              type="button"
              onClick={() => setInput((prev) => prev ? `Agent: ${prev}` : 'Agent: ')}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-canvas-elevated hover:bg-canvas-overlay text-xs text-paper-300 hover:text-purple-300 transition-fast cursor-pointer focus-ring shadow-sm"
              title="Prefix with Agent prompt"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>Agent</span>
            </button>

            {/* Workspace pill */}
            <div className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-canvas-elevated text-xs text-paper-300 shadow-sm">
              <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate max-w-[100px]">
                {typeof activeProject === 'string' ? activeProject : (activeProject?.project_name || 'Workspace')}
              </span>
            </div>

            {/* Tools dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((prev) => !prev)}
                className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border bg-canvas-elevated hover:bg-canvas-overlay text-xs text-paper-300 hover:text-paper-100 transition-fast cursor-pointer focus-ring shadow-sm"
                title="Enabled Tools"
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tools</span>
                <ChevronDown className="w-3 h-3 text-ink-muted" />
              </button>
              {toolsOpen && (
                <div className="absolute left-0 bottom-10 w-44 rounded-xl border border-border bg-canvas-elevated p-2 shadow-xl z-50 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-ink-muted px-2 py-1">Active Capabilities</div>
                  {[
                    { label: 'Code Execution', icon: FileCode2, color: 'text-emerald-400' },
                    { label: 'Web Search', icon: Globe, color: 'text-blue-400' },
                    { label: 'Image Gen', icon: ImageIcon, color: 'text-orange-400' },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-paper-200">
                      <div className="flex items-center gap-2">
                        <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
                        <span>{t.label}</span>
                      </div>
                      <span className="text-[10px] text-status-success font-semibold">ON</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice assistant trigger */}
            {onOpenVoice && (
              <button
                type="button"
                onClick={onOpenVoice}
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-canvas-elevated hover:bg-canvas-overlay text-cyan-400 hover:text-cyan-300 transition-fast cursor-pointer focus-ring shadow-sm"
                title="Voice Input (Ctrl+Shift+V)"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelOpen((prev) => !prev)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#d9ff5a]/30 bg-[#d9ff5a]/10 hover:bg-[#d9ff5a]/20 text-xs font-semibold text-[#d9ff5a] transition-fast cursor-pointer focus-ring shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#d9ff5a]" />
                <span className="truncate max-w-[120px]">
                  {models.find((m) => m.id === model)?.label || 'Auto (Smart Pick)'}
                </span>
                <ChevronDown className="w-3 h-3 text-[#d9ff5a]" />
              </button>
              {modelOpen && (
                <div className="absolute right-0 bottom-10 w-64 rounded-xl border border-border bg-canvas-elevated p-2 shadow-xl z-50 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-ink-muted px-2 py-1">Inference Engine</div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onModelChange?.(m.id);
                        setModelOpen(false);
                      }}
                      className={`w-full p-2 rounded-lg text-left transition-fast cursor-pointer hover:bg-canvas-overlay ${
                        model === m.id ? 'bg-[#d9ff5a]/10 border border-[#d9ff5a]/30 text-[#d9ff5a]' : ''
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">{m.label}</div>
                      <div className="text-[10px] text-ink-muted">{m.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send / Stop CTA Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#ff4d12] text-white hover:bg-[#ea580c] transition-fast cursor-pointer shadow-md shadow-[#ff4d12]/30 focus-ring"
                title="Stop Generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim() || disabled}
                className="flex items-center justify-center h-8 w-9 rounded-lg bg-gradient-to-tr from-[#d9ff5a] to-[#a3e635] text-black hover:from-[#e2ff54] hover:to-[#bef264] disabled:opacity-40 disabled:cursor-not-allowed transition-fast cursor-pointer shadow-md shadow-[#d9ff5a]/25 focus-ring"
                title="Send Message (Enter)"
              >
                <Send className="w-4 h-4 text-black stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
