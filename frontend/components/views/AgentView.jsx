import { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, Loader2, Sparkles, CheckCircle2, XCircle, Camera,
  Wrench, FilePlus2, ClipboardList, Play, Trash2, ChevronDown, ChevronRight,
  Users, FolderOpen, FileCheck2
} from 'lucide-react';

const QUICK_PROMPTS = [
  { label: 'Portfolio site banao', prompt: 'Ek modern portfolio website banao with hero, projects section, contact form. Frontend code likho.' },
  { label: 'Todo app fullstack', prompt: 'Fullstack todo app banao with backend API + frontend UI. Sab files likho.' },
  { label: 'Bug fix karo', prompt: 'Mere project files check karo, bugs dhundho aur fix karo. Explanation do.' },
  { label: 'Test likho', prompt: 'Core logic ke liye unit tests likho.' },
];

const PLANS_PLACEHOLDER = [
  '1. Codebase structure samjho',
  '2. Problem identify karo',
  '3. Files likho/edit karo',
  '4. Verify karo (syntax/tests)',
];

export default function AgentView({ onToast }) {
  const BACKEND = (typeof window !== 'undefined' && window.__AI_DOST_BACKEND__) || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  const [tab, setTab] = useState('agent');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [currentPlan, setCurrentPlan] = useState([]);
  const [toolHistory, setToolHistory] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [expandedTools, setExpandedTools] = useState(new Set());
  const [runCount, setRunCount] = useState(0);
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  const showToast = onToast || ((m, t) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, toolHistory, screenshot]);

  const stopRun = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setRunning(false);
    setMessages(prev => [...prev, { role: 'assistant', content: '⏹️ Agent run user ne stop kiya.' }]);
  };

  const runAgent = async (text) => {
    const prompt = (text || input).trim();
    if (!prompt || running) return;
    setInput('');
    setToolHistory([]);
    setScreenshot(null);
    setCurrentPlan([]);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ userPrompt: prompt, projectPath: '', saveToRepo: false, forceLocal: false, takeScreenshot: true }),
      });
      if (!res.ok) throw new Error(`Agent API failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let finalText = '';
      let planSeen = false;
      const newToolHistory = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const evt of chunk.split('\n\n').filter(Boolean)) {
          const dataLine = evt.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(5));
            if (data.type === 'thinking' && data.message) {
              finalText += (data.message || '') + ' ';
            } else if (data.type === 'plan' && data.plan && Array.isArray(data.plan.tasks)) {
              const tasks = data.plan.tasks.map(t => (typeof t === 'string' ? t : (t.title || 'Task'))).filter(Boolean);
              setCurrentPlan(tasks);
              setPlanVisible(true);
              planSeen = true;
            } else if (data.type === 'tool_call') {
              const args = data.parameters !== undefined ? JSON.stringify(data.parameters || {}) : (data.arguments !== undefined ? JSON.stringify(data.arguments || {}) : '');
              newToolHistory.push({ id: Date.now() + Math.random(), tool: data.action || data.tool || 'tool', args, status: 'running', result: null, error: null });
              setToolHistory([...newToolHistory]);
            } else if (data.type === 'step' && data.stepLog) {
              const last = newToolHistory[newToolHistory.length - 1];
              if (last) {
                const r = data.stepLog.result || {};
                last.status = r.success ? 'done' : 'error';
                last.result = (r.message || r.error || '').slice(0, 400);
                last.error = r.success ? null : (r.error || r.message || 'Step failed');
              }
              setToolHistory([...newToolHistory]);
            } else if (data.type === 'tool_result') {
              const last = newToolHistory[newToolHistory.length - 1];
              if (last) {
                last.status = 'done';
                last.result = (data.result || '').slice(0, 400);
              }
              setToolHistory([...newToolHistory]);
            } else if (data.type === 'step' && data.message) {
              finalText += `\n\n${data.message}`;
            } else if (data.type === 'error') {
              const last = newToolHistory[newToolHistory.length - 1];
              if (last) { last.status = 'error'; last.error = data.message; }
              setToolHistory([...newToolHistory]);
              finalText += `\n\n⚠️ ${data.message || 'Error'}`;
            } else if (data.type === 'screenshot') {
              if (data.url) {
                setScreenshot(data.url);
              } else if (data.data) {
                setScreenshot(`data:${data.mimeType || 'image/png'};base64,${data.data}`);
              }
            } else if (data.type === 'done') {
              finalText += `\n\n--- ✅ Done (${data.steps?.length ?? '?'} steps)`;
            }
          } catch (e) { /* partial */ }
        }
      }
      setMessages(prev => [...prev, { role: 'assistant', content: finalText.trim() || 'Agent complete — koi text reply nahi aaya.' }]);
      setRunCount(c => c + 1);
      showToast('Agent run complete', 'success');
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.message || 'Agent error'}` }]);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const toggleTool = (id) => {
    const next = new Set(expandedTools);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTools(next);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center copilot-ghost" style={{ background: 'var(--gradient-primary)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Autonomous Agent</h1>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Plan karta hai → tools chalata hai → code likhta hai → screenshots leta hai</p>
          </div>
          {running && (
            <button
              onClick={stopRun}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              <XCircle className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>
        {/* Mode tabs: single agent vs multi-agent crew */}
        <div className="flex gap-1.5 mt-3 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setTab('agent')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
            style={tab === 'agent'
              ? { background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 2px 10px var(--color-primary-glow)' }
              : { color: 'var(--color-text-muted)' }}
          >
            <Bot className="w-3.5 h-3.5" /> Agent
          </button>
          <button
            onClick={() => setTab('crew')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
            style={tab === 'crew'
              ? { background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 2px 10px var(--color-primary-glow)' }
              : { color: 'var(--color-text-muted)' }}
          >
            <Users className="w-3.5 h-3.5" /> Multi-Agent Crew
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'crew' ? (
          <CrewPanel onToast={showToast} BACKEND={BACKEND} />
        ) : (
        <div ref={scrollRef} className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          {/* Empty state */}
          {messages.length === 0 && !running && (
            <div className="text-center pt-16 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl copilot-ghost flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Agent kya kare? Batao!</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Poore project ki files likh sakta hai, bugs fix karta hai, screenshot leta hai — bilkul autonomous.
                </p>
              </div>
              <div className="inline-flex flex-col items-start gap-1.5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--color-border)' }}>
                {PLANS_PLACEHOLDER.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <ClipboardList className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} /> {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: m.role === 'user' ? 'rgba(161,66,244,0.2)' : 'var(--gradient-primary)' }}
              >
                <Bot className={`w-4 h-4 ${m.role === 'user' ? '' : 'text-white'}`} style={m.role === 'user' ? { color: 'var(--color-secondary)' } : undefined} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: m.role === 'user' ? 'rgba(161,66,244,0.1)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (m.role === 'user' ? 'rgba(161,66,244,0.2)' : 'var(--color-border)'),
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ))}

          {/* Plan card */}
          {planVisible && currentPlan.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(75,139,252,0.06)', border: '1px solid rgba(75,139,252,0.2)' }}>
              <button
                onClick={() => setPlanVisible(!planVisible)}
                className="flex items-center gap-2 text-xs font-bold cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
              >
                {planVisible ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <ClipboardList className="w-3.5 h-3.5" /> Agent ka plan
              </button>
              {planVisible && (
                <ol className="mt-2 space-y-1.5">
                  {currentPlan.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center mt-[1px] flex-shrink-0" style={{ background: 'rgba(75,139,252,0.2)', color: 'var(--color-primary)' }}>
                        {idx + 1}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Tool execution timeline */}
          {toolHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                <Wrench className="w-3.5 h-3.5" /> Tool executions
              </div>
              {toolHistory.map((t) => (
                <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => toggleTool(t.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer"
                  >
                    {t.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />}
                    {t.status === 'error' && <XCircle className="w-3.5 h-3.5 text-[#f87171]" />}
                    {t.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-primary)' }} />}
                    <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{t.tool}</span>
                    <span className="ml-auto text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {t.status === 'done' ? 'done' : t.status === 'error' ? 'failed' : 'running...'}
                    </span>
                  </button>
                  {expandedTools.has(t.id) && (
                    <div className="px-3 pb-2 space-y-1.5">
                      <div className="p-2 rounded-lg font-mono text-[10px] whitespace-pre-wrap break-all" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--color-text-secondary)' }}>
                        {String(t.args || '').slice(0, 600)}
                      </div>
                      {t.result && (
                        <div className="flex items-start gap-1.5 text-[11px]" style={{ color: '#34d399' }}>
                          <FilePlus2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="break-all">{t.result}</span>
                        </div>
                      )}
                      {t.error && (
                        <div className="text-[11px]" style={{ color: '#f87171' }}>⚠️ {t.error}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Screenshot */}
          {screenshot && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Camera className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>Agent ne screenshot liya</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt="Agent screenshot" className="w-full" />
            </div>
          )}
        </div>
        )}

      </div>

      {/* Input — sirf single agent tab ke liye (crew ke andar apna input hai) */}
      {tab === 'agent' && (
      <div className="shrink-0 p-4 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAgent(); } }}
            rows={1}
            placeholder="Agent se kuch bhi bol — project banao, bug fix karo..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none resize-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {runCount > 0 && (
            <button
              onClick={() => { setMessages([]); setToolHistory([]); setScreenshot(null); setCurrentPlan([]); setPlanVisible(false); setRunCount(0); }}
              className="p-2 rounded-lg cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => runAgent()}
            disabled={!input.trim() || running}
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40"
            style={{ background: running ? 'rgba(75,139,252,0.2)' : 'var(--gradient-primary)', color: '#fff' }}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          <span>Enter = run &nbsp;•&nbsp; Agent files read/likhta hai, git commit karta hai, screenshot leta hai</span>
          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> {runCount} runs</span>
        </div>
      </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Agent Crew — CrewAI (Researcher → Coder → Reviewer) real files likhta hai
// ─────────────────────────────────────────────────────────────────────────────
const CREW_MODES = [
  { id: 'dev', label: 'Dev', desc: 'Research → Code → Review (project files)' },
  { id: 'research', label: 'Research', desc: 'Research → Report (.md save)' },
  { id: 'content', label: 'Content', desc: 'Draft → Edit (.md save)' },
];
const CREW_MODELS = [
  { id: 'nvidia', label: 'NVIDIA (free)', desc: 'Llama 3.1 8B — reliable' },
  { id: 'cerebras', label: 'Cerebras (free)', desc: 'Llama 3.1 8B — 1M tok/day' },
  { id: 'ollama', label: 'Ollama (local)', desc: 'qwen2.5-coder:7b — offline' },
  { id: 'gemini', label: 'Gemini (free)', desc: 'gemini-2.5-flash — 5 req/min' },
  { id: 'groq', label: 'Groq (free)', desc: 'llama-3.3-70b — daily limit' },
];

function CrewPanel({ onToast, BACKEND }) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState('dev');
  const [model, setModel] = useState('nvidia');
  const [directory, setDirectory] = useState(() => {
    try {
      return localStorage.getItem('ai_dost_crew_dir') || '';
    } catch { return ''; }
  });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null); // { stage, agent, detail }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [status, result]);

  const runCrew = async () => {
    const p = prompt.trim();
    if (!p || running) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setStatus({ stage: 'starting', detail: 'Crew setup ho raha hai...' });
    try {
      const res = await fetch(`${BACKEND}/api/agent/ai/crew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, mode, model, directory }),
      });
      if (!res.ok) {
        let msg = `Crew API failed (${res.status})`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      setStatus({ stage: 'done', detail: 'Crew complete!' });
      setResult(data);
      if (directory) { try { localStorage.setItem('ai_dost_crew_dir', directory); } catch {} }
      (onToast || (() => {}))('Crew run complete — ' + ((data.files || []).length) + ' files', 'success');
    } catch (e) {
      setError(e?.message || 'Crew error');
      setStatus({ stage: 'error', detail: e?.message });
    } finally {
      setRunning(false);
    }
  };

  const defaultDir = (typeof window !== 'undefined' && window.__AI_DOST_CREW_DIR__) || '';

  return (
    <div className="h-full flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-w-3xl mx-auto px-6 py-6 space-y-5 w-full">
        {/* Intro */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(161,66,244,0.06)', border: '1px solid rgba(161,66,244,0.25)' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>CrewAI Multi-Agent — tumhare project me REAL files likhta hai</span>
          </div>
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {mode === 'dev' && 'Researcher plan banata hai → Coder files likhta hai (save_project_file tool) → Reviewer bugs check karta hai.'}
            {mode === 'research' && 'Researcher facts gather karta hai → Writer report .md file save karta hai.'}
            {mode === 'content' && 'Writer draft banata hai → Editor polish karke .md save karta hai.'}
            {' '}Files tumhare directory (ya Copilot workspace) me save hoti hain.
          </p>
        </div>

        {/* Mode select */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Mode</div>
          <div className="grid grid-cols-3 gap-2">
            {CREW_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className="p-2.5 rounded-xl text-left transition-all cursor-pointer"
                style={mode === m.id
                  ? { background: 'rgba(75,139,252,0.12)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <div className="text-xs font-bold">{m.label}</div>
                <div className="text-[10px] mt-0.5 leading-tight">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model select */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>LLM</div>
          <div className="grid grid-cols-3 gap-2">
            {CREW_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className="p-2.5 rounded-xl text-left transition-all cursor-pointer"
                style={model === m.id
                  ? { background: 'rgba(75,139,252,0.12)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <div className="text-xs font-bold">{m.label}</div>
                <div className="text-[10px] mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Directory */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Project folder (files yahan save hongi)
          </div>
          <div className="flex items-center gap-2 rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
            <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder={defaultDir || 'Khali chhodo → default workspace (ai-dost-workspace)'}
              className="flex-1 bg-transparent text-xs focus:outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>

        {/* Status / progress */}
        {status && status.stage !== 'done' && status.stage !== 'error' && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-primary)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> {status.detail || 'Crew chal raha hai...'}
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              (3 agents sequential — 1-3 min lag sakte hain)
            </span>
          </div>
        )}
        {error && (
          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#34d399' }}>
                <CheckCircle2 className="w-4 h-4" /> Crew complete — {result.agents?.length || 0} agents
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(result.agents || []).map(a => (
                  <span key={a} className="px-2 py-1 rounded-full text-[10px] font-medium" style={{ background: 'rgba(161,66,244,0.15)', border: '1px solid rgba(161,66,244,0.3)', color: 'var(--color-secondary)' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {(result.files || []).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  <FileCheck2 className="w-3.5 h-3.5" /> Files saved ({result.files.length})
                </div>
                <div className="mt-2 space-y-1">
                  {result.files.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs font-mono" style={{ color: '#34d399' }}>
                      <FilePlus2 className="w-3 h-3 flex-shrink-0" /> {f}
                    </div>
                  ))}
                </div>
                {result.directory && (
                  <div className="mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>📁 {result.directory}</div>
                )}
              </div>
            )}

            {result.result && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  <ClipboardList className="w-3.5 h-3.5" /> Final output
                </div>
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed max-h-72 overflow-y-auto" style={{ color: 'var(--color-text-secondary)' }}>
                  {result.result}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runCrew(); } }}
            rows={2}
            placeholder="Crew ko batao kya banana hai — 3 agents project me files likhenge..."
            className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none resize-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={runCrew}
            disabled={!prompt.trim() || running}
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40"
            style={{ background: running ? 'rgba(75,139,252,0.2)' : 'var(--gradient-primary)', color: '#fff' }}
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          Enter = run &nbsp;•&nbsp; Crew project folder me files save karta hai — phir Copilot me preview karo
        </div>
      </div>
    </div>
  );
}