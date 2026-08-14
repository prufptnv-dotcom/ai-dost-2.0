import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Trash2, Copy, Maximize2, Minimize2, Square } from 'lucide-react';

export default function TerminalModal({ isOpen, onClose }) {
  const [history, setHistory] = useState(['Welcome to Waaw Terminal']);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const executeCommand = async (cmd) => {
    if (!cmd.trim() || isRunning) return;
    
    setHistory(prev => [...prev, `waaw@dashboard:~$ ${cmd}`]);
    setIsRunning(true);
    setCommand('');

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: `Run command: ${cmd}`, forceLocal: true }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, data.message || data.error || 'Command executed']);
    } catch (err) {
      setHistory(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && command.trim()) {
      executeCommand(command.trim());
    }
  };

  const clearHistory = () => {
    setHistory(['Welcome to Waaw Terminal']);
  };

  const copyHistory = () => {
    navigator.clipboard.writeText(history.join('\n'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(10,11,18,0.97)',
              border: '1px solid rgba(6,182,212,0.15)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.06)',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <Terminal className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 id="terminal-title" className="font-bold text-white text-lg">Terminal</h2>
                  <p className="text-[11px] text-[#64748b]">waaw@dashboard:~$</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearHistory}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                  aria-label="Clear terminal"
                  title="Clear terminal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={copyHistory}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                  aria-label="Copy history"
                  title="Copy history"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                  aria-label="Close terminal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2" ref={containerRef} role="log" aria-live="polite">
              {history.map((item, i) => (
                <div
                  key={i}
                  className={`text-sm font-mono ${item.startsWith('waaw@') ? 'text-cyan-400' : item.startsWith('Error') ? 'text-red-400' : 'text-white'}`}
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-cyan-400 font-mono text-sm">waaw@dashboard:~$</span>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder-[#334155]"
                placeholder="Type a command..."
                disabled={isRunning}
              />
              {isRunning && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-cyan-400 text-sm"
                >
                  Running...
                </motion.span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}