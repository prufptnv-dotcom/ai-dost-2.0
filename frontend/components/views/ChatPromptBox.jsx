import React, { useState, useRef } from 'react';
import { ArrowUp, Paperclip, Terminal, Sparkles, Code2, CornerDownLeft } from 'lucide-react';

export default function ChatPromptBox({ onSubmit, isGenerating, placeholder = 'Ask AI Dost to build, edit files, or debug errors...' }) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        onSubmit(prompt);
        setPrompt('');
      }
    }
  };

  return (
    <div className="p-3 bg-[#0f1117] border-t border-white/[0.08]">
      <div className="relative rounded-xl bg-[#161821] border border-white/[0.10] focus-within:border-sky-500/50 focus-within:ring-2 focus-within:ring-sky-500/10 transition-all shadow-surface-card">
        {/* Input Field */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-transparent px-3.5 pt-3 pb-2 text-sm text-neutral-100 placeholder:text-neutral-500 resize-none outline-none font-sans"
        />

        {/* Footer toolbar inside box */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04] bg-[#0f1117]/50 rounded-b-xl">
          {/* Quick Context / Tool Chips */}
          <div className="flex items-center gap-1.5">
            <button 
              type="button" 
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
            >
              <Paperclip className="w-3 h-3 text-neutral-400" />
              <span>Attach Context</span>
            </button>
            <button 
              type="button" 
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors"
            >
              <Terminal className="w-3 h-3 text-neutral-400" />
              <span>Terminal Output</span>
            </button>
          </div>

          {/* Submit Action */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline-flex items-center gap-0.5">
              <span>Return</span>
              <CornerDownLeft className="w-2.5 h-2.5" />
            </span>
            <button
              onClick={() => {
                if (prompt.trim() && !isGenerating) {
                  onSubmit(prompt);
                  setPrompt('');
                }
              }}
              disabled={!prompt.trim() || isGenerating}
              className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:hover:bg-sky-500 text-white flex items-center justify-center transition-all shadow-glow-sm cursor-pointer"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
