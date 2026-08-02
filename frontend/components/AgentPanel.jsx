import { useState, useRef, useEffect } from 'react';
import {
  Bot, Square, ChevronDown,
  FileText, Terminal, FolderOpen, GitMerge, Check,
  AlertCircle, Loader2, Zap, RotateCcw, Lightbulb,
  Code2, Send, Search, History, GitCommit,
  Copy, ClipboardCheck, Play, ChevronUp, Mic, MicOff, Columns, X
} from 'lucide-react';

const BACKEND_URL = 'http://localhost:3000';

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const ToolIcon = ({ action }) => {
  const map = {
    read_file:       <FileText  className="w-3.5 h-3.5 text-blue-400" />,
    write_file:      <Code2     className="w-3.5 h-3.5 text-green-400" />,
    apply_diff:      <GitMerge  className="w-3.5 h-3.5 text-primary" />,
    run_terminal:    <Terminal  className="w-3.5 h-3.5 text-yellow-400" />,
    list_directory:  <FolderOpen className="w-3.5 h-3.5 text-purple-400" />,
    search_codebase: <Search    className="w-3.5 h-3.5 text-cyan-400" />,
    run_tests:       <Zap       className="w-3.5 h-3.5 text-emerald-400" />,
    FINAL_ANSWER:    <Check     className="w-3.5 h-3.5 text-success" />,
  };
  return map[action] || <Zap className="w-3.5 h-3.5 text-primary" />;
};

const ToolLabel = ({ action }) => {
  const map = {
    read_file: 'Read File', write_file: 'Write File',
    apply_diff: 'Apply Diff', run_terminal: 'Run Terminal',
    list_directory: 'List Dir', search_codebase: 'Search Code',
    run_tests: 'Run Tests',
    FINAL_ANSWER: 'Done',
  };
  return map[action] || action;
};

// ── Inline diff renderer ──────────────────────────────────────────────────────
const DiffView = ({ search, replace }) => {
  if (!search && !replace) return null;
  return (
    <div className="rounded-lg overflow-hidden border border-white/[0.07] text-[10px] font-mono mt-1">
      {search && (
        <div className="bg-danger/10 border-b border-danger/20">
          <div className="px-2 py-0.5 text-danger/60 text-[9px] font-bold uppercase">− Removed</div>
          <pre className="px-2 pb-1.5 text-danger/80 whitespace-pre-wrap max-h-28 overflow-auto">{search}</pre>
        </div>
      )}
      {replace && (
        <div className="bg-success/10">
          <div className="px-2 py-0.5 text-success/60 text-[9px] font-bold uppercase">+ Added</div>
          <pre className="px-2 pb-1.5 text-success/80 whitespace-pre-wrap max-h-28 overflow-auto">{replace}</pre>
        </div>
      )}
    </div>
  );
};

// ── Step Card ─────────────────────────────────────────────────────────────────
const StepCard = ({ stepLog, onApplyToEditor }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const success = stepLog.result?.success !== false;
  const isFileChange = ['write_file', 'apply_diff'].includes(stepLog.action);
  const isDiff = stepLog.action === 'apply_diff';
  const isTerminal = stepLog.action === 'run_terminal';

  const copyOutput = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border text-xs mb-2 overflow-hidden transition-all ${
      success ? 'border-white/[0.07] bg-white/[0.02]' : 'border-danger/30 bg-danger/5'
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] transition text-left cursor-pointer"
      >
        <ToolIcon action={stepLog.action} />
        <span className="font-semibold text-text-primary flex-1 truncate">
          {stepLog.step}. <ToolLabel action={stepLog.action} />
          {stepLog.parameters?.path && (
            <span className="text-text-muted font-normal ml-1 truncate">— {stepLog.parameters.path}</span>
          )}
          {stepLog.parameters?.command && (
            <span className="text-yellow-400/80 font-normal ml-1 font-mono truncate">$ {stepLog.parameters.command}</span>
          )}
        </span>
        {!success && <AlertCircle className="w-3 h-3 text-danger shrink-0" />}
        {success && isFileChange && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="File changed" />}
        {expanded ? <ChevronUp className="w-3 h-3 text-text-muted shrink-0" /> : <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/[0.05]">

          {/* Thought */}
          {stepLog.thought && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 mt-2">
              <div className="text-primary/70 text-[9px] font-bold uppercase mb-1 flex items-center gap-1">
                <Lightbulb className="w-2.5 h-2.5" /> Thought
              </div>
              <p className="text-text-secondary leading-relaxed">{stepLog.thought}</p>
            </div>
          )}

          {/* Diff view for apply_diff */}
          {isDiff && stepLog.parameters?.search && (
            <DiffView search={stepLog.parameters.search} replace={stepLog.parameters.replace} />
          )}

          {/* Terminal output */}
          {isTerminal && stepLog.result && (
            <div className={`rounded-lg border p-2 relative ${success ? 'bg-bg-hover border-border' : 'bg-danger/5 border-danger/20'}`}>
              <div className="flex items-center gap-1.5 text-[9px] text-text-muted font-bold uppercase mb-1">
                <Terminal className="w-2.5 h-2.5" />
                Terminal Output
                <button
                  onClick={() => copyOutput((stepLog.result.stdout || '') + (stepLog.result.stderr || ''))}
                  className="ml-auto p-0.5 rounded hover:bg-white/10 transition cursor-pointer"
                >
                  {copied ? <ClipboardCheck className="w-2.5 h-2.5 text-success" /> : <Copy className="w-2.5 h-2.5" />}
                </button>
              </div>
              {stepLog.result.stdout && (
                <pre className="text-[10px] text-success/80 whitespace-pre-wrap max-h-28 overflow-auto">{stepLog.result.stdout}</pre>
              )}
              {stepLog.result.stderr && (
                <pre className="text-[10px] text-danger/80 whitespace-pre-wrap max-h-28 overflow-auto mt-1">{stepLog.result.stderr}</pre>
              )}
              <div className="text-[9px] text-text-muted mt-1">Exit code: {stepLog.result.exit_code ?? '?'}</div>
            </div>
          )}

          {/* Search results */}
          {stepLog.action === 'search_codebase' && stepLog.result?.results?.length > 0 && (
            <div className="bg-bg-hover rounded-lg p-2">
              <div className="text-cyan-400/70 text-[9px] font-bold uppercase mb-1.5">Search Results</div>
              {stepLog.result.results.map((r, i) => (
                <div key={i} className="mb-1.5 text-[10px]">
                  <span className="text-text-muted">{r.file}</span>
                  <span className="text-text-muted/60"> :L{r.startLine}</span>
                </div>
              ))}
            </div>
          )}

          {/* File content preview */}
          {stepLog.action === 'read_file' && stepLog.result?.content && (
            <div className="bg-bg-hover rounded-lg p-2">
              <div className="text-blue-400/70 text-[9px] font-bold uppercase mb-1">File Content (preview)</div>
              <pre className="text-[10px] text-text-secondary whitespace-pre-wrap max-h-32 overflow-auto">
                {stepLog.result.content.substring(0, 600)}
              </pre>
            </div>
          )}

          {/* Result for write_file */}
          {stepLog.action === 'write_file' && stepLog.result?.newContent && (
            <div className="bg-bg-hover rounded-lg p-2">
              <div className="text-green-400/70 text-[9px] font-bold uppercase mb-1">New File Content</div>
              <pre className="text-[10px] text-text-secondary whitespace-pre-wrap max-h-32 overflow-auto">
                {stepLog.result.newContent.substring(0, 600)}
              </pre>
            </div>
          )}

          {/* Apply to Editor & Split Diff Preview buttons */}
          {isFileChange && stepLog.result?.success && stepLog.result?.newContent && (
            <div className="flex gap-1.5 mt-2">
              {onApplyToEditor && (
                <button
                  onClick={() => onApplyToEditor({
                    file: stepLog.parameters?.path,
                    content: stepLog.result.newContent
                  })}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition cursor-pointer font-semibold"
                >
                  <Play className="w-3 h-3" /> Apply to Editor
                </button>
              )}
              {onOpenSplitDiff && stepLog.parameters?.search && (
                <button
                  onClick={() => onOpenSplitDiff({
                    file: stepLog.parameters?.path,
                    oldCode: stepLog.parameters.search,
                    newCode: stepLog.parameters.replace
                  })}
                  className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded-lg bg-bg-hover border border-border text-text-secondary hover:text-text-primary transition cursor-pointer"
                  title="Side-by-side split diff preview"
                >
                  <Columns className="w-3 h-3 text-cyan-400" /> Split Diff
                </button>
              )}
            </div>
          )}

          {/* Generic error */}
          {!success && stepLog.result?.error && (
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-2 text-[10px] text-danger/80">
              ✗ {stepLog.result.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Side-by-Side Split Diff Modal ─────────────────────────────────────────────
const SplitDiffModal = ({ data, onClose, onApply }) => {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-bg-default border border-white/[0.1] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-bg-card">
          <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-text-primary">Side-by-Side Diff Preview</h3>
            <span className="text-xs text-text-muted font-mono">({data.file})</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Diff Columns */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-y-auto p-4 font-mono text-xs gap-2">
          {/* Before */}
          <div className="bg-danger/5 border border-danger/20 rounded-xl p-3">
            <div className="text-[10px] font-bold text-danger uppercase mb-2">Original (Before)</div>
            <pre className="text-danger/90 whitespace-pre-wrap leading-relaxed overflow-x-auto">{data.oldCode}</pre>
          </div>
          {/* After */}
          <div className="bg-success/5 border border-success/20 rounded-xl p-3">
            <div className="text-[10px] font-bold text-success uppercase mb-2">Proposed (After)</div>
            <pre className="text-success/90 whitespace-pre-wrap leading-relaxed overflow-x-auto">{data.newCode}</pre>
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-bg-card flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-bg-hover text-text-muted hover:text-text-primary text-xs font-semibold transition cursor-pointer">
            Cancel
          </button>
          {onApply && (
            <button
              onClick={() => { onApply(); onClose(); }}
              className="px-4 py-2 rounded-xl bg-primary text-bg-default text-xs font-bold hover:bg-primary/80 transition cursor-pointer shadow-[0_0_12px_var(--color-primary-glow)]"
            >
              Apply Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main AgentPanel ───────────────────────────────────────────────────────────
const AgentPanel = ({ projectFiles = [], projectPath = '', projectId = '', onApplyToEditor }) => {
  const [activeTab, setActiveTab] = useState('agent');
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [liveMessage, setLiveMessage] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isSelfHealing, setIsSelfHealing] = useState(false);
  const [history, setHistory] = useState([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [splitDiffData, setSplitDiffData] = useState(null);
  const recognitionRef = useRef(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Voice Input (Web Speech API)
  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition browser me supported nahi hai. Kripya Chrome ya Edge use karein.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setPrompt(prev => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const QUICK_PROMPTS = [
    { emoji: '🐛', label: 'Fix all bugs', prompt: 'Find and fix all bugs in the project files' },
    { emoji: '📝', label: 'Add docstrings', prompt: 'Add docstrings and comments to all functions' },
    { emoji: '🧪', label: 'Write unit tests', prompt: 'Write comprehensive unit tests for main.py' },
    { emoji: '🔧', label: 'Refactor code', prompt: 'Refactor code to be cleaner and more maintainable' },
    { emoji: '📊', label: 'Add logging', prompt: 'Add structured logging throughout the project' },
    { emoji: '⚡', label: 'Optimize', prompt: 'Optimize the code for better performance' },
  ];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps, liveMessage, isSelfHealing]);

  const stopAgent = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsRunning(false);
    setIsSelfHealing(false);
    setLiveMessage('⛔ Agent stopped by user.');
  };

  const runAgent = async (customPrompt) => {
    const userPrompt = (customPrompt || prompt).trim();
    if (!userPrompt || isRunning) return;
    setIsRunning(true);
    setSteps([]);
    setFinalAnswer('');
    setHasError(false);
    setIsSelfHealing(false);
    setLiveMessage('🚀 Starting Agent...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt,
          projectFiles: projectFiles.slice(0, 10).map(f => ({
            path: f.path,
            content: (f.content || '').substring(0, 2000)
          })),
          projectPath,
          projectId,
        }),
        signal: controller.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { handleSSE(JSON.parse(line.slice(6))); } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setLiveMessage(`❌ Network error: ${err.message}`);
        setHasError(true);
      }
    } finally {
      setIsRunning(false);
      setIsSelfHealing(false);
    }
  };

  const handleSSE = (data) => {
    switch (data.type) {
      case 'start':
        setLiveMessage(data.message);
        break;
      case 'thinking':
        setLiveMessage(data.message);
        setIsSelfHealing(false);
        break;
      case 'tool_call':
        setLiveMessage(`⚡ Calling ${data.action}...`);
        break;
      case 'self_heal':
        setIsSelfHealing(true);
        setLiveMessage(data.message);
        break;
      case 'step':
        setSteps(prev => {
          const exists = prev.find(s => s.step === data.stepLog.step);
          if (exists) return prev.map(s => s.step === data.stepLog.step ? data.stepLog : s);
          return [...prev, data.stepLog];
        });
        setIsSelfHealing(false);
        break;
      case 'done':
        setFinalAnswer(data.message || '✅ Done!');
        setLiveMessage('');
        setHistory(prev => [{
          id: Date.now(),
          prompt: prompt || 'Quick task',
          answer: data.message,
          steps: data.steps?.length || steps.length,
          time: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 14)]);
        break;
      case 'error':
        setLiveMessage(data.message);
        setHasError(true);
        break;
    }
  };

  const reset = () => {
    setSteps([]); setFinalAnswer(''); setLiveMessage('');
    setHasError(false); setIsSelfHealing(false); setPrompt('');
  };

  const gitCheckpoint = async () => {
    setIsCommitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg || `Agent checkpoint — ${new Date().toLocaleString()}` })
      });
      const data = await res.json();
      setCommitMsg('');
      alert(data.success ? `✅ Git commit done:\n${data.message}` : `⚠️ ${data.message}`);
    } catch (e) {
      alert('Git commit failed: ' + e.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const changedFiles = steps.filter(s => ['write_file', 'apply_diff'].includes(s.action) && s.result?.success);
  const isIdle = !isRunning && steps.length === 0 && !finalAnswer;

  return (
    <div className="flex flex-col h-full bg-bg-default/40 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-[0_0_16px_var(--color-primary-glow)]">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold gradient-text">AI-Dost Agent</h2>
            <p className="text-[10px] text-text-muted">ReAct · RAG · Self-Healing</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1 text-[10px] font-semibold">
                <span className={`w-2 h-2 rounded-full ${isSelfHealing ? 'bg-yellow-400 animate-ping' : 'bg-primary animate-ping'}`} />
                <span className={isSelfHealing ? 'text-yellow-400' : 'text-primary'}>
                  {isSelfHealing ? 'HEALING' : 'RUNNING'}
                </span>
              </div>
            )}
            {!isRunning && (steps.length > 0 || finalAnswer) && (
              <button onClick={reset} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition cursor-pointer" title="Reset">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inner tabs */}
        <div className="flex gap-1 mt-2.5 bg-bg-hover/50 rounded-xl p-1">
          {[
            { id: 'agent', icon: <Bot className="w-3 h-3" />, label: 'Agent' },
            { id: 'history', icon: <History className="w-3 h-3" />, label: `History${history.length ? ` (${history.length})` : ''}` },
            { id: 'git', icon: <GitCommit className="w-3 h-3" />, label: 'Git' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                activeTab === tab.id ? 'bg-primary text-bg-default' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Agent Tab ── */}
      {activeTab === 'agent' && (
        <>
          {/* Quick Prompts (idle only) */}
          {isIdle && (
            <div className="px-4 pt-3 shrink-0">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-2">Quick Tasks</p>
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    onClick={() => { setPrompt(qp.prompt); runAgent(qp.prompt); }}
                    className="text-left text-[10px] px-2.5 py-1.5 rounded-lg bg-bg-hover border border-border hover:border-primary/40 hover:bg-primary/5 text-text-secondary hover:text-text-primary transition cursor-pointer leading-snug"
                  >
                    {qp.emoji} {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Steps / output */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {/* Live message banner */}
            {liveMessage && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-3 ${
                hasError ? 'bg-danger/10 border border-danger/30 text-danger'
                : isSelfHealing ? 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-400'
                : 'bg-primary/10 border border-primary/20 text-primary'
              }`}>
                {isRunning && !hasError
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  : hasError ? <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  : <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className="leading-snug">{liveMessage}</span>
              </div>
            )}

            {/* Step cards */}
            {steps.map((stepLog, i) => (
              <StepCard
                key={`${stepLog.step}-${i}`}
                stepLog={stepLog}
                onApplyToEditor={onApplyToEditor}
                onOpenSplitDiff={(diffData) => setSplitDiffData(diffData)}
              />
            ))}

            {/* Final answer */}
            {finalAnswer && (
              <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 mt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-success mb-1.5">
                  <Check className="w-4 h-4" /> Task Completed
                  {changedFiles.length > 0 && (
                    <span className="ml-auto text-[10px] text-text-muted font-normal">
                      {changedFiles.length} file{changedFiles.length > 1 ? 's' : ''} changed
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{finalAnswer}</p>

                {/* Changed files summary */}
                {changedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {changedFiles.map((s, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        📄 {s.parameters?.path}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isRunning) { e.preventDefault(); runAgent(); } }}
                placeholder={isListening ? "Listening... Speak your task now" : "Task for the Agent... (e.g. 'Add input validation and run tests')"}
                disabled={isRunning}
                rows={2}
                className={`flex-1 bg-bg-hover border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none transition disabled:opacity-50 ${
                  isListening ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'border-border focus:border-primary/50'
                }`}
              />

              {/* Voice Input Button */}
              <button
                onClick={toggleVoiceInput}
                disabled={isRunning}
                className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-red-500 text-white border-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : 'bg-bg-hover border-border text-text-muted hover:text-primary hover:border-primary/40'
                }`}
                title={isListening ? 'Stop listening' : 'Voice command (Click & speak)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {isRunning ? (
                <button onClick={stopAgent} className="p-2 rounded-xl bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition cursor-pointer shrink-0">
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => runAgent()}
                  disabled={!prompt.trim()}
                  className="p-2 rounded-xl bg-primary text-bg-default hover:bg-primary/80 transition cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_var(--color-primary-glow)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-1 pl-1">
              Enter ↵ to run · 🎙️ Click Mic to speak · 📊 Side-by-side split diff enabled
            </p>
          </div>
        </>
      )}

      {/* Render Side-by-Side Split Diff Modal */}
      {splitDiffData && (
        <SplitDiffModal
          data={splitDiffData}
          onClose={() => setSplitDiffData(null)}
          onApply={onApplyToEditor ? () => onApplyToEditor({ file: splitDiffData.file, content: splitDiffData.newCode }) : null}
        />
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {history.length === 0 ? (
            <div className="text-center text-text-muted text-xs py-10">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No Agent runs yet.</p>
              <p className="text-[10px] mt-1">Run a task and it will appear here.</p>
            </div>
          ) : (
            history.map(h => (
              <div key={h.id} className="mb-3 p-3 rounded-xl bg-bg-hover/50 border border-border hover:border-primary/20 transition group">
                <div className="flex items-start gap-2">
                  <Bot className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary font-medium truncate">{h.prompt}</p>
                    <p className="text-[10px] text-text-muted mt-0.5 leading-snug line-clamp-2">{h.answer}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-text-muted">{h.time}</span>
                      <span className="text-[9px] text-primary">{h.steps} steps</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPrompt(h.prompt); setActiveTab('agent'); }}
                    className="opacity-0 group-hover:opacity-100 text-[9px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer shrink-0"
                  >
                    Re-run
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Git Tab ── */}
      {activeTab === 'git' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-2 shadow-lg">
              <GitCommit className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Git Checkpoint</h3>
            <p className="text-[10px] text-text-muted mt-1">Save your Agent's work as a git commit</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-text-muted font-bold uppercase block mb-1.5">Commit Message</label>
              <input
                type="text"
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder={`Agent checkpoint — ${new Date().toLocaleDateString()}`}
                className="w-full bg-bg-hover border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 transition"
              />
            </div>

            <button
              onClick={gitCheckpoint}
              disabled={isCommitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold hover:opacity-90 transition cursor-pointer disabled:opacity-50 shadow-lg"
            >
              {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
              {isCommitting ? 'Committing...' : 'Create Git Commit'}
            </button>

            {/* Recent changed files */}
            {changedFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] text-text-muted font-bold uppercase mb-2">Files Changed This Session</p>
                {changedFiles.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-[9px] font-bold text-green-400">M</span>
                    <span className="text-[10px] text-text-secondary font-mono">{s.parameters?.path}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-bg-hover/50 rounded-xl p-3 border border-border">
              <p className="text-[10px] text-text-muted leading-relaxed">
                💡 This runs <code className="bg-white/10 px-1 rounded">git add -A && git commit</code> in your project root. Make sure your project is a git repository.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPanel;
