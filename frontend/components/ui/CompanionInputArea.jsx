import { X, ImageIcon, Paperclip, Phone, Volume2, VolumeX, Mic, MicOff, Send } from 'lucide-react';

export function CompanionInputArea({
  attachedFile, setAttachedFile, mode, setInput, input, copilotMode, setCopilotMode, speakOutput, setSpeakOutput, isListening, toggleListening, isVoiceCallActive, handleToggleVoiceCall, fileInputRef, handleFileChange, setIsProSearch, isProSearch, handleSend, handlePaste, isTyping
}) {
  return (
      
      <div className="px-3 pb-3 pt-2.5 border-t border-border shrink-0 flex flex-col gap-2">

        {/* Attachment preview */}
        {attachedFile && (
          <div className="flex items-center justify-between px-3 py-2 bg-bg-card border border-border rounded-lg text-xs shrink-0 select-text">
            <div className="flex items-center gap-2 truncate">
              {attachedFile.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" /> : <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />}
              <span className="font-medium text-text-primary truncate">{attachedFile.name}</span>
            </div>
            <button 
              onClick={() => setAttachedFile(null)}
              className="text-text-muted hover:text-warning cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Copilot Quick Action Pills in Project Mode */}
        {mode === 'project' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none no-scrollbar">
            <button
              onClick={() => setInput("Find and fix all syntax or runtime bugs in the active file.")}
              className="px-2 py-0.5 rounded-full bg-white/[0.03] hover:bg-primary/10 border border-white/[0.08] hover:border-primary/30 text-text-secondary hover:text-primary text-[10px] font-medium transition cursor-pointer shrink-0"
            >
              🐞 Fix Bugs
            </button>
            <button
              onClick={() => setInput("Refactor the active file for performance and clean code principles.")}
              className="px-2 py-0.5 rounded-full bg-white/[0.03] hover:bg-secondary/10 border border-white/[0.08] hover:border-secondary/30 text-text-secondary hover:text-secondary text-[10px] font-medium transition cursor-pointer shrink-0"
            >
              ⚡ Refactor
            </button>
            <button
              onClick={() => setInput("Generate complete unit tests for all functions in the current file.")}
              className="px-2 py-0.5 rounded-full bg-white/[0.03] hover:bg-success/10 border border-white/[0.08] hover:border-success/30 text-text-secondary hover:text-success text-[10px] font-medium transition cursor-pointer shrink-0"
            >
              🧪 Unit Tests
            </button>
            <button
              onClick={() => setInput("Add detailed JSDoc / Docstring comments to all functions and classes.")}
              className="px-2 py-0.5 rounded-full bg-white/[0.03] hover:bg-amber-500/10 border border-white/[0.08] hover:border-amber-500/30 text-text-secondary hover:text-amber-400 text-[10px] font-medium transition cursor-pointer shrink-0"
            >
              📝 Add Docs
            </button>
            <button
              onClick={() => setInput("Search semantic vector memory for past design decisions and project context.")}
              className="px-2 py-0.5 rounded-full bg-white/[0.03] hover:bg-cyan-500/10 border border-white/[0.08] hover:border-cyan-500/30 text-text-secondary hover:text-cyan-400 text-[10px] font-medium transition cursor-pointer shrink-0"
            >
              🧠 Vector Memory
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center glass-panel glow-border rounded-xl px-3 py-2 transition-all duration-300 shadow-lg">
          {mode === 'project' ? (
            /* Compact Copilot Mode Select Dropdown */
            <select
              value={copilotMode}
              onChange={(e) => setCopilotMode(e.target.value)}
              className="bg-bg-hover text-primary font-bold border border-border rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
              title="Select Copilot Mode"
            >
              <option value="chat">💬 Chat Mode</option>
              <option value="agent">🤖 Agent Mode</option>
              <option value="plan">✨ Plan Mode</option>
              <option value="autonomous">⚡ Autonomous (MCP)</option>
              <option value="swarm">👥 Teamwork (Swarm)</option>
            </select>
          ) : (
            /* General Chat Voice & Speaker Controls */
            <>
              <button
                onClick={() => setSpeakOutput(!speakOutput)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  speakOutput ? 'text-success' : 'text-text-muted hover:text-text-secondary'
                }`}
                title={speakOutput ? "Mute" : "Read responses aloud"}
              >
                {speakOutput ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleListening}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  isListening ? 'text-warning animate-pulse' : 'text-text-muted hover:text-text-secondary'
                }`}
                title={isListening ? "Listening... click to stop" : "Voice input"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={handleToggleVoiceCall}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  isVoiceCallActive ? 'text-warning animate-pulse' : 'text-text-muted hover:text-text-secondary'
                }`}
                title={isVoiceCallActive ? "End voice call" : "Start voice call"}
              >
                <Phone className="w-4 h-4" />
              </button>
            </>
          )}

          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".txt,.py,.js,.html,.css,.json,.pdf,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary transition-colors cursor-pointer shrink-0"
            title="Attach File or Image"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Pro Search Toggle */}
          <button
            onClick={() => setIsProSearch(!isProSearch)}
            className={`px-2.5 py-1 rounded text-[9px] font-bold border transition-all shrink-0 cursor-pointer ${
              isProSearch 
                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(0,245,255,0.2)]' 
                : 'border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
            }`}
            title="Deep search internet indexes recursively"
          >
            PRO
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onPaste={handlePaste}
            placeholder={isListening ? "Listening..." : mode === 'project' ? `Copilot [${copilotMode.toUpperCase()}] — type or paste image/file...` : "Message Ai-Dost..."}
            className="flex-1 bg-transparent text-text-primary border-none focus:outline-none focus:ring-0 text-sm min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={isTyping}
            className="p-1.5 bg-primary text-bg-default rounded-lg hover:bg-primary-hover transition disabled:opacity-40 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
  );
}
