import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Trash2, Clock, FileText, Zap, Bot, Mic, FileText as FileTextIcon, MessageSquare } from 'lucide-react';

const mockHistory = [
  { id: 1, type: 'chat', title: 'React component architecture discussion', preview: 'How to structure reusable components...', time: '2 hours ago', messages: 12 },
  { id: 2, type: 'agent', title: 'Generated task tracker app', preview: 'Created full-stack with React + Node + SQLite', time: 'Yesterday', messages: 47 },
  { id: 3, type: 'voice', title: 'Voice session - API design', preview: 'Discussed REST vs GraphQL for new project', time: '3 days ago', messages: 8 },
  { id: 4, type: 'resume', title: 'Senior Developer resume', preview: 'Generated with 5 years React/Node experience', time: '5 days ago', messages: 1 },
  { id: 5, type: 'chat', title: 'Python async patterns', preview: 'Explained asyncio, aiohttp, and best practices', time: '1 week ago', messages: 15 },
];

const typeIcons = {
  chat: MessageSquare,
  agent: Bot,
  voice: Mic,
  resume: FileTextIcon,
};

const typeColors = {
  chat: 'text-cyan-400',
  agent: 'text-purple-400',
  voice: 'text-amber-400',
  resume: 'text-green-400',
};

export default function HistoryModal({ isOpen, onClose }) {
  const [historyItems, setHistoryItems] = useState(mockHistory);
  const [filter, setFilter] = useState('all');

  const filteredItems = filter === 'all' 
    ? historyItems 
    : historyItems.filter(item => item.type === filter);

  const deleteItem = (id) => {
    setHistoryItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    if (confirm('Clear all history? This cannot be undone.')) {
      setHistoryItems([]);
    }
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
          aria-labelledby="history-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-2xl h-[80vh] rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(10,11,18,0.97)',
              border: '1px solid rgba(6,182,212,0.15)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.06)',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <History className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 id="history-title" className="font-bold text-white text-lg">History</h2>
                  <p className="text-[11px] text-[#64748b]">{historyItems.length} sessions</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearAll}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                  aria-label="Clear all history"
                  title="Clear all history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                  aria-label="Close history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-white/5 flex gap-2 overflow-x-auto">
              {['all', 'chat', 'agent', 'voice', 'resume'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    filter === f
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-[#64748b] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <History className="w-12 h-12 text-[#334155] mb-4" />
                  <p className="text-[#64748b]">No history found</p>
                  <p className="text-[11px] text-[#475569] mt-1">Your conversation history will appear here</p>
                </div>
              ) : (
                filteredItems.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="group relative rounded-xl p-4 transition-all duration-200 cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[item.type] || ''}`}
                        style={{ background: `${typeColors[item.type]?.replace('text-', 'bg-').replace('400', '100')}`, border: `1px solid ${typeColors[item.type]?.replace('text-', '').replace('400', '200')}` }}>
                        {(() => { const Icon = typeIcons[item.type] || MessageSquare; return <Icon className="w-5 h-5" strokeWidth={2} />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-medium text-white truncate">{item.title}</h3>
                          <button
                            onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-red-400 hover:bg-red-500/10 transition-all"
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-[#94a3b8] truncate mt-1">{item.preview}</p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#475569]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {item.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> {item.messages} messages
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}