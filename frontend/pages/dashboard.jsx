import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, FolderOpen, Code2, Bot, Mic, Image as ImageIcon,
  FileText, History, Settings, CornerDownLeft, Sparkles, X, Loader2
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import ProjectsView from '../components/views/ProjectsView';
import ArtifactsView from '../components/views/ArtifactsView';
import VoiceView from '../components/views/VoiceView';
import ResearchView from '../components/views/ResearchView';
import ImageView from '../components/views/ImageView';
import ResumeView from '../components/views/ResumeView';
import HistoryView from '../components/views/HistoryView';
import SettingsView from '../components/views/SettingsView';
import McpPanel from '../components/McpPanel';
import AgentView from '../components/views/AgentView';
import IDEErrorBoundary from '../components/views/IDEErrorBoundary';
import { fetchProjects, createProject } from '../services/api';
import { useMode } from '../context/ModeContext';
import { useRouter } from 'next/router';

const CopilotIDE = dynamic(() => import('../components/views/CopilotIDE'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-canvas-base">
      <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
    </div>
  ),
});

const ChatView = dynamic(() => import('../components/views/ChatView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-canvas-base">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  ),
});

const PALETTE_ACTIONS = [
  { id: 'chat', label: 'Open Chat', hint: 'Ctrl+1', icon: MessageSquare },
  { id: 'agent', label: 'Open Agent Workbench', hint: 'Ctrl+2', icon: Bot },
  { id: 'copilot', label: 'Open Copilot IDE', hint: 'Ctrl+3', icon: Code2 },
  { id: 'projects', label: 'Open Projects', hint: 'Ctrl+4', icon: FolderOpen },
  { id: 'artifacts', label: 'Open Artifacts', hint: 'Ctrl+5', icon: FileText },
  { id: 'voice', label: 'Open Voice Assistant', hint: 'Ctrl+6', icon: Mic },
  { id: 'settings', label: 'Open Settings', hint: 'Ctrl+7', icon: Settings },
  { id: 'new-chat', label: 'Start New Conversation', hint: 'Ctrl+N', icon: Sparkles },
];

export default function Dashboard() {
  const { mode } = useMode();
  const router = useRouter();
  const [view, setView] = useState('chat');
  const [theme, setTheme] = useState('dark');
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [model, setModel] = useState('auto');
  const [chatKey, setChatKey] = useState(0);
  const [resumeData, setResumeData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const paletteRef = useRef(null);
  const paletteInputRef = useRef(null);

  // Load preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('ai_dost_theme') || localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    const isLight = savedTheme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.classList.toggle('light-theme', isLight);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setModel(localStorage.getItem('ai_dost_model') || 'auto');
  }, []);

  // Load projects
  useEffect(() => {
    (async () => {
      try {
        const userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
        const data = await fetchProjects(userId);
        const projs = Array.isArray(data) ? data : [];
        setProjects(projs);
        if (projs.length > 0) {
          setActiveProject((prev) => prev || projs[0]);
        }
      } catch (e) {
        setProjects([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (router.query?.view && typeof router.query.view === 'string') {
      setView(router.query.view);
    }
  }, [router.query?.view]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ai_dost_theme', next);
      localStorage.setItem('theme', next);
      const isLight = next === 'light';
      document.body.classList.toggle('light-theme', isLight);
      document.documentElement.classList.toggle('light-theme', isLight);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.message) {
        showToast(e.detail.message, e.detail.type || 'success');
      }
    };
    window.addEventListener('ai_dost_toast', handler);
    return () => window.removeEventListener('ai_dost_toast', handler);
  }, [showToast]);

  const go = useCallback((v) => {
    setView(v);
    setPaletteOpen(false);
  }, []);

  const handleNewChat = useCallback(() => {
    setChatKey((k) => k + 1);
    go('chat');
    showToast('New conversation initialized', 'success');
  }, [go, showToast]);

  const handleOpenResumeWithData = useCallback((data) => {
    setResumeData(data);
    go('resume');
  }, [go]);

  const handleOpenVoice = useCallback(() => go('voice'), [go]);
  const handleOpenSettings = useCallback(() => go('settings'), [go]);

  const handleVoiceTranscript = useCallback((text) => {
    const t = text.toLowerCase();
    if (/(resume|cv)/.test(t)) { go('resume'); return; }
    if (/(project|projects)/.test(t)) { go('projects'); return; }
    if (/(agent|workbench|task)/.test(t)) { go('agent'); return; }
    if (/(copilot|ide|editor)/.test(t)) { go('copilot'); return; }
    if (/(history)/.test(t)) { go('history'); return; }
    if (/(settings)/.test(t)) { go('settings'); return; }
  }, [go]);

  const handleOpenPalette = useCallback(() => {
    setPaletteOpen(true);
    setPaletteQuery('');
    setPaletteIndex(0);
    setTimeout(() => paletteInputRef.current?.focus(), 60);
  }, []);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); go('chat'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); go('agent'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); go('copilot'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); go('projects'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); go('artifacts'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, handleNewChat]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || creating) return;
    setCreating(true);
    try {
      const userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
      const created = await createProject({ name: newProjectName.trim(), description: newProjectDesc.trim(), userId });
      setProjects((prev) => [created, ...prev]);
      setActiveProject(created);
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      showToast(`Project "${created.name}" created`, 'success');
      go('projects');
    } catch (err) {
      showToast(err.message || 'Project creation failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const filteredActions = PALETTE_ACTIONS.filter(
    (a) => a.label.toLowerCase().includes(paletteQuery.toLowerCase()) || a.id.includes(paletteQuery.toLowerCase())
  );

  const runPaletteAction = (actionId) => {
    if (actionId === 'new-chat') handleNewChat();
    else go(actionId);
  };

  return (
    <AppShell
      currentView={view}
      onSelectView={go}
      onNewChat={handleNewChat}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onOpenCommandPalette={handleOpenPalette}
      activeProject={activeProject}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view + chatKey}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="h-full w-full"
        >
          {view === 'chat' && (
            <ChatView
              key={chatKey}
              model={model}
              onModelChange={setModel}
              onOpenResumeWithData={handleOpenResumeWithData}
              onOpenVoice={handleOpenVoice}
              onNavigate={go}
            />
          )}
          {view === 'agent' && (
            <AgentView
              onToast={showToast}
              onOpenFile={(filePath) => {
                go('copilot');
              }}
            />
          )}
          {view === 'copilot' && (
            <IDEErrorBoundary>
              <CopilotIDE
                projectId="copilot-workspace"
                projectName="Copilot Workspace"
                onToast={showToast}
              />
            </IDEErrorBoundary>
          )}
          {view === 'projects' && (
            <ProjectsView
              onOpenProject={(id) => router.push(`/project/${id}`)}
              onToast={showToast}
            />
          )}
          {view === 'artifacts' && (
            <ArtifactsView onToast={showToast} />
          )}
          {view === 'research' && (
            <ResearchView onToast={showToast} onNavigate={go} />
          )}
          {view === 'voice' && (
            <VoiceView
              onToast={showToast}
              onTranscript={handleVoiceTranscript}
              onClose={() => go('chat')}
            />
          )}
          {view === 'images' && <ImageView onToast={showToast} />}
          {view === 'resume' && (
            <ResumeView
              initialResume={resumeData}
              onToast={showToast}
              onClose={() => go('chat')}
            />
          )}
          {view === 'history' && <HistoryView onToast={showToast} />}
          {view === 'settings' && (
            <SettingsView
              onToast={showToast}
              onModelChange={setModel}
            />
          )}
          {view === 'mcp' && <McpPanel />}
        </motion.div>
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xs text-xs font-medium shadow-md border ${
                t.type === 'error'
                  ? 'bg-signal-error-subtle border-signal-error text-signal-error'
                  : t.type === 'warning'
                  ? 'bg-signal-warning-subtle border-signal-warning text-signal-warning'
                  : 'bg-signal-success-subtle border-signal-success text-signal-success'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs"
              onClick={() => setPaletteOpen(false)}
            />
            <motion.div
              ref={paletteRef}
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.12 }}
              className="fixed left-1/2 top-20 -translate-x-1/2 z-[95] w-full max-w-lg rounded-sm overflow-hidden shadow-modal bg-canvas-surface border border-border"
            >
              <div className="flex items-center gap-3 px-3.5 py-3 border-b border-border">
                <Sparkles className="w-4 h-4 text-accent-primary" />
                <input
                  ref={paletteInputRef}
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setPaletteIndex((prev) => (filteredActions.length > 0 ? (prev + 1) % filteredActions.length : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setPaletteIndex((prev) => (filteredActions.length > 0 ? (prev - 1 + filteredActions.length) % filteredActions.length : 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredActions[paletteIndex]) runPaletteAction(filteredActions[paletteIndex].id);
                    } else if (e.key === 'Escape') {
                      setPaletteOpen(false);
                    }
                  }}
                  placeholder="Type a command or jump to workspace view..."
                  role="combobox"
                  aria-expanded={paletteOpen}
                  aria-controls="palette-actions-list"
                  className="flex-1 bg-transparent text-sm text-paper-100 placeholder:text-ink-muted focus:outline-none font-sans"
                />
                <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-canvas-elevated text-ink-muted">
                  ESC
                </kbd>
              </div>
              <div id="palette-actions-list" role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto py-1 divide-y divide-border-subtle">
                {filteredActions.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-ink-muted">No commands found</div>
                )}
                {filteredActions.map((a, i) => {
                  const isSelected = paletteIndex === i;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setPaletteIndex(i)}
                      onClick={() => runPaletteAction(a.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left transition-fast cursor-pointer ${
                        isSelected
                          ? 'bg-canvas-elevated text-accent-primary border-l-2 border-accent-primary'
                          : 'hover:bg-canvas-elevated text-paper-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <a.icon className={`w-4 h-4 ${isSelected ? 'text-accent-primary' : 'text-ink-muted'}`} />
                        <span className={`text-xs ${isSelected ? 'text-white font-medium' : 'text-paper-100'}`}>{a.label}</span>
                      </div>
                      <kbd className="text-[10px] font-mono text-ink-muted">{a.hint}</kbd>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[95] w-full max-w-sm rounded-sm p-5 shadow-modal bg-canvas-surface border border-border"
            >
              <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2">
                <h3 className="text-sm font-semibold text-paper-100 font-display">New Project</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-ink-muted hover:text-paper-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="space-y-3">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name (e.g. auth-service)"
                  className="w-full px-3 py-2 rounded-xs text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent-primary"
                />
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xs text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent-primary resize-none"
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || creating}
                  className="w-full py-2 rounded-xs text-xs font-medium bg-accent-primary hover:bg-accent-primary-strong text-paper-100 transition-fast cursor-pointer disabled:opacity-40"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 inline animate-spin" /> : 'Create Project'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}