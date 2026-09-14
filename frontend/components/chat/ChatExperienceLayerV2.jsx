import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Check, ChevronRight, Command, FileText, Image as ImageIcon, Loader2, Mic, Palette, Paperclip, Sparkles, Upload, X } from 'lucide-react';
import api from '../../services/api';

const MAX_FILES = 15;
const MAX_TEXT_CHARS = 30000;
const THEMES = [
  { id: 'ember', name: 'Ember', colors: ['#d45b3f', '#ff8a65', '#7c3aed'], bg: '#0b0908', surface: '#120d0b', fg: '#f8f3ed', muted: '#b7aaa0', glow: 'rgba(212,91,63,.18)' },
  { id: 'aurora', name: 'Aurora', colors: ['#22c55e', '#06b6d4', '#8b5cf6'], bg: '#050907', surface: '#07100d', fg: '#effff7', muted: '#9ab3a5', glow: 'rgba(34,197,94,.14)' },
  { id: 'ocean', name: 'Ocean', colors: ['#38bdf8', '#2563eb', '#7c3aed'], bg: '#050914', surface: '#07101d', fg: '#eff8ff', muted: '#9ab1c9', glow: 'rgba(56,189,248,.16)' },
  { id: 'nebula', name: 'Nebula', colors: ['#8b5cf6', '#ec4899', '#f59e0b'], bg: '#09050c', surface: '#100914', fg: '#fff3fb', muted: '#b9a4b5', glow: 'rgba(139,92,246,.17)' },
  { id: 'mint', name: 'Mint', colors: ['#10b981', '#14b8a6', '#84cc16'], bg: '#050a08', surface: '#07110d', fg: '#effff9', muted: '#9db5ad', glow: 'rgba(20,184,166,.15)' },
  { id: 'sunset', name: 'Sunset', colors: ['#f97316', '#ef4444', '#eab308'], bg: '#0a0605', surface: '#120908', fg: '#fff6ef', muted: '#b7a69c', glow: 'rgba(249,115,22,.18)' },
  { id: 'ice', name: 'Ice', colors: ['#67e8f9', '#60a5fa', '#e0f2fe'], bg: '#050b10', surface: '#071017', fg: '#f1fbff', muted: '#9db0bc', glow: 'rgba(103,232,249,.17)' },
  { id: 'mono', name: 'Mono', colors: ['#f4f4f5', '#a1a1aa', '#52525b'], bg: '#070708', surface: '#101011', fg: '#fafafa', muted: '#a1a1aa', glow: 'rgba(244,244,245,.10)' },
];

const COMMANDS = [
  ['new chat', 'New chat', 'new-chat'], ['delete chat', 'Delete current chat', 'delete-chat'],
  ['history', 'Open chat history', 'history'], ['projects', 'Open projects', 'projects'],
  ['copilot', 'Open Copilot IDE', 'copilot'], ['agent', 'Open autonomous agent', 'agent'],
  ['settings', 'Open settings', 'settings'], ['artifacts', 'Open artifacts', 'artifacts'],
];

const setVars = (theme) => {
  if (typeof document === 'undefined') return;
  const targets = [document.documentElement, document.body];
  targets.forEach((target) => {
    target.dataset.chatTheme = theme.id;
    target.style.setProperty('--chat-accent', theme.colors[0]);
    target.style.setProperty('--chat-accent-2', theme.colors[1]);
    target.style.setProperty('--chat-accent-3', theme.colors[2]);
    target.style.setProperty('--chat-theme-bg', theme.bg);
    target.style.setProperty('--chat-theme-surface', theme.surface);
    target.style.setProperty('--chat-theme-fg', theme.fg);
    target.style.setProperty('--chat-theme-muted', theme.muted);
    target.style.setProperty('--chat-theme-glow', theme.glow);
    target.style.setProperty('--accent-primary', theme.colors[0]);
    target.style.setProperty('--accent-primary-strong', theme.colors[1]);
    target.style.setProperty('--accent-subtle', theme.glow);
  });
};

function putTextInComposer(text) {
  const input = document.querySelector('textarea[aria-label="Ask AI-Dost anything"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  return true;
}

async function readFile(file) {
  const base = { id: `${file.name}:${file.size}:${file.lastModified}`, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' };
  if (file.type.startsWith('image/')) {
    const previewUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file); });
    return { ...base, kind: 'image', previewUrl, base64: previewUrl.split(',')[1] || '' };
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return { ...base, kind: 'pdf', previewUrl: URL.createObjectURL(file), base64: typeof btoa === 'function' ? btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer()))) : '' };
  }
  return { ...base, kind: 'text', text: (await file.text()).slice(0, MAX_TEXT_CHARS) };
}

export default function ChatExperienceLayerV2({ onNavigate, onNewChat, onDeleteChat }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [themeId, setThemeId] = useState('ember');
  const [recording, setRecording] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const pickerRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeFile = files.find((file) => file.id === activeId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMANDS.filter(([key, label]) => `${key} ${label}`.includes(q)) : COMMANDS;
  }, [query]);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ai_dost_chat_theme_premium') : null;
    const theme = THEMES.find((item) => item.id === saved) || THEMES[0];
    setThemeId(theme.id); setVars(theme);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const observer = new MutationObserver(() => {
      const label = document.querySelector('.thinking-indicator .thinking-copy strong')?.textContent?.trim() || '';
      if (!label) return;
      const name = /search/i.test(label) ? 'Searching' : /read|analy/i.test(label) ? 'Reading' : /generat|creat/i.test(label) ? 'Writing' : /execut/i.test(label) ? 'Executing' : /verif/i.test(label) ? 'Verifying' : 'Thinking';
      setActivity((prev) => prev[0]?.label === name ? prev : [{ id: Date.now(), label: name, status: 'running' }, ...prev].slice(0, 8));
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); setShowCommands(false); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const chooseTheme = (theme) => {
    setThemeId(theme.id); setVars(theme); try { localStorage.setItem('ai_dost_chat_theme_premium', theme.id); } catch (_) {}
  };

  const chooseCommand = (action) => {
    setShowCommands(false); setQuery('');
    if (action === 'new-chat') { onNewChat?.(); return; }
    if (action === 'delete-chat') { onDeleteChat?.(); return; }
    onNavigate?.(action);
  };

  const onFilesSelected = async (event) => {
    const chosen = Array.from(event.target.files || []).slice(0, MAX_FILES - files.length);
    const next = [];
    for (const file of chosen) { try { next.push(await readFile(file)); } catch (_) {} }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    if (!activeId && next[0]) { setActiveId(next[0].id); setSplitOpen(true); }
    event.target.value = '';
  };

  const removeFile = (id) => { setFiles((prev) => prev.filter((file) => file.id !== id)); if (activeId === id) setActiveId(null); };

  const analyze = useCallback(async () => {
    if (!files.length || batchRunning) return;
    setBatchRunning(true); setBatchProgress(0); setBatchResults([]);
    const results = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setActivity((prev) => [{ id: Date.now(), label: `Reading ${file.name}`, status: 'running' }, ...prev].slice(0, 8));
      try {
        const payload = { message: `Analyze this file: ${file.name}`, filename: file.name };
        if (file.kind === 'image') { payload.imageBase64 = file.base64; payload.imageMime = file.mime; }
        if (file.kind === 'pdf') payload.pdfBase64 = file.base64;
        if (file.kind === 'text') payload.text = file.text;
        const result = await api.post('/chat/analyze', payload);
        results.push({ file: file.name, success: true, reply: result.data?.reply || '' });
      } catch (error) { results.push({ file: file.name, success: false, reply: error?.message || 'Analysis failed' }); }
      setBatchProgress(Math.round(((index + 1) / files.length) * 100));
    }
    setBatchResults(results); setBatchRunning(false);
    setActivity((prev) => [{ id: Date.now(), label: 'Multi-file analysis complete', status: 'done' }, ...prev].slice(0, 8));
  }, [batchRunning, files]);

  const continueInChat = () => {
    const context = batchResults.filter((item) => item.success).map((item) => `### ${item.file}\n${item.reply}`).join('\n\n');
    if (context) putTextInComposer(`Use the following file analysis as context and continue the task:\n\n${context.slice(0, 45000)}`);
    setOpen(false);
  };

  const toggleVoice = () => {
    if (recording) { recognitionRef.current?.stop?.(); setRecording(false); return; }
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition(); recognition.lang = 'hi-IN'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = (event) => { const text = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim(); if (text) putTextInComposer(text); };
    recognition.onend = () => setRecording(false); recognition.onerror = () => setRecording(false); recognitionRef.current = recognition; recognition.start(); setRecording(true);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen((value) => !value)} className="fixed right-5 bottom-5 z-[70] h-11 w-11 rounded-full border border-border bg-canvas-surface/95 shadow-lg backdrop-blur flex items-center justify-center text-paper-100 hover:text-accent" aria-label="Open chat control center" title="Chat control center"><Sparkles className="w-4 h-4" /></button>
      {open && <div className="fixed inset-0 z-[65] pointer-events-none">
        <div className="absolute right-5 bottom-20 pointer-events-auto w-[min(94vw,430px)] max-h-[78vh] overflow-hidden rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle"><div><div className="flex items-center gap-2 text-sm font-semibold text-paper-100"><Command className="w-4 h-4 text-accent" /> Universal Chat</div><div className="text-[10px] text-ink-muted">Commands · live work · files · themes · voice</div></div><button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-canvas-elevated"><X className="w-4 h-4" /></button></div>
          <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(78vh-56px)]">
            <section className="rounded-xl border border-border bg-canvas-base/60 p-2"><div className="flex items-center gap-2"><Command className="w-4 h-4 text-ink-muted" /><input value={query} onChange={(e) => { setQuery(e.target.value); setShowCommands(true); }} onFocus={() => setShowCommands(true)} onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) chooseCommand(filtered[0][2]); }} placeholder="open projects · new chat · delete chat…" aria-label="Universal chat command" className="flex-1 bg-transparent outline-none text-xs text-paper-100 placeholder:text-ink-muted" /><button onClick={toggleVoice} aria-label={recording ? 'Stop voice input' : 'Voice input'} className={`p-1.5 rounded-lg ${recording ? 'bg-accent-subtle text-accent' : 'hover:bg-canvas-elevated text-ink-muted'}`}><Mic className="w-4 h-4" /></button></div>{showCommands && <div className="mt-2 space-y-1">{filtered.slice(0, 6).map(([key, label, action]) => <button key={key} onClick={() => chooseCommand(action)} className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left hover:bg-canvas-elevated"><span><span className="block text-[11px] text-paper-100">{label}</span><span className="block text-[9px] text-ink-muted">{key}</span></span><ChevronRight className="w-3 h-3 text-ink-muted" /></button>)}</div>}</section>

            <section className="rounded-xl border border-border bg-canvas-base/50 p-3"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Activity className="w-3.5 h-3.5 text-accent" /> Live work</div><span className="text-[9px] text-ink-muted">{activity.length ? `${activity.length} events` : 'Waiting'}</span></div>{activity.length ? <div className="space-y-1.5">{activity.slice(0, 6).map((item) => <div key={item.id} className="flex items-center gap-2 text-[10px]">{item.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : <Check className="w-3.5 h-3.5 text-signal-success" />}<span className="flex-1 truncate text-paper-200">{item.label}</span><span className="text-ink-muted">{item.status}</span></div>)}</div> : <div className="text-[10px] text-ink-muted">Thinking, reading, searching, writing, executing and verifying states will appear here.</div>}</section>

            <section className="rounded-xl border border-border bg-canvas-base/50 p-3"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Paperclip className="w-3.5 h-3.5 text-accent" /> Multi-file context</div><span className="text-[9px] text-ink-muted">{files.length}/{MAX_FILES}</span></div><input ref={pickerRef} type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.c,.cpp,.go,.rs,.xlsx,.docx,.pptx" onChange={onFilesSelected} /><div className="flex gap-2"><button onClick={() => pickerRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-canvas-surface text-[10px] text-paper-200 hover:bg-canvas-elevated"><Upload className="w-3.5 h-3.5" /> Add files</button><button disabled={!files.length || batchRunning} onClick={analyze} className="px-3 py-2 rounded-lg bg-accent text-black text-[10px] font-semibold disabled:opacity-40">{batchRunning ? `${batchProgress}%` : 'Analyze'}</button></div>{files.length > 0 && <div className="grid grid-cols-2 gap-1.5 mt-2">{files.map((file) => <button key={file.id} onClick={() => { setActiveId(file.id); setSplitOpen(true); }} className={`rounded-lg border p-2 text-left ${activeId === file.id ? 'border-accent/60 bg-accent-subtle' : 'border-border bg-canvas-surface'}`}><div className="flex items-center gap-1.5 min-w-0">{file.kind === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-accent" /> : <FileText className="w-3.5 h-3.5 text-ink-muted" />}<span className="text-[10px] truncate text-paper-200 flex-1">{file.name}</span><span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); removeFile(file.id); }} className="text-ink-muted hover:text-paper-100"><X className="w-3 h-3" /></span></div></button>)}</div>}{batchResults.length > 0 && <div className="mt-2 space-y-1.5"><div className="text-[9px] uppercase tracking-wider text-ink-muted">Batch analysis</div>{batchResults.map((item) => <div key={item.file} className="text-[10px] text-paper-200"><strong>{item.file}</strong>: {item.success ? 'done' : 'failed'}</div>)}<button onClick={continueInChat} className="mt-1 text-[10px] text-accent hover:underline">Continue in chat with these results →</button></div>}</section>

            <section className="rounded-xl border border-border bg-canvas-base/50 p-3"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Palette className="w-3.5 h-3.5 text-accent" /> Premium themes</div><span className="text-[9px] text-ink-muted">Project-wide</span></div><div className="grid grid-cols-4 gap-2">{THEMES.map((theme) => <button key={theme.id} onClick={() => chooseTheme(theme)} title={theme.name} className={`rounded-xl border p-2 ${themeId === theme.id ? 'border-accent ring-1 ring-accent/20' : 'border-border hover:border-accent/30'}`}><span className="flex justify-center gap-0.5">{theme.colors.map((color) => <span key={color} style={{ background: color }} className="h-4 w-4 rounded-full border border-white/20" />)}</span><span className="block mt-1 text-[9px] text-paper-200">{theme.name}</span></button>)}</div></section>
          </div>
        </div>
        {splitOpen && activeFile && <div className="absolute right-[460px] bottom-20 pointer-events-auto w-[min(42vw,560px)] max-h-[72vh] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl overflow-hidden"><div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle"><div className="flex items-center gap-2 text-xs font-medium text-paper-100"><FileText className="w-3.5 h-3.5 text-accent" />{activeFile.name}</div><button onClick={() => setSplitOpen(false)} aria-label="Close preview"><X className="w-3.5 h-3.5" /></button></div>{activeFile.kind === 'image' && <img src={activeFile.previewUrl} alt={activeFile.name} className="max-w-full max-h-[68vh] mx-auto object-contain" />}{activeFile.kind === 'pdf' && <iframe src={activeFile.previewUrl} title={activeFile.name} className="w-full h-[66vh] border-0" />}{activeFile.kind === 'text' && <pre className="p-4 text-[10px] whitespace-pre-wrap leading-relaxed overflow-auto max-h-[68vh] text-paper-200">{activeFile.text}</pre>}</div>}
      </div>}
    </>
  );
}
