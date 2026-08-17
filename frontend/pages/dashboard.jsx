import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, FolderOpen, Code2, Bot, Mic, Image as ImageIcon, FileText, History, Settings, CornerDownLeft, Sparkles, X, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import ChatView from '../components/views/ChatView';
import ProjectsView from '../components/views/ProjectsView';
import VoiceView from '../components/views/VoiceView';
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
  loading: () => <div className="h-full flex items-center justify-center"><div className="w-8 h-8 rounded-xl animate-spin" style={{ background: 'var(--gradient-primary)' }} /></div>,
});

const VIEW_META = {
  chat: { title: 'AI-Dost Chat', subtitle: 'Kuch bhi puchho — bina judgement ke', icon: MessageSquare },
  projects: { title: 'Projects', subtitle: 'Aapke saare projects ek jagah', icon: FolderOpen },
  copilot: { title: 'Copilot IDE', subtitle: 'VS Code-style editor + Copilot agent', icon: Code2 },
  agent: { title: 'Autonomous Agent', subtitle: 'Plan → Tools → Code → Screenshots', icon: Bot },
  voice: { title: 'Voice Assistant', subtitle: 'Bolke kaam karo — Hinglish me', icon: Mic },
  images: { title: 'Image Generator', subtitle: 'Prompt se free images — Pollinations AI', icon: ImageIcon },
  resume: { title: 'Resume Builder', subtitle: 'Prompt se instant resume + preview', icon: FileText },
  history: { title: 'Chat History', subtitle: 'Purani baatein — sab saved', icon: History },
  settings: { title: 'Settings', subtitle: 'Models, keys aur preferences', icon: Settings },
};

const SIDEBAR_WIDTH = { collapsed: 72, expanded: 280 };
const TOPBAR_H = 64;

const PALETTE_ACTIONS = [
  { id: 'chat', label: 'Chat kholo', hint: 'Ctrl+1', icon: MessageSquare },
  { id: 'projects', label: 'Projects kholo', hint: 'Ctrl+2', icon: FolderOpen },
  { id: 'copilot', label: 'Copilot IDE kholo', hint: 'Ctrl+3', icon: Code2 },
  { id: 'agent', label: 'Agent kholo', hint: 'Ctrl+4', icon: Bot },
  { id: 'voice', label: 'Voice assistant kholo', hint: 'Ctrl+5', icon: Mic },
  { id: 'resume', label: 'Resume builder kholo', hint: 'Ctrl+6', icon: FileText },
  { id: 'images', label: 'Images generator kholo', hint: 'Ctrl+9', icon: ImageIcon },
  { id: 'history', label: 'History dekho', hint: 'Ctrl+7', icon: History },
  { id: 'settings', label: 'Settings kholo', hint: 'Ctrl+8', icon: Settings },
  { id: 'new-chat', label: 'Nayi chat shuru karo', hint: 'Ctrl+N', icon: Sparkles },
];

export default function Dashboard() {
  const { mode } = useMode();
  const router = useRouter();
  const [view, setView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projects, setProjects] = useState([]);
  const [model, setModel] = useState('auto');
  const [chatKey, setChatKey] = useState(0);
  const [resumeData, setResumeData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const paletteRef = useRef(null);
  const paletteInputRef = useRef(null);

  // Sidebar persistence
  useEffect(() => {
    const saved = localStorage.getItem('ai_dost_sidebar_open');
    if (saved !== null) setSidebarOpen(saved === '1');
    setModel(localStorage.getItem('ai_dost_model') || 'auto');
  }, []);

  // Load projects
  useEffect(() => {
    (async () => {
      try {
        const userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
        const data = await fetchProjects(userId);
        setProjects(Array.isArray(data) ? data : []);
      } catch (e) {
        setProjects([]);
      }
    })();
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      localStorage.setItem('ai_dost_sidebar_open', prev ? '0' : '1');
      return !prev;
    });
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail && e.detail.message) showToast(e.detail.message, e.detail.type || 'success');
    };
    window.addEventListener('ai_dost_toast', handler);
    return () => window.removeEventListener('ai_dost_toast', handler);
  }, [showToast]);

  const go = useCallback((v) => {
    setView(v);
    setPaletteOpen(false);
  }, []);

  const handleNewChat = useCallback(() => {
    setChatKey(k => k + 1);
    go('chat');
    showToast('Nayi chat shuru', 'success');
  }, [go, showToast]);

  const handleNewProject = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleOpenResumeWithData = useCallback((data) => {
    setResumeData(data);
    go('resume');
  }, [go]);

  const handleOpenVoice = useCallback(() => go('voice'), [go]);
  const handleOpenSettings = useCallback(() => go('settings'), [go]);
  const handleVoiceTranscript = useCallback((text) => {
    const t = text.toLowerCase();
    if (/(resume|cv banao|cv ban|bio data)/.test(t)) { go('resume'); return; }
    if (/(project|projects)/.test(t) && /(kholo|dekho|dikhao|show|open|list)/.test(t)) { go('projects'); return; }
    if (/(agent|autonomous)/.test(t) && /(chalao|run|start|kholo)/.test(t)) { go('agent'); return; }
    if (/(copilot|code editor|ide)/.test(t)) { go('copilot'); return; }
    if (/(history|purani)/.test(t)) { go('history'); return; }
    if (/(settings|setting)/.test(t)) { go('settings'); return; }
  }, [go]);
  const handleOpenPalette = useCallback(() => { setPaletteOpen(true); setPaletteQuery(''); setTimeout(() => paletteInputRef.current?.focus(), 60); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); toggleSidebar(); return; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); handleOpenPalette(); return; }
      if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) { e.preventDefault(); handleNewChat(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); go('resume'); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); go('copilot'); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') { e.preventDefault(); go('copilot'); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); go('voice'); return; }
      if (mod && e.key.toLowerCase() === '1') { e.preventDefault(); go('chat'); return; }
      if (mod && e.key.toLowerCase() === '2') { e.preventDefault(); go('projects'); return; }
      if (mod && e.key.toLowerCase() === '3') { e.preventDefault(); go('copilot'); return; }
      if (mod && e.key.toLowerCase() === '4') { e.preventDefault(); go('agent'); return; }
      if (mod && e.key.toLowerCase() === '5') { e.preventDefault(); go('voice'); return; }
      if (mod && e.key.toLowerCase() === '6') { e.preventDefault(); go('resume'); return; }
      if (mod && e.key.toLowerCase() === '9') { e.preventDefault(); go('images'); return; }
      if (mod && e.key.toLowerCase() === '7') { e.preventDefault(); go('history'); return; }
      if (mod && e.key.toLowerCase() === '8') { e.preventDefault(); go('settings'); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSidebar, handleOpenPalette, handleNewChat, go]);

  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH.expanded : SIDEBAR_WIDTH.collapsed;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
      const newProj = await createProject(newProjectName.trim(), newProjectDesc.trim(), userId);
      if (newProj?.project_id) {
        setProjects(prev => [...prev, newProj]);
        setShowCreateModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
        showToast('Project ban gaya!', 'success');
      }
    } catch (err) {
      showToast(`Create failed: ${err?.detail || err?.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const filteredActions = PALETTE_ACTIONS.filter(a =>
    a.label.toLowerCase().includes(paletteQuery.toLowerCase()) ||
    (a.hint || '').toLowerCase().includes(paletteQuery.toLowerCase())
  );

  const runPaletteAction = (actionId) => {
    if (actionId === 'new-chat') handleNewChat();
    else go(actionId);
  };

  const meta = VIEW_META[view];

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        activeItem={view}
        onItemClick={go}
        userProjects={projects}
        onNewProject={handleNewProject}
        onNewChat={handleNewChat}
      />

      <TopBar
        sidebarPadding={sidebarWidth}
        title={meta.title}
        subtitle={meta.subtitle}
        model={model}
        onModelChange={setModel}
        onOpenVoice={handleOpenVoice}
        onOpenSettings={handleOpenSettings}
        onOpenCommandPalette={handleOpenPalette}
      />

      {/* Main content */}
      <main
        className="absolute top-0 right-0 bottom-0 transition-[padding] duration-300"
        style={{ left: sidebarWidth, paddingTop: TOPBAR_H }}
      >
        <div className="h-full w-full overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + chatKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full w-full"
            >
              {view === 'chat' && <ChatView key={chatKey} model={model} onModelChange={setModel} onOpenResumeWithData={handleOpenResumeWithData} onOpenVoice={handleOpenVoice} onNavigate={go} />}
              {view === 'projects' && <ProjectsView onOpenProject={(id) => router.push(`/project/${id}`)} onToast={showToast} />}
              {view === 'copilot' && (
                <IDEErrorBoundary>
                  <CopilotIDE projectId="copilot-workspace" projectName="Copilot Workspace" onToast={showToast} />
                </IDEErrorBoundary>
              )}
              {view === 'agent' && <AgentView onToast={showToast} />}
              {view === 'voice' && <VoiceView onToast={showToast} onTranscript={handleVoiceTranscript} onClose={() => go('chat')} />}
              {view === 'images' && <ImageView onToast={showToast} />}
              {view === 'resume' && <ResumeView initialResume={resumeData} onToast={showToast} onClose={() => go('chat')} />}
              {view === 'history' && <HistoryView onToast={showToast} />}
              {view === 'settings' && <SettingsView onToast={showToast} onModelChange={setModel} />}
              {view === 'mcp' && <McpPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium shadow-2xl"
              style={{
                background: t.type === 'error' ? 'rgba(248,113,113,0.15)' : t.type === 'warning' ? 'rgba(250,204,21,0.15)' : 'rgba(52,211,153,0.15)',
                border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,0.3)' : t.type === 'warning' ? 'rgba(250,204,21,0.3)' : 'rgba(52,211,153,0.3)'}`,
                color: t.type === 'error' ? '#f87171' : t.type === 'warning' ? '#facc15' : '#34d399',
                backdropFilter: 'blur(12px)',
              }}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Command Palette */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPaletteOpen(false)}
            />
            <motion.div
              ref={paletteRef}
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-24 -translate-x-1/2 z-[95] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: 'rgba(20,22,30,0.98)', border: '1px solid var(--color-border)', backdropFilter: 'blur(20px)' }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <input
                  ref={paletteInputRef}
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredActions.length > 0) runPaletteAction(filteredActions[0].id);
                    if (e.key === 'Escape') setPaletteOpen(false);
                  }}
                  placeholder="Kya karna hai? Type karo..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                <kbd className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>ESC</kbd>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {filteredActions.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>Kuch nahi mila</div>
                )}
                {filteredActions.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => runPaletteAction(a.id)}
                    onMouseEnter={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer"
                    style={{ background: i === 0 ? 'rgba(75,139,252,0.12)' : 'transparent' }}
                  >
                    <a.icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <span className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{a.label}</span>
                    <kbd className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>{a.hint}</kbd>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <CornerDownLeft className="w-3 h-3 inline mr-1" /> Enter = select
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90]" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[95] w-full max-w-sm rounded-2xl p-6 shadow-2xl"
              style={{ background: 'rgba(20,22,30,0.98)', border: '1px solid var(--color-border)', backdropFilter: 'blur(20px)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Naya Project</h3>
                <button onClick={() => setShowCreateModal(false)} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="space-y-3">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project ka naam (e.g. my-website)"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || creating}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--gradient-primary)', color: '#fff' }}
                >
                  {creating ? <Loader2 className="w-4 h-4 inline animate-spin" /> : 'Project Banao'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}