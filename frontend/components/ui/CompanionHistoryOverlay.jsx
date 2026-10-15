import { History, X, Trash2 } from 'lucide-react';

export function CompanionHistoryOverlay({
  showHistory, setShowHistory, mode, handleClearCurrentHistory, messages, setMessages, showToast
}) {
  if (!showHistory) return null;
  return (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col p-5 overflow-hidden select-text text-text-primary">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <History className="w-4 h-4" /> 
              <span>{mode === 'chat' ? 'General Chat History' : 'Project Workspace Chat History'}</span>
            </div>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="flex justify-between items-center bg-bg-card p-3 rounded-lg border border-border text-xs">
              <span className="text-text-muted">Current Mode: <strong className="text-primary capitalize">{mode} Mode</strong></span>
              <button
                onClick={handleClearCurrentHistory}
                className="flex items-center gap-1 px-2.5 py-1 bg-warning/10 border border-warning/30 text-warning hover:bg-warning hover:text-bg-default rounded text-[10px] font-medium transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Messages ({messages.length})</h4>
              {messages.map((m, idx) => (
                <div key={idx} className="p-3 bg-bg-card border border-border rounded-lg text-xs space-y-1 group relative">
                  <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
                    <span className="capitalize">{m.sender === 'ai' ? 'Ai-Dost' : 'You'}</span>
                    <div className="flex items-center gap-2">
                      <span>{m.timestamp || ''}</span>
                      <button
                        onClick={() => {
                          setMessages(prev => prev.filter((_, i) => i !== idx));
                          showToast({ type: 'info', message: 'Message removed from history' });
                        }}
                        className="text-text-muted hover:text-warning transition p-0.5 cursor-pointer"
                        title="Delete this message"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-text-primary font-mono text-[11px] truncate leading-relaxed">
                    {m.text ? m.text.substring(0, 120) + (m.text.length > 120 ? '...' : '') : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
  );
}