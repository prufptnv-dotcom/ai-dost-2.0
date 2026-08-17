import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  FolderTree, Search, GitBranch, Puzzle, X, Plus, Save,
  Send, Sparkles, Play, Terminal as TerminalIcon,
  Loader2, Bot, Eraser, Eye, Download, Square, RotateCcw, Settings2,
  FilePlus2, FolderPlus, Pencil, Trash2, SaveAll, PanelLeftClose, PanelLeftOpen, ChevronRight, GitCompareArrows, Database
} from 'lucide-react';
import api from '../../services/api';
import { LANG_BY_EXT, TreeView, fileTreeFromFiles } from './CopilotTree';
import { PromptModal, QuickOpen, CommandPalette, SearchOverlay, MODAL_ICONS } from './IDEOverlays';
import DiffReviewModal from './DiffReviewModal';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const TerminalPanel = dynamic(() => import('./TerminalPanel'), { ssr: false });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const QUICK_PROMPTS = [
  { label: 'Fullstack app banao', prompt: 'MERN stack todo app banao with authentication — sab files likho (backend, frontend, DB schema)' },
  { label: 'Bug fix', prompt: 'Is code me bugs dhundho aur fix karo. Har file analyse karo.' },
  { label: 'Feature add', prompt: 'Dark mode toggle add karo with localStorage persistence.' },
  { label: 'Tests likho', prompt: 'Unit tests likho aur run karo.' },
];

// Agent tool action → human-readable live status
const STATUS_BY_ACTION = {
  write_file: '✍️ Writing files...',
  create_file: '✍️ Writing files...',
  apply_diff: '✏️ Editing code...',
  read_file: '📖 Reading files...',
  list_directory: '📂 Browsing files...',
  run_terminal: '💻 Running terminal commands...',
  run_terminal_auto: '💻 Running terminal commands...',
  run_tests: '🧪 Running tests...',
  search_codebase: '🔍 Searching codebase...',
  git_init: '🔀 Initializing git...',
  git_add: '🔀 Staging files...',
  git_commit: '🔀 Committing changes...',
  git_branch: '🔀 Managing branches...',
  git_log: '🔀 Reading git history...',
  get_current_branch: '🔀 Reading git branch...',
  init_git: '🔀 Initializing git...',
};

// File extension → brand color (for tab icons)
const LANG_COLOR = {
  js: '#f7df1e', mjs: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
  html: '#e34f26', htm: '#e34f26', css: '#563d7c', scss: '#cd6799',
  py: '#3776ab', json: '#fbcb40', md: '#8b949e', txt: '#8b949e',
  java: '#f89820', c: '#a8b9cc', cpp: '#659ad2', go: '#00add8',
  rs: '#dea584', sh: '#89e051', yml: '#cb171e', yaml: '#cb171e',
  xml: '#e34f26', svg: '#ffb13b', sql: '#e38c00', php: '#777bb4',
  rb: '#cc342d', lock: '#fbcb40',
};

export default function CopilotIDE({ projectId = 'copilot-workspace', projectName = 'Copilot Workspace', onToast }) {
  const [files, setFiles] = useState([]);
  const [openTabs, setOpenTabs] = useState([]); // editor me khule huye file paths (tab = open file)
  const [activePath, setActivePath] = useState(null);
  const [contents, setContents] = useState({}); // unsaved content per path (dirty files)
  const [dirtyPaths, setDirtyPaths] = useState(() => new Set());
  const [activityBar, setActivityBar] = useState('explorer');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    { role: 'assistant', content: 'Namaste! Main **Copilot** hoon. Kya banayein? Fullstack project, bug fix, feature add — ek prompt me batao. 👇' },
  ]);
  const [running, setRunning] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [problems, setProblems] = useState(0);
  // Live process indicator: { label, tone: 'work'|'info'|'success'|'error'|'selfheal' }
  const [copilotStatus, setCopilotStatus] = useState({ label: '', tone: 'info' });
  const terminalRef = useRef(null);
  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const diagTimerRef = useRef(null);
  const abortRef = useRef(null);
  const activePathRef = useRef(null);
  const termMsgIdxRef = useRef(-1);
  const endRef = useRef(null);
  // Live plan tasks from SSE 'plan' events: [{id, title, status}]
  const [planTasks, setPlanTasks] = useState([]);
  // Live preview pane (iframe inside IDE — project ke andar hi dikhta hai)
  const [previewOpen, setPreviewOpen] = useState(false);
  // Plan → Approve gate (GitHub Copilot style): show plan, wait for approval
  const [planGate, setPlanGate] = useState(true);
  const [pendingPlan, setPendingPlan] = useState(null);
  // Custom instructions for the agent
  const [showInstructions, setShowInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  // Find in Files (Ctrl+Shift+F)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchCase, setSearchCase] = useState(false);
  const [searching, setSearching] = useState(false);
  // Diff Review: latest run id + change count for the "Review Changes" button
  const [latestRunId, setLatestRunId] = useState(null);
  const latestRunIdRef = useRef(null);
  const [runChangeCount, setRunChangeCount] = useState(0);
  const [diffOpen, setDiffOpen] = useState(false);
  // Reveal-at-line after opening a search result
  const pendingRevealRef = useRef(null);
  const [revealTick, setRevealTick] = useState(0);

  useEffect(() => { activePathRef.current = activePath; }, [activePath]);

  // Derived: active file content = unsaved contents[path] ?? saved files[path]
  const activeContent = useMemo(() => {
    if (!activePath) return '';
    return contents[activePath] ?? files.find(f => f.path === activePath)?.content ?? '';
  }, [activePath, contents, files]);
  const dirty = dirtyPaths.has(activePath);

  const markDirty = (p) => setDirtyPaths(prev => {
    if (prev.has(p)) return prev;
    const n = new Set(prev);
    n.add(p);
    return n;
  });
  const clearDirty = (p) => setDirtyPaths(prev => {
    if (!prev.has(p)) return prev;
    const n = new Set(prev);
    n.delete(p);
    return n;
  });
  const setFileContent = (p, v) => setContents(prev => (prev[p] === v ? prev : { ...prev, [p]: v }));

  // Auto-scroll chat to bottom as the agent streams messages in
  useEffect(() => {
    if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;
  }, [copilotMessages]);

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
  }), [onToast]);

  // Load project files
  useEffect(() => {
    (async () => {
      setLoadingFiles(true);
      setContents({});
      setDirtyPaths(new Set());
      try {
        let res = await api.get(`/memory/project/${projectId}`);
        let fileArr = Array.isArray(res.data?.files) ? res.data.files : [];
        if (fileArr.length === 0) {
          fileArr.push(
            { path: 'README.md', content: `# ${projectName}\n\nAI-Dost Copilot workspace — yahan se fullstack project banao.\n` },
            { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head><title>' + projectName + '</title></head>\n<body>\n  <h1>' + projectName + '</h1>\n</body>\n</html>\n' },
            { path: 'app.js', content: '// AI-Dost Copilot workspace\nconsole.log("Hello from AI-Dost!");\n' },
          );
        }
        setFiles(fileArr);
        if (fileArr.length > 0) {
          setActivePath(fileArr[0].path);
          setOpenTabs(fileArr.slice(0, 10).map(f => f.path));
        }
      } catch (e) {
        if (e?.status === 404 || /not found/i.test(e?.message || '')) {
          try {
            await api.post('/memory/project', { project_id: projectId, project_name: projectName, description: `${projectName} — AI-Dost Copilot workspace` });
            const res = await api.get(`/memory/project/${projectId}`);
            const fileArr = Array.isArray(res.data?.files) ? res.data.files : [];
            if (fileArr.length > 0) {
              setFiles(fileArr);
              setActivePath(fileArr[0].path);
              setOpenTabs(fileArr.slice(0, 10).map(f => f.path));
            }
            showToast('Project create ho gaya', 'success');
            return;
          } catch (e2) { /* backend off */ }
        }
        const fallback = [
          { path: 'README.md', content: `# ${projectName}\n\nAI-Dost Copilot workspace.\n` },
          { path: 'app.js', content: '// AI-Dost Copilot workspace\nconsole.log("Hello from AI-Dost!");\n' },
        ];
        setFiles(fallback);
        setActivePath('app.js');
        setOpenTabs(['app.js', 'README.md']);
        showToast('Files load nahi hue — offline workspace', 'warning');
      } finally {
        setLoadingFiles(false);
      }
    })();
  }, [projectId, projectName, showToast]);

  const selectFile = (f) => {
    setActivePath(f.path);
    setOpenTabs(prev => prev.includes(f.path) ? prev : [...prev, f.path]);
  };

  // Search results → open the file and jump to the matching line
  const openSearchResult = (r) => {
    setSearchOpen(false);
    pendingRevealRef.current = { path: r.path, line: Math.max(1, r.line || 1) };
    const f = files.find(x => x.path === r.path);
    if (f) selectFile(f);
    else {
      setActivePath(r.path);
      setOpenTabs(prev => prev.includes(r.path) ? prev : [...prev, r.path]);
    }
    setRevealTick(t => t + 1);
  };

  // Debounced find-in-files query → backend line search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!searchOpen || !q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/memory/project/${projectId}/search?q=${encodeURIComponent(q)}&case=${searchCase ? '1' : '0'}`);
        setSearchResults(Array.isArray(r.data?.results) ? r.data.results : []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchOpen, searchQuery, searchCase, projectId]);

  // Reveal the target line once the file is open in the editor
  useEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending || !activePath || pending.path !== activePath) return;
    const editor = editorRef.current;
    if (!editor) return;
    pendingRevealRef.current = null;
    const line = Math.max(1, pending.line || 1);
    try {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    } catch (_) {}
  }, [activePath, revealTick, activeContent]);

  // Tab close: file DB se delete nahi hota — sirf editor se band hota hai (tree me rehta hai)
  const closeTab = useCallback((path) => {
    if (path === activePath && dirtyPaths.has(path)) {
      if (!window.confirm(`"${path}" save nahi hua — phir bhi close karein?`)) return;
    }
    setOpenTabs(prev => {
      const next = prev.filter(p => p !== path);
      if (path === activePathRef.current) {
        const nextOpen = next.map(p => files.find(f => f.path === p)).filter(Boolean);
        const target = nextOpen[nextOpen.length - 1];
        setActivePath(target?.path || null);
      }
      return next;
    });
  }, [files, activePath, dirtyPaths]);

  const saveActiveFile = useCallback(async () => {
    if (!activePath) return;
    const content = contents[activePath] ?? activeContent;
    try {
      await api.put(`/memory/project/${projectId}/file`, { path: activePath, content });
      clearDirty(activePath);
      showToast('File saved', 'success');
    } catch (e) {
      showToast('Save failed — backend off?', 'error');
    }
  }, [activePath, activeContent, contents, projectId, showToast]);

  const saveAllFiles = useCallback(async () => {
    if (dirtyPaths.size === 0) return;
    const dirtyList = [...dirtyPaths];
    try {
      await Promise.all(dirtyList.map(p => {
        const f = files.find(ff => ff.path === p);
        const content = contents[p] ?? f?.content ?? '';
        return f ? api.put(`/memory/project/${projectId}/file`, { path: p, content }) : Promise.resolve();
      }));
      setDirtyPaths(new Set());
      showToast(`${dirtyList.length} files save ho gayi`, 'success');
    } catch (e) {
      showToast('Save all fail — backend off?', 'error');
    }
  }, [dirtyPaths, files, contents, projectId, showToast]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveActiveFile]);

  const deleteFilePath = async (path) => {
    if (!window.confirm(`"${path}" delete karein?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/file`, { params: { path } });
      setFiles(prev => prev.filter(f => f.path !== path));
      setOpenTabs(prev => prev.filter(p => p !== path));
      setContents(prev => { const n = { ...prev }; delete n[path]; return n; });
      clearDirty(path);
      if (activePathRef.current === path) {
        const next = files.find(f => f.path !== path);
        setActivePath(next?.path || null);
      }
      showToast(`"${path}" delete ho gaya`, 'success');
    } catch (e) {
      showToast('Delete fail — backend off?', 'error');
    }
  };

  const deleteFolder = async (folderPath) => {
    if (!window.confirm(`"${folderPath}" folder + andar ki saari files delete karein?`)) return;
    try {
      await api.delete(`/memory/project/${projectId}/folder`, { params: { path: folderPath } });
      setFiles(prev => prev.filter(f => f.path !== folderPath && !f.path.startsWith(folderPath + '/')));
      setOpenTabs(prev => prev.filter(p => p !== folderPath && !p.startsWith(folderPath + '/')));
      setContents(prev => {
        const n = { ...prev };
        for (const k of Object.keys(n)) {
          if (k === folderPath || k.startsWith(folderPath + '/')) delete n[k];
        }
        return n;
      });
      setDirtyPaths(prev => {
        const n = new Set();
        for (const p of prev) {
          if (p !== folderPath && !p.startsWith(folderPath + '/')) n.add(p);
        }
        return n;
      });
      if (activePathRef.current === folderPath || activePathRef.current?.startsWith(folderPath + '/')) {
        setActivePath(null);
      }
      showToast(`Folder "${folderPath}" delete ho gaya`, 'success');
    } catch (e) {
      showToast('Delete fail — backend off?', 'error');
    }
  };

  const renamePath = async (oldPath, newPath) => {
    if (!oldPath || !newPath || oldPath === newPath) return;
    try {
      await api.post(`/memory/project/${projectId}/rename`, { oldPath, newPath });
      setFiles(prev => prev.map(f =>
        f.path === oldPath ? { ...f, path: newPath }
        : f.path.startsWith(oldPath + '/') ? { ...f, path: newPath + f.path.slice(oldPath.length) }
        : f
      ));
      setOpenTabs(prev => prev.map(p =>
        p === oldPath ? newPath : p.startsWith(oldPath + '/') ? newPath + p.slice(oldPath.length) : p
      ));
      setContents(prev => {
        const n = {};
        for (const [k, v] of Object.entries(prev)) {
          if (k === oldPath) n[newPath] = v;
          else if (k.startsWith(oldPath + '/')) n[newPath + k.slice(oldPath.length)] = v;
          else n[k] = v;
        }
        return n;
      });
      setDirtyPaths(prev => {
        const n = new Set();
        for (const p of prev) {
          if (p === oldPath) n.add(newPath);
          else if (p.startsWith(oldPath + '/')) n.add(newPath + p.slice(oldPath.length));
          else n.add(p);
        }
        return n;
      });
      setActivePath(prev =>
        prev === oldPath ? newPath
        : (prev && prev.startsWith(oldPath + '/')) ? newPath + prev.slice(oldPath.length)
        : prev
      );
      showToast(`"${oldPath}" → "${newPath}"`, 'success');
    } catch (e) {
      showToast('Rename fail — backend off?', 'error');
    }
  };

  const createFileInFolder = (folderPath) => {
    setUiModal({ type: 'fileIn', folder: folderPath });
  };

  const createFolderInFolder = (folderPath) => {
    setUiModal({ type: 'folderIn', folder: folderPath });
  };

  const runSingleFile = useCallback(() => {
    if (!activePath || running) return;
    const ext = activePath.split('.').pop();
    const cmd = ext === 'py' ? `python "${activePath}"` : `node "${activePath}"`;
    if (terminalRef.current?.runCommand) {
      terminalRef.current.runCommand(cmd);
      if (!terminalOpen) setTerminalOpen(true);
    } else {
      showToast('Terminal ready nahi hai', 'warning');
    }
  }, [activePath, running, terminalOpen, showToast]);

  // Right-click context menu (VS Code style)
  const [ctxMenu, setCtxMenu] = useState(null);
  // Modal dialog (replaces window.prompt): newFile | newFolder | fileIn | folderIn | rename
  const [uiModal, setUiModal] = useState(null);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  const submitModal = (value) => {
    const modal = uiModal;
    setUiModal(null);
    if (!modal || !value) return;
    if (modal.type === 'rename') {
      const oldName = modal.path.split('/').pop();
      const newPath = `${modal.path.slice(0, modal.path.length - oldName.length)}${value}`;
      renamePath(modal.path, newPath);
      return;
    }
    const clean = value.replace(/^\/+|\/+$/g, '');
    if (modal.type === 'newFile' || modal.type === 'fileIn') {
      const full = modal.type === 'fileIn' ? `${modal.folder}/${clean}` : clean;
      if (files.some(f => f.path === full)) { showToast('File already exists', 'warning'); return; }
      const content = full.endsWith('.py') ? '# Python file\n' : '// New file\n';
      setFiles(prev => [...prev, { path: full, content }]);
      setActivePath(full);
      setOpenTabs(prev => prev.includes(full) ? prev : [...prev, full]);
      api.post(`/memory/project/${projectId}/file`, { path: full, content }).catch(() => {});
    } else {
      const full = modal.type === 'folderIn' ? `${modal.folder}/${clean}` : clean;
      if (!full || full.includes('..')) { showToast('Invalid folder name', 'error'); return; }
      if (files.some(f => f.path.startsWith(full + '/'))) { showToast('Folder already exists', 'warning'); return; }
      const gitkeep = `${full}/.gitkeep`;
      setFiles(prev => [...prev, { path: gitkeep, content: '' }]);
      setOpenTabs(prev => prev.includes(gitkeep) ? prev : [...prev, gitkeep]);
      setActivePath(gitkeep);
      api.post(`/memory/project/${projectId}/folder`, { path: full })
        .then(() => showToast(`Folder "${full}" ban gaya`, 'success'))
        .catch(() => showToast('Folder create fail — backend off?', 'error'));
    }
  };

  const modalSpec = (() => {
    if (!uiModal) return null;
    const base = { initial: '', okLabel: 'Create' };
    if (uiModal.type === 'rename') {
      return {
        ...base,
        title: 'Rename',
        placeholder: 'Naya naam',
        initial: uiModal.path.split('/').pop(),
        okLabel: 'Rename',
        hint: uiModal.path,
        icon: MODAL_ICONS.rename,
      };
    }
    if (uiModal.type === 'newFile' || uiModal.type === 'fileIn') {
      return {
        ...base,
        title: uiModal.type === 'fileIn' ? `New File — ${uiModal.folder}/` : 'New File',
        placeholder: 'file.txt ya utils.py (subfolder bhi: src/app.js)',
        hint: uiModal.type === 'fileIn' ? `Folder: ${uiModal.folder}` : undefined,
        icon: MODAL_ICONS.newFile,
      };
    }
    return {
      ...base,
      title: uiModal.type === 'folderIn' ? `New Folder — ${uiModal.folder}/` : 'New Folder',
      placeholder: 'src/components (nested allowed)',
      hint: uiModal.type === 'folderIn' ? `Folder: ${uiModal.folder}` : undefined,
      icon: MODAL_ICONS.newFolder,
    };
  })();

  // Keybindings: Ctrl+P quick open, Ctrl+Shift+P command palette, Ctrl+B sidebar,
  // Ctrl+W close tab, Ctrl+Shift+S save all, Ctrl+` terminal, F2 rename
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toLowerCase();
      if (mod && k === 'p' && e.shiftKey) {
        e.preventDefault();
        setCmdPaletteOpen(o => !o);
      } else if (mod && k === 'f' && e.shiftKey) {
        e.preventDefault();
        setSearchOpen(o => !o);
      } else if (mod && k === 'p') {
        e.preventDefault();
        setQuickOpenOpen(o => !o);
      } else if (mod && k === 'b') {
        e.preventDefault();
        setSidebarHidden(h => !h);
      } else if (mod && k === 'w') {
        e.preventDefault();
        if (activePathRef.current) closeTab(activePathRef.current);
      } else if (mod && e.shiftKey && k === 's') {
        e.preventDefault();
        saveAllFiles();
      } else if (mod && k === '`') {
        e.preventDefault();
        setTerminalOpen(t => !t);
      } else if (k === 'f2') {
        e.preventDefault();
        if (activePathRef.current) setUiModal({ type: 'rename', path: activePathRef.current });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeTab, saveAllFiles]);

  const commands = useMemo(() => [
    { label: 'Quick Open File', key: 'Ctrl+P', icon: <Search className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />, run: () => setQuickOpenOpen(true) },
    { label: 'Find in Files', key: 'Ctrl+Shift+F', icon: <Search className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-accent)' }} />, run: () => setSearchOpen(true) },
    { label: 'New File', key: 'Ctrl+N', icon: <FilePlus2 className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />, run: () => setUiModal({ type: 'newFile' }) },
    { label: 'New Folder', icon: <FolderPlus className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />, run: () => setUiModal({ type: 'newFolder' }) },
    { label: 'Save File', key: 'Ctrl+S', icon: <Save className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-success)' }} />, run: () => saveActiveFile() },
    { label: `Save All Files${dirtyPaths.size ? ` (${dirtyPaths.size})` : ''}`, key: 'Ctrl+Shift+S', icon: <SaveAll className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-success)' }} />, run: () => saveAllFiles() },
    { label: 'Close Tab', key: 'Ctrl+W', icon: <X className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-warning)' }} />, run: () => activePathRef.current && closeTab(activePathRef.current) },
    { label: 'Rename Active File', key: 'F2', icon: <Pencil className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-accent)' }} />, run: () => activePathRef.current && setUiModal({ type: 'rename', path: activePathRef.current }) },
    { label: 'Toggle Terminal', key: 'Ctrl+`', icon: <TerminalIcon className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-teal)' }} />, run: () => setTerminalOpen(t => !t) },
    { label: 'Open Live Preview', icon: <Eye className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-success)' }} />, run: () => window.open('http://localhost:3000', '_blank') },
    { label: 'Toggle Copilot Chat', icon: <Sparkles className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-secondary)' }} />, run: () => setCopilotOpen(o => !o) },
    { label: 'Toggle Sidebar', key: 'Ctrl+B', icon: sidebarHidden ? <PanelLeftOpen className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} /> : <PanelLeftClose className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />, run: () => setSidebarHidden(h => !h) },
    { label: `Plan Gate: ${planGate ? 'ON (plan → approve)' : 'OFF (autopilot)'}`, icon: <Settings2 className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-info)' }} />, run: () => setPlanGate(g => !g) },
    { label: 'Run Active File', icon: <Play className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-success)' }} />, run: () => runSingleFile() },
    { label: 'Clear Terminal', icon: <Eraser className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />, run: () => terminalRef.current?.clear() },
    { label: 'Download Workspace ZIP', icon: <Download className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-info)' }} />, run: () => { window.open(`${BACKEND}/api/preview/${projectId}/zip`, '_blank'); } },
  ], [saveActiveFile, saveAllFiles, dirtyPaths.size, sidebarHidden, planGate, projectId, closeTab, runSingleFile]);

  const runCommand = (c) => {
    setCmdPaletteOpen(false);
    c.run();
  };
  const openCtxMenu = (e, path, isDir) => {
    e.preventDefault();
    const menuW = 180;
    const menuH = isDir ? 170 : 90;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setCtxMenu({ x, y, path, isDir });
  };
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') setCtxMenu(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  const ctxRename = () => {
    if (!ctxMenu) return;
    const path = ctxMenu.path;
    setCtxMenu(null);
    setUiModal({ type: 'rename', path });
  };
  const ctxDelete = () => {
    if (!ctxMenu) return;
    const { path, isDir } = ctxMenu;
    setCtxMenu(null);
    if (isDir) deleteFolder(path);
    else deleteFilePath(path);
  };

  const addFile = () => {
    setUiModal({ type: 'newFile' });
  };

  const addFolder = () => {
    setUiModal({ type: 'newFolder' });
  };

  const deleteFile = () => {
    if (!activePath) return;
    deleteFilePath(activePath);
  };

  // Plan → Approve gate: fetch the plan first, show it, run only on approval
  const handleSend = async (text) => {
    const prompt = (text || copilotInput).trim();
    if (!prompt || running) return;
    if (!planGate) return runCopilot(prompt);
    setCopilotInput('');
    setCopilotMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setCopilotStatus({ label: '📋 Plan bana raha hoon...', tone: 'info' });
    try {
      const res = await fetch(`${BACKEND}/api/agent/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json();
      const tasks = Array.isArray(data.plan?.tasks) ? data.plan.tasks : [];
      if (tasks.length === 0) return runCopilot(prompt);
      setPendingPlan({ prompt, summary: data.plan?.summary || '', tasks });
      setCopilotStatus({ label: '🛡 Plan approve karo — phir agent kaam shuru karega', tone: 'info' });
    } catch (e) {
      setCopilotStatus({ label: '📋 Plan fetch fail — direct run', tone: 'info' });
      runCopilot(prompt);
    }
  };

  const approvePlan = () => {
    if (!pendingPlan) return;
    const prompt = pendingPlan.prompt;
    setPendingPlan(null);
    runCopilot(prompt);
  };

  const cancelPlan = () => {
    setPendingPlan(null);
    setCopilotStatus({ label: '', tone: 'info' });
  };

  // 1-click undo: restore workspace + DB to a checkpoint snapshot
  const rollbackTo = async (dir) => {
    if (running) return;
    setCopilotStatus({ label: '⏪ Rollback ho raha hai...', tone: 'info' });
    try {
      const r = await fetch(`${BACKEND}/api/agent/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, snapshotDir: dir }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Rollback failed');
      // Refresh tree from DB (post-run there is no open SSE stream for events)
      try {
        const fres = await api.get(`/memory/project/${projectId}`);
        if (Array.isArray(fres.data?.files) && fres.data.files.length > 0) {
          setFiles(fres.data.files);
          setContents({});
          setDirtyPaths(new Set());
          setActivePath(fres.data.files[0].path);
        }
      } catch (e) { /* noop */ }
      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        kind: 'warn',
        content: `⏪ Rollback done: ${data.restored.length} files restore hue${data.removed?.length ? `, ${data.removed.length} naye files remove hue` : ''}`,
      }]);
      setCopilotStatus({ label: '⏪ Rollback complete', tone: 'success' });
      // noop
    } catch (e) {
      setCopilotStatus({ label: '⏪ Rollback failed', tone: 'error' });
      showToast(e?.message || 'Rollback failed', 'error');
    }
  };

  const runCopilot = async (text) => {
    const prompt = (text || copilotInput).trim();
    if (!prompt || running) return;
    setCopilotInput('');
    setCopilotMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setRunning(true);
    setPlanTasks([]);
    setRunChangeCount(0);
    termMsgIdxRef.current = -1;
    setCopilotStatus({ label: '🚀 Starting agent...', tone: 'info' });
    setCopilotMessages(prev => [...prev, { role: 'thinking', content: 'Deep analysing...' }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const body = {
        userPrompt: prompt,
        projectPath: '',
        projectFiles: files.map(f => ({ path: f.path, content: contents[f.path] ?? f.content })),
        projectId,
        saveToRepo: false,
        forceLocal: false,
        customInstructions: customInstructions.trim() || undefined,
      };

      // Inject MCP Config if a default one exists in localStorage
      try {
        const savedMcp = localStorage.getItem('mcp_configs');
        if (savedMcp) {
          const configs = JSON.parse(savedMcp);
          if (configs && configs.length > 0) {
            body.mcpConfig = { command: configs[0].command, args: configs[0].args.split(' ') };
          }
        }
      } catch(e) {}

      let res;
      try {
        // Direct to backend SSE (bypasses Next proxy buffering → true real-time)
        res = await fetch(`${BACKEND}/api/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (directErr) {
        if (ctrl.signal.aborted) throw directErr;
        // BUG-011 FIX: fallback also uses direct backend (not Next.js proxy which buffers SSE)
        const fallbackBackend = 'http://localhost:5000';
        res = await fetch(`${fallbackBackend}/api/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      }
      if (!res.ok) throw new Error(`Agent failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let toolCount = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ctrl.signal.aborted) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const evt of chunk.split('\n\n').filter(Boolean)) {
          const dataLine = evt.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(5));
            if (data.type === 'plan') {
              const tasks = Array.isArray(data.plan?.tasks) ? data.plan.tasks : [];
              setPlanTasks(tasks);
              setCopilotStatus({ label: '📋 Planning...', tone: 'info' });
              await sleep(30);
            } else if (data.type === 'thinking') {
              const t = (data.message || data.thought || '').toString().trim();
              setCopilotStatus({
                label: t ? `🤔 ${t.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/u, '')}` : '🤔 Deep analysing...',
                tone: 'info',
              });
              await sleep(30);
            } else if (data.type === 'tool_call') {
              const action = data.action || data.tool || 'tool';
              setCopilotStatus({
                label: STATUS_BY_ACTION[action] || `⚙️ Running: ${action}...`,
                tone: 'work',
              });
              await sleep(30);
              toolCount++;
              const params = typeof data.parameters === 'string' ? data.parameters.slice(0, 80) : JSON.stringify(data.parameters || {}).slice(0, 80);
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'tool', content: `⚙️ ${action} → ${params}...` }]);
            } else if (data.type === 'self_heal') {
              setCopilotStatus({ label: `🔧 ${data.message || 'Self-healing...'}`, tone: 'selfheal' });
              await sleep(30);
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'warn', content: data.message || 'Self-healing...' }]);
            } else if (data.type === 'step' && data.message) {
              setCopilotMessages(prev => [...prev, { role: 'assistant', content: `✅ ${data.message}` }]);
            } else if (data.type === 'error') {
              setCopilotStatus({ label: `⚠️ ${data.message || 'Agent error'}`, tone: 'error' });
              await sleep(30);
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'warn', content: `⚠️ ${data.message || 'Agent error'}` }]);
            } else if (data.type === 'run_started') {
              setLatestRunId(data.runId || null);
              latestRunIdRef.current = data.runId || null;
              setRunChangeCount(0);
            } else if (data.type === 'done') {
              const stepCount = Array.isArray(data.steps) ? data.steps.length : (data.steps || '?');
              setPlanTasks(prev => prev.map(t => ({ ...t, status: 'completed' })));
              setCopilotStatus({ label: `✅ Done — ${stepCount} steps`, tone: 'success' });
              await sleep(30);
              const doneMsg = (data.message || '').trim();
              setCopilotMessages(prev => [...prev, { role: 'assistant', content: doneMsg || `--- Done (${stepCount} steps)` }]);
              // Fetch change count so the "Review Changes" button shows up
              if (latestRunIdRef.current) {
                fetch(`${BACKEND}/api/agent/run-diffs?runId=${encodeURIComponent(latestRunIdRef.current)}`)
                  .then(r => r.json())
                  .then(d => setRunChangeCount(Array.isArray(d?.diffs) ? d.diffs.length : 0))
                  .catch(() => setRunChangeCount(0));
              }
            } else if (data.type === 'screenshot') {
              // Agent's "eyes": render UI screenshot as a chat card
              setCopilotMessages(prev => [...prev, {
                role: 'assistant',
                kind: 'screenshot',
                image: `data:${data.mimeType || 'image/png'};base64,${data.data}`,
                auto: !!data.auto,
              }]);
            } else if (data.type === 'vision') {
              // Gemini vision verdict — what the agent actually SAW in the UI
              const v = String(data.message || '').trim();
              if (v) {
                setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'vision', content: v }]);
              }
            } else if (data.type === 'checkpoint') {
              // Snapshot taken before a mutating tool call → rollback button
              setCopilotMessages(prev => [...prev, {
                role: 'assistant',
                kind: 'checkpoint',
                step: data.step,
                dir: data.dir,
                files: Array.isArray(data.files) ? data.files : [],
              }]);
            } else if (data.type === 'commit') {
              setCopilotMessages(prev => [...prev, { role: 'assistant', kind: 'commit', hash: data.hash }]);
            } else if (data.type === 'terminal_output') {
              const out = String(data.output || '').slice(0, 2000);
              if (!out.trim()) continue;
              setCopilotMessages(prev => {
                const idx = termMsgIdxRef.current;
                if (idx !== -1 && idx < prev.length && prev[idx].kind === 'term') {
                  const next = [...prev];
                  next[idx] = { ...prev[idx], content: (prev[idx].content + out).slice(-8000) };
                  return next;
                }
                termMsgIdxRef.current = prev.length;
                return [...prev, { role: 'assistant', kind: 'term', content: `$ ${data.command || ''}\n${out}` }];
              });
            } else if (data.type === 'file_changed') {
              // Real-time tree/editor/preview updates — no page refresh
              if (data.action === 'delete') {
                setFiles(prev => prev.filter(f => f.path !== data.path));
                setOpenTabs(prev => prev.filter(p => p !== data.path));
                if (activePathRef.current === data.path) { setActivePath(null); }
              } else if (data.action === 'move') {
                setFiles(prev => {
                  const idx = prev.findIndex(f => f.path === data.path);
                  if (idx === -1) return prev;
                  const next = [...prev];
                  next[idx] = { path: data.newPath, content: next[idx].content };
                  return next;
                });
                setOpenTabs(prev => {
                  if (!prev.includes(data.path)) return prev;
                  return prev.map(p => p === data.path ? data.newPath : p);
                });
              } else {
                setFiles(prev => {
                  const idx = prev.findIndex(f => f.path === data.path);
                  if (idx === -1) return [...prev, { path: data.path, content: data.content || '' }];
                  const next = [...prev];
                  next[idx] = { ...next[idx], content: data.content || next[idx].content };
                  return next;
                });
                // Agent ki nayi file automatically tab me khul jaye
                setOpenTabs(prev => prev.includes(data.path) ? prev : [...prev.slice(-9), data.path]);
                setFileContent(data.path, data.content || '');
                if (activePathRef.current === data.path) {
                  clearDirty(data.path);
                }
              }
              // noop
            }
          } catch (e) { /* partial chunk */ }
        }
      }
      setCopilotMessages(prev => prev.filter(m => m.role !== 'thinking'));
      showToast(`Copilot: ${toolCount} tools chale`, 'success');
      // Final safety sync from DB (covers files the agent made via sub-tools)
      try {
        const fres = await api.get(`/memory/project/${projectId}`);
        if (Array.isArray(fres.data?.files) && fres.data.files.length > 0) {
          setFiles(fres.data.files);
          setContents({});
          setDirtyPaths(new Set());
          setOpenTabs(prev => [...prev, ...fres.data.files.slice(0, 10).map(f => f.path)].filter((p, i, a) => a.indexOf(p) === i));
          if (!fres.data.files.some(f => f.path === activePathRef.current)) {
            setActivePath(fres.data.files[0].path);
          }
        }
      } catch (e) { /* noop */ }
    } catch (e) {
      setCopilotMessages(prev => prev.filter(m => m.role !== 'thinking'));
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.name === 'AbortError' ? 'Agent ko stop kar diya gaya' : (e?.message || 'Agent error')}` }]);
      setCopilotStatus({ label: e?.name === 'AbortError' ? '⏹ Stopped' : '⚠️ Agent failed', tone: 'error' });
      if (e?.name !== 'AbortError') {
        showToast(e?.message || 'Agent pipeline interrupted', 'error');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
      setTimeout(() => setCopilotStatus(prev => prev.tone === 'success' || prev.tone === 'error' ? { label: '', tone: 'info' } : prev), 5000);
    }
  };

  const activeLang = activePath ? (LANG_BY_EXT[activePath.split('.').pop()] || 'plaintext') : 'plaintext';
  const tree = fileTreeFromFiles(files);
  const previewTarget = files.find(f => f.path === 'index.html') || files.find(f => f.path.toLowerCase().endsWith('.html')) || null;

  const setMarkers = useCallback((path, diagnostics) => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;
    if (!diagnostics || diagnostics.length === 0) {
      monaco.editor.setModelMarkers(model, 'ai-dost-lsp', []);
      setProblems(0);
      return;
    }
    const markerSeverity = monaco.MarkerSeverity;
    const markers = diagnostics.map((d) => ({
      startLineNumber: d.line || 1,
      startColumn: (d.column || 1) + 1,
      endLineNumber: d.line || 1,
      endColumn: (d.column || 1) + 50,
      message: d.message || 'Issue',
      severity: d.severity === 'error' ? markerSeverity.Error : d.severity === 'info' ? markerSeverity.Info : markerSeverity.Warning,
    }));
    monaco.editor.setModelMarkers(model, 'ai-dost-lsp', markers);
    setProblems(diagnostics.length);
  }, []);

  const runDiagnostics = useCallback((path, content) => {
    const ext = (path || '').split('.').pop();
    const lang = LANG_BY_EXT[ext];
    if (!lang) return;
    if (diagTimerRef.current) clearTimeout(diagTimerRef.current);
    diagTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/agent/lsp-diagnostics', { code: content, language: lang });
        setMarkers(path, Array.isArray(res.data?.diagnostics) ? res.data.diagnostics : []);
      } catch (e) { /* LSP offline */ }
    }, 500);
  }, [setMarkers]);

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (activePath) runDiagnostics(activePath, activeContent);
    const pending = pendingRevealRef.current;
    if (pending && pending.path === activePath) {
      pendingRevealRef.current = null;
      const line = Math.max(1, pending.line || 1);
      try {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      } catch (_) {}
    }
  };

  // Clear diagnostics when switching files
  useEffect(() => {
    if (diagTimerRef.current) clearTimeout(diagTimerRef.current);
    setProblems(0);
    if (activePath) runDiagnostics(activePath, activeContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ backgroundColor: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)' }}>
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] font-medium truncate" style={{ color: 'var(--color-text-muted)' }}>
          {projectName} — AI-Dost Copilot
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={saveAllFiles}
            disabled={dirtyPaths.size === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer disabled:opacity-40"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: 'var(--color-success)' }}
            title="Sab dirty files save karo (Ctrl+Shift+S)"
          >
            <SaveAll className="w-3.5 h-3.5 stroke-[1.5]" /> Save All{dirtyPaths.size ? ` (${dirtyPaths.size})` : ''}
          </button>
          <button
            onClick={() => setSidebarHidden(h => !h)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            title="Toggle sidebar (Ctrl+B)"
          >
            {sidebarHidden ? <PanelLeftOpen className="w-3.5 h-3.5 stroke-[1.5]" /> : <PanelLeftClose className="w-3.5 h-3.5 stroke-[1.5]" />} Sidebar
          </button>
          <button
            onClick={addFile}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.5]" /> New File
          </button>
          <button
            onClick={addFolder}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <FolderTree className="w-3.5 h-3.5 stroke-[1.5]" /> New Folder
          </button>
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] cursor-pointer transition-all hover:opacity-80"
            style={{
              background: previewOpen ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid ' + (previewOpen ? 'rgba(52,211,153,0.4)' : 'var(--color-border)'),
              color: '#34d399',
            }}
            title={previewOpen ? 'Preview band karo' : 'Project preview IDE ke andar kholo'}
          >
            <Eye className="w-3.5 h-3.5 stroke-[1.5]" /> Preview
          </button>
          <a
            href={`${BACKEND}/api/preview/${projectId}/zip`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            title="Workspace zip download"
          >
            <Download className="w-3.5 h-3.5 stroke-[1.5]" /> Zip
          </a>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <div className="w-12 shrink-0 flex flex-col items-center py-2 space-y-3" style={{ backgroundColor: 'var(--color-bg-elevated)', borderRight: '1px solid var(--color-border)' }}>
          {[
            { id: 'explorer', icon: FolderTree, title: 'Explorer' },
            { id: 'search', icon: Search, title: 'Search' },
            { id: 'git', icon: GitBranch, title: 'Source Control' },
            { id: 'extensions', icon: Puzzle, title: 'Extensions' },
          ].map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              onClick={() => setActivityBar(id === activityBar ? 'explorer' : id)}
              title={title}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
              style={{
                background: activityBar === id ? 'var(--gradient-primary)' : 'transparent',
                color: activityBar === id ? '#fff' : 'var(--color-text-muted)',
                boxShadow: activityBar === id ? '0 0 12px var(--color-primary-glow)' : 'none',
              }}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        {/* Sidebar panel */}
        {!sidebarHidden && (
        <div className="w-52 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-bg-hover)', borderRight: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {activityBar === 'explorer' ? 'Explorer' : activityBar === 'git' ? 'Source Control' : activityBar === 'search' ? 'Search' : 'Extensions'}
            </span>
            {activityBar === 'explorer' && (
              <div className="flex items-center gap-1">
                <button onClick={addFolder} title="New folder" className="cursor-pointer p-0.5 hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
                  <FolderTree className="w-4 h-4 stroke-[1.5]" />
                </button>
                <button onClick={addFile} title="New file" className="cursor-pointer p-0.5 hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
                  <Plus className="w-4 h-4 stroke-[1.5]" />
                </button>
                <button onClick={() => {
                  onToast('Rebuilding RAG Index...', 'info');
                  fetch('http://127.0.0.1:8001/ai/rag/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory: projectId })
                  }).then(() => onToast('Index synced!', 'success')).catch(() => onToast('Index failed', 'error'));
                }} title="Sync AI Context Index" className="cursor-pointer p-0.5 hover:opacity-80" style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>
                  <Database className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loadingFiles ? (
              <div className="px-3 space-y-2"><div className="h-4 rounded skeleton" /><div className="h-4 rounded skeleton w-3/4" /><div className="h-4 rounded skeleton w-1/2" /></div>
            ) : activityBar === 'explorer' ? (
              <TreeView
                node={tree}
                activePath={activePath}
                onSelect={selectFile}
                onCtx={openCtxMenu}
                onNewFileInFolder={createFileInFolder}
                onNewFolderInFolder={createFolderInFolder}
              />
            ) : (
              <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {activityBar === 'git'
                  ? 'Local-only git. GitControlModal dashboard me hai.'
                  : 'Monaco native support: 15+ languages. Har file ka syntax highlighting automatic.'}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Editor + Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 pt-1.5 shrink-0 overflow-x-auto" style={{ backgroundColor: 'var(--color-bg-default)' }}>
            {openTabs.map((p) => {
              const f = files.find(ff => ff.path === p);
              if (!f) return null;
              const ext = f.path.split('.').pop();
              const isActive = activePath === f.path;
              return (
                <div
                  key={f.path}
                  onClick={() => selectFile(f)}
                  className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-t-lg text-[11px] transition-colors cursor-pointer shrink-0"
                  style={{
                    background: isActive ? '#1a1d26' : 'transparent',
                    color: isActive ? '#fff' : 'var(--color-text-muted)',
                    borderTop: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: LANG_COLOR[ext] || '#4b8bfc' }} />
                  <span className="truncate max-w-32">{f.path.split('/').pop()}</span>
                  {dirtyPaths.has(f.path) && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#fbbf24' }} />}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(f.path); }}
                    title="Close tab"
                    className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 cursor-pointer transition-opacity"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <X className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              );
            })}
            {openTabs.length === 0 && (
              <div className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                No open files — tree se kholo ya New File
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          {activePath && (
            <div className="flex items-center gap-1 px-3 py-1 shrink-0 overflow-x-auto" style={{ background: '#13151b', borderBottom: '1px solid var(--color-border)' }}>
              {activePath.split('/').map((seg, i, arr) => (
                <span key={i} className="flex items-center gap-1 shrink-0 text-[10px]">
                  <span style={{ color: i === arr.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }} className={i === arr.length - 1 ? 'font-semibold' : 'hover:opacity-80 cursor-pointer'} onClick={() => {
                    if (i < arr.length - 1) {
                      const folder = arr.slice(0, i + 1).join('/');
                      const firstInFolder = files.find(f => f.path.startsWith(folder + '/'));
                      if (firstInFolder) selectFile(firstInFolder);
                    }
                  }}>
                    {seg}
                  </span>
                  {i < arr.length - 1 && <ChevronRight className="w-2.5 h-2.5" style={{ color: 'var(--color-text-muted)' }} />}
                </span>
              ))}
            </div>
          )}

          {/* Monaco Editor Pane */}
          <div className="flex-1 min-h-0 relative flex">
            <div className="flex-1 min-h-0 relative flex flex-col" style={{ display: previewOpen && previewTarget ? 'none' : 'flex' }}>
              {activePath ? (
                <MonacoEditor
                  height="100%"
                  language={activeLang}
                  value={activeContent}
                  onMount={handleEditorMount}
                  onChange={(v) => {
                    const p = activePath;
                    if (!p) return;
                    setFileContent(p, v || '');
                    markDirty(p);
                    runDiagnostics(p, v || '');
                  }}
                  theme="vs-dark"
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
                <div className="h-full flex flex-col items-center justify-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <FolderTree className="w-10 h-10 opacity-30" />
                  <p>Explorer se file select karo ya nayi file banao</p>
                  <button
                    onClick={addFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: 'rgba(75,139,252,0.12)', border: '1px solid rgba(75,139,252,0.3)', color: 'var(--color-primary)' }}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[1.5]" /> New File
                  </button>
                </div>
              )}
            </div>


            {/* Live preview iframe — project ke andar hi render hota hai */}
            {previewOpen && (
              <div className="flex-1 min-h-0 flex flex-col" style={{ background: '#fff' }}>
                <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ background: '#13151b', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#34d399' }}>
                    <Eye className="w-3 h-3" /> Live Preview — {projectId}
                  </span>
                  <button
                    onClick={() => setPreviewOpen(false)}
                    className="rounded p-1 cursor-pointer hover:opacity-80"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Close preview"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {previewTarget ? (
                  <iframe
                    key={`${projectId}-${previewTarget?.path || 'index'}`}
                    src={`${BACKEND}/api/preview/${encodeURIComponent(projectId)}`}
                    className="flex-1 w-full border-0"
                    title="Project preview"
                    sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm" style={{ color: '#666' }}>
                    <Eye className="w-10 h-10 opacity-30" />
                    <p>Preview ke liye project me index.html hona chahiye</p>
                  </div>
                )}
              </div>
            )}

            {/* Copilot floating button */}
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer z-10"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 8px 30px rgba(75,139,252,0.45)' }}
              title="Toggle Copilot chat"
            >
              <Sparkles className="w-4 h-4 stroke-[1.5]" /> {copilotOpen ? 'Hide Copilot' : 'Copilot'}
            </button>
          </div>

          {/* Terminal */}
          <div className="h-52 shrink-0 flex flex-col" style={{ background: '#0d0f14', borderTop: '1px solid var(--color-border)', display: terminalOpen ? 'flex' : 'none' }}>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: 'var(--color-bg-hover)' }}>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                <TerminalIcon className="w-3.5 h-3.5 stroke-[1.5]" /> Terminal
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={runSingleFile}
                  disabled={!activePath}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--color-success)', border: '1px solid rgba(52,211,153,0.25)' }}
                  title="Run active file"
                >
                  <Play className="w-3 h-3 inline mr-0.5" />Run
                </button>
                <button onClick={() => { terminalRef.current?.clear(); }} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }} title="Clear terminal">
                  <Eraser className="w-4 h-4 stroke-[1.5]" />
                </button>
                <button onClick={() => setTerminalOpen(false)} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }} title="Close terminal">
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <TerminalPanel innerRef={terminalRef} projectId={projectId} projectPath="" />
            </div>
          </div>
        </div>

        {/* Copilot chat panel */}
        {copilotOpen && (
          <div className="w-96 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-bg-hover)', borderLeft: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <span className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </span>
                Copilot
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPlanGate(g => !g)}
                  title={planGate ? 'Plan gate ON — pehle plan dikhega, approve pe run hoga' : 'Autopilot — plan gate OFF, turant run'}
                  className="px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all"
                  style={{
                    background: planGate ? 'rgba(75,139,252,0.15)' : 'rgba(255,255,255,0.05)',
                    border: planGate ? '1px solid rgba(75,139,252,0.4)' : '1px solid var(--color-border)',
                    color: planGate ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {planGate ? '🛡 Plan' : '⚡ Auto'}
                </button>
                <button
                  onClick={() => setShowInstructions(s => !s)}
                  className="p-1 rounded-md cursor-pointer transition-all"
                  style={{
                    background: showInstructions ? 'rgba(75,139,252,0.15)' : 'transparent',
                    color: showInstructions ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                  title="Custom instructions"
                >
                  <Settings2 className="w-4 h-4 stroke-[1.5]" />
                </button>
                <button onClick={() => setCopilotOpen(false)} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>
            </div>

            {/* Custom instructions */}
            {showInstructions && (
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  placeholder="Custom instructions... e.g. 'Sirf .html/.css/.js files banao', 'Hinglish me explain karo', 'Har file ke end me TODO comment add karo'"
                  className="w-full text-[10px] focus:outline-none resize-none rounded-md p-2"
                  style={{ color: 'var(--color-text-primary)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
                />
              </div>
            )}

            {/* Live process status */}
            {copilotStatus.label && (
              <div
                className="flex items-center gap-2 px-3 py-2 border-b"
                style={{
                  background: copilotStatus.tone === 'error' ? 'rgba(248,113,113,0.1)' : copilotStatus.tone === 'success' ? 'rgba(52,211,153,0.1)' : copilotStatus.tone === 'selfheal' ? 'rgba(251,191,36,0.1)' : 'rgba(75,139,252,0.08)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {(copilotStatus.tone === 'work' || copilotStatus.tone === 'info') && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: copilotStatus.tone === 'work' ? '#34d399' : '#6cb2ff' }} />
                )}
                {copilotStatus.tone === 'success' && <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>✔</span>}
                {copilotStatus.tone === 'error' && <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>✖</span>}
                <span
                  className={`text-[11px] font-semibold truncate ${copilotStatus.tone === 'work' ? 'copilot-status-pulse' : ''}`}
                  style={{
                    color: copilotStatus.tone === 'error' ? '#f87171' : copilotStatus.tone === 'success' ? '#34d399' : copilotStatus.tone === 'selfheal' ? '#fbbf24' : 'var(--color-text-primary)',
                  }}
                >
                  {copilotStatus.label}
                </span>
              </div>
            )}

            {/* Plan tasks — live progress list */}
            {planTasks.length > 0 && running && (
              <div className="px-3 py-2 border-b space-y-1" style={{ borderColor: 'var(--color-border)' }}>
                {planTasks.map((t) => (
                  <div key={t.id || t.title || t.description} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-3 shrink-0 text-center" style={{ color: t.status === 'completed' ? '#34d399' : t.status === 'in_progress' ? '#6cb2ff' : 'var(--color-text-muted)' }}>
                      {t.status === 'completed' ? '✓' : t.status === 'in_progress' ? <Loader2 className="w-2.5 h-2.5 animate-spin inline-block" /> : '○'}
                    </span>
                    <span className="truncate" style={{ color: t.status === 'completed' ? '#34d399' : 'var(--color-text-secondary)' }}>
                      {t.title || t.description || t.name || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div ref={endRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {pendingPlan && (
                <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(75,139,252,0.08)', border: '1px solid rgba(75,139,252,0.3)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>
                    🛡 Plan — approve karo
                  </p>
                  <div className="space-y-1">
                    {pendingPlan.tasks.map((t, i) => (
                      <div key={t.id || i} className="flex items-start gap-1.5 text-[10px]">
                        <span style={{ color: 'var(--color-primary)' }}>▸</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={approvePlan}
                      className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ background: 'var(--gradient-primary)', color: '#fff' }}
                    >
                      ✅ Approve — Run karo
                    </button>
                    <button
                      onClick={cancelPlan}
                      className="flex-1 px-2 py-1.5 rounded-md text-[10px] cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--color-warning)', border: '1px solid rgba(248,113,113,0.3)' }}
                    >
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              )}
              {copilotMessages.map((m, i) => {
                if (m.role === 'thinking') {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px]" style={{ background: 'rgba(75,139,252,0.08)', border: '1px solid rgba(75,139,252,0.15)', color: 'var(--color-text-muted)' }}>
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--color-info)' }} /> {m.content}
                      </div>
                    </div>
                  );
                }
                if (m.kind === 'checkpoint') {
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.12)' }}>
                        <RotateCcw className="w-3 h-3 text-[#fbbf24]" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          ⏸ Snapshot step {m.step} — {m.files.length} files
                        </p>
                        <button
                          onClick={() => rollbackTo(m.dir)}
                          disabled={running}
                          className="px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer disabled:opacity-40 hover:opacity-90 transition-opacity"
                          style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--color-accent)', border: '1px solid rgba(251,191,36,0.3)' }}
                          title="Is step pe wapas jao (agent ke changes undo)"
                        >
                          ⏪ Rollback to step {m.step}
                        </button>
                      </div>
                    </div>
                  );
                }
                if (m.kind === 'commit') {
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(97,175,239,0.12)' }}>
                        <GitBranch className="w-3 h-3 text-[#61afef]" />
                      </div>
                      <p className="text-[10px] font-mono" style={{ color: '#61afef' }}>
                        🔀 commit {m.hash}
                      </p>
                    </div>
                  );
                }
                if (m.kind === 'tool') {
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
                        <Bot className="w-3 h-3 text-[#34d399]" />
                      </div>
                      <pre className="text-[10px] whitespace-pre-wrap font-mono rounded-md px-2 py-1.5 flex-1 overflow-x-auto" style={{ background: '#0d0f14', border: '1px solid var(--color-border)', color: '#a5f3c5' }}>
                        {m.content}
                      </pre>
                    </div>
                  );
                }
                if (m.kind === 'term') {
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(97,175,239,0.12)' }}>
                        <TerminalIcon className="w-3 h-3 text-[#61afef]" />
                      </div>
                      <pre className="text-[10px] whitespace-pre-wrap font-mono rounded-md px-2 py-1.5 flex-1 overflow-x-auto" style={{ background: '#000', border: '1px solid rgba(97,175,239,0.2)', color: '#c9d1d9' }}>
                        {m.content}
                      </pre>
                    </div>
                  );
                }
                if (m.kind === 'vision') {
                  const isOk = /UI OK|sahi|theek|good|nice|beautiful|accha/i.test(m.content);
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isOk ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)' }}>
                        <Eye className={`w-3 h-3 ${isOk ? 'text-[#34d399]' : 'text-[#fbbf24]'}`} />
                      </div>
                      <div className="rounded-lg px-2.5 py-2 text-[11px] whitespace-pre-wrap flex-1" style={{ background: isOk ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${isOk ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}`, color: 'var(--color-text-primary)' }}>
                        <p className="text-[10px] font-bold mb-1" style={{ color: isOk ? '#34d399' : '#fbbf24' }}>
                          {isOk ? '👁️ UI OK — agent ne dekh liya, sab theek' : '👁️ Visual verdict (agent ne UI dekha)'}
                        </p>
                        {m.content}
                      </div>
                    </div>
                  );
                }
                if (m.kind === 'screenshot') {
                  return (
                    <div key={i} className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="space-y-1">
                        {m.auto && <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>📸 Agent ne result screenshot liya</p>}
                        <img
                          src={m.image}
                          alt="Agent screenshot"
                          className="rounded-lg border cursor-pointer transition-transform hover:scale-[1.02]"
                          style={{ maxWidth: '100%', maxHeight: 220, borderColor: 'var(--color-border)' }}
                          onClick={() => window.open(m.image, '_blank')}
                        />
                      </div>
                    </div>
                  );
                }
                const isUser = m.role === 'user';
                if (isUser) {
                  return (
                    <div key={i} className="flex justify-end">
                      <div
                        className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md text-[11px] leading-relaxed whitespace-pre-wrap"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', boxShadow: '0 2px 10px rgba(124,58,237,0.25)' }}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex gap-2">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}
                    >
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div
                      className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md text-[11px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        background: m.kind === 'warn' ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)',
                        border: m.kind === 'warn' ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(255,255,255,0.06)',
                        color: m.kind === 'warn' ? '#fbbf24' : 'var(--color-text-primary)',
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick prompts */}
            {latestRunId && runChangeCount > 0 && (
              <div className="px-3 pb-2">
                <button
                  onClick={() => setDiffOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--color-accent)' }}
                  title="Agent ke changes ka diff dekho — file per revert bhi kar sakte ho"
                >
                  <GitCompareArrows className="w-3.5 h-3.5 shrink-0" />
                  Review Changes ({runChangeCount})
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--color-accent)' }}>
                    diff + revert
                  </span>
                </button>
              </div>
            )}
            <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleSend(q.prompt)}
                  disabled={running}
                  className="px-2 py-1.5 rounded-lg text-[10px] text-left transition-all cursor-pointer disabled:opacity-40 hover:scale-[1.02]"
                  style={{ background: 'rgba(75,139,252,0.07)', border: '1px solid rgba(75,139,252,0.2)', color: 'var(--color-primary)' }}
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="p-3 border-t flex items-end gap-2" style={{ borderColor: 'var(--color-border)' }}>
              <textarea
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) { e.preventDefault(); handleSend(); } }}
                rows={2}
                placeholder="Prompt likho... (Enter = run)"
                className="flex-1 bg-transparent text-[11px] focus:outline-none resize-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
              {running && (
                <button
                  onClick={() => { abortRef.current?.abort(); setCopilotStatus({ label: '⏹ Stopping...', tone: 'error' }); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                  style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--color-warning)', border: '1px solid rgba(248,113,113,0.3)' }}
                  title="Stop agent"
                >
                  <Square className="w-3 h-3 fill-current" />
                </button>
              )}
              <button
                onClick={() => handleSend()}
                disabled={!copilotInput.trim() || running}
                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--gradient-primary)', color: '#fff' }}
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-4 h-4 stroke-[1.5]" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prompt modal (new file/folder/rename) */}
      <PromptModal modal={modalSpec} onClose={() => setUiModal(null)} onSubmit={submitModal} />

      {/* Quick Open — Ctrl+P */}
      {quickOpenOpen && (
        <QuickOpen
          files={files}
          onPick={(f) => { setQuickOpenOpen(false); selectFile(f); }}
          onClose={() => setQuickOpenOpen(false)}
        />
      )}

      {/* Find in Files — Ctrl+Shift+F */}
      {searchOpen && (
        <SearchOverlay
          q={searchQuery}
          onQueryChange={setSearchQuery}
          caseSensitive={searchCase}
          onCaseChange={setSearchCase}
          results={searchResults}
          searching={searching}
          onPick={openSearchResult}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* Diff Review — agent changes before/after + revert */}
      {diffOpen && latestRunId && (
        <DiffReviewModal
          runId={latestRunId}
          onClose={() => setDiffOpen(false)}
          onReverted={() => {
            // Live refresh: tree + editor from DB (revert events may have
            // landed outside the open SSE stream)
            api.get(`/memory/project/${projectId}`)
              .then(r => {
                if (Array.isArray(r.data?.files)) {
                  setFiles(r.data.files);
                  setContents({});
                  setDirtyPaths(new Set());
                }
              })
              .catch(() => {});
            setRunChangeCount(0);
          }}
        />
      )}

      {/* Command Palette — Ctrl+Shift+P */}
      {cmdPaletteOpen && (
        <CommandPalette
          commands={commands}
          onRun={runCommand}
          onClose={() => setCmdPaletteOpen(false)}
        />
      )}

      {/* Context menu (right-click on tree) */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div
            className="fixed z-[100] rounded-lg py-1 text-[11px] shadow-2xl"
            style={{
              left: ctxMenu.x,
              top: ctxMenu.y,
              width: 180,
              background: '#1c1f28',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              color: 'var(--color-text-primary)',
            }}
          >
            {ctxMenu.isDir && (
              <>
                <button
                  onClick={() => { const p = ctxMenu.path; setCtxMenu(null); createFileInFolder(p); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-white/5"
                >
                  <FilePlus2 className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} /> New File
                </button>
                <button
                  onClick={() => { const p = ctxMenu.path; setCtxMenu(null); createFolderInFolder(p); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-white/5"
                >
                  <FolderPlus className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} /> New Folder
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />
              </>
            )}
            <button
              onClick={ctxRename}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-white/5"
            >
              <Pencil className="w-4 h-4 stroke-[1.5]" style={{ color: 'var(--color-accent)' }} /> Rename
            </button>
            <button
              onClick={ctxDelete}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-white/5"
              style={{ color: 'var(--color-warning)' }}
            >
              <Trash2 className="w-4 h-4 stroke-[1.5]" /> Delete
            </button>
          </div>
        </>
      )}

      {/* Status bar — full width, bottom of the IDE */}
      <div className="flex items-center gap-4 px-4 py-1 shrink-0 text-[10px]" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          {activePath ? activePath.split('/').pop() : 'no file'}
        </span>
        <span className="opacity-90">{activeLang}</span>
        <span className={`flex items-center gap-1 ${problems > 0 ? 'font-bold' : ''}`}>
          {problems > 0 ? `⚠ ${problems} problems` : '✓ no problems'}
        </span>
        {running && <span className="flex items-center gap-1.5 opacity-90"><Loader2 className="w-3 h-3 animate-spin" /> agent running...</span>}
        <span className="ml-auto opacity-80">Ln {activeContent.split('\n').length} • UTF-8 • AI-Dost v3</span>
      </div>
    </div>
  );
}