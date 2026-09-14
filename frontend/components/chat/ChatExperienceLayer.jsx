'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Moon,
  Paperclip,
  Palette,
  Pause,
  Play,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import api from '../../services/api';

const MAX_FILES = 15;
const MAX_TEXT_CHARS = 30000;
const THEMES = [
  { id: 'ember', name: 'Ember', colors: ['#d45b3f', '#ff8a65', '#7c3aed'], surface: '#120d0b', glow: 'rgba(212,91,63,.18)', bg: '#0b0908', fg: '#f8f3ed', muted: '#b7aaa0' },
  { id: 'aurora', name: 'Aurora', colors: ['#22c55e', '#06b6d4', '#8b5cf6'], surface: '#07100d', glow: 'rgba(34,197,94,.14)', bg: '#050907', fg: '#effff7', muted: '#9ab3a5' },
  { id: 'ocean', name: 'Ocean', colors: ['#38bdf8', '#2563eb', '#7c3aed'], surface: '#07101d', glow: 'rgba(56,189,248,.16)', bg: '#050914', fg: '#eff8ff', muted: '#9ab1c9' },
  { id: 'nebula', name: 'Nebula', colors: ['#8b5cf6', '#ec4899', '#f59e0b'], surface: '#100914', glow: 'rgba(139,92,246,.17)', bg: '#09050c', fg: '#fff3fb', muted: '#b9a4b5' },
  { id: 'mint', name: 'Mint', colors: ['#10b981', '#14b8a6', '#84cc16'], surface: '#07110d', glow: 'rgba(20,184,166,.15)', bg: '#050a08', fg: '#effff9', muted: '#9db5ad' },
  { id: 'sunset', name: 'Sunset', colors: ['#f97316', '#ef4444', '#eab308'], surface: '#120908', glow: 'rgba(249,115,22,.18)', bg: '#0a0605', fg: '#fff6ef', muted: '#b7a69c' },
  { id: 'ice', name: 'Ice', colors: ['#67e8f9', '#60a5fa', '#e0f2fe'], surface: '#071017', glow: 'rgba(103,232,249,.17)', bg: '#050b10', fg: '#f1fbff', muted: '#9db0bc' },
  { id: 'mono', name: 'Mono', colors: ['#f4f4f5', '#a1a1aa', '#52525b'], surface: '#101011', glow: 'rgba(244,244,245,.10)', bg: '#070708', fg: '#fafafa', muted: '#a1a1aa' },
];

const COMMANDS = [
  { key: 'new chat', label: 'New chat', hint: 'Start a fresh conversation', action: 'new-chat' },
  { key: 'delete chat', label: 'Delete current chat', hint: 'Remove this conversation', action: 'delete-chat' },
  { key: 'history', label: 'Open chat history', hint: 'Browse saved conversations', action: 'history' },
  { key: 'projects', label: 'Open projects', hint: 'View project workspace', action: 'projects' },
  { key: 'copilot', label: 'Open Copilot IDE', hint: 'Open code editor', action: 'copilot' },
  { key: 'agent', label: 'Open autonomous agent', hint: 'Open agent workbench', action: 'agent' },
  { key: 'settings', label: 'Open settings', hint: 'Configure AI-Dost', action: 'settings' },
  { key: 'artifacts', label: 'Open artifacts', hint: 'Browse generated files', action: 'artifacts' },
];

function bytesToText(bytes) {
  try {
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return '';
  }
}

async function readFileDescriptor(file) {
  const base = { id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' };
  if (file.type.startsWith('image/')) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { ...base, kind: 'image', previewUrl: dataUrl, base64: dataUrl.split(',')[1] || '' };
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    const base64 = typeof btoa === 'function' ? btoa(binary) : '';
    return { ...base, kind: 'pdf', base64, previewUrl: URL.createObjectURL(file) };
  }
  const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
  return { ...base, kind: 'text', text, previewText: text.slice(0, 1000) };
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.chatTheme = theme.id;
  root.style.setProperty('--chat-accent', theme.colors[0]);
  root.style.setProperty('--chat-accent-2', theme.colors[1]);
  root.style.setProperty('--chat-accent-3', theme.colors[2]);
  root.style.setProperty('--chat-theme-bg', theme.bg);
  root.style.setProperty('--chat-theme-surface', theme.surface);
  root.style.setProperty('--chat-theme-fg', theme.fg);
  root.style.setProperty('--chat-theme-muted', theme.muted);
  root.style.setProperty('--chat-theme-glow', theme.glow);
  root.style.setProperty('--accent-primary', theme.colors[0]);
  root.style.setProperty('--accent-primary-strong', theme.colors[1]);
  root.style.setProperty('--accent-subtle', `${theme.glow}`);
}

function emitCompose(text) {
  if (typeof window === 'undefined') return false;
  const textarea = document.querySelector('textarea[aria-label="Ask AI-Dost anything"]');
  if (!textarea) return false;
  const proto = Object.getPrototypeOf(textarea);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(textarea, text);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  return true;
}

export default function ChatExperienceLayer({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [command, setCommand] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('ember');
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeFile = files.find((file) => file.id === selectedFileId) || null;
  const filteredCommands = useMemo(() => {
    const q = command.trim().toLowerCase();
    return q ? COMMANDS.filter((item) => `${item.key} ${item.label} ${item.hint}`.includes(q)) : COMMANDS;
  }, [command]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('ai_dost_chat_theme_premium') : null;
    const themeId = stored && THEMES.some((theme) => theme.id === stored) ? stored : 'ember';
    const theme = THEMES.find((item) => item.id === themeId) || THEMES[0];
    setSelectedTheme(theme.id);
    applyTheme(theme);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setShowCommands(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => {
      const node = document.querySelector('.thinking-indicator .thinking-copy strong');
      const label = node?.textContent?.trim();
      if (!label) return;
      const mapped = /search/i.test(label) ? 'Searching' : /read|analy/i.test(label) ? 'Reading' : /generat|creat/i.test(label) ? 'Writing' : /verif/i.test(label) ? 'Verifying' : /document/i.test(label) ? 'Preparing file' : 'Thinking';
      setActivity((prev) => {
        if (prev[0]?.label === mapped) return prev;
        return [{ id: Date.now(), label: mapped, status: 'running', startedAt: Date.now() }, ...prev].slice(0, 8);
      });
    }) : null;
    const root = document.body;
    observer?.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const request = args[0];
      const url = typeof request === 'string' ? request : request?.url || '';
      const isChat = /\/api\/(?:v1\/)?(?:chat|image|document|agent)/.test(url);
      if (isChat) {
        const lower = url.toLowerCase();
        const label = /search/.test(lower) ? 'Searching' : /image|document/.test(lower) ? 'Creating' : /stream/.test(lower) ? 'Processing' : /agent/.test(lower) ? 'Executing' : 'Thinking';
        setActivity((prev) => [{ id: Date.now(), label, status: 'running', startedAt: Date.now() }, ...prev].slice(0, 8));
      }
      try {
        const response = await originalFetch(...args);
        if (isChat) {
          setActivity((prev) => prev.map((item, index) => index === 0 ? { ...item, status: response.ok ? 'done' : 'error', completedAt: Date.now() } : item));
        }
        return response;
      } catch (error) {
        if (isChat) setActivity((prev) => prev.map((item, index) => index === 0 ? { ...item, status: 'error', completedAt: Date.now() } : item));
        throw error;
      }
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const chooseTheme = useCallback((theme) => {
    setSelectedTheme(theme.id);
    applyTheme(theme);
    try { window.localStorage.setItem('ai_dost_chat_theme_premium', theme.id); } catch (_) {}
  }, []);

  const onFilesSelected = useCallback(async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const remaining = Math.max(0, MAX_FILES - files.length);
    if (selected.length > remaining) {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'warning', message: `Maximum ${MAX_FILES} files per batch.` } }));
    }
    const next = [];
    for (const file of selected.slice(0, remaining)) {
      try { next.push(await readFileDescriptor(file)); } catch (_) {}
    }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
    if (!selectedFileId && next[0]) { setSelectedFileId(next[0].id); setSplitOpen(true); }
    event.target.value = '';
  }, [files.length, selectedFileId]);

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    if (selectedFileId === id) setSelectedFileId(null);
  };

  const analyzeBatch = useCallback(async () => {
    if (!files.length || batchRunning) return;
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchResults([]);
    const results = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setActivity((prev) => [{ id: Date.now(), label: `Reading ${file.name}`, status: 'running', startedAt: Date.now() }, ...prev].slice(0, 8));
      try {
        const payload = { message: `Analyze this attached file: ${file.name}`, filename: file.name };
        if (file.kind === 'image') { payload.imageBase64 = file.base64; payload.imageMime = file.mime; }
        if (file.kind === 'pdf') payload.pdfBase64 = file.base64;
        if (file.kind === 'text') payload.text = file.text;
        const response = await api.post('/chat/analyze', payload);
        results.push({ file: file.name, success: true, reply: response.data?.reply || 'Analysis complete.' });
      } catch (error) {
        results.push({ file: file.name, success: false, reply: error?.message || 'Analysis failed.' });
      }
      setBatchProgress(Math.round(((index + 1) / files.length) * 100));
    }
    setBatchResults(results);
    setBatchRunning(false);
    setActivity((prev) => [{ id: Date.now(), label: 'Multi-file analysis complete', status: 'done', startedAt: Date.now(), completedAt: Date.now() }, ...prev].slice(0, 8));
  }, [files, batchRunning]);

  const toggleVoice = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop?.();
      setRecording(false);
      return;
    }
    const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recognition) {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'warning', message: 'Speech recognition is not supported in this browser.' } }));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim();
      if (transcript) emitCompose(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [recording]);

  const runCommand = useCallback((item) => {
    setCommand('');
    setShowCommands(false);
    if (item.action === 'new-chat') {
      window.dispatchEvent(new CustomEvent('ai_dost_new_chat')); 
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'New conversation requested.' } }));
      return;
    }
    if (item.action === 'delete-chat') {
      window.dispatchEvent(new CustomEvent('ai_dost_delete_current_chat'));
      return;
    }
    if (onNavigate) onNavigate(item.action);
  }, [onNavigate]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed right-5 bottom-5 z-[70] h-11 w-11 rounded-full border border-border bg-canvas-surface/95 shadow-lg backdrop-blur flex items-center justify-center text-paper-100 hover:text-accent transition-all"
        aria-label="Open AI-Dost chat control center"
        title="Chat control center"
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[65] pointer-events-none">
          <div className="absolute right-5 bottom-20 pointer-events-auto w-[min(94vw,420px)] max-h-[78vh] overflow-hidden rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-paper-100"><Command className="w-4 h-4 text-accent" /> Chat Control Center</div>
                <div className="text-[10px] text-ink-muted mt-0.5">Universal actions · files · live activity · themes</div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-canvas-elevated" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(78vh-56px)]">
              <div className="rounded-xl border border-border bg-canvas-base/60 p-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-ink-muted" />
                  <input
                    value={command}
                    onChange={(event) => { setCommand(event.target.value); setShowCommands(true); }}
                    onFocus={() => setShowCommands(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setShowCommands(false);
                      if (event.key === 'Enter' && filteredCommands[0]) runCommand(filteredCommands[0]);
                    }}
                    placeholder="Type a command: open projects, new chat…"
                    className="flex-1 bg-transparent outline-none text-xs text-paper-100 placeholder:text-ink-muted"
                    aria-label="Chat command"
                  />
                  <button onClick={toggleVoice} className={`p-1.5 rounded-lg ${recording ? 'bg-accent-subtle text-accent' : 'hover:bg-canvas-elevated text-ink-muted'}`} aria-label={recording ? 'Stop voice input' : 'Voice input'}>
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                {showCommands && (
                  <div className="mt-2 space-y-1">
                    {filteredCommands.slice(0, 6).map((item) => (
                      <button key={item.key} onClick={() => runCommand(item)} className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-canvas-elevated">
                        <span><span className="block text-[11px] text-paper-100">{item.label}</span><span className="block text-[9px] text-ink-muted">{item.hint}</span></span>
                        <ChevronRight className="w-3 h-3 text-ink-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <section className="rounded-xl border border-border bg-canvas-base/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Activity className="w-3.5 h-3.5 text-accent" /> Live work</div>
                  <span className="text-[9px] text-ink-muted">{activity.length ? `${activity.length} events` : 'Waiting'}</span>
                </div>
                {activity.length === 0 ? <div className="text-[10px] text-ink-muted">Thinking, reading, searching, writing, executing aur verifying states yahan live dikhenge.</div> : (
                  <div className="space-y-1.5">
                    {activity.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-[10px]">
                        {item.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : item.status === 'done' ? <Check className="w-3.5 h-3.5 text-signal-success" /> : <Zap className="w-3.5 h-3.5 text-signal-error" />}
                        <span className="flex-1 text-paper-200 truncate">{item.label}</span>
                        <span className="text-ink-muted">{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-canvas-base/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Paperclip className="w-3.5 h-3.5 text-accent" /> Multi-file context</div>
                  <span className="text-[9px] text-ink-muted">{files.length}/{MAX_FILES}</span>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.c,.cpp,.go,.rs,.xlsx,.docx,.pptx" className="hidden" onChange={onFilesSelected} />
                <div className="flex gap-2 mb-2">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-canvas-surface text-[10px] text-paper-200 hover:bg-canvas-elevated"><Upload className="w-3.5 h-3.5" /> Add up to 15 files</button>
                  <button disabled={!files.length || batchRunning} onClick={analyzeBatch} className="px-3 py-2 rounded-lg bg-accent text-black text-[10px] font-semibold disabled:opacity-40"><Loader2 className={`w-3.5 h-3.5 inline mr-1 ${batchRunning ? 'animate-spin' : 'hidden'}`} /> {batchRunning ? `${batchProgress}%` : 'Analyze'}</button>
                </div>
                {files.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {files.map((file) => (
                      <button key={file.id} onClick={() => { setSelectedFileId(file.id); setSplitOpen(true); }} className={`text-left rounded-lg border px-2 py-2 ${selectedFileId === file.id ? 'border-accent/50 bg-accent-subtle' : 'border-border bg-canvas-surface'}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {file.kind === 'image' ? <ImageIcon className="w-3.5 h-3.5 shrink-0 text-accent" /> : <FileText className="w-3.5 h-3.5 shrink-0 text-ink-muted" />}
                          <span className="truncate text-[10px] text-paper-200">{file.name}</span>
                          <span onClick={(event) => { event.stopPropagation(); removeFile(file.id); }} className="ml-auto text-ink-muted hover:text-paper-100 cursor-pointer"><X className="w-3 h-3" /></span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {batchResults.length > 0 && <div className="mt-2 rounded-lg border border-border p-2 space-y-1.5"><div className="text-[9px] uppercase tracking-wider text-ink-muted">Batch results</div>{batchResults.map((result) => <div key={result.file} className="text-[10px] text-paper-200"><strong>{result.file}</strong>: {result.success ? 'done' : 'failed'}</div>)}</div>}
              </section>

              <section className="rounded-xl border border-border bg-canvas-base/50 p-3">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-xs font-semibold text-paper-100"><Palette className="w-3.5 h-3.5 text-accent" /> Premium themes</div><span className="text-[9px] text-ink-muted">Project-wide</span></div>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((theme) => (
                    <button key={theme.id} onClick={() => chooseTheme(theme)} className={`rounded-xl border p-2 transition-all ${selectedTheme === theme.id ? 'border-accent/70 ring-1 ring-accent/30' : 'border-border hover:border-accent/30'}`} title={theme.name}>
                      <span className="flex items-center justify-center gap-0.5 mb-1">
                        {theme.colors.map((color) => <span key={color} style={{ background: color }} className="w-3.5 h-3.5 rounded-full border border-white/20" />)}
                      </span>
                      <span className="block text-[9px] text-paper-200">{theme.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => chooseTheme(THEMES.find((theme) => theme.id === 'mono'))} className="text-[9px] px-2 py-1 rounded-md border border-border text-ink-muted hover:text-paper-100"><Moon className="w-3 h-3 inline mr-1" />Calm</button>
                  <button onClick={() => chooseTheme(THEMES.find((theme) => theme.id === 'ice'))} className="text-[9px] px-2 py-1 rounded-md border border-border text-ink-muted hover:text-paper-100"><Sun className="w-3 h-3 inline mr-1" />Bright</button>
                </div>
              </section>
            </div>
          </div>

          {splitOpen && activeFile && (
            <div className="absolute right-[455px] bottom-20 pointer-events-auto w-[min(42vw,560px)] max-h-[72vh] rounded-2xl border border-border bg-canvas-surface/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle"><div className="flex items-center gap-2 text-xs font-medium text-paper-100"><FileText className="w-3.5 h-3.5 text-accent" />{activeFile.name}</div><button onClick={() => setSplitOpen(false)} className="p-1 rounded-md hover:bg-canvas-elevated"><X className="w-3.5 h-3.5" /></button></div>
              <div className="overflow-auto max-h-[calc(72vh-38px)] bg-black/10">
                {activeFile.kind === 'image' && <img src={activeFile.previewUrl} alt={activeFile.name} className="max-w-full mx-auto block object-contain" />}
                {activeFile.kind === 'pdf' && <iframe src={activeFile.previewUrl} title={activeFile.name} className="w-full h-[65vh] border-0" />}
                {activeFile.kind === 'text' && <pre className="p-4 text-[10px] leading-relaxed whitespace-pre-wrap text-paper-200">{activeFile.text}</pre>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
