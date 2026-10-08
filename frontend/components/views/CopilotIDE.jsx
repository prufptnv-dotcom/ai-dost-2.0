import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import AppIcon from '../ui/AppIcon';
import api from '../../services/api';
import { isImageCreateRequest } from '../../lib/imageIntent';
import { runCopilotImageRequest } from '../../lib/copilotImageRequest';
import { cancelAgentRun } from '../../lib/copilotStop';
import { saveBgRun, clearBgRun, loadBgRun, attachRunEvents, eventToActions } from '../../lib/backgroundRun';
import { bindCurrentModel, unbindProject, subscribeParticipants } from '../../lib/collabClient';
import { filePathOf, detectMention, parseMentionPaths } from '../../lib/copilotMentions';
import { LANG_BY_EXT, TreeView, fileTreeFromFiles } from './CopilotTree';
import { PromptModal, QuickOpen, CommandPalette, SearchOverlay, MODAL_ICONS } from './IDEOverlays';
import DiffReviewModal from './DiffReviewModal';
import ProjectWizardModal from './ProjectWizardModal';
import DeployModal from './DeployModal';
import CopilotPlanCard from '../ide/CopilotPlanCard';
import CopilotStatusBar, { stripEmoji } from '../ide/CopilotStatusBar';
import CopilotMarkdown from '../ide/CopilotMarkdown';
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

function isPathInFolder(filePath, folderPath) {
  const file = normalizePath(filePath).toLowerCase();
  const folder = normalizePath(folderPath).toLowerCase().replace(/\/+$/, '');
  return Boolean(file && folder && (file === folder || file.startsWith(`${folder}/`)));
}

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
  { v: 'openrouter', l: 'OpenRouter first' },
  { v: 'openrouter:nemotron_3_super', l: 'Nemotron 3 Super' },
  { v: 'openrouter:north_mini_code', l: 'Cohere North Code' },
  { v: 'openrouter:laguna_s', l: 'Laguna-S Agent' },
  { v: 'openrouter:lfm_reasoning', l: 'Liquid LFM 2.5' },
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

  return (
    <div className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-accent text-white shadow-md">
        <AppIcon name="code" size={15} />
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
          <CopilotMarkdown
            text={content}
            className="ai-studio-markdown text-xs leading-relaxed text-paper-200 space-y-2.5"
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
            <AppIcon name="compare" size={12} className="text-amber-400" />
            Review Diff
          </button>

          <button
            onClick={onOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold cursor-pointer transition-colors"
          >
            <AppIcon name="play" size={11} className="fill-white" />
            Live Preview
          </button>

          {message.checkpointDir && (
            <button
              onClick={() => onRollback && onRollback(message.checkpointDir)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium cursor-pointer transition-colors border border-red-500/30"
            >
              <AppIcon name="rotate" size={12} className="text-red-400" />
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
  const [workspaceMode, setWorkspaceMode] = useState(() => {
    try {
      const override = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ai_dost_copilot_mode_override') : null;
      if (override) {
        sessionStorage.removeItem('ai_dost_copilot_mode_override');
        return override;
      }
    } catch (_) {}
    return 'split';
  });
  useEffect(() => {
    try {
      const override = sessionStorage.getItem('ai_dost_copilot_mode_override');
      if (override) {
        sessionStorage.removeItem('ai_dost_copilot_mode_override');
        setWorkspaceMode(override);
      }
    } catch (_) {}
    const handleSetMode = (e) => {
      if (e.detail?.mode) setWorkspaceMode(e.detail.mode);
    };
    window.addEventListener('ai_dost_set_workspace_mode', handleSetMode);
    return () => window.removeEventListener('ai_dost_set_workspace_mode', handleSetMode);
  }, []);

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
  // Devin-style @file mentions: active query after '@' + highlighted index.
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const composerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [problems, setProblems] = useState(0);
  const [copilotStatus, setCopilotStatus] = useState({ label: '', tone: 'info' });
  // Preferred model (rotates cascade order server-side; fallback always active)
  const [preferredModel, setPreferredModel] = useState('auto');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  // Visual QA badge: idle → running → passed/failed (from director_verification)
  const [qaStatus, setQaStatus] = useState('idle');
  // Devin-style preview console drawer (iframe console.log / errors)
  const [previewLogs, setPreviewLogs] = useState([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Chat: click a file row → inline unified diff; thought rows collapsible
  const [expandedDiffIdx, setExpandedDiffIdx] = useState(null);
  const [openThoughts, setOpenThoughts] = useState(() => new Set());
  const toggleThought = (idx) => setOpenThoughts((prev) => {
    const nextSet = new Set(prev);
    if (nextSet.has(idx)) nextSet.delete(idx);
    else nextSet.add(idx);
    return nextSet;
  });
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
  // Devin-style agent mode: ask = answer only (no files), plan = review & edit
  // the plan before building, code = autonomous execution (default).
  const [agentMode, setAgentMode] = useState('code');
  // Devin-style permission level: ask = approve every run, auto = canonical
  // policy, turbo = auto-approve (BLOCK still blocks).
  const [permissionLevel, setPermissionLevel] = useState('auto');
  // P9: background runs outlive this socket (refresh / tab close) — persisted
  // per-device, applied to the next /api/agent/run body.
  const [runInBackground, setRunInBackground] = useState(() => {
    try { return window.localStorage.getItem('ai_dost_copilot_background') === '1'; } catch (_) { return false; }
  });
  // Devin-style watch mode: SSE (GET /api/agent/watch/:projectId) live-pushes
  // workspace file changes → auto-refresh tree + activity rows without polling.
  const [watching, setWatching] = useState(false);
  const watchSourceRef = useRef(null);
  const watchDebounceRef = useRef(null);
  // Self-learning memory: durable notes (user-level — survive project delete)
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryNotes, setMemoryNotes] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);
  // P8: multiplayer presence — other humans + the agent participant (from the
  // shared Yjs doc's awareness; deduped so cursor moves don't re-render).
  const [collabPeers, setCollabPeers] = useState([]);

  const loadMemoryNotes = async () => {
    try {
      const res = await api.get('/copilot/memory/list?limit=40');
      setMemoryNotes(res.data?.notes || []);
      if (typeof res.data?.total === 'number') setMemoryCount(res.data.total);
    } catch (_) { /* panel stays empty offline */ }
  };
  const deleteMemoryNote = async (id) => {
    try {
      await api.delete(`/copilot/memory/${id}`);
      await loadMemoryNotes();
    } catch (_) { /* ignore */ }
  };
  const clearMemoryNotes = async () => {
    try {
      await api.delete('/copilot/memory/clear');
      await loadMemoryNotes();
    } catch (_) { /* ignore */ }
  };
  const [pendingPlan, setPendingPlan] = useState(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('ai_dost_copilot_model');
      if (saved && MODEL_OPTIONS.some(o => o.v === saved)) setPreferredModel(saved);
      const savedMode = window.localStorage.getItem('ai_dost_copilot_mode');
      if (savedMode === 'ask' || savedMode === 'plan' || savedMode === 'code') setAgentMode(savedMode);
      const savedPerm = window.localStorage.getItem('ai_dost_copilot_permissions');
      if (savedPerm === 'ask' || savedPerm === 'auto' || savedPerm === 'turbo') setPermissionLevel(savedPerm);
      if (window.localStorage.getItem('ai_dost_copilot_watch') === '1') setWatching(true);
    } catch (_) { /* storage unavailable */ }
  }, []);

  // Learning-notes badge count (panel loads the full list on open)
  useEffect(() => {
    let alive = true;
    api.get('/copilot/memory/count')
      .then((res) => {
        if (alive && typeof res.data?.count === 'number') setMemoryCount(res.data.count);
      })
      .catch(() => { /* backend offline */ });
    return () => { alive = false; };
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
  const [previewSourceMode, setPreviewSourceMode] = useState('auto'); // 'auto' | 'live' | 'instant' | 'mock'
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
  const [promptModal, setPromptModal] = useState(null);

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
  const runTaskIdRef = useRef(null);
  // Id of the pre-run time-travel snapshot created for the CURRENT run —
  // attached to done cards as checkpointDir so the Revert button works.
  const preRunCheckpointRef = useRef(null);
  // Last run inputs — lets the approval banner resume a paused 'ask' run.
  const lastRunRef = useRef(null);
  const activePathRef = useRef(null);
  const endRef = useRef(null);
  const diagTimerRef = useRef(null);
  const [visualDebuggerOpen, setVisualDebuggerOpen] = useState(false);
  const [editorTick, setEditorTick] = useState(0);

  // P8: presence subscription — dedupe by identity signature (awareness
  // 'change' fires on every remote cursor move; never re-render for those).
  useEffect(() => {
    if (!projectId) return undefined;
    let lastSig = '';
    const unsub = subscribeParticipants(projectId, list => {
      const sig = list.map(p => `${p.clientId}:${p.name}:${p.agent ? 1 : 0}:${p.editing || ''}`).join('|');
      if (sig === lastSig) return;
      lastSig = sig;
      setCollabPeers(list);
    });
    return unsub;
  }, [projectId]);

  // P8: bind the editor to the shared Yjs doc for the active file. Cleanup
  // disposes the binding on file switch/unmount so one model is never driven
  // by two Y.Texts. (Single Monaco model — no `path` prop — so rebind here.)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !projectId || !activePath) return undefined;
    bindCurrentModel(projectId, editor, activePath);
    return () => { unbindProject(projectId); };
  }, [projectId, activePath, editorTick]);

  // Devin-style Stop: abort the local stream AND cancel server-side so the
  // director loop (signal.aborted) actually halts instead of running headless.
  // Declared early because the global hotkey effect (Esc → stop) runs above it.
  const handleStopRun = useCallback(() => {
    const taskId = runTaskIdRef.current;
    cancelAgentRun({ backend: BACKEND, taskId, controller: abortRef.current });
    setCopilotStatus({ label: '⏹ Stopped by user', tone: 'error' });
    setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: '⏹ Run stopped by user — agent halted at the current step.' }]);
    setRunning(false);
  }, [setCopilotMessages]);

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
        voiceAnimFrameRef.current = setTimeout(animate, 33); // ~30fps cap
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
      } else if (e.key === 'Escape' && running && !paletteOpen && !quickOpenOpen && !searchOpen) {
        // Devin-style: Esc stops a running agent (unless an overlay owns Escape)
        e.preventDefault();
        handleStopRun();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [handleReplitRun, handleStopRun, running, paletteOpen, quickOpenOpen, searchOpen]);

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
    let rafId = null;
    const request = () => { rafId = window.requestAnimationFrame(() => { if (endRef.current) { endRef.current.scrollTop = endRef.current.scrollHeight; } }); };
    request(); // initial
    return () => { if (rafId) window.cancelAnimationFrame(rafId); };
  }, [copilotMessages, copilotStatus, planTasks, endRef]);

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
  // Guard vs. async session-hydrate race: hydrateSessions() awaits
  // /copilot/sessions and can resolve AFTER loadWorkspaceFiles() has already
  // populated the workspace from the API — its empty-files branch must never
  // wipe API-loaded files/tabs (performance entries proved the ordering:
  // sessions +319ms vs memory +271ms → restore landed last → FILES(0)).
  const workspaceLoadedRef = useRef(false);

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

        let target = null;
        if (defaultProjectId) {
          target = parsed.find(s => s.id === defaultProjectId);
          if (!target) {
            target = {
              id: defaultProjectId,
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
            parsed.unshift(target);
            localStorage.setItem('copilot_sessions_v2', JSON.stringify(parsed));
          }
        } else {
          const currentId = localStorage.getItem('copilot_current_session_id');
          target = parsed.find(s => s.id === currentId) || parsed[0];
        }

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
          if (!workspaceLoadedRef.current) {
            // Workspace API hasn't answered yet: session snapshot = fast fallback.
            setFiles(target.files);
            const targetContents = target.contents || {};
            contentsRef.current = targetContents;
            setContents(targetContents);
            setOpenTabs(target.openTabs || (target.files[0] ? [target.files[0].path] : []));
            setActivePath(target.activePath || (target.files[0] ? target.files[0].path : null));
            activePathRef.current = target.activePath || (target.files[0] ? target.files[0].path : null);
          } else {
            // API files are already live: a stored snapshot must never clobber
            // them (it can be stale — or poisoned by an old doc-bind bug that
            // wrote CSS into src/App.jsx). Restore only the tab layout,
            // filtered to paths that actually exist in the loaded workspace.
            const known = contentsRef.current;
            const tabs = (target.openTabs || []).filter((p) => known[p] !== undefined);
            if (tabs.length) setOpenTabs(tabs);
            const path = target.activePath && known[target.activePath] !== undefined ? target.activePath : null;
            if (path) {
              setActivePath(path);
              activePathRef.current = path;
            }
          }
          if (target.messages && target.messages.length > 0) setCopilotMessages(target.messages);
          else setCopilotMessages([]);
          if (target.workspaceMode) setWorkspaceMode(target.workspaceMode);
          if (target.previewDevice) setPreviewDevice(target.previewDevice);
          if (target.planTasks) setPlanTasks(target.planTasks);
          else setPlanTasks([]);
          if (target.snapshots) setSnapshots(target.snapshots);
          else setSnapshots([]);
        } else {
          if (!workspaceLoadedRef.current) {
            setFiles([]);
            contentsRef.current = {};
            setContents({});
            setOpenTabs([]);
            setActivePath(null);
            activePathRef.current = null;
          }
          setCopilotMessages(target.messages && target.messages.length > 0 ? target.messages : []);
          setPlanTasks(target.planTasks || []);
          setSnapshots(target.snapshots || []);
          setDirtyPaths(new Set());
          setRuntimeError(null);
          setSelectedInspectorElement(null);
          setCopilotStatus({ label: '', tone: 'info' });
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
    contentsRef.current = {};
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
    setDirtyPaths(new Set());

    setActiveSessionId(newId);
    const listWithNew = [newSession, ...sessionsRef.current];
    sessionsRef.current = listWithNew;
    setSessions(listWithNew);
    try {
      localStorage.setItem('copilot_current_session_id', newId);
      localStorage.setItem('ai_dost_session_id', newId);
      window.dispatchEvent(new CustomEvent('ai_dost_new_chat', { detail: newId }));
      window.dispatchEvent(new CustomEvent('ai_dost_switch_session', { detail: newId }));
    } catch (_) {}
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
    try {
      localStorage.setItem('copilot_current_session_id', sessionId);
      localStorage.setItem('ai_dost_session_id', sessionId);
      window.dispatchEvent(new CustomEvent('ai_dost_switch_session', { detail: sessionId }));
    } catch (_) {}

    if (workspaceLoadedRef.current) {
      // Live workspace files win over the stored session snapshot (same
      // workspace for every session of this project; the snapshot can be
      // stale or poisoned). Restore only the tab layout, filtered to paths
      // that exist in the loaded workspace.
      const known = contentsRef.current;
      const tabs = (target.openTabs || []).filter((p) => known[p] !== undefined);
      setOpenTabs(tabs);
      const picked = target.activePath && known[target.activePath] !== undefined ? target.activePath : (tabs[0] || null);
      setActivePath(picked);
      activePathRef.current = picked;
    } else {
      setFiles(target.files || []);
      const targetContents = target.contents || {};
      contentsRef.current = targetContents;
      setContents(targetContents);
      setOpenTabs(target.openTabs || []);
      const defFile = target.activePath || (target.files && target.files[0] ? target.files[0].path : null);
      setActivePath(defFile);
      activePathRef.current = defFile;
    }
    setCopilotMessages(target.messages || []);
    setPlanTasks(target.planTasks || []);
    setSnapshots(target.snapshots || []);
    if (target.workspaceMode) setWorkspaceMode(target.workspaceMode);
    if (target.previewDevice) setPreviewDevice(target.previewDevice);
    setPreviewZoom(100);
    setCopilotStatus({ label: '', tone: 'info' });
    setRuntimeError(null);
    setSelectedInspectorElement(null);
    setDirtyPaths(new Set());

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
    try {
      localStorage.setItem('copilot_sessions_v2', JSON.stringify(updated));
      const chatSessionsRaw = localStorage.getItem('ai_dost_chat_sessions');
      if (chatSessionsRaw) {
        try {
          const chatSessions = JSON.parse(chatSessionsRaw);
          const filteredChat = chatSessions.filter(c => c.id !== id);
          localStorage.setItem('ai_dost_chat_sessions', JSON.stringify(filteredChat));
        } catch (_) {}
      }
      localStorage.removeItem(`ai_dost_messages_${id}`);
    } catch (_) {}
    api.delete(`/copilot/sessions/${id}`).catch(() => {});
    api.delete(`/memory/project/${id}`).catch(() => {});
    api.delete(`/chat/history?session_id=${id}`).catch(() => {});
    if (activeSessionId === id) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        handleNewSession();
      }
    }
    showToast('Session and workspace deleted', 'info');
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

  // 4b. Listen for global chat switch and new-chat events
  useEffect(() => {
    const handleGlobalNewChat = (e) => {
      const newId = e?.detail;
      if (newId && typeof newId === 'string') {
        saveCurrentSession();
        setActiveSessionId(newId);
        setFiles([]);
        contentsRef.current = {};
        setContents({});
        setOpenTabs([]);
        setActivePath(null);
        activePathRef.current = null;
        setCopilotMessages([]);
        setPlanTasks([]);
        setSnapshots([]);
        setDirtyPaths(new Set());
        setRuntimeError(null);
        setSelectedInspectorElement(null);
        setCopilotStatus({ label: '', tone: 'info' });
      }
    };

    const handleGlobalSwitchSession = (e) => {
      const targetId = e?.detail;
      if (targetId && typeof targetId === 'string' && targetId !== activeSessionId) {
        handleSelectSession(targetId);
      }
    };

    window.addEventListener('ai_dost_new_chat', handleGlobalNewChat);
    window.addEventListener('ai_dost_switch_session', handleGlobalSwitchSession);
    return () => {
      window.removeEventListener('ai_dost_new_chat', handleGlobalNewChat);
      window.removeEventListener('ai_dost_switch_session', handleGlobalSwitchSession);
    };
  }, [activeSessionId, handleSelectSession, saveCurrentSession, setCopilotMessages]);

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
      workspaceLoadedRef.current = fileList.length > 0;
      const map = {};
      fileList.forEach(f => { map[f.path] = f.content; });
      contentsRef.current = map;
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

  // Phase 3b watch mode: live workspace change stream (SSE). While a run is
  // active the run stream already streams file_written/file_changed rows, so
  // watch events are ignored mid-run to avoid duplicate activity noise.
  useEffect(() => {
    if (!watching || !projectId) return undefined;
    let es;
    try {
      es = new EventSource(`/api/agent/watch/${encodeURIComponent(projectId)}`);
    } catch (_) {
      return undefined;
    }
    watchSourceRef.current = es;
    const refresh = () => {
      clearTimeout(watchDebounceRef.current);
      watchDebounceRef.current = setTimeout(() => { loadWorkspaceFiles(); }, 400);
    };
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== 'file_changed' || running) return;
        setCopilotMessages((prev) => [...prev, {
          kind: 'thought',
          content: `↻ watch · ${data.action || 'write'}: ${data.path}`,
        }]);
        refresh();
      } catch (_) { /* malformed frame */ }
    };
    return () => {
      clearTimeout(watchDebounceRef.current);
      try { es.close(); } catch (_) { /* already closed */ }
      watchSourceRef.current = null;
    };
  }, [watching, projectId, running, loadWorkspaceFiles, setCopilotMessages]);

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
    setEditorTick(t => t + 1);

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

  // Revert to the pre-run snapshot (Devin-style /revert): restores the client
  // workspace immediately and pushes the same files to the backend store so a
  // reload (loadWorkspaceFiles) cannot resurrect the bad state.
  const rollbackTo = async (checkpointId) => {
    if (!checkpointId) return;
    const snap = snapshots.find(s => s.id === checkpointId);
    if (!snap) {
      showToast('Snapshot not found — it may already be restored', 'error');
      return;
    }
    // Backend payload contract: { checkpoint: { files: [{path, content}] }, projectId }
    const filesPayload = [];
    let budget = 4_000_000;
    for (const [filePath, raw] of Object.entries(snap.contents || {})) {
      const content = typeof raw === 'string' ? raw : '';
      if (content.length > 500_000 || budget - content.length < 0) continue;
      budget -= content.length;
      filesPayload.push({ path: filePath, content });
    }

    let serverOk = false;
    let serverError = null;
    try {
      const res = await api.post('/agent/rollback', {
        checkpoint: { files: filesPayload },
        projectId
      });
      serverOk = Boolean(res.data?.success);
      if (!serverOk) serverError = res.data?.error || 'server refused';
    } catch (err) {
      serverError = err.message;
    }

    // Always restore local state (preview/editor usable even offline).
    handleRollbackSnapshot(snap);
    if (serverOk) {
      await loadWorkspaceFiles();
    } else {
      showToast(`Server rollback failed (${serverError}) — local snapshot restored only`, 'warning');
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
  // ── P9: reattach to a background run after refresh / tab return ────────────
  // Applies one reattach action (pure eventToActions output) to UI state.
  const applyBgAction = (action, runId) => {
    if (!action) return;
    if (action.do === 'latestRunId') {
      setLatestRunId(action.runId);
      latestRunIdRef.current = action.runId;
    } else if (action.do === 'row') {
      setCopilotMessages(prev => [...prev, action.row]);
    } else if (action.do === 'plan') {
      setPlanTasks(action.tasks);
    } else if (action.do === 'status') {
      setCopilotStatus({ label: action.label, tone: action.tone });
    } else if (action.do === 'file') {
      setFiles(prev => prev.some(f => f.path === action.path)
        ? prev.map(f => (f.path === action.path ? { ...f, content: action.content, lastModified: Date.now() } : f))
        : [...prev, { path: action.path, content: action.content, lastModified: Date.now() }]);
      setContents(prev => ({ ...prev, [action.path]: action.content }));
    } else if (action.do === 'done') {
      clearBgRun(runId);
    }
  };

  // Replay + live tail of a still-running background run. The stream only
  // closes on terminal events (server cleanup) or network failure — storage is
  // cleared ONLY on a real 'done', so a blip can be reattached again later.
  const attachBgRun = async (runId) => {
    setRunning(true);
    runStartRef.current = Date.now();
    setElapsedSec(0);
    setCopilotStatus({ label: '↻ Reattached to background run…', tone: 'work' });
    setCopilotMessages(prev => [...prev, {
      role: 'assistant',
      kind: 'thought',
      content: `↻ Reattached to background run ${runId} — replaying what you missed…`
    }]);
    try {
      await attachRunEvents({
        runId,
        backend: BACKEND,
        onEvent: (data) => {
          for (const action of eventToActions(data)) applyBgAction(action, runId);
        }
      });
    } catch (e) {
      setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: `Reattach ended: ${e.message}` }]);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    const stored = loadBgRun();
    if (!stored) return undefined;
    if (projectId && stored.projectId && stored.projectId !== projectId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/agent/runs/${encodeURIComponent(stored.runId)}`);
        if (!res.ok) {
          if (res.status === 404) clearBgRun();
          return;
        }
        const info = await res.json();
        if (cancelled) return;
        if (info.running) {
          await attachBgRun(stored.runId);
        } else {
          clearBgRun(stored.runId);
          if (info.finalMessage) {
            setCopilotMessages(prev => [...prev, {
              role: 'assistant',
              kind: 'thought',
              content: `↻ Background run finished while you were away:\n${String(info.finalMessage).slice(0, 1200)}`
            }]);
          }
        }
      } catch (_) { /* backend unreachable — storage kept for the next mount */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const runCopilot = async (prompt, attachedImages = [], planOverride = null, runOptions = {}) => {
    if (!prompt || running) return;
    // Resume inputs for a paused 'ask' run (approval banner → Approve) and
    // for Retry after a failed run.
    lastRunRef.current = { mode: 'code', prompt, attachedImages, planOverride };
    // @file mentions → mentioned files first in projectFiles + contextFiles
    // for the backend (ReAct slices the first 5; director gets the priority list).
    const mentionedFiles = parseMentionPaths(prompt);
    const mentionedSet = new Set(mentionedFiles);
    const orderedFiles = mentionedFiles.length
      ? [
          ...files.filter(f => mentionedSet.has(filePathOf(f))),
          ...files.filter(f => !mentionedSet.has(filePathOf(f))),
        ]
      : files;

    // Automatically record an internal Time-Travel Snapshot before executing AI prompt
    preRunCheckpointRef.current = null;
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
      preRunCheckpointRef.current = snap.id;
    }

    // Best-effort git checkpoint of the workspace BEFORE the run (Devin-style
    // /revert safety net). Failure is non-fatal — the client snapshot above is
    // the primary rollback source.
    api.post('/agent/checkpoint', {
      projectId,
      message: `copilot pre-run: ${prompt.slice(0, 120)}`
    }).catch(() => {});

    setRunning(true);
    runStartRef.current = Date.now();
    setElapsedSec(0);
    setQaStatus('idle');
    setPreviewLogs([]);
    setExpandedDiffIdx(null);
    setCopilotStatus({ label: '🤖 Agent thinking & planning...', tone: 'info' });
    const cleanDisplay = prompt.replace(/\[IMAGE_BASE64:[^\]]+\]/g, '').trim() || 'Analyze screenshot & apply upgrades';
    // Approval resume re-sends the SAME prompt — don't duplicate the user row.
    if (!runOptions.approvalToken) {
      setCopilotMessages(prev => [...prev, { role: 'user', content: cleanDisplay, images: attachedImages }]);
    }
    setCopilotInput('');
    setPastedImages([]);

    const controller = new AbortController();
    abortRef.current = controller;
    // Devin-style Stop: a stable task id lets us cancel the run server-side
    // (POST /api/chat/tasks/:id/cancel) instead of only dropping the stream.
    runTaskIdRef.current = `copilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const runTaskId = runTaskIdRef.current;
    const createdFilesTracker = [];
    // Per-run de-dup for unknown SSE event types (see the catch-all branch below)
    const unknownEventCounts = new Map();

    try {
      const response = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-dost-task-id': runTaskId },
        body: JSON.stringify({
          userPrompt: prompt,
          projectId,
          taskId: runTaskId,
          projectFiles: orderedFiles,
          ...(mentionedFiles.length ? { contextFiles: mentionedFiles } : {}),
          chatHistory: copilotMessages.slice(-20).map(m => ({
            role: m.role,
            content: (m.content || '').substring(0, 500),
            kind: m.kind,
            file: m.file
          })),
          copilotDirector: true,
          // User-approved (possibly edited) plan — backend executes this instead
          // of generating its own. Absent in code mode / planner fallbacks.
          ...(planOverride ? { plan: planOverride } : {}),
          // Devin-style permission level + single-use approval token resume.
          permissionLevel,
          ...(runOptions.approvalToken ? { approvalToken: runOptions.approvalToken } : {}),
          preferredModel,
          // P9: run outlives this socket — refresh/tab close won't kill it and
          // the persisted event log makes reattach possible on return.
          ...(runInBackground ? { background: true } : {})
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Agent request failed: ${response.statusText}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let streamFinished = false;

      while (!streamFinished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          if (jsonStr === '[DONE]') {
            streamFinished = true;
            setRunning(false);
            break;
          }

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'run_started' || data.type === 'director_start') {
              setLatestRunId(data.runId || data.taskId || null);
              latestRunIdRef.current = data.runId || data.taskId || null;
              // P9: remember a background run so a refresh can reattach to it.
              if (runInBackground && data.runId) saveBgRun({ runId: data.runId, projectId });
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
                  summary: data.message || `Director completed ${taskCount} tasks`,
                  checkpointDir: preRunCheckpointRef.current
                }
              ]);

              await loadWorkspaceFiles(true);
              setMilestonesExpanded(false);
              if (activePathRef.current) {
                runDiagnostics(activePathRef.current, contents[activePathRef.current] || '');
              }
              setWorkspaceMode('preview');
              if (iframeRef?.current && devServerStatus?.state === 'READY') {
                iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
              }
              setRunning(false);
              streamFinished = true;
              break;
            }
            // ── Director Error: Show error and reset running state ──
            else if (data.type === 'director_error') {
              const errMsg = data.error || 'Director encountered an error';
              setCopilotStatus({ label: `❌ ${errMsg.substring(0, 40)}`, tone: 'error' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: `❌ Director Error: ${errMsg}` }]);
              setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, status: 'error' } : t));
              setRunning(false);
              streamFinished = true;
              break;
            }
            // ── Director Canceled: Show cancellation and reset ──
            else if (data.type === 'director_canceled') {
              setCopilotStatus({ label: '⏹ Director run canceled', tone: 'neutral' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: '⏹ Director run canceled. Completed changes remain in the workspace.' }]);
              setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, status: 'pending' } : t));
              setRunning(false);
              streamFinished = true;
              break;
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
                setCopilotMessages(prev => [...prev, {
                  role: 'assistant', kind: 'file', file: filePath,
                  content: `Created/Updated: ${filePath}`,
                  isNew, added, removed,
                  // Keep capped prev/next for click-to-expand inline diff
                  ...(!isNew && typeof prevContent === 'string'
                    ? { prev: String(prevContent).slice(-80000), next: String(content).slice(-80000) }
                    : {})
                }]);
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
              // P9: live completion — this run needs no reattach anymore.
              clearBgRun(latestRunIdRef.current);
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
                  summary: data.message,
                  checkpointDir: preRunCheckpointRef.current
                }
              ]);

              await loadWorkspaceFiles(true);
              setMilestonesExpanded(false);
              if (activePathRef.current) {
                runDiagnostics(activePathRef.current, contents[activePathRef.current] || '');
              }
              setWorkspaceMode('preview');
              if (iframeRef?.current && devServerStatus?.state === 'READY') {
                iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
              }
              setRunning(false);
              streamFinished = true;
              break;
            }
            // ── ReAct-loop events (defensive: non-director run shapes must stay visible) ──
            else if (data.type === 'start') {
              const msg = data.message || 'Analyzing prompt & generating dynamic task plan...';
              setCopilotStatus({ label: `🚀 ${msg}`, tone: 'work' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `🚀 ${msg}` }]);
            }
            else if (data.type === 'error') {
              const errMsg = String(data.message || data.error || 'Agent run failed');
              setCopilotStatus({ label: `⚠️ ${errMsg.substring(0, 40)}`, tone: 'error' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: `⚠️ ${errMsg}` }]);
              setPlanTasks(prev => prev.map(t => t.status === 'in_progress' ? { ...t, status: 'error' } : t));
              setRunning(false);
              streamFinished = true;
              break;
            }
            else if (data.type === 'terminal_output') {
              const out = String(data.output || data.text || '').trim();
              if (out) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'step', content: `🖥️ Terminal:\n${out.slice(0, 2000)}` }]);
              }
            }
            else if (data.type === 'self_heal') {
              const healMsg = String(data.message || data.reason || data.error || 'Agent detected a failure and is repairing it...');
              setCopilotStatus({ label: `🛠️ Self-heal: ${healMsg.substring(0, 35)}`, tone: 'work' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `🛠️ Self-heal: ${healMsg}` }]);
            }
            // ── Approval gates (ReAct path with REQUIRE_EXPLICIT_APPROVAL) ──
            else if (data.type === 'gate_approval_required' || data.type === 'gate_blocked' || data.type === 'gate_approved' || data.type === 'gate_approval_invalid') {
              const emoji = data.type === 'gate_approved' ? '✅' : data.type === 'gate_approval_invalid' ? '⚠️' : '🔐';
              const label = String(data.message || data.reason || data.type.replace(/_/g, ' '));
              setCopilotStatus({ label: `${emoji} ${label}`.substring(0, 60), tone: data.type === 'gate_approved' ? 'success' : 'work' });
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `${emoji} ${label}` }]);
              // Ask-mode pause with a real token → actionable Approve/Reject banner
              if (data.type === 'gate_approval_required' && data.gate && data.gate.approval_token) {
                setCopilotMessages(prev => [...prev, {
                  role: 'assistant',
                  kind: 'approval',
                  token: data.gate.approval_token,
                  gate: data.gate
                }]);
              }
            }
            // ── Unknown event: never silently drop (first 2 per type as rows, then count in status) ──
            else {
              const evtType = String(data.type || 'event');
              const seen = unknownEventCounts.get(evtType) || 0;
              unknownEventCounts.set(evtType, seen + 1);
              if (seen < 2) {
                const detail = data.message || data.status || data.summary || data.error || '';
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'thought', content: `· [${evtType}]${detail ? ` ${String(detail).slice(0, 160)}` : ''}` }]);
              } else {
                setCopilotStatus({ label: `· [${evtType}] ×${seen + 1}`, tone: 'neutral' });
              }
            }
          } catch (_) {}
        }
      }

      if (streamFinished) {
        try { await reader.cancel(); } catch (_) {}
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setCopilotStatus({ label: `⚠️ ${err.message}`, tone: 'error' });
        setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: `⚠️ ${err.message}` }]);
        showToast(err.message, 'error');
      }
    } finally {
      // Only the still-active run may clear the running state — a stopped run's
      // finally must not kill a newer run that started in the meantime.
      if (abortRef.current === controller) {
        setRunning(false);
        // Force-save session after every agent run completes to prevent data loss
        setTimeout(() => saveCurrentSession(), 500);
      }
    }
  };

  // Ask mode (Devin parity): answer the question through the chat cascade —
  // never touches the workspace, never calls /agent/run.
  const runAskMode = async (prompt) => {
    lastRunRef.current = { mode: 'ask', prompt };
    setCopilotInput('');
    setPastedImages([]);
    setCopilotMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setCopilotStatus({ label: '💬 Ask mode — answering (workspace untouched)', tone: 'work' });
    try {
      const res = await api.post('/chat', { message: prompt });
      const reply = res.data?.reply || '';
      if (!reply || !String(reply).trim()) throw new Error('Empty reply from provider');
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: String(reply), model: res.data?.model }]);
      setCopilotStatus({ label: '💬 Ask answered', tone: 'success' });
    } catch (err) {
      setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'error', content: `⚠️ Ask mode failed: ${err.message}` }]);
      setCopilotStatus({ label: '⚠️ Ask mode failed', tone: 'error' });
    }
  };

  // ── /btw side question: ask WITHOUT interrupting the running agent ──────
  const askSideChat = async (question) => {
    setCopilotInput('');
    setMentionQuery(null);
    setPastedImages([]);
    setCopilotMessages(prev => [...prev, { role: 'user', content: `/btw ${question}` }]);
    try {
      const res = await api.post('/chat', { message: question });
      const reply = res.data?.reply || '';
      if (!reply || !String(reply).trim()) throw new Error('Empty reply from provider');
      setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'sidechat', content: String(reply) }]);
    } catch (err) {
      setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'sidechat', content: `⚠️ Side question failed: ${err.message}` }]);
    }
  };

  // ── @file mentions (composer autocomplete) ────────────────────────────────
  const handleComposerChange = (e) => {
    const value = e.target.value;
    setCopilotInput(value);
    const caret = e.target.selectionStart ?? value.length;
    setMentionQuery(detectMention(value, caret));
    setMentionIdx(0);
  };

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return files
      .map(filePathOf)
      .filter(p => p && p.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, files]);

  const insertMention = (filePath) => {
    const el = composerRef.current;
    const value = copilotInput;
    const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const token = before.match(/@[^\s@]*$/);
    const start = token ? before.length - token[0].length : before.length;
    const next = `${before.slice(0, start)}@${filePath} ${after}`;
    setCopilotInput(next);
    setMentionQuery(null);
    setMentionIdx(0);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + filePath.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = async (text, isWizardPrompt = false) => {
    if (isWizardPrompt) {
      return openProjectWizard(text || copilotInput);
    }
    const rawPrompt = (text || copilotInput).trim();
    // /btw side question works even WHILE a run is in progress — it only
    // calls /chat and never touches the run pipeline.
    if (rawPrompt.startsWith('/btw')) {
      const question = rawPrompt.replace(/^\/btw\s*/, '');
      if (!question) return;
      return askSideChat(question);
    }
    if ((!rawPrompt && pastedImages.length === 0) || running) return;

    // Client-side view switch commands (preview / code / split)
    if (pastedImages.length === 0) {
      const isPreviewCommand = /\b(preview|live preview)\b.*\b(kholo|dikhao|dikha|open|show|run|chalao|start|de do|do)\b|\b(open|show|kholo|dikhao|dikha|run|chalao|start)\b.*\b(preview|live preview)\b|^preview$/i.test(rawPrompt);
      if (isPreviewCommand) {
        setCopilotInput('');
        setWorkspaceMode('preview');
        if (iframeRef?.current && devServerStatus?.state === 'READY') {
          iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
        }
        setCopilotMessages(prev => [
          ...prev,
          { role: 'user', content: rawPrompt },
          { role: 'assistant', kind: 'thought', content: '🖥️ Live Preview mode open kar diya hai.' }
        ]);
        showToast('🖥️ Live Preview opened', 'success');
        return;
      }

      const isCodeCommand = /\b(code|editor|files?)\b.*\b(kholo|dikhao|dikha|open|show)\b|\b(open|show|kholo|dikhao|dikha)\b.*\b(code|editor)\b|^code$/i.test(rawPrompt);
      if (isCodeCommand) {
        setCopilotInput('');
        setWorkspaceMode('code');
        setCopilotMessages(prev => [
          ...prev,
          { role: 'user', content: rawPrompt },
          { role: 'assistant', kind: 'thought', content: '📝 Code editor mode open kar diya hai.' }
        ]);
        showToast('📝 Code editor opened', 'success');
        return;
      }

      const isSplitCommand = /\b(split|split screen|dono)\b.*\b(kholo|dikhao|dikha|open|show|mode)\b|^split$/i.test(rawPrompt);
      if (isSplitCommand) {
        setCopilotInput('');
        setWorkspaceMode('split');
        setCopilotMessages(prev => [
          ...prev,
          { role: 'user', content: rawPrompt },
          { role: 'assistant', kind: 'thought', content: '⚡ Split screen view open kar diya hai.' }
        ]);
        showToast('⚡ Split view opened', 'success');
        return;
      }
    }

    // Image generation is NOT a build task. Short-circuit BEFORE /agent/plan —
    // the planner used to turn "ek cat ka images banao" into a multi-file plan
    // and started writing code instead of rendering the picture. (Screenshot
    // attachments keep the normal copilot path — those are edit requests.)
    if (pastedImages.length === 0 && isImageCreateRequest(rawPrompt)) {
      setCopilotInput('');
      setPastedImages([]);
      await runCopilotImageRequest({
        prompt: rawPrompt,
        api,
        pushMessage: (m) => setCopilotMessages(prev => [...prev, m]),
        setStatus: setCopilotStatus,
      });
      return;
    }

    const currentImages = [...pastedImages];
    let finalPrompt = rawPrompt || 'Please review this screenshot reference and apply the requested UI changes or upgrades.';
    if (currentImages.length > 0) {
      const imgTags = currentImages.map(img => {
        const b64 = img.dataUrl.includes('base64,') ? img.dataUrl.split('base64,')[1] : img.dataUrl;
        return `[IMAGE_BASE64:${b64}]`;
      }).join('\n');
      finalPrompt = `${finalPrompt}\n\n${imgTags}`;
    }

    if (agentMode === 'ask') {
      // Ask never sends base64 image tags to /chat — answer from text only.
      return runAskMode(rawPrompt || 'Review the attached screenshot reference and describe what you see.');
    }

    if (agentMode !== 'plan') {
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
    // Approved plan is OVERRIDDEN into the run (backend executes this plan,
    // not a freshly LLM-generated one) — title → objective, sequential chain.
    const cleanSteps = (pendingPlan.tasks || []).filter(t => (t.title || '').trim());
    const presetPlan = {
      summary: pendingPlan.summary || undefined,
      tasks: cleanSteps.map((t, i) => ({
        id: `task-${i + 1}`,
        objective: String(t.title).trim().slice(0, 12000),
        ...(t.specialty ? { specialty: t.specialty } : {}),
        dependsOn: i > 0 ? [`task-${i}`] : [],
        expectedOutput: `Completed step: ${String(t.title).trim().slice(0, 400)}`
      }))
    };
    setPendingPlan(null);
    runCopilot(prompt, images, presetPlan.tasks.length ? presetPlan : null);
  };

  const cancelPlan = () => {
    setPendingPlan(null);
    setCopilotStatus({ label: 'Plan cancelled', tone: 'neutral' });
  };

  // ── Ask-mode approval (single-use gatekeeper token) ──────────────────────
  const approveRun = (token) => {
    const last = lastRunRef.current;
    setCopilotMessages(prev => prev.map(m => (
      m.kind === 'approval' && m.token === token ? { ...m, resolved: 'approved' } : m
    )));
    if (!last) {
      setCopilotStatus({ label: 'No paused run to resume', tone: 'neutral' });
      return;
    }
    runCopilot(last.prompt, last.attachedImages || [], last.planOverride || null, { approvalToken: token });
  };

  const rejectApproval = (token) => {
    setCopilotMessages(prev => prev.map(m => (
      m.kind === 'approval' && m.token === token ? { ...m, resolved: 'rejected' } : m
    )));
    setCopilotStatus({ label: 'Run rejected by user', tone: 'neutral' });
    showToast('Run rejected — nothing was changed', 'info');
  };

  // ── Retry the last run from a failed (kind:'error') message row ─────────
  const retryLastRun = () => {
    if (running) return;
    const last = lastRunRef.current;
    if (!last) {
      showToast('No previous run to retry', 'info');
      return;
    }
    if (last.mode === 'ask') return runAskMode(last.prompt);
    runCopilot(last.prompt, last.attachedImages || [], last.planOverride || null);
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
    const snapshotContents = snap.contents || {};
    contentsRef.current = snapshotContents;
    setContents(snapshotContents);
    setActivePath(snap.activePath || (snap.files && snap.files[0] ? snap.files[0].path : null));
    setOpenTabs(snap.files ? snap.files.slice(0, 4).map(f => f.path) : []);
    setDirtyPaths(new Set());
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
      if (previewSourceMode === 'instant') {
        // P6: reload the isolated WebContainer wrapper (never clobber it with srcdoc)
        iframeRef.current.src = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/instant/${projectId}?t=${Date.now()}`;
      } else if (previewSourceMode === 'live' || (previewSourceMode === 'auto' && devServerStatus.state === 'READY')) {
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
      } else if (e.data.type === 'CONSOLE') {
        setPreviewLogs((prev) => [...prev.slice(-79), {
          level: String(e.data.level || 'log'),
          text: String(e.data.text || ''),
          ts: Date.now(),
        }]);
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
      setPromptModal({
        type: 'file',
        parentFolder,
        title: parentFolder ? `Create file inside "${parentFolder}"` : 'Create new file',
        hint: 'Use a path such as src/components/Card.jsx.',
        placeholder: 'src/components/Card.jsx'
      });
      return;
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
      setPromptModal({
        type: 'folder',
        parentFolder,
        title: parentFolder ? `Create folder inside "${parentFolder}"` : 'Create new folder',
        hint: 'Use a path such as src/components.',
        placeholder: 'src/components'
      });
      return;
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
    setPromptModal({
      type: 'rename',
      oldPath: cleanOld,
      title: `Rename "${cleanOld}"`,
      hint: 'Enter the new file or folder path.',
      placeholder: cleanOld,
      initial: cleanOld
    });
  };

  const renamePath = async (oldPath, requestedPath) => {
    const cleanOld = normalizePath(oldPath);
    if (!requestedPath || !requestedPath.trim() || normalizePath(requestedPath) === cleanOld) return;
    const newPath = normalizePath(requestedPath);
    
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
      setFiles(prev => prev.filter(f => !isPathInFolder(f.path, folderPath)));
      const nextContents = { ...contentsRef.current };
      Object.keys(nextContents).forEach(k => {
        if (isPathInFolder(k, folderPath)) delete nextContents[k];
      });
      contentsRef.current = nextContents;
      setContents(nextContents);
      setOpenTabs(prev => prev.filter(t => !isPathInFolder(t, folderPath)));
      setDirtyPaths(prev => new Set(Array.from(prev).filter(p => !isPathInFolder(p, folderPath))));
      if (activePath && isPathInFolder(activePath, folderPath)) setActivePath(null);
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
      contentsRef.current = {};
      setContents({});
      setOpenTabs([]);
      setActivePath(null);
      setDirtyPaths(new Set());
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
        <aside className="w-[390px] shrink-0 flex flex-col bg-canvas-base border-r border-border z-10 overflow-hidden">

          {/* Copilot Header — identity/actions on row 1, mode + permission on row 2.
              The single-row layout needed ~430px inside a 390px pane, so the
              controls painted over the file explorer; two rows + overflow-x
              keeps every control inside this pane. */}
          <div className="shrink-0 bg-canvas-base border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,.65)]" />
              <span className="text-xs font-semibold text-paper-100 shrink-0">Copilot</span>
              <div className="relative min-w-0 shrink">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen(o => !o)}
                  className="text-[10px] font-mono text-ink-muted bg-canvas-elevated pl-2 pr-1.5 py-0.5 rounded border border-border hover:border-accent/40 hover:text-paper-200 transition-colors cursor-pointer flex items-center gap-1 max-w-[120px]"
                  title="Preferred model — failure still falls back through the cascade"
                  data-testid="model-picker-btn"
                >
                  <AppIcon name="zap" size={9} className="text-accent shrink-0" />
                  <span className="truncate">{MODEL_OPTIONS.find(o => o.v === preferredModel)?.l || 'auto'}</span>
                  <AppIcon name="chevronDown" size={9} className="opacity-60 shrink-0" />
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
                          {preferredModel === opt.v && <AppIcon name="check" size={11} />}
                        </button>
                      ))}
                      <div className="px-3 pt-1.5 pb-1 text-[9px] text-ink-muted border-t border-border-subtle mt-1">
                        Fallback cascade stays on
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="ml-auto flex items-center gap-0.5 shrink-0">
                <button
                  data-testid="watch-toggle"
                  aria-pressed={watching}
                  onClick={() => {
                    setWatching((prev) => {
                      const next = !prev;
                      try { window.localStorage.setItem('ai_dost_copilot_watch', next ? '1' : '0'); } catch (_) { /* ignore */ }
                      showToast(next ? 'Watch mode ON — live workspace updates' : 'Watch mode OFF', 'info');
                      return next;
                    });
                  }}
                  title={watching
                    ? 'Watch mode: streaming workspace file changes (click to stop)'
                    : 'Watch mode: live-refresh workspace file changes (click to start)'}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    watching
                      ? 'bg-emerald-400/15 text-emerald-400'
                      : 'hover:bg-canvas-elevated text-ink-muted hover:text-paper-100'
                  }`}
                >
                  <AppIcon name="eye" size={13} />
                </button>

                <button
                  data-testid="memory-btn"
                  aria-expanded={memoryOpen}
                  onClick={() => {
                    const next = !memoryOpen;
                    setMemoryOpen(next);
                    if (next) loadMemoryNotes();
                  }}
                  title={`Self-learning notes (${memoryCount} saved — survive project deletion)`}
                  className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
                    memoryOpen
                      ? 'bg-accent/15 text-accent'
                      : 'hover:bg-canvas-elevated text-ink-muted hover:text-paper-100'
                  }`}
                >
                  <AppIcon name="brain" size={13} />
                  {memoryCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-[2px] rounded-full bg-accent/90 text-[8px] font-bold text-white flex items-center justify-center">
                      {memoryCount > 99 ? '99+' : memoryCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setCopilotMessages([]);
                    setPendingPlan(null);
                    setPlanTasks([]);
                    showToast('Chat history cleared', 'info');
                  }}
                  className="p-1.5 rounded-md hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <AppIcon name="trash" size={13} />
                </button>
              </div>
            </div>

            {/* Mode + permission — scrollable, so it can never bleed into the file tree */}
            <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
              <div
                className="flex items-center rounded-md border border-border overflow-hidden shrink-0"
                role="radiogroup"
                aria-label="Agent mode"
                data-testid="agent-mode-switch"
              >
                {[
                  { v: 'ask', l: 'Ask', t: 'Ask mode — answers only, never touches files' },
                  { v: 'plan', l: 'Plan', t: 'Plan mode — review & edit the plan, then approve' },
                  { v: 'code', l: 'Code', t: 'Code mode — autonomous execution (default)' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    role="radio"
                    aria-checked={agentMode === opt.v}
                    onClick={() => {
                      setAgentMode(opt.v);
                      try { window.localStorage.setItem('ai_dost_copilot_mode', opt.v); } catch (_) { /* ignore */ }
                      showToast(`Mode: ${opt.l}`, 'info');
                    }}
                    title={opt.t}
                    className={`px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                      agentMode === opt.v
                        ? 'bg-accent/20 text-accent'
                        : 'bg-canvas-elevated text-ink-muted hover:text-paper-200'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>

              {/* P9: background run toggle — survives refresh/tab close */}
              <button
                type="button"
                data-testid="background-toggle"
                aria-pressed={runInBackground}
                onClick={() => {
                  const next = !runInBackground;
                  setRunInBackground(next);
                  try { window.localStorage.setItem('ai_dost_copilot_background', next ? '1' : '0'); } catch (_) { /* ignore */ }
                  showToast(next ? 'BG run ON — close the tab, the agent keeps working' : 'BG run OFF', 'info');
                }}
                title="Background run — refresh or close the tab and the agent keeps going; reattach on return"
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors cursor-pointer shrink-0 ${
                  runInBackground
                    ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40'
                    : 'bg-canvas-elevated text-ink-muted hover:text-paper-200 border-border'
                }`}
              >
                <AppIcon name="clock" size={10} />
                BG
              </button>

              <div
                className="flex items-center rounded-md border border-border overflow-hidden shrink-0"
                role="radiogroup"
                aria-label="Agent permission level"
                data-testid="permission-switch"
              >
                {[
                  { v: 'ask', l: 'Ask', t: 'Ask — pause & require approval before every run' },
                  { v: 'auto', l: 'Auto', t: 'Auto — canonical safety policy decides' },
                  { v: 'turbo', l: 'Turbo', t: 'Turbo — auto-approve (hard blocks still apply)' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    role="radio"
                    aria-checked={permissionLevel === opt.v}
                    onClick={() => {
                      setPermissionLevel(opt.v);
                      try { window.localStorage.setItem('ai_dost_copilot_permissions', opt.v); } catch (_) { /* ignore */ }
                      showToast(`Permissions: ${opt.l}`, 'info');
                    }}
                    title={opt.t}
                    className={`px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                      permissionLevel === opt.v
                        ? 'bg-amber-400/15 text-amber-400'
                        : 'bg-canvas-elevated text-ink-muted hover:text-paper-200'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Self-learning memory panel (notes survive project deletion) */}
          {memoryOpen && (
            <div
              data-testid="memory-panel"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/55"
              onClick={() => setMemoryOpen(false)}
            >
              <div
                className="w-[520px] max-w-[92vw] max-h-[72vh] overflow-y-auto bg-canvas-surface border border-border rounded-xl p-4 space-y-2.5 shadow-surface-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AppIcon name="brain" size={15} className="text-accent" />
                    <span className="text-sm font-bold text-paper-100">Learning Notes</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold font-mono">
                      {memoryCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {memoryNotes.length > 0 && (
                      <button
                        data-testid="memory-clear-btn"
                        onClick={clearMemoryNotes}
                        className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setMemoryOpen(false)}
                      className="p-1 rounded-md hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                      title="Close"
                    >
                      <AppIcon name="close" size={14} />
                    </button>
                  </div>
                </div>

                {memoryNotes.length === 0 ? (
                  <p className="text-xs text-ink-muted leading-relaxed py-3 text-center">
                    No notes yet — build a project and the Copilot will save lessons automatically.
                    Notes stay even if you delete the project.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {memoryNotes.map((n) => (
                      <div
                        key={n.id}
                        data-testid="memory-note-row"
                        className="flex items-start gap-2 p-2 rounded-lg bg-canvas-elevated/60 border border-border-subtle group"
                      >
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                            n.kind === 'fix'
                              ? 'bg-amber-400/15 text-amber-400'
                              : 'bg-emerald-400/15 text-emerald-400'
                          }`}
                        >
                          {n.kind}
                        </span>
                        <span className="flex-1 text-[11px] text-paper-200 leading-snug break-words">
                          {n.content}
                        </span>
                        <button
                          data-testid="memory-note-delete"
                          onClick={() => deleteMemoryNote(n.id)}
                          className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-400 transition-opacity cursor-pointer"
                          title="Delete note"
                        >
                          <AppIcon name="trash" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-ink-muted leading-snug pt-1 border-t border-border-subtle">
                  Notes are saved per user and survive project deletion — future runs reuse them for higher accuracy.
                </p>
              </div>
            </div>
          )}

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
                    <AppIcon name="code" size={18} />
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
                    <AppIcon name="shield" size={14} /> Plan ready for approval
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono">Approve to proceed</span>
                </div>
                <div className="space-y-1.5" data-testid="plan-editor">
                  {pendingPlan.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-accent shrink-0">▸</span>
                      <input
                        value={t.title || ''}
                        onChange={(e) => setPendingPlan(p => p ? ({
                          ...p,
                          tasks: p.tasks.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x)
                        }) : p)}
                        aria-label={`Plan step ${i + 1}`}
                        data-testid="plan-step-input"
                        className="flex-1 min-w-0 bg-canvas-base border border-border rounded px-2 py-1 text-paper-200 text-[11px] focus:outline-none focus:border-accent/50"
                      />
                      <button
                        type="button"
                        onClick={() => setPendingPlan(p => p ? ({ ...p, tasks: p.tasks.filter((_, idx) => idx !== i) }) : p)}
                        title="Remove step"
                        className="p-1 text-ink-muted hover:text-red-400 transition-colors cursor-pointer shrink-0"
                      >
                        <AppIcon name="close" size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPendingPlan(p => p ? ({ ...p, tasks: [...p.tasks, { id: `manual-${Date.now()}`, title: '' }] }) : p)}
                    className="text-[10px] text-accent hover:underline cursor-pointer flex items-center gap-1 pt-0.5"
                    data-testid="plan-add-step"
                  >
                    <AppIcon name="plus" size={10} /> Add step
                  </button>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <button
                    onClick={approvePlan}
                    disabled={!pendingPlan.tasks.some(t => (t.title || '').trim())}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="plan-approve-btn"
                  >
                    <AppIcon name="play" size={12} className="fill-white" /> Approve &amp; Build
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
              if (m.kind === 'error') {
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 flex flex-col gap-1.5"
                    data-testid="error-row"
                  >
                    <div className="flex items-start gap-2 text-[11px] font-mono text-red-300">
                      <AppIcon name="alert" size={12} className="shrink-0 mt-0.5" />
                      <span className="break-words whitespace-pre-wrap">{m.content}</span>
                      <span className="ml-auto shrink-0 text-[9px] text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                    </div>
                    {!running && lastRunRef.current && (
                      <div className="pl-5">
                        <button
                          type="button"
                          onClick={retryLastRun}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-400/15 hover:bg-red-400/25 text-red-200 border border-red-400/40 transition-colors cursor-pointer"
                          data-testid="msg-retry-btn"
                        >
                          <AppIcon name="rotate" size={10} /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              if (m.kind === 'sidechat') {
                const failedSide = String(m.content || '').startsWith('⚠️');
                return (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 flex flex-col gap-1 ${
                      failedSide
                        ? 'border-red-400/40 bg-red-400/10'
                        : 'border-indigo-400/40 bg-indigo-400/10'
                    }`}
                    data-testid="sidechat-row"
                  >
                    <div className={`flex items-center gap-2 text-[9px] uppercase tracking-wider font-bold ${failedSide ? 'text-red-300' : 'text-indigo-300'}`}>
                      <AppIcon name="message" size={11} />
                      BTW — side question (run uninterrupted)
                      <span className="ml-auto text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                    </div>
                    <div className="text-[11px] font-mono text-paper-200 whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                );
              }
              if (m.kind === 'approval') {
                const resolved = m.resolved;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 flex flex-col gap-2"
                    data-testid="approval-banner"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-mono text-amber-300">
                      <AppIcon name="shield" size={13} />
                      <span className="font-bold uppercase tracking-wider text-[9px]">Approval required — ask mode paused this run</span>
                      <span className="ml-auto shrink-0 text-[9px] text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                    </div>
                    {!resolved ? (
                      <div className="flex items-center gap-2 pl-5">
                        <button
                          type="button"
                          onClick={() => approveRun(m.token)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors cursor-pointer"
                          data-testid="approval-approve-btn"
                        >
                          Approve &amp; Run
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectApproval(m.token)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-canvas-elevated hover:bg-canvas-overlay text-paper-300 border border-border transition-all cursor-pointer"
                          data-testid="approval-reject-btn"
                        >
                          Reject
                        </button>
                        <span className="text-[9px] text-ink-muted">token {String(m.token || '').slice(0, 8)}…</span>
                      </div>
                    ) : (
                      <div className={`pl-5 text-[11px] ${resolved === 'approved' ? 'text-emerald-400' : 'text-ink-muted'}`}>
                        {resolved === 'approved' ? '✓ Approved — resuming run…' : '✗ Rejected — run cancelled'}
                      </div>
                    )}
                  </div>
                );
              }
              if (m.kind === 'thought') {
                const longThought = (m.content || '').length > 120;
                const thoughtOpen = openThoughts.has(i) || !longThought;
                return (
                  <div key={i} className="flex flex-col text-[11px] font-mono bg-canvas-subtle/70 px-3 py-2 rounded-lg border border-border-subtle" data-testid="thought-row">
                    <button
                      type="button"
                      onClick={() => longThought && toggleThought(i)}
                      className={`flex items-center gap-2 text-left ${longThought ? 'cursor-pointer' : 'cursor-default'}`}
                      title={longThought ? (thoughtOpen ? 'Collapse thought' : 'Expand thought') : undefined}
                    >
                      <AppIcon name="sparkles" size={12} className="text-accent/70 shrink-0" />
                      <span className="font-bold text-ink-muted text-[9px] uppercase tracking-wider">{m.agent || 'thinking'}</span>
                      <span className="ml-auto shrink-0 text-[9px] text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                      {longThought && (
                        <AppIcon name="chevronRight" size={11} className={`shrink-0 text-ink-muted transition-transform ${thoughtOpen ? 'rotate-90' : ''}`} />
                      )}
                    </button>
                    {thoughtOpen ? (
                      <span className="text-paper-300 break-words whitespace-pre-wrap pl-5 mt-0.5">{m.content}</span>
                    ) : (
                      <span className="text-ink-muted pl-5 mt-0.5 truncate">{m.content}</span>
                    )}
                  </div>
                );
              }
              if (m.kind === 'tool') {
                return (
                  <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-paper-300 bg-canvas-subtle/70 px-3 py-2 rounded-lg border border-border-subtle">
                    <AppIcon name="zap" size={12} className="text-accent shrink-0" />
                    <span className="truncate">{stripEmoji(typeof m.label === 'object' ? JSON.stringify(m.label) : String(m.label || ''))}</span>
                    <span className="ml-auto shrink-0 text-[9px] text-ink-muted tabular-nums">{fmtTs(m.ts)}</span>
                  </div>
                );
              }
              if (m.kind === 'file') {
                const hasStats = typeof m.added === 'number' || typeof m.removed === 'number';
                const diffExpanded = expandedDiffIdx === i;
                const canExpand = !m.isNew && typeof m.prev === 'string' && typeof m.next === 'string' && m.prev !== m.next;
                let diffOps = null;
                if (diffExpanded && canExpand) {
                  try { diffOps = diffLines(m.prev, m.next); } catch (_) { diffOps = null; }
                }
                const diffStats2 = diffOps ? diffStats(diffOps) : null;
                return (
                  <div key={i} className="rounded-lg border border-border-subtle bg-canvas-subtle/70 hover:border-accent/40 transition-colors group" data-testid="chat-file-row">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (canExpand) setExpandedDiffIdx(diffExpanded ? null : i);
                          else if (m.file) selectFile(m.file);
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                        data-testid="file-row-main"
                        title={canExpand ? (diffExpanded ? 'Collapse diff' : 'Show inline diff') : `Open ${m.file || ''} in editor`}
                      >
                        <AppIcon name="fileDiff" size={12} className="text-accent shrink-0" />
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
                      </button>
                      <button
                        type="button"
                        onClick={() => m.file && selectFile(m.file)}
                        className="p-1 rounded hover:bg-canvas-elevated text-ink-muted hover:text-accent transition-colors shrink-0"
                        title="Open in editor"
                        data-testid="file-row-open"
                      >
                        <AppIcon name="chevronRight" size={12} className={`transition-transform ${diffExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                    {diffOps && (
                      <div className="border-t border-border-subtle" data-testid="file-diff-panel">
                        <div className="flex items-center justify-between px-3 py-1 text-[9px] font-mono text-ink-muted bg-canvas-elevated/60 border-b border-border-subtle">
                          <span className="truncate">unified diff · {m.file}</span>
                          <span className="flex gap-2 shrink-0">
                            <span className="text-emerald-500">+{diffStats2?.added || 0}</span>
                            <span className="text-red-400">-{diffStats2?.removed || 0}</span>
                          </span>
                        </div>
                        <div className="max-h-56 overflow-auto px-1 py-1" data-testid="file-diff-lines">
                          {(diffOps.length > 600 ? diffOps.slice(0, 600) : diffOps).map((op, k) => (
                            <div
                              key={k}
                              className={`flex text-[10px] leading-[1.45] font-mono ${
                                op.type === 'add'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : op.type === 'del'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'text-ink-muted'
                              }`}
                            >
                              <span className="w-6 shrink-0 text-right pr-1.5 select-none opacity-60">
                                {op.type === 'add' ? '+' : op.type === 'del' ? '\u2212' : ' '}
                              </span>
                              <span className="min-w-0 whitespace-pre-wrap break-all">{op.text || ' '}</span>
                            </div>
                          ))}
                          {diffOps.length > 600 && (
                            <div className="px-2 py-1 text-[9px] text-ink-muted">
                              … {diffOps.length - 600} more lines (open in editor for full file)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
                    <AppIcon name="bot" size={12} />
                  </div>
                  <div className="max-w-[92%] px-3.5 py-2.5 rounded-xl rounded-tl-sm text-xs leading-relaxed bg-canvas-surface border border-border text-paper-200 space-y-1">
                    <CopilotMarkdown text={m.content} />
                  </div>
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
                    <AppIcon name="crosshair" size={12} className="text-accent shrink-0" />
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
                    <AppIcon name="close" size={12} />
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
                        <AppIcon name="close" size={10} />
                      </button>
                    </div>
                  ))}
                  <span className="text-[10px] text-accent/80 font-mono flex items-center gap-1">
                    <AppIcon name="sparkles" size={11} /> Multimodal Prompt Active
                  </span>
                </div>
              )}

              {mentionQuery !== null && mentionMatches.length > 0 && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-2 max-h-52 overflow-auto rounded-lg border border-border bg-canvas-elevated shadow-xl z-20 py-1"
                  data-testid="file-mention-dropdown"
                  role="listbox"
                  aria-label="File mentions"
                >
                  {mentionMatches.map((p, i) => (
                    <button
                      key={p}
                      type="button"
                      role="option"
                      aria-selected={i === mentionIdx}
                      onClick={() => insertMention(p)}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] font-mono truncate flex items-center gap-2 cursor-pointer ${
                        i === mentionIdx
                          ? 'bg-accent/15 text-paper-100'
                          : 'text-ink-muted hover:bg-canvas-overlay'
                      }`}
                    >
                      <AppIcon name="file" size={11} className="shrink-0 opacity-70" />
                      {p}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={composerRef}
                value={copilotInput}
                onChange={handleComposerChange}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  const mentionOpen = mentionQuery !== null && mentionMatches.length > 0;
                  if (mentionOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    setMentionIdx(prev => (e.key === 'ArrowDown'
                      ? (prev + 1) % mentionMatches.length
                      : (prev - 1 + mentionMatches.length) % mentionMatches.length));
                    return;
                  }
                  if (mentionOpen && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                    e.preventDefault();
                    insertMention(mentionMatches[mentionIdx] || mentionMatches[0]);
                    return;
                  }
                  if (e.key === 'Escape' && mentionQuery !== null) {
                    e.stopPropagation();
                    setMentionQuery(null);
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const raw = copilotInput.trim();
                    const sideAsk = raw.startsWith('/btw');
                    if ((raw && (!running || sideAsk)) || (pastedImages.length > 0 && !running)) handleSend();
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
                    {isListening ? <AppIcon name="micOff" size={13} /> : <AppIcon name="mic" size={13} />}
                  </button>

                  <label
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Attach screenshot or image (or Ctrl+V directly)"
                  >
                    <AppIcon name="paperclip" className="w-3.5 h-3.5" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>

                  <button
                    type="button"
                    onClick={() => { setTerminalOpen(!terminalOpen); setBottomPanelTab('terminal'); }}
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Toggle Terminal"
                  >
                    <AppIcon name="terminal" className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTerminalOpen(true); setBottomPanelTab('database'); }}
                    className="p-1.5 rounded-md flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                    title="Open Database Explorer"
                  >
                    <AppIcon name="database" className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Submit Action */}
                <div className="flex items-center gap-2">
                  {healCount > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                      <AppIcon name="wrench" size={9} /> {healCount} healed
                    </span>
                  )}
                  <span className="text-[10px] text-ink-muted font-mono hidden sm:inline-flex items-center gap-1">
                    <kbd className="px-1 py-px rounded border border-border-subtle bg-canvas-base text-[9px]">↵</kbd> send
                    <kbd className="px-1 py-px rounded border border-border-subtle bg-canvas-base text-[9px]">⇧↵</kbd> line
                  </span>
                  {running ? (
                    <button
                      onClick={handleStopRun}
                      title="Stop run (Esc)"
                      className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-[0_0_10px_rgba(239,68,68,0.4)] cursor-pointer"
                      data-testid="copilot-stop-btn"
                    >
                      <AppIcon name="square" size={10} />
                    </button>
                  ) : (
                    <button
                      data-testid="copilot-send-btn"
                      onClick={() => handleSend()}
                      disabled={!copilotInput.trim() && pastedImages.length === 0}
                      className="w-7 h-7 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:hover:bg-accent text-white flex items-center justify-center transition-all shadow-glow-sm cursor-pointer"
                    >
                      <AppIcon name="arrowUp" className="w-4 h-4" />
                    </button>
                  )}
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
                    <AppIcon name="folderTree" size={14} />
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
                    {/* P8: multiplayer presence — humans + AI-Dost Agent */}
                    <div
                      className="flex items-center gap-2 px-3 py-1 border-b border-border-subtle bg-canvas-surface/70 text-[10px] shrink-0"
                      data-testid="collab-presence"
                    >
                      <AppIcon name="users" size={11} className="text-ink-muted shrink-0" />
                      <span className="text-ink-muted shrink-0 font-medium">Live:</span>
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {collabPeers.length === 0 && (
                          <span className="text-ink-muted font-mono">connecting…</span>
                        )}
                        {collabPeers.map(p => (
                          <span
                            key={p.clientId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border-subtle"
                            style={{ background: `${p.color}1f` }}
                            title={p.editing ? `editing ${p.editing}` : p.name}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="truncate max-w-[110px] font-mono" style={{ color: p.color }}>
                              {p.name}{p.isSelf ? ' (you)' : ''}
                            </span>
                            {p.agent && (
                              <span className="px-1 rounded bg-accent/15 text-accent font-semibold shrink-0">agent</span>
                            )}
                            {p.editing && (
                              <span className="text-ink-muted truncate max-w-[130px] font-mono hidden sm:inline">
                                ↳ {p.editing}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Smart Missing Dependency Detector & 1-Click Installer */}
                    {detectedMissingPackages.length > 0 && (
                      <div className="bg-indigo-950/90 border-b border-indigo-500/40 px-3 py-1.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1 z-20 shrink-0">
                        <div className="flex items-center gap-2 text-indigo-200 min-w-0">
                          <AppIcon name="package" size={14} className="text-indigo-400 shrink-0 animate-pulse" />
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
                          <AppIcon name="zap" size={11} />
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
                                <AppIcon name="sparkles" size={24} />
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
                            <AppIcon name="code" size={28} className="text-ink-muted/40" />
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
                          <AppIcon name="terminal" size={12} /> Terminal
                        </button>
                        <button
                          onClick={() => setBottomPanelTab('database')}
                          className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                            bottomPanelTab === 'database'
                              ? 'text-paper-100 border-amber-400 bg-amber-500/5'
                              : 'text-ink-muted border-transparent hover:text-paper-200 hover:bg-canvas-surface/30'
                          }`}
                        >
                          <AppIcon name="database" size={12} /> Database
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {bottomPanelTab === 'terminal' && (
                          <>
                            <button
                              onClick={runSingleFile}
                              className="px-2 py-0.5 rounded-xs text-[10px] font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 border border-border cursor-pointer transition-fast"
                            >
                              <AppIcon name="play" size={10} className="inline mr-1" /> Run File
                            </button>
                            <button
                              onClick={() => terminalRef.current?.clear()}
                              className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                              title="Clear Terminal"
                            >
                              <AppIcon name="eraser" size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setTerminalOpen(false)}
                          className="p-1 rounded-xs hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 cursor-pointer transition-fast"
                          title="Close Panel"
                        >
                          <AppIcon name="close" size={13} />
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
                previewLogs={previewLogs}
                onClearLogs={() => setPreviewLogs([])}
                consoleOpen={consoleOpen}
                setConsoleOpen={setConsoleOpen}
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
                <AppIcon name="sparkles" className="w-4 h-4 text-indigo-400" />
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
                {inlineEditLoading ? <AppIcon name="loader" className="w-3.5 h-3.5" /> : <AppIcon name="sparkles" className="w-3.5 h-3.5" />}
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
      <PromptModal
        modal={promptModal}
        onClose={() => setPromptModal(null)}
        onSubmit={(value) => {
          const modal = promptModal;
          setPromptModal(null);
          const path = modal?.parentFolder ? `${modal.parentFolder}/${value}` : value;
          if (modal?.type === 'folder') handleCreateFolder(path);
          else if (modal?.type === 'file') handleCreateFile(path);
          else if (modal?.type === 'rename') renamePath(modal.oldPath, value);
        }}
      />

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