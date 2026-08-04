import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Plus, BarChart3, Sparkles, Folder,
  ChevronRight, Zap, Brain, Clock, TrendingUp, X,
  Terminal, Bot, Activity, Star
} from 'lucide-react';
import ProjectCard from '../components/ProjectCard';
import AICompanion from '../components/AICompanion';
import Header from '../components/Header';
import { fetchProjects, createProject } from '../services/api';
import { useMode } from '../context/ModeContext';

/* ─── Animated Progress Bar ─── */
function ProgressBar({ value, color = '#06b6d4', delay = 0 }) {
  const [width, setWidth] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay + 200);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}50` }}
      />
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color, sub, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative rounded-2xl p-5 overflow-hidden group"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(200px at 50% 0%, ${color}12, transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{sub}</span>
      </div>
      <div className="text-2xl font-black text-white mb-0.5">{value}</div>
      <div className="text-xs text-[#64748b]">{label}</div>
    </motion.div>
  );
}

const Dashboard = () => {
  const { mode } = useMode();
  const [projects, setProjects] = useState([]);
  const [learningProgress] = useState([
    { topic: 'Python Basics', description: 'Variables, Lists, Dicts', progress: 85, color: '#06b6d4' },
    { topic: 'FastAPI Development', description: 'Routing & Pydantic schemas', progress: 60, color: '#8b5cf6' },
    { topic: 'React Components', description: 'State, hooks & lifecycle', progress: 40, color: '#10b981' },
  ]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
        const data = await fetchProjects(userId);
        setProjects(data || []);
      } catch (err) {
        console.error('Failed to load projects', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      let userId = localStorage.getItem('ai_dost_user_id') || 'demo_user_id';
      const newProj = await createProject(newProjectName.trim(), newProjectDesc.trim(), userId);
      if (newProj?.project_id) {
        setProjects(prev => [...prev, newProj]);
        setShowCreateModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
        window.location.href = `/project/${newProj.project_id}`;
      }
    } catch (err) {
      console.error('Failed to create project', err);
    } finally {
      setCreating(false);
    }
  };

  const stats = [
    { icon: Folder, label: 'Total Projects', value: projects.length || 0, color: '#06b6d4', sub: 'All Time', delay: 0 },
    { icon: Zap, label: 'Agent Runs', value: 9, color: '#8b5cf6', sub: 'Today', delay: 0.05 },
    { icon: Activity, label: 'Tests Passed', value: '9/9', color: '#10b981', sub: '100%', delay: 0.1 },
    { icon: Clock, label: 'Avg Agent Speed', value: '1.9s', color: '#f59e0b', sub: 'Fast ⚡', delay: 0.15 },
  ];

  return (
    <div className="min-h-screen text-[#f0f2f5] flex flex-col" style={{ background: '#05060a' }}>
      <Header />

      {mode === 'chat' ? (
        <div className="flex-1 flex pt-14 w-full justify-center">
          <div className="w-full h-[calc(100vh-56px)] animate-fadeIn">
            <AICompanion />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex pt-14 overflow-hidden">
          {/* ─── Left: AI Companion ─── */}
          <div className="hidden md:flex w-[340px] lg:w-[370px] shrink-0 h-[calc(100vh-56px)] sticky top-14 flex-col"
            style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <AICompanion />
          </div>

          {/* ─── Center: Dashboard ─── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-5 py-7 space-y-7">

              {/* Greeting + Actions */}
              <div className="flex items-end justify-between">
                <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                  <p className="text-xs font-medium text-[#06b6d4] tracking-widest uppercase mb-1">Welcome back 👋</p>
                  <h1 className="text-2xl font-black text-white tracking-tight">Your Projects</h1>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => setShowProgress(!showProgress)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
                    style={{
                      background: showProgress ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)',
                      border: showProgress ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      color: showProgress ? '#06b6d4' : '#64748b',
                    }}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Skill Progress</span>
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="gradient-btn flex items-center gap-1.5 px-4 py-2 text-white font-semibold rounded-xl text-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" /> New Project
                  </button>
                </motion.div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
              </div>

              {/* Projects Grid */}
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton rounded-2xl h-40" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center justify-center py-24 text-center rounded-2xl relative overflow-hidden group"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: 'radial-gradient(400px at 50% 50%, rgba(6,182,212,0.05), transparent 70%)' }}
                  />
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}
                  >
                    <Bot className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Start Your Next Big Idea</h3>
                  <p className="text-sm text-[#64748b] mb-7 max-w-sm">
                    Give AI Dost a prompt and watch it build your entire project autonomously — files, tests, everything.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="gradient-btn flex items-center gap-2 px-7 py-3 text-white font-semibold rounded-xl text-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" /> Create First Project
                  </button>
                </motion.div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project, i) => (
                    <motion.div
                      key={project.project_id || project._id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.07 }}
                    >
                      <ProjectCard project={project} />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Skill Progress Panel (inline, collapsible) */}
              {showProgress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl p-5 overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white">Skill Progress</h2>
                        <p className="text-[11px] text-[#64748b]">Your coding journey tracker</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowProgress(false)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid md:grid-cols-3 gap-5">
                    {learningProgress.map((item, i) => (
                      <div key={item.topic}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-white">{item.topic}</span>
                          <span className="text-xs font-bold" style={{ color: item.color }}>{item.progress}%</span>
                        </div>
                        <p className="text-[11px] text-[#64748b] mb-2">{item.description}</p>
                        <ProgressBar value={item.progress} color={item.color} delay={i * 200} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* ─── Right: Progress Sidebar (lg+) ─── */}
          {showProgress && (
            <div className="hidden xl:block w-64 shrink-0 h-[calc(100vh-56px)] sticky top-14 py-7 pr-5"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="rounded-2xl p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-white">Your Skills</span>
                </div>
                {learningProgress.map((item, i) => (
                  <div key={item.topic} className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs font-medium text-[#e2e8f0]">{item.topic}</span>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.progress}%</span>
                    </div>
                    <ProgressBar value={item.progress} color={item.color} delay={i * 200} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Create Project Modal ─── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl animate-scaleIn relative overflow-hidden"
            style={{ background: 'rgba(10,11,18,0.97)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 0 0 1px rgba(6,182,212,0.06), 0 24px 64px rgba(0,0,0,0.7)' }}
          >
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'var(--gradient-primary)' }} />

            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <Plus className="w-4 h-4 text-cyan-400" />
                  </div>
                  New Project
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Awesome App"
                    className="w-full h-10 px-3.5 rounded-xl text-sm text-white placeholder-[#334155] focus:outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; e.target.style.boxShadow = '0 0 12px rgba(6,182,212,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Description</label>
                  <textarea
                    placeholder="What is this project about?"
                    rows="3"
                    className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-[#334155] focus:outline-none transition-all resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                    onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.4)'; e.target.style.boxShadow = '0 0 12px rgba(6,182,212,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] hover:text-white transition-all cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 gradient-btn py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
