import React, { useState, useEffect } from 'react';
import { Brain, X, ThumbsUp, ThumbsDown, Eye, Sparkles, CheckCircle2, MessageSquare, Send, Database, ShieldAlert, Cpu } from 'lucide-react';
import api from '../services/api';

export default function PersonalBrainModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('inspector'); // 'inspector' | 'chat'
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Hidden Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: '🔓 Welcome to your Secret Personal Brain Console! Main aapka autonomous self-learning personal AI model hoon. Aap mujhe pooch sakte hain ki maine aapke workspace aur feedbacks se kya-kya sikha hai!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBrainStats();
    }
  }, [isOpen]);

  const fetchBrainStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/learning/stats');
      if (res.data?.success) {
        setStats(res.data);
      }
    } catch (e) {
      console.warn("Failed to fetch personal brain stats:", e.message);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await api.post('/learning/chat', {
        prompt: userMsg,
        history: chatMessages.slice(-6).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      });

      if (res.data?.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Personal Brain response error.' }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error communicating with Personal Model: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-4xl bg-bg-card border border-primary/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col max-h-[85vh] h-auto my-auto overflow-hidden relative noise-overlay">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--color-bg-glass)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-[0_0_15px_var(--color-primary-glow)] animate-pulse">
              <div className="w-full h-full bg-bg-default rounded-[10px] flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-text-primary tracking-tight gradient-text">Personal AI-Dost Brain</h2>
                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                  Secret Inspector Mode
                </span>
              </div>
              <p className="text-xs text-text-muted">Autonomous self-learning agent with vision scanning & feedback integration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-border px-6 bg-bg-default shrink-0">
          <button
            onClick={() => setActiveTab('inspector')}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'inspector' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Cpu className="w-4 h-4" /> Learning Matrix & Stats
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'chat' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Hidden Personal Chat
          </button>
        </div>

        {/* Tab 1: Learning Inspector Stats */}
        {activeTab === 'inspector' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Real-time Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-4 rounded-xl border border-primary/20">
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Total Feedbacks</span>
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-black text-text-primary">{stats?.totalFeedback || 0}</div>
                <div className="text-[10px] text-primary mt-1 font-semibold">Self-learning cycles</div>
              </div>

              <div className="glass-card p-4 rounded-xl border border-success/20">
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Thumbs Up 👍</span>
                  <ThumbsUp className="w-4 h-4 text-success" />
                </div>
                <div className="text-2xl font-black text-success">{stats?.positiveCount || 0}</div>
                <div className="text-[10px] text-success/80 mt-1">Confirmed correct behaviors</div>
              </div>

              <div className="glass-card p-4 rounded-xl border border-warning/20">
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Corrections 👎</span>
                  <ThumbsDown className="w-4 h-4 text-warning" />
                </div>
                <div className="text-2xl font-black text-warning">{stats?.negativeCount || 0}</div>
                <div className="text-[10px] text-warning/80 mt-1">Auto-corrected mistakes</div>
              </div>

              <div className="glass-card p-4 rounded-xl border border-accent/20">
                <div className="flex items-center justify-between text-text-muted mb-2">
                  <span className="text-xs font-medium">Aakh / Vision</span>
                  <Eye className="w-4 h-4 text-accent" />
                </div>
                <div className="text-2xl font-black text-accent">{stats?.scannedFilesCount || 5}</div>
                <div className="text-[10px] text-accent mt-1">Active files scanned</div>
              </div>
            </div>

            {/* Accumulated Learned Rules */}
            <div className="glass-card p-5 rounded-2xl border border-border">
              <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Accumulated Self-Correction Rules
              </h3>
              <div className="space-y-2">
                {(stats?.learnedRules || []).map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-bg-default border border-border-subtle text-xs text-text-secondary">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scanned Project Files ("Aakh / Vision") */}
            <div className="glass-card p-5 rounded-2xl border border-border">
              <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-accent" /> Active Workspace Files Scanned by Vision Engine
              </h3>
              <div className="flex flex-wrap gap-2">
                {(stats?.scannedFiles || []).map((file, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-mono font-medium">
                    📄 {file}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hidden Personal Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-bg-default">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                  }`}>
                    {msg.role === 'user' ? '🧑' : <Brain className="w-4 h-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-2xl whitespace-pre-wrap shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-bg-default font-medium rounded-tr-none' 
                      : 'glass-card border border-border text-text-primary rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-secondary animate-spin" />
                  </div>
                  <div className="glass-card p-3 rounded-2xl text-xs text-text-muted animate-pulse">
                    Personal Brain is reading learning memory...
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="p-4 border-t border-border bg-[var(--color-bg-glass)] flex items-center gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Talk to your Personal Learning Model... Ask 'What have you learned?'"
                className="flex-1 h-11 px-4 rounded-xl bg-bg-hover text-text-primary border border-border focus:outline-none focus:ring-1 focus:ring-primary text-xs"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="gradient-btn px-5 h-11 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                Send <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
