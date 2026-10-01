import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  FolderTree, Search, GitBranch, Puzzle, X, Plus, Save,
  Send, Sparkles, Play, Terminal as TerminalIcon,
  Loader2, Bot, Eraser, Eye, Download, Square, RotateCcw, Settings2,
  FolderPlus, Pencil, Trash2, SaveAll, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, GitCompareArrows, Database,
  Smartphone, Tablet, Monitor, Crosshair,
  Mic, MicOff, LayoutGrid, Zap, Bug, Code2, RefreshCw, ExternalLink, Copy, Check, ArrowRight,
  Code, ShieldCheck, ShoppingCart, BarChart3, Kanban, MessageSquare, Flame,
  BrainCircuit, Workflow, ArrowUp, Paperclip,
  Columns2, Package, KeyRound, History, AlertTriangle, AlertCircle,
  Volume2, AudioWaveform, Wrench, TableProperties, FileDiff
} from 'lucide-react';
import api from '../../services/api';
import { LANG_BY_EXT, TreeView, fileTreeFromFiles } from './CopilotTree';
import { PromptModal, QuickOpen, CommandPalette, SearchOverlay, MODAL_ICONS } from './IDEOverlays';
import DiffReviewModal from './DiffReviewModal';
import ProjectWizardModal from './ProjectWizardModal';
import DeployModal from './DeployModal';
import CopilotPlanCard from '../ide/CopilotPlanCard';
import CopilotStatusBar, { stripEmoji } from '../ide/CopilotStatusBar';
import { diffLines, diffStats } from '../../lib/lineDiff';
import VisualDebugger from './VisualDebugger';
import VisualHealer from '../VisualHealer';
import CopilotHistoryModal from './CopilotHistoryModal';
import VisualDatabaseExplorer from './VisualDatabaseExplorer';
import { FileExplorer, normalizePath } from '../ide/FileExplorer';
import { WorkspaceTabs } from '../ide/WorkspaceTabs';
import { EditorToolbar } from '../ide/EditorToolbar';
import { TerminalDock } from '../ide/TerminalDock';
import { AiInspector } from '../ide/AiInspector';
import { DiffReview } from '../ide/DiffReview';
import { configureMonacoThemes } from '../ide/MonacoTheme';
import { PackagesModal } from '../ide/PackagesModal';
import { SecretsModal } from '../ide/SecretsModal';
import { PreviewPane } from '../ide/PreviewPane';
import { IdeHeader } from '../ide/IdeHeader';
import { IdeFooter } from '../ide/IdeFooter';
import { generateLiveAppHtml, PREVIEW_TELEMETRY_SCRIPT } from '../ide/PreviewEngine';
import { syncFileToWebContainer } from '../../lib/webcontainer';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
  gfm: true,
});

// P2 #104: default to relative '' so agent-run goes through the Next /api
// rewrite — the hardcoded http://localhost:5000 bypassed rewrites and died
// off-machine. Env opt-in still wins.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// Model picker options — preferred provider rotates server-side cascade (fallback always on)
const MODEL_OPTIONS = [
  { v: 'auto', l: 'Auto (cascade)' },
  { v: 'gemini', l: 'Gemini first' },
  { v: 'groq', l: 'Groq first' },
  { v: 'ollama', l: 'Ollama local' },
];
const fmtTs = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const TerminalPanel = dynamic(() => import('./TerminalPanel'), { ssr: false });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Agent tool action → human-readable live status
const STATUS_BY_ACTION = {
  write_file: '✍️ Writing source code...',
  create_file: '✍️ Creating file...',
  apply_diff: '✏️ Applying surgical code edits...',
  read_file: '📖 Reading file context...',
  list_directory: '📂 Scanning workspace files...',
  run_terminal: '💻 Running terminal command...',
  run_terminal_auto: '💻 Executing background command...',
  run_tests: '🧪 Running automated test suite...',
  search_codebase: '🔍 Analyzing codebase graph...',
  generate_project_from_prompt: '🏗️ Generating full-stack project scaffold...',
  git_init: '🔀 Initializing local git repo...',
  git_add: '🔀 Staging files...',
  git_commit: '🔀 Creating commit snapshot...',
  git_branch: '🔀 Managing git branch...',
  git_log: '🔀 Reading git logs...',
  web_search: '🌐 Searching the web for real-time info...',
  fetch_webpage: '🌍 Fetching webpage content...',
  sandbox_create: '🐳 Booting up isolated Docker sandbox...',
  sandbox_exec: '💻 Executing command inside sandbox...',
  sandbox_dev_start: '🚀 Starting sandbox dev server...',
  sandbox_write: '📝 Writing file to sandbox...',
  figma_mcp: '🎨 Fetching Figma designs via MCP...',
  db_query: '🗄️ Querying database...',
};

// File extension → brand color
const LANG_COLOR = {
  js: '#f7df1e', mjs: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  html: '#e34f26', htm: '#e34f26', css: '#563d7c', scss: '#cd6799',
  py: '#3776ab', json: '#fbcb40', md: '#8b949e', txt: '#8b949e',
  java: '#f89820', c: '#a8b9cc', cpp: '#659ad2', go: '#00add8',
  rs: '#dea584', sh: '#89e051', yml: '#cb171e', yaml: '#cb171e',
  xml: '#e34f26', svg: '#ffb13b', sql: '#e38c00', php: '#777bb4',
  rb: '#cc342d', lock: '#fbcb40',
};

function AiStudioResponseCard({ message, onSelectFile, onOpenDiff, onRollback, onOpenPreview }) {
  const modelName = message.model || 'Gemini 2.5 Flash + Groq Cascade';
  const duration = message.duration || '12s';
  const files = Array.isArray(message.files) ? message.files : [];
  const content = message.content || message.summary || '';

  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      const raw = marked.parse(content);
      if (typeof window !== 'undefined' && DOMPurify?.isSupported !== false && typeof DOMPurify?.sanitize === 'function') {
        return DOMPurify.sanitize(raw);
      }
      return String(raw).replace(/<[^>]*>/g, '');
    } catch (_) {
      return String(content).replace(/<[^>]*>/g, '');
    }
  }, [content]);

  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-accent text-white shadow-md">
        <Code2 size={15} />
      </div>

      <div className="flex-1 space-y-3 rounded-2xl p-4 border bg-canvas-surface/95 backdrop-blur-md shadow-xl border-border">
        {/* Header: Model & Duration */}
        <div className="flex items-center justify-between text-xs text-ink-muted pb-2.5 border-b border-border">
          <span className="font-medium flex items-center gap-2 text-paper-100">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {modelName} • {duration}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            Completed
          </span>
        </div>

        {/* Markdown Content */}
        {content && (
          <div
            className="ai-studio-markdown text-xs leading-relaxed text-paper-200 space-y-2.5"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}

        {/* Files Touched Chips */}
        {files.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted font-bold block">
              Files Built ({files.length}):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {files.map((file, idx) => {
                const fileName = typeof file === 'string' ? file : (file.path || file.name || `file-${idx}`);
                const ext = fileName.split('.').pop()?.toLowerCase();
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectFile && onSelectFile(fileName)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono bg-canvas-base hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs hover:border-border-strong"
                    title={`Open ${fileName}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: LANG_COLOR[ext] || '#818cf8' }} />
                    <span className="truncate max-w-[170px]">{fileName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800 text-xs">
          <button
            onClick={onOpenDiff}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium cursor-pointer transition-colors border border-zinc-700"
          >
            <GitCompareArrows size={12} className="text-amber-400" />
            Review Diff
          </button>

          <button
            onClick={onOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold cursor-pointer transition-colors"
          >
            <Play size={11} className="fill-white" />
            Live Preview
          </button>

          {message.checkpointDir && (
            <button
              onClick={() => onRollback && onRollback(message.checkpointDir)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium cursor-pointer transition-colors border border-red-500/30"
            >
              <RotateCcw size={12} className="text-red-400" />
              Restore
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Super-Advance Modern Starter Framework Templates ───────────────────────
const STARTER_TEMPLATES = [
  {
    id: 'react-tailwind',
    title: 'React 19 + Tailwind',
    badge: 'Popular',
    desc: 'Vite SPA with Lucide icons, glassmorphic UI, responsive layouts and animations',
    prompt: 'Create a modern React 19 single-page application with Tailwind CSS and Lucide icons'
  },
  {
    id: 'saas-dashboard',
    title: 'Modern SaaS Analytics',
    badge: 'Dashboard',
    desc: 'Interactive dashboard with metrics cards, analytics graphs, filtering and dark theme',
    prompt: 'Build a high-performance modern SaaS dashboard with analytics charts, stat counters, and dark theme'
  },
  {
    id: 'hospital-booking',
    title: 'Appointment Booking Platform',
    badge: 'Full-Stack',
    desc: 'Doctor selection, slot calendar picker, appointment confirmation modal & history',
    prompt: 'Build a hospital appointment booking system with doctor profiles, slot picker, and appointment history'
  },
  {
    id: 'rest-api',
    title: 'Express + SQLite API',
    badge: 'Backend',
    desc: 'Full CRUD REST API with SQLite database, validation middleware and health routes',
    prompt: 'Build a complete Express.js backend REST API with SQLite database schema and CRUD operations'
  }
];

export default function CopilotIDE({ projectId: defaultProjectId = 'copilot-workspace', projectName: defaultProjectName = 'Copilot Workspace', onToast }) {
  // ── Multi-Session History State ──────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  // Always-fresh mirror of `sessions` so handlers can run side effects
  // OUTSIDE setState updaters (updaters may run twice under StrictMode).
  const sessionsRef = useRef([]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const projectId = activeSessionId || defaultProjectId;

  // Time-Travel Snapshots (Internal Automated Checkpoints)
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotMenuOpen, setSnapshotMenuOpen] = useState(false);

  // Multimodal Pasted / Attached Images for AI Chat
  const [pastedImages, setPastedImages] = useState([]);

  // Runtime error telemetry & Inspector selection
  const [runtimeError, setRuntimeError] = useState(null);
  const [selectedInspectorElement, setSelectedInspectorElement] = useState(null);
  const [healingInProgress, setHealingInProgress] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal'); // 'terminal' | 'database'
  const [autoFixBanner, setAutoFixBanner] = useState(null); // { error, suggestedFix, explanation, confidence }
  const [healCount, setHealCount] = useState(0);

  // Voice Waveform Animation State
  const [voiceWaveform, setVoiceWaveform] = useState([0, 0, 0, 0, 0]);
  const voiceAnimFrameRef = useRef(null);
  const voiceAnalyserRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [contents, setContents] = useState({});
  // Mirror of `contents` for SSE handlers (state closure goes stale mid-run) —
  // used to compute per-file diff stats when file_written events arrive.
  const contentsRef = useRef({});
  useEffect(() => { contentsRef.current = contents; }, [contents]);
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());

  // Workspace Mode: 'code' | 'split' | 'preview'
  const [workspaceMode, setWorkspaceMode] = useState('split');
  const [packagesModalOpen, setPackagesModalOpen] = useState(false);
  const [secretsModalOpen, setSecretsModalOpen] = useState(false);
  const [isReplitRunning, setIsReplitRunning] = useState(false);
  // IDE overlays — Ctrl+P (Quick Open), Ctrl+Shift+P (Command Palette), Ctrl+Shift+F (Find in Files)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCase, setSearchCase] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Left Sidebar & Terminal Collapsible States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');

  // Copilot Agent Chat States
  const [copilotMessages, setCopilotMessagesRaw] = useState([]);
  // Auto-stamp every appended message with push time — audit rows render HH:MM
  const setCopilotMessages = useCallback((action) => {
    setCopilotMessagesRaw(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (Array.isArray(next) && Array.isArray(prev) && next.length > prev.length) {
        const now = Date.now();
        return next.map((m, idx) => (idx >= prev.length && !m.ts ? { ...m, ts: now } : m));
      }
      return next;
    });
  }, []);
  const [copilotInput, setCopilotInput] = useState('');
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [problems, setProblems] = useState(0);
  const [copilotStatus, setCopilotStatus] = useState({ label: '', tone: 'info' });
  // Preferred model (rotates cascade order server-side; fallback always active)
  const [preferredModel, setPreferredModel] = useState('auto');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Visual QA badge: idle → running → passed/failed (from director_verification)
  const [qaStatus, setQaStatus] = useState('idle');
  // Devin-style elapsed timer for the live status strip
  const [elapsedSec, setElapsedSec] = useState(0);
  const runStartRef = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      if (runStartRef.current) setElapsedSec((Date.now() - runStartRef.current) / 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);
  const [planTasks, setPlanTasks] = useState([]);
  const [planGate, setPlanGate] = useState(false); // Default to Autopilot (Replit/Bolt style)
  const [pendingPlan, setPendingPlan] = useState(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('ai_dost_copilot_model');
      if (saved && MODEL_OPTIONS.some(o => o.v === saved)) setPreferredModel(saved);
    } catch (_) { /* storage unavailable */ }
  }, []);

  // Dynamic session project name
  const projectName = useMemo(() => {
    const s = sessions.find(x => x.id === activeSessionId);
    return s?.title || defaultProjectName;
  }, [sessions, activeSessionId, defaultProjectName]);

  useEffect(() => {
    const checkTheme = () => {
      if (typeof window === 'undefined') return;
      let light = document.body.classList.contains('light-theme');
      try { light = light || localStorage.getItem('ai_dost_theme') === 'light'; } catch (_) {}
      setIsLight(light);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  useEffect(() => {
    if (monacoRef.current?.editor) {
      try {
        monacoRef.current.editor.setTheme(isLight ? 'aidost-light' : 'aidost-dark');
      } catch (_) {}
    }
  }, [isLight]);

  // Live preview configuration
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [previewZoom, setPreviewZoom] = useState(100); // Default 100% desktop for crisp full preview
  const [milestonesExpanded, setMilestonesExpanded] = useState(true); // Plan checklist default open (Devin-style)
  const [inspectorActive, setInspectorActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(`/api/preview/${projectId}`);
  const [previewSourceMode, setPreviewSourceMode] = useState('auto'); // 'auto' | 'live' | 'mock'
  const [devServerStatus, setDevServerStatus] = useState({ running: false, state: 'STOPPED', url: null });
  const [devServerLoading, setDevServerLoading] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Modals & Overlays
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialPrompt, setWizardInitialPrompt] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);
  const [latestRunId, setLatestRunId] = useState(null);
  const latestRunIdRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  // Voice Coding State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const voiceAutoSendTimerRef = useRef(null);

  // Ctrl+K Inline AI Edit State
  const [inlineEditOpen, setInlineEditOpen] = useState(false);
  const [inlineEditPrompt, setInlineEditPrompt] = useState('');
  const [inlineEditLoading, setInlineEditLoading] = useState(false);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const terminalRef = useRef(null);
  const iframeRef = useRef(null);
  const abortRef = useRef(null);
  const activePathRef = useRef(null);
  const endRef = useRef(null);
  const diagTimerRef = useRef(null);
  const [visualDebuggerOpen, setVisualDebuggerOpen] = useState(false);

  const showToast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
  }, [onToast]);

  // Handle Ctrl+V clipboard image paste in Copilot chat
  const handlePaste = useCallback((e) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type && item.type.startsWith('image/'));

    if (imageItems.length > 0) {
      e.preventDefault();
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const dataUrl = uploadEvent.target.result;
            setPastedImages(prev => [
              ...prev,
              {
                id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                dataUrl,
                name: file.name && file.name !== 'image.png' ? file.name : `Screenshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
                size: (file.size / 1024).toFixed(1) + ' KB'
              }
            ]);
            showToast('📸 Screenshot pasted & attached to prompt', 'success');
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }, [showToast]);

  const handleImageUpload = useCallback((e) => {
    const selected = Array.from(e.target.files || []);
    selected.forEach(file => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          setPastedImages(prev => [
            ...prev,
            {
              id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              dataUrl: uploadEvent.target.result,
              name: file.name,
              size: (file.size / 1024).toFixed(1) + ' KB'
            }
          ]);
          showToast('📸 Image attached to prompt', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value = '';
  }, [showToast]);

  const loadDevServerStatus = useCallback(async () => {
    try {
      const res = await api.get(`/preview/${projectId}/status`);
      if (res.data?.success) {
        setDevServerStatus(res.data);
      }
    } catch (_) {}
  }, [projectId]);

  useEffect(() => {
    loadDevServerStatus();
    const interval = setInterval(loadDevServerStatus, 5000);
    return () => clearInterval(interval);
  }, [loadDevServerStatus]);

  const handleStartDevServer = useCallback(async () => {
    setDevServerLoading(true);
    try {
      showToast('🚀 Starting Dev Server...', 'info');
      const res = await api.post(`/preview/${projectId}/dev/start`, { projectPath: '.' });
      if (res.data?.success) {
        showToast(`✅ Dev Server Ready on port ${res.data.hostPort || res.data.port || ''}`, 'success');
        setDevServerStatus(prev => ({ ...prev, running: true, state: 'READY', url: res.data.url }));
        if (iframeRef.current) iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
      } else {
        showToast(`❌ Dev Server Start Failed: ${res.data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Dev Server error: ${err.message}`, 'error');
    } finally {
      setDevServerLoading(false);
      loadDevServerStatus();
    }
  }, [projectId, showToast, loadDevServerStatus]);

  const handleStopDevServer = async () => {
    try {
      await api.post(`/preview/${projectId}/dev/stop`);
      showToast('⏹️ Dev Server Stopped', 'info');
      setDevServerStatus(prev => ({ ...prev, running: false, state: 'STOPPED' }));
    } catch (err) {
      showToast(`Stop error: ${err.message}`, 'error');
    }
  };

  const handleRestartDevServer = async () => {
    setDevServerLoading(true);
    try {
      showToast('🔄 Restarting Dev Server...', 'info');
      const res = await api.post(`/preview/${projectId}/dev/restart`);
      if (res.data?.success) {
        showToast('✅ Dev Server Restarted', 'success');
        if (iframeRef.current) iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
      }
    } catch (err) {
      showToast(`Restart error: ${err.message}`, 'error');
    } finally {
      setDevServerLoading(false);
      loadDevServerStatus();
    }
  };

  // ── Advanced Voice-to-Code Engine (Hindi / Hinglish / English) ──────────
  const startVoiceWaveform = useCallback((stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      voiceAnalyserRef.current = { analyser, audioCtx, source };
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 5 }, (_, i) => {
          const idx = Math.floor((i / 5) * dataArray.length);
          return Math.min(100, (dataArray[idx] / 255) * 100);
        });
        setVoiceWaveform(bars);
        voiceAnimFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (_) {}
  }, []);

  const stopVoiceWaveform = useCallback(() => {
    if (voiceAnimFrameRef.current) cancelAnimationFrame(voiceAnimFrameRef.current);
    if (voiceAnalyserRef.current) {
      try {
        voiceAnalyserRef.current.source?.disconnect();
        voiceAnalyserRef.current.audioCtx?.close();
      } catch (_) {}
    }
    voiceAnalyserRef.current = null;
    setVoiceWaveform([0, 0, 0, 0, 0]);
  }, []);

  // Detect language from transcript (Hindi / Hinglish / English)
  const detectVoiceLang = useCallback((text) => {
    const hindiChars = /[\u0900-\u097F]/;
    if (hindiChars.test(text)) return 'hi';
    const hinglishWords = ['karo', 'bana', 'dikhao', 'hatao', 'lagao', 'rakh', 'badal', 'likho', 'kholna', 'karo', 'chahiye', 'raha', 'wala', 'hoga'];
    const words = text.toLowerCase().split(/\s+/);
    const hinglishCount = words.filter(w => hinglishWords.some(hw => w.includes(hw))).length;
    if (hinglishCount >= 2 || hinglishCount / words.length > 0.2) return 'hinglish';
    return 'en';
  }, []);

  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser. Use Chrome/Edge.', 'warning');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      stopVoiceWaveform();
      return;
    }
    try {
      // Get microphone stream for waveform visualization
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        voiceStreamRef.current = stream;
        startVoiceWaveform(stream);

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'hi-IN'; // Primary: Hindi (auto-detects English too)
        recognition.maxAlternatives = 1;

        let finalTranscript = '';

        recognition.onstart = () => {
          setIsListening(true);
          showToast('🎙️ Listening... Speak naturally in Hindi, Hinglish or English!', 'info');
        };

        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += (finalTranscript ? ' ' : '') + t;
            } else {
              interim += t;
            }
          }
          // Show interim text in input
          setCopilotInput(finalTranscript + (interim ? ' ' + interim : ''));

          // Auto-send after 2s of silence
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (finalTranscript.trim()) {
              recognition.stop();
            }
          }, 2000);
        };

        recognition.onerror = (err) => {
          console.warn('[Voice] Error:', err.error);
          setIsListening(false);
          stopVoiceWaveform();
          stream.getTracks().forEach(t => t.stop());
          voiceStreamRef.current = null;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
        };

        recognition.onend = () => {
          setIsListening(false);
          stopVoiceWaveform();
          stream.getTracks().forEach(t => t.stop());
          voiceStreamRef.current = null;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }

          if (finalTranscript.trim()) {
            const lang = detectVoiceLang(finalTranscript);
            const langLabel = lang === 'hi' ? 'Hindi' : lang === 'hinglish' ? 'Hinglish' : 'English';
            showToast(`🎙️ ${langLabel}: "${finalTranscript.trim().slice(0, 60)}..."`, 'success');
            setCopilotInput(finalTranscript.trim());
            // Auto-send the voice prompt
            if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
            voiceAutoSendTimerRef.current = setTimeout(() => {
              voiceAutoSendTimerRef.current = null;
              handleSendRef.current(finalTranscript.trim());
            }, 300);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }).catch(err => {
        showToast(`Microphone access denied: ${err.message}`, 'error');
        setIsListening(false);
      });
    } catch (_) {
      setIsListening(false);
      stopVoiceWaveform();
    }
  }, [isListening, showToast, startVoiceWaveform, stopVoiceWaveform, detectVoiceLang]);

  // Voice coding cleanup on unmount — stop timers, recognition and mic stream
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (voiceAutoSendTimerRef.current) clearTimeout(voiceAutoSendTimerRef.current);
      try { recognitionRef.current?.abort(); } catch (_) {}
      if (voiceStreamRef.current) {
        voiceStreamRef.current.getTracks().forEach(t => t.stop());
        voiceStreamRef.current = null;
      }
      stopVoiceWaveform();
    };
  }, [stopVoiceWaveform]);

  // ── Replit Central Run Engine ──────────────────────────────────────────────
  const handleReplitRun = useCallback(async () => {
    setIsReplitRunning(true);
    try {
      const ext = (activePath || '').split('.').pop()?.toLowerCase();
      const isStandaloneScript = ['js', 'py', 'ts', 'sh'].includes(ext) &&
        !activePath?.includes('App.jsx') && !activePath?.includes('main.jsx') && !activePath?.includes('server.js');

      if (isStandaloneScript && activePath) {
        setTerminalOpen(true);
        showToast(`💻 Running ${activePath} in terminal...`, 'info');
        const runner = ext === 'py' ? 'python' : 'node';
        await api.post('/terminal/exec', {
          command: `${runner} "${activePath}"`,
          projectId,
          projectPath: '.',
          timeout: 15000,
        });
      } else {
        showToast('🚀 Running project in Split View...', 'info');
        setWorkspaceMode(prev => prev === 'preview' ? 'preview' : 'split');
        if (devServerStatus.state !== 'READY') {
          handleStartDevServer();
        } else {
          if (iframeRef.current) {
            iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
          }
        }
      }
    } catch (err) {
      showToast(`Run error: ${err.message}`, 'error');
    } finally {
      setTimeout(() => setIsReplitRunning(false), 1200);
    }
  }, [activePath, projectId, devServerStatus.state, showToast, handleStartDevServer]);

  // Global Keyboard Shortcuts (Ctrl+Enter to Run, Ctrl+\ to toggle Split)
  useEffect(() => {
    const handleGlobalKey = (e) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'p') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && key === 'p') {
        e.preventDefault();
        setQuickOpenOpen(v => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleReplitRun();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setWorkspaceMode(m => m === 'split' ? 'code' : 'split');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [handleReplitRun]);

  const handleUpdatePackageJson = async (newContent) => {
    try {
      await api.post(`/memory/project/${projectId}/file`, { path: 'package.json', content: newContent });
      setContents(prev => ({ ...prev, 'package.json': newContent }));
      setFiles(prev => {
        const exists = prev.some(f => f.path === 'package.json');
        if (exists) return prev.map(f => f.path === 'package.json' ? { ...f, content: newContent } : f);
        return [...prev, { path: 'package.json', content: newContent, lastModified: Date.now() }];
      });
      showToast('📦 package.json updated successfully', 'success');
      return true;
    } catch (err) {
      showToast(`Package update failed: ${err.message}`, 'error');
      return false;
    }
  };

  const handleSaveEnv = async (newContent) => {
    try {
      await api.post(`/memory/project/${projectId}/file`, { path: '.env', content: newContent });
      setContents(prev => ({ ...prev, '.env': newContent }));
      setFiles(prev => {
        const exists = prev.some(f => f.path === '.env');
        if (exists) return prev.map(f => f.path === '.env' ? { ...f, content: newContent } : f);
        return [...prev, { path: '.env', content: newContent, lastModified: Date.now() }];
      });
      showToast('🔐 Secrets saved to .env successfully', 'success');
    } catch (err) {
      showToast(`Secrets save failed: ${err.message}`, 'error');
    }
  };

  const handleTerminalCommand = async (cmd) => {
    setTerminalOpen(true);
    showToast(`Executing: ${cmd}`, 'info');
    try {
      await api.post('/terminal/exec', {
        command: cmd,
        projectId,
        projectPath: '.',
        timeout: 30000,
      });
    } catch (err) {
      console.error('Terminal command error:', err);
    }
  };

  // Ctrl+K Inline AI Edit
  const triggerInlineEdit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setInlineEditPrompt('');
    setInlineEditOpen(true);
  };

  const handleInlineEditSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!inlineEditPrompt.trim()) return;
    const editor = editorRef.current;
    if (!editor || !activePath) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    let selectedText = model.getValueInRange(selection);
    let targetRange = selection;

    if (!selectedText.trim()) {
      const pos = editor.getPosition();
      const lineContent = model.getLineContent(pos.lineNumber);
      selectedText = lineContent;
      targetRange = new monacoRef.current.Range(pos.lineNumber, 1, pos.lineNumber, lineContent.length + 1);
    }

    setInlineEditLoading(true);
    try {
      const ext = activePath.split('.').pop()?.toLowerCase();
      const res = await api.post('/agent/inline-edit', {
        code: selectedText,
        prompt: inlineEditPrompt,
        language: LANG_BY_EXT[ext] || 'javascript',
        file: activePath
      });

      if (res.data?.success && res.data?.replacement) {
        editor.executeEdits('inline-ai', [
          { range: targetRange, text: res.data.replacement, forceMoveMarkers: true }
        ]);
        setDirtyPaths(prev => new Set(prev).add(activePath));
        showToast('✨ Inline AI edit applied! (Ctrl+S to save)', 'success');
        setInlineEditOpen(false);
      }
    } catch (err) {
      showToast(`Inline edit failed: ${err.message}`, 'error');
    } finally {
      setInlineEditLoading(false);
    }
  };

  // Active path ref sync
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // Auto scroll chat messages
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      if (endRef.current) {
        endRef.current.scrollTop = endRef.current.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [copilotMessages, copilotStatus, planTasks]);

  // Suppress benign Monaco editor unmount cancellation errors
  useEffect(() => {
    const handleRejection = (e) => {
      if (e?.reason?.message === 'Canceled' || e?.reason?.name === 'Canceled' || e?.reason === 'Canceled') {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  // ── Session Hydration, Auto-Save & History Management ───────────────────
  const autoSaveTimeoutRef = useRef(null);
  const isHydratedRef = useRef(false);

  // 1. Initial hydration from localStorage & backend SQLite
  useEffect(() => {
    let isMounted = true;
    const hydrateSessions = async () => {
      try {
        const stored = localStorage.getItem('copilot_sessions_v2');
        let parsed = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(parsed)) parsed = [];

        // Try syncing from backend SQLite
        try {
          const res = await api.get('/copilot/sessions');
          if (res.data?.success && Array.isArray(res.data?.sessions) && res.data.sessions.length > 0) {
            const mergedMap = new Map();
            parsed.forEach(s => mergedMap.set(s.id, s));
            res.data.sessions.forEach(bs => {
              const local = mergedMap.get(bs.id);
              if (!local || (bs.updatedAt || 0) >= (local.updatedAt || 0)) {
                mergedMap.set(bs.id, { ...local, ...bs });
              }
            });
            parsed = Array.from(mergedMap.values());
            localStorage.setItem('copilot_sessions_v2', JSON.stringify(parsed));
          }
        } catch (_) {}

        const currentId = localStorage.getItem('copilot_current_session_id');
        let target = parsed.find(s => s.id === currentId) || parsed[0];

        if (!target) {
          target = {
            id: defaultProjectId || 'copilot-session-main',
            title: defaultProjectName || 'Copilot Workspace',
            promptSummary: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            files: [],
            contents: {},
            openTabs: [],
            activePath: null,
            workspaceMode: 'split',
            previewDevice: 'desktop',
            planTasks: [],
            snapshots: []
          };
          parsed = [target];
          localStorage.setItem('copilot_sessions_v2', JSON.stringify(parsed));
        }

        if (!isMounted) return;
        setSessions(parsed);
        setActiveSessionId(target.id);
        localStorage.setItem('copilot_current_session_id', target.id);

        if (target.files && target.files.length > 0) {
          setFiles(target.files);
          setContents(target.contents || {});
          setOpenTabs(target.openTabs || (target.files[0] ? [target.files[0].path] : []));
          setActivePath(target.activePath || (target.files[0] ? target.files[0].path : null));
          if (target.messages && target.messages.length > 0) setCopilotMessages(target.messages);
          if (target.workspaceMode) setWorkspaceMode(target.workspaceMode);
          if (target.previewDevice) setPreviewDevice(target.previewDevice);
          if (target.planTasks) setPlanTasks(target.planTasks);
          if (target.snapshots) setSnapshots(target.snapshots);
        }
        isHydratedRef.current = true;
      } catch (e) {
        console.warn('Failed to load session storage:', e);
        if (isMounted) isHydratedRef.current = true;
      }
    };

    hydrateSessions();
    return () => { isMounted = false; };
  }, [defaultProjectId, defaultProjectName, setCopilotMessages]);

  // 2. Save current session function
  const saveCurrentSession = useCallback((overrides = {}) => {
    if (!activeSessionId || !isHydratedRef.current) return;
    const prev = sessionsRef.current;
    const idx = prev.findIndex(s => s.id === activeSessionId);
    const existing = idx !== -1 ? prev[idx] : {};
    const updated = {
      ...existing,
      id: activeSessionId,
      title: overrides.title !== undefined ? overrides.title : (existing.title || defaultProjectName),
      promptSummary: overrides.promptSummary !== undefined ? overrides.promptSummary : (existing.promptSummary || ''),
      updatedAt: Date.now(),
      messages: overrides.messages !== undefined ? overrides.messages : copilotMessages,
      files: overrides.files !== undefined ? overrides.files : files,
      contents: overrides.contents !== undefined ? overrides.contents : contents,
      openTabs: overrides.openTabs !== undefined ? overrides.openTabs : openTabs,
      activePath: overrides.activePath !== undefined ? overrides.activePath : activePath,
      workspaceMode: overrides.workspaceMode !== undefined ? overrides.workspaceMode : workspaceMode,
      previewDevice: overrides.previewDevice !== undefined ? overrides.previewDevice : previewDevice,
      planTasks: overrides.planTasks !== undefined ? overrides.planTasks : planTasks,
      snapshots: overrides.snapshots !== undefined ? overrides.snapshots : (snapshots.length > 0 ? snapshots : (existing.snapshots || [])),
    };
    const list = idx !== -1
      ? prev.map(s => s.id === activeSessionId ? updated : s)
      : [updated, ...prev];
    sessionsRef.current = list;
    setSessions(list);
    try {
      localStorage.setItem('copilot_sessions_v2', JSON.stringify(list));
    } catch (_) {}

    // Async persist to backend SQLite (retry once on failure)
    api.post('/copilot/sessions', updated).catch((err) => {
      setTimeout(() => api.post('/copilot/sessions', updated).catch(() => {}), 3000);
      console.warn('[CopilotIDE] Session persist retry scheduled:', err?.message);
    });
  }, [activeSessionId, copilotMessages, files, contents, openTabs, activePath, workspaceMode, previewDevice, planTasks, snapshots, defaultProjectName]);

  // 3. Debounced auto-save on state changes
  useEffect(() => {
    if (!isHydratedRef.current || !activeSessionId) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveCurrentSession();
    }, 1200);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [files, contents, openTabs, activePath, copilotMessages, workspaceMode, previewDevice, saveCurrentSession, activeSessionId]);

  // 4. Session switching & management handlers
  const handleNewSession = useCallback(async () => {
    saveCurrentSession();

    const newId = `copilot-session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Workspace',
      promptSummary: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      files: [],
      contents: {},
      openTabs: [],
      activePath: null,
      workspaceMode: 'split',
      previewDevice: 'desktop',
      planTasks: [],
      snapshots: []
    };

    setFiles([]);
    setContents({});
    setOpenTabs([]);
    setActivePath(null);
    activePathRef.current = null;
    setCopilotMessages([]);
    setPlanTasks([]);
    setSnapshots([]);
    setCopilotStatus({ label: '', tone: 'info' });
    setWorkspaceMode('split');
    setPreviewDevice('desktop');
    setPreviewZoom(100);
    setRuntimeError(null);
    setSelectedInspectorElement(null);

    setActiveSessionId(newId);
    const listWithNew = [newSession, ...sessionsRef.current];
    sessionsRef.current = listWithNew;
    setSessions(listWithNew);
    try { localStorage.setItem('copilot_current_session_id', newId); } catch (_) {}
    try {
      const stored = localStorage.getItem('copilot_sessions_v2');
      const list = stored ? JSON.parse(stored) : [];
      localStorage.setItem('copilot_sessions_v2', JSON.stringify([newSession, ...(Array.isArray(list) ? list : [])]));
    } catch (_) {}

    api.post('/copilot/sessions', newSession).catch(() => {});

    showToast('✨ Started new project! Past work is safely saved in History.', 'success');
  }, [saveCurrentSession, showToast, setCopilotMessages]);

  const handleSelectSession = useCallback((sessionId) => {
    if (sessionId === activeSessionId) return;
    saveCurrentSession();

    const target = sessions.find(s => s.id === sessionId);
    if (!target) return;

    setActiveSessionId(sessionId);
    try { localStorage.setItem('copilot_current_session_id', sessionId); } catch (_) {}

    setFiles(target.files || []);
    setContents(target.contents || {});
    setOpenTabs(target.openTabs || []);
    const defFile = target.activePath || (target.files && target.files[0] ? target.files[0].path : null);
    setActivePath(defFile);
    activePathRef.current = defFile;
    setCopilotMessages(target.messages || []);
    setPlanTasks(target.planTasks || []);
    setSnapshots(target.snapshots || []);
    if (target.workspaceMode) setWorkspaceMode(target.workspaceMode);
    if (target.previewDevice) setPreviewDevice(target.previewDevice);
    setPreviewZoom(100);
    setCopilotStatus({ label: '', tone: 'info' });
    setRuntimeError(null);
    setSelectedInspectorElement(null);

    showToast(`📂 Switched to session: "${target.title || 'Untitled'}"`, 'info');
  }, [activeSessionId, sessions, saveCurrentSession, showToast, setCopilotMessages]);

  const handleRenameSession = useCallback((id, newTitle) => {
    const updated = sessionsRef.current.map(s => s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s);
    sessionsRef.current = updated;
    setSessions(updated);
    try { localStorage.setItem('copilot_sessions_v2', JSON.stringify(updated)); } catch (_) {}
    showToast('Session title updated', 'success');
  }, [showToast]);

  const handleDeleteSession = useCallback((id) => {
    const updated = sessionsRef.current.filter(s => s.id !== id);
    sessionsRef.current = updated;
    setSessions(updated);
    try { localStorage.setItem('copilot_sessions_v2', JSON.stringify(updated)); } catch (_) {}
    api.delete(`/copilot/sessions/${id}`).catch(() => {});
    if (activeSessionId === id) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        handleNewSession();
      }
    }
    showToast('Session deleted', 'info');
  }, [activeSessionId, handleSelectSession, handleNewSession, showToast]);

  const handleDuplicateSession = useCallback((id) => {
    const source = sessionsRef.current.find(s => s.id === id);
    if (!source) return;
    const newId = `copilot-session-${Date.now()}`;
    const clone = {
      ...source,
      id: newId,
      title: `${source.title || 'Workspace'} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [clone, ...sessionsRef.current];
    sessionsRef.current = updated;
    setSessions(updated);
    try { localStorage.setItem('copilot_sessions_v2', JSON.stringify(updated)); } catch (_) {}
    api.post('/copilot/sessions', clone).catch(() => {});
    showToast(`Cloned session as "${clone.title}"`, 'success');
  }, [showToast]);

  // Load workspace files with path normalization & deduplication
  const loadWorkspaceFiles = useCallback(async (forceSelect = false) => {
    setLoadingFiles(true);
    try {
      const res = await api.get(`/memory/project/${projectId}`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.files || []);
      
      const fileMap = new Map();
      raw.forEach(f => {
        const cleanPath = normalizePath(f.path || f.name);
        if (cleanPath && !fileMap.has(cleanPath)) {
          fileMap.set(cleanPath, {
            path: cleanPath,
            content: f.content || '',
            lastModified: f.last_modified || f.lastModified || Date.now()
          });
        }
      });
      const fileList = Array.from(fileMap.values());

      setFiles(fileList);
      const map = {};
      fileList.forEach(f => { map[f.path] = f.content; });
      setContents(map);

      const priority = ['src/App.jsx', 'src/App.js', 'src/main.jsx', 'src/index.js', 'App.jsx', 'index.html', 'server.js', 'package.json'];
      const target = priority.find(p => fileList.some(f => f.path === p)) || (fileList[0] ? fileList[0].path : null);

      if (fileList.length > 0 && (forceSelect || !activePathRef.current || !fileList.some(f => f.path === activePathRef.current))) {
        if (target) {
          setOpenTabs([target]);
          setActivePath(target);
          activePathRef.current = target;
        }
      } else if (fileList.length === 0) {
        setOpenTabs([]);
        setActivePath(null);
        activePathRef.current = null;
      }
    } catch (_) {
      // Keep local session files if offline
    } finally {
      setLoadingFiles(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkspaceFiles();
  }, [loadWorkspaceFiles]);

  // Unified Cross-Module Bridge: Import code or artifacts from Chat / Agent into active editor
  useEffect(() => {
    try {
      const imported = localStorage.getItem('ai_dost_copilot_import');
      if (imported) {
        localStorage.removeItem('ai_dost_copilot_import');
        const data = JSON.parse(imported);
        if (data && data.code) {
          const lang = (data.language || 'javascript').toLowerCase();
          const ext = lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'python' || lang === 'py' ? 'py' : lang === 'json' ? 'json' : lang === 'jsx' ? 'jsx' : lang === 'ts' || lang === 'typescript' ? 'ts' : 'js';
          const filename = data.title ? (data.title.includes('.') ? data.title : `${data.title.replace(/\s+/g, '_')}.${ext}`) : `imported_snippet.${ext}`;

          activePathRef.current = filename;
          setContents(prev => ({ ...prev, [filename]: data.code }));
          setFiles(prev => {
            const exists = prev.some(f => f.path === filename);
            if (exists) {
              return prev.map(f => f.path === filename ? { ...f, content: data.code } : f);
            }
            return [{ path: filename, content: data.code, lastModified: Date.now() }, ...prev];
          });
          setOpenTabs(prev => prev.includes(filename) ? prev : [filename, ...prev]);
          setActivePath(filename);
          setWorkspaceMode('code');
          if (onToast) onToast(`Imported ${filename} from chat into editor`, 'success');
        }
      }
    } catch (_) {}
  }, [onToast]);

  const selectFile = useCallback((fileOrPath) => {
    const pathStr = typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
    if (!pathStr) return;
    if (!openTabs.includes(pathStr)) {
      setOpenTabs(prev => [...prev, pathStr]);
    }
    setActivePath(pathStr);
    setWorkspaceMode('code');
  }, [openTabs]);

  // Ctrl+Shift+F find-in-files: synchronous search over loaded workspace contents
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    const needle = searchCase ? q : q.toLowerCase();
    const out = [];
    for (const f of files) {
      const text = contents[f.path] ?? f.content ?? '';
      if (!text) continue;
      const linesArr = text.split('\n');
      for (let i = 0; i < linesArr.length; i++) {
        const hay = searchCase ? linesArr[i] : linesArr[i].toLowerCase();
        if (hay.includes(needle)) {
          out.push({ path: f.path, line: i + 1, text: linesArr[i].trim().slice(0, 200) });
          if (out.length >= 200) break;
        }
      }
      if (out.length >= 200) break;
    }
    setSearchResults(out);
    setSearching(false);
  }, [searchOpen, searchQuery, searchCase, files, contents]);

  // P3 #118: dashboard's AgentView onOpenFile stores the clicked path in
  // localStorage before switching view — consume it once workspace files are
  // loaded (exact path → suffix match → basename fallback).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ai_dost_copilot_open');
      if (!raw) return;
      const req = JSON.parse(raw);
      const want = req && req.path ? String(req.path).replace(/\\/g, '/').toLowerCase() : '';
      if (!want || Date.now() - (req.at || 0) > 60000) {
        localStorage.removeItem('ai_dost_copilot_open');
        return;
      }
      if (!files.length && loadingFiles) return; // wait for workspace load
      const wantBase = want.split('/').pop();
      const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase();
      const match =
        files.find(f => norm(f.path) === want) ||
        files.find(f => norm(f.path).endsWith('/' + want) || want.endsWith('/' + norm(f.path))) ||
        files.find(f => norm(f.path).split('/').pop() === wantBase);
      localStorage.removeItem('ai_dost_copilot_open');
      if (match) {
        selectFile(match.path);
      } else if (onToast) {
        onToast(`File not found in workspace: ${req.path}`, 'error');
      }
    } catch (_) { /* malformed request — drop */ }
  }, [files, loadingFiles, selectFile, onToast]);

  const closeTab = useCallback((pathStr) => {
    setOpenTabs(prev => {
      const next = prev.filter(p => p !== pathStr);
      if (activePath === pathStr) {
        setActivePath(next[next.length - 1] || null);
      }
      return next;
    });
  }, [activePath]);

  const activeContent = activePath ? (contents[activePath] ?? '') : '';
  const activeExt = activePath ? activePath.split('.').pop()?.toLowerCase() : 'js';
  const activeLang = LANG_BY_EXT[activeExt] || 'javascript';

  const setFileContent = (pathStr, newContent) => {
    setContents(prev => ({ ...prev, [pathStr]: newContent }));
  };

  const markDirty = (pathStr) => {
    setDirtyPaths(prev => new Set(prev).add(pathStr));
  };

  const saveActiveFile = async () => {
    if (!activePath) return;
    const content = contents[activePath] ?? '';
    setSaving(true);
    try {
      await api.post(`/memory/project/${projectId}/file`, { path: activePath, content });
      setDirtyPaths(prev => {
        const next = new Set(prev);
        next.delete(activePath);
        return next;
      });
      setFiles(prev => prev.map(f => f.path === activePath ? { ...f, content } : f));
      showToast(`Saved ${activePath}`, 'success');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatFile = () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const action = editor.getAction('editor.action.formatDocument');
      if (action && typeof action.run === 'function') {
        const result = action.run();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
    } catch (_) {
      showToast('Format failed for the active file', 'warning');
    }
  };

  const saveAllFiles = async () => {
    if (dirtyPaths.size === 0) return;
    const saves = Array.from(dirtyPaths).map(p =>
      api.post(`/memory/project/${projectId}/file`, { path: p, content: contents[p] ?? '' })
    );
    try {
      await Promise.all(saves);
      setDirtyPaths(new Set());
      showToast(`All files saved`, 'success');
    } catch (err) {
      showToast(`Save error: ${err.message}`, 'error');
    }
  };

  // LSP Diagnostics
  const setMarkers = useCallback((pathStr, diags) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    const markers = (diags || []).map(d => ({
      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message: d.message,
      startLineNumber: d.line || 1,
      startColumn: d.column || 1,
      endLineNumber: d.line || 1,
      endColumn: (d.column || 1) + 10,
    }));
    monaco.editor.setModelMarkers(model, 'lsp', markers);
    setProblems(markers.length);
  }, []);

  const runDiagnostics = useCallback((pathStr, content) => {
    const ext = pathStr.split('.').pop()?.toLowerCase();
    const lang = LANG_BY_EXT[ext];
    if (!lang) return;
    if (diagTimerRef.current) clearTimeout(diagTimerRef.current);
    diagTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/agent/lsp-diagnostics', { code: content, language: lang });
        setMarkers(pathStr, Array.isArray(res.data?.diagnostics) ? res.data.diagnostics : []);
      } catch (_) {}
    }, 500);
  }, [setMarkers]);

  const handleAutoFixProblems = useCallback(async () => {
    if (running || !activePath) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    let markerMsgs = [];
    if (monaco && editor) {
      const model = editor.getModel();
      if (model) {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        markerMsgs = markers.map(m => `Line ${m.startLineNumber}: ${m.message}`).slice(0, 8);
      }
    }
    const issueSummary = markerMsgs.length > 0 ? markerMsgs.join('; ') : `${problems} syntax issues or warnings detected`;
    const prompt = `Auto-fix all code diagnostics and problems in ${activePath}: ${issueSummary}. Ensure valid syntax, clean formatting, and 0 errors.`;
    showToast(`⚡ Sending ${problems} problem(s) to Copilot for auto-healing...`, 'info');
    handleSendRef.current(prompt);
  }, [running, activePath, problems, showToast]);

  const handleAutoFixRuntimeError = useCallback(async (errText) => {
    if (running) return;
    const targetErr = errText || runtimeError?.error || 'Live preview error';
    const prompt = `Fix runtime error in application preview: "${targetErr}". Check active components and dependencies, resolve null references, undefined variables, and broken syntax so the preview renders cleanly.`;
    showToast(`⚡ Auto-fixing preview runtime error with Copilot...`, 'info');
    setRuntimeError(null);
    handleSendRef.current(prompt);
  }, [running, runtimeError, showToast]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    try {
      configureMonacoThemes(monaco);
      monaco.editor.setTheme(isLight ? 'aidost-light' : 'aidost-dark');
    } catch (_) {}

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      triggerInlineEdit();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleReplitRun();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      setWorkspaceMode(m => m === 'split' ? 'code' : 'split');
    });

    const mountDisposables = [];

    mountDisposables.push(editor.onDidChangeCursorSelection(() => {
      try {
        const sel = editor.getSelection();
        const text = sel ? editor.getModel()?.getValueInRange(sel) || '' : '';
        setSelectedCode(text);
      } catch (_) {}
    }));

    try {
      const supportedLangs = ['javascript', 'typescript', 'python', 'html', 'css', 'json'];
      supportedLangs.forEach(langId => {
        mountDisposables.push(monaco.languages.registerInlineCompletionsProvider(langId, {
          provideInlineCompletions: async (model, position) => {
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 30),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });
            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
              endColumn: 1
            });

            if (!prefix.trim() || prefix.trim().length < 5) return { items: [] };

            try {
              const res = await api.post('/agent/autocomplete', {
                prefix,
                suffix,
                language: langId
              });
              if (res.data?.success && res.data?.completion) {
                return {
                  items: [{
                    insertText: res.data.completion,
                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
                  }]
                };
              }
            } catch (_) {}
            return { items: [] };
          },
          freeInlineCompletions: () => {}
        }));
      });
    } catch (_) {}

    // Dispose selection listener + completion providers when editor unmounts
    editor.onDidDispose(() => {
      mountDisposables.forEach(d => {
        try { d?.dispose?.(); } catch (_) {}
      });
    });

    if (activePath) runDiagnostics(activePath, activeContent);
  };

  const runSingleFile = () => {
    if (!activePath) return;
    setTerminalOpen(true);
    const ext = activePath.split('.').pop()?.toLowerCase();
    let cmd = `node "${activePath}"`;
    if (ext === 'py') cmd = `python "${activePath}"`;
    if (ext === 'sh') cmd = `bash "${activePath}"`;
    terminalRef.current?.runCommand(cmd);
  };

  const rollbackTo = async (dir) => {
    if (!dir) return;
    try {
      const res = await api.post('/agent/rollback', { dir });
      if (res.data?.success) {
        showToast('Restored workspace snapshot successfully', 'success');
        await loadWorkspaceFiles();
      }
    } catch (err) {
      showToast(`Rollback failed: ${err.message}`, 'error');
    }
  };

  const openProjectWizard = (prompt = '') => {
    setWizardInitialPrompt(prompt);
    setWizardOpen(true);
  };

  const handleWizardBuild = async (spec) => {
    setWizardOpen(false);
    setRunning(true);
    setCopilotStatus({ label: '🏗️ Scaffolding full-stack application...', tone: 'work' });

    try {
      const res = await api.post('/agent/scaffold-wizard', {
        spec,
        projectId
      });

      if (res.data?.success) {
        showToast('🎉 Project scaffolded successfully!', 'success');
        await loadWorkspaceFiles();
        setWorkspaceMode('preview');
      }
    } catch (err) {
      showToast(`Scaffold error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  // Main SSE Agent Stream Runner
  const runCopilot = async (prompt, attachedImages = []) => {
    if (!prompt || running) return;

    // Automatically record an internal Time-Travel Snapshot before executing AI prompt
    if (files.length > 0) {
      const snap = {
        id: `snap_${Date.now()}`,
        prompt: prompt.slice(0, 50),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        filesCount: files.length,
        files: JSON.parse(JSON.stringify(files)),
        contents: { ...contents },
        activePath
      };
      setSnapshots(prev => [snap, ...prev.slice(0, 19)]);
    }

    setRunning(true);
    runStartRef.current = Date.now();
    setElapsedSec(0);
    setQaStatus('idle');
    setCopilotStatus({ label: '🤖 Agent thinking & planning...', tone: 'info' });
    const cleanDisplay = prompt.replace(/\[IMAGE_BASE64:[^\]]+\]/g, '').trim() || 'Analyze screenshot & apply upgrades';
    setCopilotMessages(prev => [...prev, { role: 'user', content: cleanDisplay, images: attachedImages }]);
    setCopilotInput('');
    setPastedImages([]);

    const controller = new AbortController();
    abortRef.current = controller;
    const createdFilesTracker = [];

    try {
      const response = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          projectId,
          projectFiles: files,
          chatHistory: copilotMessages.slice(-20).map(m => ({
            role: m.role,
            content: (m.content || '').substring(0, 500),
            kind: m.kind,
            file: m.file
          })),
          copilotDirector: true,
          preferredModel
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Agent request failed: ${response.statusText}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'run_started' || data.type === 'director_start') {
              setLatestRunId(data.runId || data.taskId || null);
              latestRunIdRef.current = data.runId || data.taskId || null;
              if (data.type === 'director_start') {
                setCopilotStatus({ label: '🎯 Director accepted — inspecting workspace...', tone: 'work' });
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: '🎯 Copilot Director accepted your request. Inspecting workspace and planning optimal execution path...' }]);
              }
            }
            // ── Director Plan: Map to milestone task plan ──
            else if (data.type === 'director_plan') {
              const dirTasks = Array.isArray(data.tasks) ? data.tasks : [];
              if (dirTasks.length > 0) {
                setPlanTasks(dirTasks.map((t, idx) => ({
                  id: t.id || `task-${idx + 1}`,
                  title: t.objective || t.title || `Task ${idx + 1}`,
                  specialty: t.specialty || 'integration',
                  role: t.role || 'CODER',
                  status: idx === 0 ? 'in_progress' : 'pending'
                })));
              }
              const summary = data.summary || `Director planned ${data.taskCount || dirTasks.length} specialist task(s)`;
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `📋 ${summary}` }]);
              setCopilotStatus({ label: `📋 ${data.taskCount || dirTasks.length} tasks planned`, tone: 'work' });
            }
            // ── Director Task: Map specialist activity to thinking/step ──
            else if (data.type === 'director_task') {
              const specialty = data.specialty || data.role || 'worker';
              const taskStatus = data.status || 'running';
              const taskLabel = `${specialty.toUpperCase()}${data.taskId ? ` [${data.taskId}]` : ''}`;
              const statusEmoji = taskStatus === 'SUCCEEDED' ? '✅' : taskStatus === 'FAILED' ? '❌' : taskStatus === 'RETRYING' ? '🔄' : '⚙️';
              const msg = `${statusEmoji} ${taskLabel}: ${taskStatus}${data.error ? ` — ${data.error}` : ''}${data.objective ? ` — ${data.objective.substring(0, 80)}` : ''}`;
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: msg, agent: specialty }]);
              setCopilotStatus({ label: `${statusEmoji} ${taskLabel}: ${taskStatus}`, tone: taskStatus === 'FAILED' ? 'error' : 'work' });
              // Update plan tasks status
              if (data.taskId) {
                setPlanTasks(prev => {
                  const updated = prev.map(t => {
                    if (t.id === data.taskId) {
                      return { ...t, status: taskStatus === 'SUCCEEDED' ? 'completed' : taskStatus === 'FAILED' ? 'error' : 'in_progress', logSnippet: msg.substring(0, 60) };
                    }
                    return t;
                  });
                  // Advance next pending task to in_progress
                  if (taskStatus === 'SUCCEEDED') {
                    let activated = false;
                    return updated.map(t => {
                      if (!activated && t.status === 'pending') {
                        activated = true;
                        return { ...t, status: 'in_progress' };
                      }
                      return t;
                    });
                  }
                  return updated;
                });
              }
            }
            // ── Director Verification: Show verification gate status ──
            else if (data.type === 'director_verification') {
              const vStatus = data.status || 'running';
              const vEmoji = vStatus === 'SUCCEEDED' ? '✅' : vStatus === 'DELEGATING' ? '🔍' : '⚠️';
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `${vEmoji} Final Verification Gate: ${vStatus}` }]);
              setCopilotStatus({ label: `${vEmoji} Verification: ${vStatus}`, tone: 'work' });
              setQaStatus(vStatus === 'SUCCEEDED' ? 'passed' : vStatus === 'DELEGATING' ? 'running' : 'failed');
            }
            // ── Director Complete: CRITICAL — Map to done, reset running state ──
            else if (data.type === 'director_complete') {
              const taskCount = data.taskCount || '?';
              setPlanTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
              setCopilotStatus({ label: `✅ Director completed — ${taskCount} tasks`, tone: 'success' });

              const finalFiles = createdFilesTracker.length > 0 ? createdFilesTracker : files.map(f => f.path);
              setCopilotMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  kind: 'aistudio_card',
                  model: 'Copilot Director (Gemini + Groq Cascade)',
                  duration: `${Math.max(6, parseInt(taskCount) * 8 || 12)}s`,
                  files: finalFiles,
                  content: data.message || `🎉 Copilot Director completed ${taskCount} autonomous specialist task(s) with verification.`,
                  summary: data.message || `Director completed ${taskCount} tasks`
                }
              ]);

              await loadWorkspaceFiles(true);
              setMilestonesExpanded(false);
              if (activePathRef.current) {
                runDiagnostics(activePathRef.current, contents[activePathRef.current] || '');
              }
              setWorkspaceMode('preview');
            }
            // ── Director Error: Show error and reset running state ──
            else if (data.type === 'director_error') {
              const errMsg = data.error || 'Director encountered an error';
              setCopilotStatus({ label: `❌ ${errMsg.substring(0, 40)}`, tone: 'error' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `❌ Director Error: ${errMsg}` }]);
              setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, status: 'error' } : t));
            }
            // ── Director Canceled: Show cancellation and reset ──
            else if (data.type === 'director_canceled') {
              setCopilotStatus({ label: '⏹ Director run canceled', tone: 'neutral' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: '⏹ Director run canceled. Completed changes remain in the workspace.' }]);
              setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, status: 'pending' } : t));
            }
            else if (data.type === 'plan' || data.type === 'plan_tasks') {
              const tasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data.plan?.tasks) ? data.plan.tasks : []);
              if (tasks.length > 0) {
                setPlanTasks(tasks.map((t, idx) => ({
                  ...t,
                  status: idx === 0 ? 'in_progress' : (t.status || 'pending')
                })));
              }
            }
            else if (data.type === 'thinking' || data.type === 'thought' || data.type === 'agent_status') {
              const msg = data.message || data.thought;
              if (msg && msg.trim()) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: msg, agent: data.agent }]);
                setCopilotStatus({ label: msg.substring(0, 45) + '...', tone: 'work' });
                setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, logSnippet: msg.substring(0, 60) } : t));
              }
            }
            else if (data.type === 'tool_call') {
              const action = data.action;
              const label = STATUS_BY_ACTION[action] || `Executing ${action}...`;
              setCopilotStatus({ label, tone: 'work' });
              
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'tool', action: action, content: data.thought, label: label }]);
              
              setPlanTasks(prev => {
                let foundActive = false;
                return prev.map(t => {
                  if (t.status === 'in_progress') {
                    foundActive = true;
                    return { ...t, actionType: action, logSnippet: data.thought || label };
                  }
                  return t;
                });
              });
            }
            else if (data.type === 'director_file_diff') {
              const filePath = normalizePath(data.file || data.fullPath);
              setCopilotMessages(prev => [...prev, {
                role: 'assistant',
                kind: 'file',
                file: filePath,
                content: `⚡ Surgical Diff: ${data.file} (${data.summary || 'modified'})`
              }]);
              setCopilotStatus({ label: `⚡ Patched ${data.file}`, tone: 'work' });
              loadWorkspaceFiles();
            }
            else if (data.type === 'file_written' || data.type === 'file_changed' || data.type === 'file') {
              const rawPath = data.path || data.file;
              const filePath = normalizePath(rawPath);
              const content = data.content || '';
              if (filePath) {
                if (!createdFilesTracker.includes(filePath)) {
                  createdFilesTracker.push(filePath);
                }
                // Devin-style per-file diff stats vs. previous known content.
                // Update contentsRef synchronously: multiple file_written events
                // can land in the same tick, before React effects re-sync the ref.
                const prevContent = contentsRef.current[filePath];
                const isNew = typeof prevContent !== 'string';
                let added = null;
                let removed = null;
                if (!isNew) {
                  try {
                    const stats = diffStats(diffLines(prevContent, content));
                    added = stats.added;
                    removed = stats.removed;
                  } catch (_) {}
                }
                contentsRef.current = { ...contentsRef.current, [filePath]: content };
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'file', file: filePath, content: `Created/Updated: ${filePath}`, isNew, added, removed }]);
                setFiles(prev => {
                  const existingIdx = prev.findIndex(f => normalizePath(f.path).toLowerCase() === filePath.toLowerCase());
                  if (existingIdx !== -1) {
                    const updated = [...prev];
                    updated[existingIdx] = { path: filePath, content, lastModified: Date.now() };
                    return updated;
                  }
                  return [...prev, { path: filePath, content, lastModified: Date.now() }];
                });
                setContents(prev => ({ ...prev, [filePath]: content }));
                syncFileToWebContainer(filePath, content);

                // Advance milestone task status dynamically
                setPlanTasks(prev => {
                  let advanced = false;
                  return prev.map((t) => {
                    if (t.status === 'in_progress' && !advanced) {
                      advanced = true;
                      return { ...t, status: 'completed', target: filePath, actionType: 'WRITE' };
                    }
                    return t;
                  }).map((t, idx, arr) => {
                    const prevTask = arr[idx - 1];
                    if (prevTask && prevTask.status === 'completed' && t.status === 'pending') {
                      return { ...t, status: 'in_progress' };
                    }
                    return t;
                  });
                });

                // Auto-open primary component in editor tab
                if (!activePathRef.current || filePath.endsWith('App.jsx') || filePath.endsWith('main.jsx')) {
                  setActivePath(filePath);
                  setOpenTabs(prev => prev.includes(filePath) ? prev : [...prev, filePath]);
                }
              }
            }
            else if (data.type === 'step') {
              const log = data.stepLog || {};
              if (log.thought || log.action) {
                const safeContent = typeof log.thought === 'object' ? JSON.stringify(log.thought) :
                                    typeof log.action === 'object' ? JSON.stringify(log.action) :
                                    (log.thought || log.action || 'Processing step');
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'step', content: safeContent }]);
              }
            }
            else if (data.type === 'screenshot') {
              const shotData = data.data || data.screenshot || data.image;
              setCopilotMessages(prev => [...prev, {
                role: 'assistant',
                kind: 'screenshot',
                image: shotData ? `data:${data.mimeType || 'image/png'};base64,${shotData}` : null,
                url: data.url || 'http://localhost:3000',
                message: data.message || 'Live Application UI Verification Snapshot'
              }]);
            }
            else if (data.type === 'vision') {
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `👁️ Vision QA: ${data.message}` }]);
            }
            else if (data.type === 'done') {
              const stepCount = Array.isArray(data.steps) ? data.steps.length : (data.steps || '?');
              setPlanTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
              setCopilotStatus({ label: `✅ Done — ${stepCount} steps`, tone: 'success' });

              const finalFiles = createdFilesTracker.length > 0 ? createdFilesTracker : files.map(f => f.path);

              setCopilotMessages(prev => [
                ...prev,
                {
                  role: 'assistant',
                  kind: 'aistudio_card',
                  model: 'Gemini 2.5 Flash + Groq Cascade',
                  duration: `${Math.max(6, parseInt(stepCount) * 4 || 12)}s`,
                  files: finalFiles,
                  content: data.message || `🎉 Fullstack task completed successfully across ${stepCount} steps.`,
                  summary: data.message
                }
              ]);

              await loadWorkspaceFiles(true);
              setMilestonesExpanded(false);
              if (activePathRef.current) {
                runDiagnostics(activePathRef.current, contents[activePathRef.current] || '');
              }
              setWorkspaceMode('preview');
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setCopilotStatus({ label: `⚠️ ${err.message}`, tone: 'error' });
        showToast(err.message, 'error');
      }
    } finally {
      setRunning(false);
      // Force-save session after every agent run completes to prevent data loss
      setTimeout(() => saveCurrentSession(), 500);
    }
  };

  const handleSend = async (text, isWizardPrompt = false) => {
    if (isWizardPrompt) {
      return openProjectWizard(text || copilotInput);
    }
    const rawPrompt = (text || copilotInput).trim();
    if ((!rawPrompt && pastedImages.length === 0) || running) return;

    const currentImages = [...pastedImages];
    let finalPrompt = rawPrompt || 'Please review this screenshot reference and apply the requested UI changes or upgrades.';
    if (currentImages.length > 0) {
      const imgTags = currentImages.map(img => {
        const b64 = img.dataUrl.includes('base64,') ? img.dataUrl.split('base64,')[1] : img.dataUrl;
        return `[IMAGE_BASE64:${b64}]`;
      }).join('\n');
      finalPrompt = `${finalPrompt}\n\n${imgTags}`;
    }

    if (!planGate) {
      setPastedImages([]);
      return runCopilot(finalPrompt, currentImages.map(i => i.dataUrl));
    }

    setCopilotInput('');
    setPastedImages([]);
    setCopilotMessages(prev => [...prev, { role: 'user', content: rawPrompt || 'Attached screenshot reference', images: currentImages.map(i => i.dataUrl) }]);
    setCopilotStatus({ label: '📋 Planning architecture...', tone: 'info' });

    try {
      const res = await api.post('/agent/plan', { userPrompt: finalPrompt });
      const tasks = Array.isArray(res.data?.plan?.tasks) ? res.data.plan.tasks : [];
      if (tasks.length === 0) return runCopilot(finalPrompt, currentImages.map(i => i.dataUrl));
      setPendingPlan({ prompt: finalPrompt, images: currentImages.map(i => i.dataUrl), summary: res.data.plan?.summary || '', tasks });
    } catch (_) {
      runCopilot(finalPrompt, currentImages.map(i => i.dataUrl));
    }
  };

  const approvePlan = () => {
    if (!pendingPlan) return;
    const prompt = pendingPlan.prompt;
    const images = pendingPlan.images || [];
    setPendingPlan(null);
    runCopilot(prompt, images);
  };

  const cancelPlan = () => {
    setPendingPlan(null);
    setCopilotStatus({ label: 'Plan cancelled', tone: 'neutral' });
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // ── Auto-Dependency Detector ─────────────────────────────────────────────
  const detectedMissingPackages = useMemo(() => {
    try {
      const pkgContent = contents['package.json'] || '';
      let installed = {};
      if (pkgContent) {
        try {
          const parsed = JSON.parse(pkgContent);
          installed = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
        } catch (_) {}
      }

      const standardBuiltins = new Set([
        'react', 'react-dom', 'next', 'fs', 'path', 'http', 'https', 'crypto', 'os', 'url', 'events', 'stream', 'util', 'buffer'
      ]);

      const foundPackages = new Set();
      const importRegex = /(?:import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

      Object.entries(contents).forEach(([p, code]) => {
        if (!p.endsWith('.js') && !p.endsWith('.jsx') && !p.endsWith('.ts') && !p.endsWith('.tsx')) return;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
          const rawPkg = match[1] || match[2] || '';
          if (rawPkg.startsWith('.') || rawPkg.startsWith('/') || rawPkg.startsWith('@/')) continue;
          const parts = rawPkg.split('/');
          const pkgName = rawPkg.startsWith('@') && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
          if (pkgName && !standardBuiltins.has(pkgName) && !installed[pkgName]) {
            foundPackages.add(pkgName);
          }
        }
      });

      return Array.from(foundPackages);
    } catch (_) {
      return [];
    }
  }, [contents]);

  const handleInstallMissingPackages = async (packagesToInstall) => {
    if (!Array.isArray(packagesToInstall) || packagesToInstall.length === 0) return;
    showToast(`📦 Adding ${packagesToInstall.join(', ')} to package.json...`, 'info');
    
    try {
      let pkgObj = {
        name: projectId || 'copilot-project',
        version: '1.0.0',
        private: true,
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0'
        }
      };

      if (contents['package.json']) {
        try { pkgObj = JSON.parse(contents['package.json']); } catch (_) {}
      }

      if (!pkgObj.dependencies) pkgObj.dependencies = {};
      packagesToInstall.forEach(pkg => {
        pkgObj.dependencies[pkg] = 'latest';
      });

      const updatedStr = JSON.stringify(pkgObj, null, 2);
      const updated = await handleUpdatePackageJson(updatedStr);
      if (!updated) {
        showToast('Failed to update package.json — install aborted', 'error');
        return;
      }

      // Actually install into the project environment via terminal
      setTerminalOpen(true);
      try {
        await api.post('/terminal/exec', {
          command: `npm install ${packagesToInstall.join(' ')}`,
          projectId,
          projectPath: '.',
          timeout: 180000,
        });
        showToast(`⚡ Installed ${packagesToInstall.join(', ')} into project environment!`, 'success');
      } catch (execErr) {
        showToast(`Added to package.json — run npm install to apply (${execErr.message})`, 'warning');
      }
    } catch (err) {
      showToast(`Failed to install packages: ${err.message}`, 'error');
    }
  };

  // Bi-directional Element Jump: Highlight matching code line in Monaco
  const jumpToMatchingElementInEditor = useCallback((tag, text, className) => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const fullCode = model.getValue();
    const lines = fullCode.split('\n');

    let targetLine = -1;
    const cleanText = (text || '').trim();
    if (cleanText && cleanText.length > 2) {
      const idx = lines.findIndex(l => l.includes(cleanText));
      if (idx !== -1) targetLine = idx + 1;
    }

    if (targetLine === -1 && className) {
      const firstClass = className.split(' ')[0];
      if (firstClass && firstClass.length > 3) {
        const idx = lines.findIndex(l => l.includes(firstClass));
        if (idx !== -1) targetLine = idx + 1;
      }
    }

    if (targetLine === -1 && tag) {
      const idx = lines.findIndex(l => new RegExp(`<${tag}[\\s>]`, 'i').test(l));
      if (idx !== -1) targetLine = idx + 1;
    }

    if (targetLine !== -1) {
      editor.revealLineInCenter(targetLine);
      editor.setPosition({ lineNumber: targetLine, column: 1 });
      editor.focus();
    }
  }, []);

  const handleRollbackSnapshot = useCallback((snap) => {
    if (!snap) return;
    setFiles(snap.files || []);
    setContents(snap.contents || {});
    setActivePath(snap.activePath || (snap.files && snap.files[0] ? snap.files[0].path : null));
    setOpenTabs(snap.files ? snap.files.slice(0, 4).map(f => f.path) : []);
    setSnapshotMenuOpen(false);
    showToast(`⏪ Reverted workspace to snapshot before: "${snap.prompt}"`, 'info');
  }, [showToast]);

  // ── Autonomous Self-Healing Diagnostic & Repair Engine (Enhanced) ────────
  const applyHealedCode = useCallback((targetFile, healedCode, explanation) => {
    setContents(prev => ({ ...prev, [targetFile]: healedCode }));
    setFiles(prev => prev.map(f => f.path === targetFile ? { ...f, content: healedCode, lastModified: Date.now() } : f));
    if (editorRef.current && activePath === targetFile) {
      editorRef.current.setValue(healedCode);
    }
    try {
      api.post(`/memory/project/${projectId}/file`, { path: targetFile, content: healedCode }).catch(() => {});
    } catch (_) {}
    setRuntimeError(null);
    setHealCount(prev => prev + 1);
    showToast('✅ Self-Healing: Error repaired and preview restored!', 'success');

    // Trigger preview refresh
    if (iframeRef.current) {
      if (previewSourceMode === 'live' || (previewSourceMode === 'auto' && devServerStatus.state === 'READY')) {
        iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
      } else {
        iframeRef.current.srcdoc = generateLiveAppHtml(files, { ...contents, [targetFile]: healedCode }, inspectorActive);
      }
    }
  }, [activePath, contents, projectId, files, previewSourceMode, devServerStatus.state, inspectorActive, showToast]);

  const handleAutonomousSelfHeal = useCallback(async (errorMessage, source) => {
    if (healingInProgress || !errorMessage) return;
    setHealingInProgress(true);

    const healMsgId = `heal_${Date.now()}`;
    setCopilotMessages(prev => [
      ...prev,
      {
        id: healMsgId,
        role: 'assistant',
        content: `### ⚡ Autonomous Self-Healing Triggered\n**Runtime Error Detected:**\n\`\`\`\n${String(errorMessage).slice(0, 180)}\n\`\`\`\n*Diagnosing stack trace and applying surgical patch to workspace...*`
      }
    ]);

    try {
      const targetFile = activePath || 'src/App.jsx';
      const fileContent = contents[targetFile] || contents['App.jsx'] || '';

      const res = await api.post('/agent/heal', {
        projectId,
        error: errorMessage,
        source,
        file: targetFile,
        code: fileContent
      });

      if (res.data?.success && res.data?.fixedCode) {
        const healedCode = res.data.fixedCode;
        const confidence = res.data.confidence ?? 0.9;
        const explanation = res.data.explanation || 'Fixed runtime exception in ' + targetFile;

        if (confidence >= 0.8) {
          // High confidence → auto-apply immediately
          applyHealedCode(targetFile, healedCode, explanation);
          setCopilotMessages(prev => prev.map(m => m.id === healMsgId ? {
            ...m,
            content: `### ✅ Autonomous Self-Healing Completed (Confidence: ${Math.round(confidence * 100)}%)\n**Repaired Issue:** ${explanation}\n\nThe file has been updated and the live preview has been restored automatically.`
          } : m));
        } else {
          // Low confidence → show banner for user approval
          setAutoFixBanner({
            error: errorMessage,
            suggestedFix: healedCode,
            explanation,
            confidence,
            targetFile,
            healMsgId
          });
          setCopilotMessages(prev => prev.map(m => m.id === healMsgId ? {
            ...m,
            content: `### ⚠️ Self-Healing Suggestion (Confidence: ${Math.round(confidence * 100)}%)\n**Error:** ${String(errorMessage).slice(0, 120)}\n**Fix:** ${explanation}\n\n*Review and approve the suggested fix in the banner above the preview.*`
          } : m));
          showToast('⚠️ Low-confidence fix suggested — review in the banner', 'warning');
        }
      }
    } catch (err) {
      console.warn('[Self-Healing] Error:', err.message);
    } finally {
      setHealingInProgress(false);
    }
  }, [healingInProgress, activePath, contents, projectId, showToast, applyHealedCode, setCopilotMessages]);

  // Handler for user-approved banner fix
  const handleApplyBannerFix = useCallback(() => {
    if (!autoFixBanner) return;
    applyHealedCode(autoFixBanner.targetFile, autoFixBanner.suggestedFix, autoFixBanner.explanation);
    setCopilotMessages(prev => prev.map(m => m.id === autoFixBanner.healMsgId ? {
      ...m,
      content: `### ✅ Self-Healing Applied (User Approved)\n**Fixed:** ${autoFixBanner.explanation}`
    } : m));
    setAutoFixBanner(null);
  }, [autoFixBanner, applyHealedCode, setCopilotMessages]);

  const handleDismissBannerFix = useCallback(() => {
    setAutoFixBanner(null);
    showToast('Fix dismissed', 'info');
  }, [showToast]);

  // Preview Iframe Auto-Fix & Inspector message listener
  useEffect(() => {
    const handleMessage = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (!iframeRef.current?.contentWindow || e.source !== iframeRef.current.contentWindow) return;
      if (e.data.channel && e.data.channel !== 'ai-dost-preview') return;
      if (e.data.type === 'RUNTIME_ERROR' || e.data.type === 'AUTO_FIX_ERROR') {
        const err = String(e.data.error || 'Unknown runtime error');
        setRuntimeError({ error: err, time: Date.now() });
        handleAutonomousSelfHeal(err, e.data.source);
      } else if (e.data.type === 'VISUAL_ERROR') {
        setRuntimeError({ error: String(e.data.message || 'Blank preview detected'), time: Date.now() });
      } else if (e.data.type === 'PREVIEW_READY') {
        setRuntimeError(null);
      } else if (e.data.type === 'INSPECT_ELEMENT') {
        const target = e.data.element || e.data;
        const { tag = 'element', className = '', text = '', id = '', selector = '', outerHTML = '', styles = {} } = target;
        setSelectedInspectorElement({ tag, className, text, id, selector, outerHTML, styles });
        jumpToMatchingElementInEditor(tag, text, className);

        // Auto-populate chat with element context for "Click to Edit with AI"
        const elementDesc = `<${tag}${id ? '#' + id : ''}${className ? '.' + String(className).split(' ')[0] : ''}>` +
          (text ? ` "${text.slice(0, 30)}"` : '');
        const stylesDesc = styles && Object.keys(styles).length > 0
          ? `\nCurrent styles: ${Object.entries(styles).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ')}`
          : '';
        const prefilledPrompt = `Edit the ${elementDesc} element${stylesDesc}\n\nDescribe what you want to change: `;
        setCopilotInput(prefilledPrompt);
        showToast(`🎯 Selected ${elementDesc} — describe your edit in the chat!`, 'success');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showToast, jumpToMatchingElementInEditor, handleAutonomousSelfHeal]);

  // ── File & Folder CRUD + New Project Handlers ──────────────────────────────
  const handleCreateFile = async (target = '') => {
    let fullPath = '';
    if (typeof target === 'string' && target.trim() && target.includes('.')) {
      fullPath = target.trim();
    } else {
      const parentFolder = typeof target === 'string' ? target.trim() : '';
      const name = window.prompt(parentFolder ? `Create new file inside "${parentFolder}":` : 'Enter new file name (e.g. src/components/Card.jsx):');
      if (!name || !name.trim()) return;
      fullPath = parentFolder ? `${parentFolder}/${name.trim()}` : name.trim();
    }
    fullPath = normalizePath(fullPath);
    if (!fullPath) return;

    // Strict duplicate check (case-insensitive)
    const exists = files.some(f => normalizePath(f.path).toLowerCase() === fullPath.toLowerCase());
    if (exists) {
      showToast(`⚠️ File "${fullPath}" already exists! Opened in editor.`, 'warning');
      setOpenTabs(prev => prev.includes(fullPath) ? prev : [...prev, fullPath]);
      setActivePath(fullPath);
      return;
    }

    try {
      await api.post(`/memory/project/${projectId}/file`, { path: fullPath, content: '' });
      setContents(prev => ({ ...prev, [fullPath]: '' }));
      setFiles(prev => {
        const filtered = prev.filter(f => normalizePath(f.path).toLowerCase() !== fullPath.toLowerCase());
        return [...filtered, { path: fullPath, content: '', lastModified: Date.now() }];
      });
      setOpenTabs(prev => prev.includes(fullPath) ? prev : [...prev, fullPath]);
      setActivePath(fullPath);
      showToast(`📄 Created file ${fullPath}`, 'success');
    } catch (err) {
      showToast(`Create file failed: ${err.message}`, 'error');
    }
  };

  const handleCreateFolder = async (target = '') => {
    let fullPath = '';
    if (typeof target === 'string' && target.trim() && !target.includes('.')) {
      fullPath = target.trim();
    } else {
      const parentFolder = typeof target === 'string' ? target.trim() : '';
      const name = window.prompt(parentFolder ? `Create folder inside "${parentFolder}":` : 'Enter new folder name (e.g. src/utils):');
      if (!name || !name.trim()) return;
      fullPath = parentFolder ? `${parentFolder}/${name.trim()}` : name.trim();
    }
    fullPath = normalizePath(fullPath);
    if (!fullPath) return;

    // Strict duplicate check
    const exists = files.some(f => {
      const p = normalizePath(f.path).toLowerCase();
      return p === fullPath.toLowerCase() || p.startsWith(fullPath.toLowerCase() + '/');
    });
    if (exists) {
      showToast(`⚠️ Folder "${fullPath}" already exists!`, 'warning');
      return;
    }

    try {
      await api.post(`/memory/project/${projectId}/folder`, { path: fullPath });
      const placeholderFile = `${fullPath}/.gitkeep`;
      setContents(prev => ({ ...prev, [placeholderFile]: '' }));
      setFiles(prev => {
        const filtered = prev.filter(f => normalizePath(f.path).toLowerCase() !== placeholderFile.toLowerCase());
        return [...filtered, { path: placeholderFile, content: '', lastModified: Date.now() }];
      });
      showToast(`📁 Created folder ${fullPath}`, 'success');
    } catch (err) {
      showToast(`Create folder failed: ${err.message}`, 'error');
    }
  };

  const handleRename = async (oldPath) => {
    const cleanOld = normalizePath(oldPath);
    const newName = window.prompt(`Rename "${cleanOld}" to:`, cleanOld);
    if (!newName || !newName.trim() || normalizePath(newName) === cleanOld) return;
    const newPath = normalizePath(newName);
    
    // Check collision
    if (files.some(f => normalizePath(f.path).toLowerCase() === newPath.toLowerCase())) {
      showToast(`⚠️ A file named "${newPath}" already exists!`, 'error');
      return;
    }

    try {
      await api.post(`/memory/project/${projectId}/rename`, { oldPath: cleanOld, newPath });
      const oldContent = contents[cleanOld] || '';
      setContents(prev => {
        const next = { ...prev, [newPath]: oldContent };
        delete next[cleanOld];
        return next;
      });
      setFiles(prev => prev.map(f => normalizePath(f.path).toLowerCase() === cleanOld.toLowerCase() ? { ...f, path: newPath } : f));
      setOpenTabs(prev => prev.map(t => normalizePath(t).toLowerCase() === cleanOld.toLowerCase() ? newPath : t));
      if (normalizePath(activePath).toLowerCase() === cleanOld.toLowerCase()) setActivePath(newPath);
      showToast(`✏️ Renamed to ${newPath}`, 'success');
    } catch (err) {
      showToast(`Rename failed: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (filePath) => {
    if (!window.confirm(`Are you sure you want to delete "${filePath}"?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/file`, { data: { path: filePath } });
      setContents(prev => {
        const next = { ...prev };
        delete next[filePath];
        return next;
      });
      setFiles(prev => prev.filter(f => f.path !== filePath));
      setOpenTabs(prev => prev.filter(t => t !== filePath));
      if (activePath === filePath) setActivePath(null);
      showToast(`🗑️ Deleted ${filePath}`, 'info');
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteFolder = async (folderPath) => {
    if (!window.confirm(`Are you sure you want to delete folder "${folderPath}" and all its contents?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/folder`, { data: { path: folderPath } });
      setFiles(prev => prev.filter(f => !f.path.startsWith(folderPath)));
      setContents(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          if (k.startsWith(folderPath)) delete next[k];
        });
        return next;
      });
      setOpenTabs(prev => prev.filter(t => !t.startsWith(folderPath)));
      if (activePath && activePath.startsWith(folderPath)) setActivePath(null);
      showToast(`🗑️ Deleted folder ${folderPath}`, 'info');
    } catch (err) {
      showToast(`Delete folder failed: ${err.message}`, 'error');
    }
  };

  const handleNewProject = async () => {
    if (files.length > 0 && !window.confirm('Start a new project? Current project files will be reset.')) return;
    try {
      await api.delete(`/memory/project/${projectId}`);
      setFiles([]);
      setContents({});
      setOpenTabs([]);
      setActivePath(null);
      setCopilotMessages([]);
      setPlanTasks([]);
      setCopilotStatus({ label: '', tone: 'info' });
      setWorkspaceMode('code');
      showToast('✨ Fresh new project initialized! Select a starter template below.', 'success');
    } catch (err) {
      showToast(`New project error: ${err.message}`, 'error');
    }
  };

  // Ctrl+Shift+P command palette (VS Code style)
  const ideCommands = [
    { label: 'File: Quick Open…', key: 'Ctrl+P', run: () => setQuickOpenOpen(true) },
    { label: 'File: Save active file', key: 'Ctrl+S', run: () => saveActiveFile() },
    { label: 'File: Save all files', run: () => saveAllFiles() },
    { label: 'View: Find in Files…', key: 'Ctrl+Shift+F', run: () => setSearchOpen(true) },
    { label: 'View: Toggle Terminal', run: () => setTerminalOpen(v => !v) },
    { label: 'View: Toggle Sidebar', run: () => setSidebarOpen(v => !v) },
    { label: 'View: Toggle Inspector', run: () => setInspectorOpen(v => !v) },
    { label: 'View: Cycle Split / Code / Preview', key: 'Ctrl+\\', run: () => setWorkspaceMode(m => m === 'split' ? 'code' : m === 'code' ? 'preview' : 'split') },
    { label: 'Run: Start project', key: 'Ctrl+Enter', run: () => handleReplitRun() },
    { label: 'AI: Inline edit selection', key: 'Ctrl+K', run: () => triggerInlineEdit() },
    { label: 'AI: New project wizard', run: () => openProjectWizard('') },
    { label: 'Workspace: Refresh files', run: () => loadWorkspaceFiles(true) },
    { label: 'Workspace: Packages manager', run: () => setPackagesModalOpen(true) },
    { label: 'Workspace: Secrets (.env)', run: () => setSecretsModalOpen(true) },
    { label: 'Workspace: Session history', run: () => setHistoryModalOpen(true) },
    { label: 'Workspace: Snapshots', run: () => setSnapshotMenuOpen(true) },
    { label: 'Deploy: Open deploy modal', run: () => setDeployModalOpen(true) },
    { label: 'Debug: Visual Debugger', run: () => setVisualDebuggerOpen(true) },
  ];

  const planProgressLabel = planTasks.length
    ? `${planTasks.filter(t => t.status === 'completed').length}/${planTasks.length}`
    : '';
  const approxTokens = Math.round(
    copilotMessages.reduce((n, m) => n + (m.content?.length || 0) + (m.file?.length || 0), 0) / 4
  );
  const modelLabel = MODEL_OPTIONS.find(o => o.v === preferredModel)?.l || 'auto';

  return (
    <div className="h-full w-full flex flex-col bg-canvas-base text-paper-100 overflow-hidden font-sans">
      {/* ── TOP ACTION BAR (Linear/Cursor style header) ────────────────────────── */}
      <IdeHeader
        projectName={projectName}
        handleNewSession={handleNewSession}
        handleReplitRun={handleReplitRun}
        isReplitRunning={isReplitRunning}
        workspaceMode={workspaceMode}
        setWorkspaceMode={setWorkspaceMode}
        setHistoryModalOpen={setHistoryModalOpen}
        sessions={sessions}
        setPackagesModalOpen={setPackagesModalOpen}
        setSecretsModalOpen={setSecretsModalOpen}
        openProjectWizard={openProjectWizard}
        saveAllFiles={saveAllFiles}
        dirtyPaths={dirtyPaths}
        projectId={projectId}
        backendUrl={BACKEND}
      />

      {/* ── 2. MASTER 2-COLUMN SPLIT (Left: AI Copilot | Right: Code/Preview) ───── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT PANE: AI COPILOT CHAT & AUTONOMOUS ENGINE ─────────────────── */}
        <aside className="w-[430px] shrink-0 flex flex-col bg-canvas-base border-r border-border z-10">

          {/* Copilot Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-canvas-surface border-b border-border">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute inset-0 animate-ping opacity-75" />
              </div>
              <span className="text-xs font-bold text-paper-100 tracking-wide">Copilot</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen(o => !o)}
                  className="text-[10px] font-mono text-ink-muted bg-canvas-elevated px-2 py-0.5 rounded border border-border hover:border-accent/40 hover:text-paper-200 transition-colors cursor-pointer flex items-center gap-1"
                  title="Preferred model — failure still falls back through the cascade"
                  data-testid="model-picker-btn"
                >
                  <Zap size={9} className="text-accent" />
                  {MODEL_OPTIONS.find(o => o.v === preferredModel)?.l || 'auto'}
                  <ChevronDown size={9} />
                </button>
                {modelMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg bg-canvas-elevated border border-border shadow-surface-card py-1" data-testid="model-menu">
                      {MODEL_OPTIONS.map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => {
                            setPreferredModel(opt.v);
                            try { window.localStorage.setItem('ai_dost_copilot_model', opt.v); } catch (_) { /* ignore */ }
                            setModelMenuOpen(false);
                            showToast(`Model: ${opt.l}`, 'info');
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-canvas-overlay transition-colors flex items-center justify-between ${
                            preferredModel === opt.v ? 'text-accent' : 'text-paper-300'
                          }`}
                        >
                          <span>{opt.l}</span>
                          {preferredModel === opt.v && <Check size={11} />}
                        </button>
                      ))}
                      <div className="px-3 pt-1.5 pb-1 text-[9px] text-ink-muted border-t border-border-subtle mt-1">
                        Fallback cascade stays on
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPlanGate(g => !g)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  planGate
                    ? 'bg-accent/20 text-accent border-accent/40 shadow-xs'
                    : 'bg-canvas-elevated text-ink-muted border-border'
                }`}
                title={planGate ? 'Plan Gate ON (Review plan before execution)' : 'Autopilot ON (Instant execution)'}
              >
                {planGate ? 'Plan first' : 'Run mode'}
              </button>

              <button
                onClick={() => {
                  setCopilotMessages([]);
                  setPendingPlan(null);
                  setPlanTasks([]);
                  showToast('Chat history cleared', 'info');
                }}
                className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                title="Clear Conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Plan Checklist Card (Devin-style) */}
          <CopilotPlanCard
            tasks={planTasks}
            expanded={milestonesExpanded}
            onToggle={() => setMilestonesExpanded(prev => !prev)}
          />

          {/* Chat Messages Scroll Container */}
          <div ref={endRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">

            {/* Empty State: Linear/Cursor Style Hero Starters */}
            {copilotMessages.length === 0 && !pendingPlan && (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-canvas-surface border border-border shadow-surface-card text-center space-y-2">
                  <div className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center bg-accent/10 text-accent border border-accent/20 shadow-glow-sm">
                    <Code2 size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-paper-100 tracking-tight">What would you like to build?</h3>
                  <p className="text-xs text-ink-muted leading-relaxed font-sans">
                    Describe any fullstack web app in plain English or Hindi. Copilot will architect, code, test, and render live preview automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-1 font-mono">
                    Try asking Copilot:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hospital Appointment Booking with Doctor Filters',
                      'Crypto Trading Simulator with Live Portfolio',
                      'Space Rocket Launch Tracker with Timers',
                      'Restaurant Food Delivery with Slide-Over Cart'
                    ].map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(promptText)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
                      >
                        ✨ {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pending Plan Approval Gate */}
            {pendingPlan && (
              <div className="rounded-xl p-4 bg-canvas-surface border border-accent/30 space-y-3 shadow-surface-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Plan ready for approval
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono">Approve to proceed</span>
                </div>
                <div className="space-y-1.5">
                  {pendingPlan.tasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-paper-300 font-mono">
                      <span className="text-accent">▸</span>
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={approvePlan}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play size={12} className="fill-white" /> Approve &amp; Build
                  </button>
                  <button
                    onClick={cancelPlan}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium bg-canvas-elevated hover:bg-canvas-overlay text-paper-300 border border-border transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Chat Timeline */}
            {copilotMessages.map((m, i) => {
              if (m.kind === 'thought') {
                return (
                  <div key={i} className="flex gap-2 text-[11px] font-mono bg-canvas-subtle/70 px-3 py-2 rounded-lg border border-border-subtle">
                    <Sparkles size={12} className="text-accent/70 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-ink-muted block text-[9px] uppercase tracking-wider">{m.agent || 'thinking'}</span>
                      <span className="text-paper-300 break-words whitespace-pre-wrap">{m.content}</span>
                    </div>
                    <span className="ml-auto shrink-0 self-start text-[9px] font-mono text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                  </div>
                );
              }
              if (m.kind === 'tool') {
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-paper-300 bg-canvas-subtle/70 px-3 py-2 rounded-lg border border-border-subtle">
                    <Zap size={12} className="text-accent shrink-0" />
                    <span className="truncate">{stripEmoji(typeof m.label === 'object' ? JSON.stringify(m.label) : String(m.label || ''))}</span>
                    <span className="ml-auto shrink-0 text-[9px] text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                  </div>
                );
              }
              if (m.kind === 'file') {
                const hasStats = typeof m.added === 'number' || typeof m.removed === 'number';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => m.file && selectFile(m.file)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-canvas-subtle/70 hover:border-accent/40 hover:bg-accent/[0.06] transition-colors cursor-pointer text-left group"
                    title={m.file ? `Open ${m.file} in editor` : undefined}
                    data-testid="chat-file-row"
                  >
                    <FileDiff size={12} className="text-accent shrink-0" />
                    <span className="flex-1 min-w-0 text-[11px] font-mono text-paper-300 truncate">
                      {m.file || m.content}
                    </span>
                    {m.isNew && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 shrink-0">NEW</span>
                    )}
                    {hasStats && (
                      <span className="flex items-center gap-1 text-[10px] font-mono tabular-nums shrink-0">
                        {typeof m.added === 'number' && <span className="text-emerald-500">+{m.added}</span>}
                        {typeof m.removed === 'number' && <span className="text-red-400">-{m.removed}</span>}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-ink-muted tabular-nums shrink-0">{fmtTs(m.ts)}</span>
                    <ChevronRight size={12} className="text-ink-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                  </button>
                );
              }
              if (m.kind === 'step') {
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-ink-muted px-2 py-1">
                    <span className="text-accent/60 shrink-0">▸</span>
                    <span className="truncate">{typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content || '')}</span>
                    <span className="ml-auto shrink-0 text-[9px] tabular-nums">{fmtTs(m.ts)}</span>
                  </div>
                );
              }
              if (m.kind === 'screenshot') {
                return (
                  <div key={i} className="space-y-2 p-3 rounded-xl bg-canvas-surface border border-border">
                    <span className="text-[11px] font-mono text-ink-muted flex items-center gap-1.5">
                      {m.message}
                    </span>
                    {m.image && m.image.length > 30 && !m.image.endsWith('undefined') && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="Live App UI" className="rounded-lg border border-border w-full object-cover" />
                    )}
                  </div>
                );
              }
              if (m.kind === 'aistudio_card') {
                return (
                  <AiStudioResponseCard
                    key={i}
                    message={m}
                    onSelectFile={selectFile}
                    onOpenDiff={() => setDiffOpen(true)}
                    onRollback={rollbackTo}
                    onOpenPreview={() => setWorkspaceMode('preview')}
                  />
                );
              }
              if (m.role === 'user') {
                return (
                  <div key={i} className="flex flex-col items-end gap-1.5">
                    {Array.isArray(m.images) && m.images.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap justify-end max-w-[85%]">
                        {m.images.map((imgSrc, imgIdx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={imgIdx}
                            src={imgSrc}
                            alt="Attached reference"
                            className="max-h-36 max-w-[220px] rounded-xl border border-white/20 shadow-md object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => window.open(imgSrc, '_blank')}
                          />
                        ))}
                      </div>
                    )}
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed bg-accent/15 border border-accent/30 text-paper-100 whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (!m.content || !m.content.trim()) {
                return null;
              }
              return (
                <div key={i} className="flex gap-2.5 items-start">
                  <div className="w-6 h-6 mt-0.5 rounded-md flex items-center justify-center shrink-0 bg-canvas-elevated border border-border text-ink-muted">
                    <Bot size={12} />
                  </div>
                  <div
                    className="max-w-[92%] px-3.5 py-2.5 rounded-xl rounded-tl-sm text-xs leading-relaxed bg-canvas-surface border border-border text-paper-200 space-y-1"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(m.content || '')) }}
                  />
                </div>
              );
            })}
          </div>

          {/* Live Status Strip (Devin-style: current action + elapsed timer) */}
          <CopilotStatusBar running={running} status={copilotStatus} elapsedSec={elapsedSec} />

          {/* Floating Prompt Composer */}
          <div className="p-3 bg-canvas-surface border-t border-border">
            <div className="relative rounded-xl bg-canvas-elevated border border-border focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/10 transition-all shadow-surface-card flex flex-col overflow-hidden">
              {/* Active Visual Inspector Target Chip */}
              {selectedInspectorElement && (
                <div className="flex items-center justify-between px-3 py-1 bg-accent/15 border-b border-accent/25 text-[11px] font-mono text-accent">
                  <span className="truncate flex items-center gap-1.5">
                    <Crosshair size={12} className="text-accent shrink-0" />
                    <span>Target: &lt;{selectedInspectorElement.tag}&gt;</span>
                    {selectedInspectorElement.text && (
                      <span className="text-paper-200 truncate">&quot;{selectedInspectorElement.text.slice(0, 25)}&quot;</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedInspectorElement(null)}
                    className="text-ink-muted hover:text-paper-100 p-0.5 ml-2 cursor-pointer"
                    title="Clear element selection"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Attached / Pasted Images Chips (Ctrl+V) */}
              {pastedImages.length > 0 && (
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 flex-wrap bg-canvas-base/80 border-b border-border/50">
                  {pastedImages.map(img => (
                    <div
                      key={img.id}
                      className="relative group rounded-lg overflow-hidden border border-accent/40 bg-accent/10 flex items-center gap-2 pr-2 animate-in fade-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt={img.name} className="w-8 h-8 object-cover rounded-l-md border-r border-accent/20" />
                      <div className="flex flex-col min-w-0 max-w-[120px]">
                        <span className="text-[10px] text-paper-100 font-medium truncate">{img.name}</span>
                        <span className="text-[8px] text-ink-muted font-mono">{img.size}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPastedImages(prev => prev.filter(p => p.id !== img.id))}
                        className="w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-[10px] cursor-pointer transition-colors"
                        title="Remove image"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <span className="text-[10px] text-accent/80 font-mono flex items-center gap-1">
                    <Sparkles size={11} /> Multimodal Prompt Active
                  </span>
                </div>
              )}

              <textarea
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((copilotInput.trim() || pastedImages.length > 0) && !running) handleSend();
                  }
                }}
                rows={2}
                placeholder="Message Copilot — build, edit, or paste a screenshot (Ctrl+V)…"
                className="w-full bg-transparent px-3.5 pt-3 pb-2 text-xs text-paper-100 placeholder:text-ink-muted focus:outline-none resize-none font-sans leading-relaxed"
              />

              {/* Voice Waveform Visualizer */}
              {isListening && (
                <div className="flex items-center gap-0.5 px-3 py-1.5 border-t border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-[3px] h-5">
                    {voiceWaveform.map((level, i) => (
                      <div
                        key={i}
                        className="w-[3px] rounded-full bg-red-400 transition-all duration-75"
                        style={{ height: `${Math.max(4, level * 0.2)}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-red-400 font-medium ml-2 animate-pulse">🎙️ Listening... Speak naturally</span>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}

              {/* Footer toolbar inside box */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-canvas-surface/50 rounded-b-xl">
                {/* Quick Context / Tool Chips */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition-all ${
                      isListening
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                        : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated'
                    }`}
                    title="🎙️ Voice-to-Code: Speak in Hindi, Hinglish or English to generate code"
                  >
                    {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  </button>

                  <label
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Attach screenshot or image (or Ctrl+V directly)"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>

                  <button
                    type="button"
                    onClick={() => { setTerminalOpen(!terminalOpen); setBottomPanelTab('terminal'); }}
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Toggle Terminal"
                  >
                    <TerminalIcon className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTerminalOpen(true); setBottomPanelTab('database'); }}
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Open Database Explorer"
                  >
                    <Database className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Submit Action */}
                <div className="flex items-center gap-2">
                  {healCount > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <Wrench size={9} /> {healCount} healed
                    </span>
                  )}
                  <span className="text-[10px] text-ink-muted font-mono hidden sm:inline-flex items-center gap-1">
                    <kbd className="px-1 py-px rounded border border-border-subtle bg-canvas-base text-[9px]">↵</kbd> send
                    <kbd className="px-1 py-px rounded border border-border-subtle bg-canvas-base text-[9px]">⇧↵</kbd> line
                  </span>
                  <button
                    onClick={() => handleSend()}
                    disabled={(!copilotInput.trim() && pastedImages.length === 0) || running}
                    className="w-7 h-7 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:hover:bg-accent text-white flex items-center justify-center transition-all shadow-glow-sm cursor-pointer"
                  >
                    {running ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp className="w-4 h-4 stroke-[2.5]" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANE: WORKSPACE (Code Editor OR Live Preview) ──────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-canvas-base">

          {/* ── Helper Renderers for Split & Fullscreen Views ─────────── */}
          {(() => {
            const renderEditorPane = () => (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 w-full h-full">
                {/* Workspace Tabs & Rail Toggle */}
                <div className="flex items-center bg-canvas-subtle border-b border-border">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="px-2.5 h-8 border-r border-border text-ink-muted hover:text-paper-100 hover:bg-canvas-surface cursor-pointer transition-fast flex items-center justify-center flex-shrink-0"
                    title={sidebarOpen ? 'Hide Files' : 'Show Files'}
                  >
                    <FolderTree size={14} />
                  </button>
                  <WorkspaceTabs
                    tabs={openTabs}
                    activePath={activePath}
                    modifiedPaths={dirtyPaths}
                    onSelectTab={selectFile}
                    onCloseTab={closeTab}
                    onNewTab={() => handleCreateFile()}
                    className="flex-1 min-w-0 border-b-0"
                  />
                </div>

                {/* Editor Breadcrumb & Toolbar */}
                {activePath && (
                  <EditorToolbar
                    activePath={activePath}
                    isModified={dirtyPaths.has(activePath)}
                    isSaving={saving}
                    onSave={saveActiveFile}
                    onFormat={() => formatFile()}
                    onTogglePreview={() => setWorkspaceMode(workspaceMode === 'preview' ? 'code' : 'preview')}
                    showPreview={workspaceMode === 'preview' || workspaceMode === 'split'}
                    onToggleDiff={() => setDiffModalOpen(true)}
                    showDiff={diffModalOpen}
                    onToggleInspector={() => setInspectorOpen(prev => !prev)}
                    showInspector={inspectorOpen}
                    onAiAction={(action) => handleSend(`${action === 'explain' ? 'Explain how' : action === 'fix' ? 'Find and fix bugs in' : 'Refactor'} ${activePath}`)}
                  />
                )}

                {/* Editor + File Tree Split */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                  {/* File Explorer Panel */}
                  {sidebarOpen && (
                    <FileExplorer
                      files={files}
                      activePath={activePath}
                      onSelectFile={selectFile}
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onDeleteFile={handleDelete}
                      onRefresh={loadWorkspaceFiles}
                      loading={loadingFiles}
                      className="w-52 flex-shrink-0"
                    />
                  )}

                  {/* Monaco Editor Container */}
                  <div className="flex-1 min-w-0 min-h-0 relative bg-canvas-base flex flex-col">
                    {/* Smart Missing Dependency Detector & 1-Click Installer */}
                    {detectedMissingPackages.length > 0 && (
                      <div className="bg-indigo-950/90 border-b border-indigo-500/40 px-3 py-1.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1 z-20 shrink-0">
                        <div className="flex items-center gap-2 text-indigo-200 min-w-0">
                          <Package size={14} className="text-indigo-400 shrink-0 animate-pulse" />
                          <span className="truncate">Missing packages detected:</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {detectedMissingPackages.map(pkg => (
                              <span key={pkg} className="px-1.5 py-0.2 rounded bg-indigo-900/90 text-indigo-200 font-mono text-[10px] border border-indigo-500/30">
                                {pkg}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleInstallMissingPackages(detectedMissingPackages)}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs shrink-0"
                        >
                          <Zap size={11} />
                          Install to Project
                        </button>
                      </div>
                    )}

                    <div className="flex-1 min-h-0 relative">
                      {activePath ? (
                        <MonacoEditor
                          height="100%"
                          language={activeLang}
                          value={activeContent}
                          onMount={handleEditorMount}
                          onChange={(v) => {
                            if (!activePath) return;
                            setFileContent(activePath, v || '');
                            markDirty(activePath);
                            // eslint-disable-next-line react-hooks/refs
                            runDiagnostics(activePath, v || '');
                          }}
                          theme="aidost-dark"
                          options={{
                            automaticLayout: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            fontSize: 13,
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: { top: 12 },
                            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                          }}
                        />
                      ) : (
                        files.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
                            <div className="max-w-md w-full space-y-4">
                              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center mx-auto text-accent shadow-xs">
                                <Sparkles size={24} />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-paper-100">Empty Workspace</h3>
                                <p className="text-xs text-ink-muted mt-1">
                                  Choose a modern starter framework below or prompt Copilot to build your app
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5 text-left">
                                {STARTER_TEMPLATES.map((tmpl) => (
                                  <button
                                    key={tmpl.id}
                                    onClick={() => handleSend(tmpl.prompt)}
                                    className="p-3 rounded-xl bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-accent/50 transition-all cursor-pointer group text-left space-y-1 shadow-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-paper-100 group-hover:text-accent transition-colors truncate">
                                        {tmpl.title}
                                      </span>
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/15 text-accent border border-accent/20 shrink-0">
                                        {tmpl.badge}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-ink-muted line-clamp-2 leading-relaxed">
                                      {tmpl.desc}
                                    </p>
                                  </button>
                                ))}
                              </div>

                              <div className="pt-2 flex items-center justify-center gap-3">
                                <button
                                  onClick={() => handleCreateFile('index.html')}
                                  className="px-3 py-1.5 rounded-lg bg-canvas-elevated hover:bg-canvas-surface border border-border text-paper-200 text-xs font-medium cursor-pointer transition-colors"
                                >
                                  📄 Blank index.html
                                </button>
                                <button
                                  onClick={() => openProjectWizard()}
                                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  ✨ Open App Wizard
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center gap-3 text-xs text-ink-muted select-none">
                            <Code2 size={28} className="text-ink-muted/40" />
                            <p>Select a file from the explorer on the left</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* AI Inspector & Action Verifier Panel */}
                  {inspectorOpen && (
                    <AiInspector
                      activePath={activePath}
                      activeContent={activeContent}
                      selectedCode={selectedCode}
                      isOpen={true}
                      onClose={() => setInspectorOpen(false)}
                      onRunAiTask={handleSend}
                      className="w-80 flex-shrink-0 border-l border-border h-full"
                    />
                  )}
                </div>

                {/* Integrated Bottom Panel: Terminal + Database Explorer */}
                {terminalOpen && (
                  <div className="h-56 shrink-0 flex flex-col bg-canvas-base border-t border-border">
                    {/* Tab Switcher Header */}
                    <div className="flex items-center justify-between px-3 py-1 bg-canvas-subtle border-b border-border text-xs font-mono">
                      <div className="flex items-center gap-0">
                        <button
                          onClick={() => setBottomPanelTab('terminal')}
                          className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                            bottomPanelTab === 'terminal'
                              ? 'text-paper-100 border-accent bg-canvas-surface/50'
                              : 'text-ink-muted border-transparent hover:text-paper-200 hover:bg-canvas-surface/30'
                          }`}
                        >
                          <TerminalIcon size={12} /> Terminal
                        </button>
                        <button
                          onClick={() => setBottomPanelTab('database')}
                          className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                            bottomPanelTab === 'database'
                              ? 'text-paper-100 border-amber-400 bg-amber-500/5'
                              : 'text-ink-muted border-transparent hover:text-paper-200 hover:bg-canvas-surface/30'
                          }`}
                        >
                          <Database size={12} /> Database
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {bottomPanelTab === 'terminal' && (
                          <>
                            <button
                              onClick={runSingleFile}
                              className="px-2 py-0.5 rounded-xs text-[10px] font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 border border-border cursor-pointer transition-fast"
                            >
                              <Play size={10} className="inline mr-1" /> Run File
                            </button>
                            <button
                              onClick={() => terminalRef.current?.clear()}
                              className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                              title="Clear Terminal"
                            >
                              <Eraser size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setTerminalOpen(false)}
                          className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                          title="Close Panel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      {bottomPanelTab === 'terminal' ? (
                        <TerminalPanel innerRef={terminalRef} projectId={projectId} projectPath="" />
                      ) : (
                        <VisualDatabaseExplorer projectId={projectId} onToast={showToast} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );

            const renderPreviewPane = () => (
              <PreviewPane
                devServerStatus={devServerStatus}
                devServerLoading={devServerLoading}
                handleStartDevServer={handleStartDevServer}
                handleRestartDevServer={handleRestartDevServer}
                handleStopDevServer={handleStopDevServer}
                previewDevice={previewDevice}
                setPreviewDevice={setPreviewDevice}
                previewZoom={previewZoom}
                setPreviewZoom={setPreviewZoom}
                inspectorActive={inspectorActive}
                setInspectorActive={setInspectorActive}
                setSelectedInspectorElement={setSelectedInspectorElement}
                visualDebuggerOpen={visualDebuggerOpen}
                setVisualDebuggerOpen={setVisualDebuggerOpen}
                previewSourceMode={previewSourceMode}
                setPreviewSourceMode={setPreviewSourceMode}
                iframeRef={iframeRef}
                projectId={projectId}
                files={files}
                contents={contents}
                showToast={showToast}
                setDeployModalOpen={setDeployModalOpen}
                handleSend={handleSend}
                running={running}
                autoFixBanner={autoFixBanner}
                handleApplyBannerFix={handleApplyBannerFix}
                handleDismissBannerFix={handleDismissBannerFix}
                runtimeError={runtimeError}
                setRuntimeError={setRuntimeError}
                handleAutoFixRuntimeError={handleAutoFixRuntimeError}
                healingInProgress={healingInProgress}
                qaStatus={qaStatus}
              />
            );

            if (workspaceMode === 'code') {
              return renderEditorPane();
            }
            if (workspaceMode === 'preview') {
              return renderPreviewPane();
            }
            // Default: 'split' mode (Replit-style dual-pane layout)
            return (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 w-full h-full">
                <div className="w-full md:w-1/2 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-border h-full">
                  {renderEditorPane()}
                </div>
                <div className="w-full md:w-1/2 flex flex-col min-w-0 bg-canvas-base h-full">
                  {renderPreviewPane()}
                </div>
              </div>
            );
          })()}
        </main>
      </div>

      {/* ── 3. FLOATING MODALS & OVERLAYS ──────────────────────────────────────── */}
      {/* Ctrl+K Floating Inline AI Prompt Box */}
      {inlineEditOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-[#12141e] border border-indigo-500/40 rounded-2xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Cursor-Style Inline AI (Ctrl+K)</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{activePath || 'active file'}</span>
            </div>
            <form onSubmit={handleInlineEditSubmit} className="flex gap-2">
              <input
                autoFocus
                value={inlineEditPrompt}
                onChange={(e) => setInlineEditPrompt(e.target.value)}
                placeholder="e.g. Add validation, optimize logic, make responsive..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!inlineEditPrompt.trim() || inlineEditLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-40 cursor-pointer"
              >
                {inlineEditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Apply
              </button>
              <button
                type="button"
                onClick={() => setInlineEditOpen(false)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Esc
              </button>
            </form>
            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Surgically edits selected code block</span>
              <span>Enter = Apply • Esc = Cancel</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Project Architect Wizard Modal */}
      <ProjectWizardModal
        isOpen={wizardOpen}
        initialPrompt={wizardInitialPrompt}
        onClose={() => setWizardOpen(false)}
        onBuildProject={handleWizardBuild}
      />

      {/* 1-Click Deploy Modal */}
      <DeployModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        projectId={projectId}
        onToast={showToast}
      />

      {/* Diff Review Modal */}
      {diffOpen && latestRunId && (
        <DiffReviewModal
          isOpen={diffOpen}
          onClose={() => setDiffOpen(false)}
          runId={latestRunId}
          onReverted={loadWorkspaceFiles}
        />
      )}

      {/* Replit Package Manager Modal */}
      <PackagesModal
        isOpen={packagesModalOpen}
        onClose={() => setPackagesModalOpen(false)}
        packageJsonContent={contents['package.json'] || ''}
        onUpdatePackageJson={handleUpdatePackageJson}
        onRunCommand={handleTerminalCommand}
      />

      {/* Replit Secrets (.env) Manager Modal */}
      <SecretsModal
        isOpen={secretsModalOpen}
        onClose={() => setSecretsModalOpen(false)}
        envContent={contents['.env'] || contents['.env.local'] || ''}
        onSaveEnv={handleSaveEnv}
      />

      {/* Copilot Session History Modal */}
      <CopilotHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onDuplicateSession={handleDuplicateSession}
      />

      {/* IDE Overlays — QuickOpen (Ctrl+P), CommandPalette (Ctrl+Shift+P), SearchOverlay (Ctrl+Shift+F) */}
      {quickOpenOpen && (
        <QuickOpen
          files={files}
          onPick={(f) => { setQuickOpenOpen(false); selectFile(f.path); }}
          onClose={() => setQuickOpenOpen(false)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          commands={ideCommands}
          onRun={(c) => { setPaletteOpen(false); if (c && typeof c.run === 'function') c.run(); }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      {searchOpen && (
        <SearchOverlay
          q={searchQuery}
          onQueryChange={setSearchQuery}
          caseSensitive={searchCase}
          onCaseChange={setSearchCase}
          results={searchResults}
          searching={searching}
          onPick={(r) => { setSearchOpen(false); selectFile(r.path); }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* ── 4. STATUS BAR ──────────────────────────────────────────────────────── */}
      <IdeFooter
        activePath={activePath}
        handleAutoFixProblems={handleAutoFixProblems}
        running={running}
        problems={problems}
        stepLabel={planProgressLabel}
        approxTokens={approxTokens}
        elapsedSec={elapsedSec}
        modelLabel={modelLabel}
      />
    </div>
  );
}