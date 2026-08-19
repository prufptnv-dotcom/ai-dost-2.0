import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen, Plus, Trash2, Code2, X, RefreshCw,
  ArrowUpRight, GitBranch, Activity, Clock, FileCode2
} from 'lucide-react';
import api from '../../services/api';

export default function ProjectsView({ onOpenProject, onToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
  }), [onToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/memory/projects');
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast(e?.message || 'Projects load nahi hue', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await api.post('/memory/project', { project_name: name.trim(), description: desc.trim() || 'Interactive AI Copilot Workspace' });
      showToast('Project created!', 'success');
      setShowCreate(false);
      setName('');
      setDesc('');
      await load();
      if (res.data?.project_id) onOpenProject(res.data.project_id);
    } catch (e) {
      showToast(e?.message || 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (project) => {
    if (!window.confirm(`"${project.project_name}" delete karein? Files bhi delete hongi.`)) return;
    try {
      await api.delete(`/memory/project/${project.project_id}`);
      showToast('Project deleted', 'success');
      load();
    } catch (e) {
      showToast(e?.message || 'Delete failed', 'error');
    }
  };

  const statusColor = (s) => {
    switch ((s || '').toLowerCase()) {
      case 'completed': return '#34d399';
      case 'active': return '#4b8bfc';
      default: return '#f59e0b';
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 md:px-10 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-2xl text-white mb-1">Your Projects</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              SQLite me saved — koi bhi project kholo, edit karo, agent chalao
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 18px var(--color-primary-glow)' }}
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: FolderOpen, label: 'Total Projects', value: projects.length, color: '#4b8bfc' },
            { icon: Code2, label: 'Copilot Runs', value: 12, color: '#a142f4' },
            { icon: Activity, label: 'Agent Tasks', value: 8, color: '#18c2a8' },
            { icon: GitBranch, label: 'Commits', value: 24, color: '#ff8a65' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="font-display font-bold text-xl text-white">{value}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl skeleton" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ border: '1px dashed var(--color-border)' }}>
            <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
            <p className="font-medium text-white mb-1">Koi project nahi hai</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Pehla project banao ya Copilot se generate karo</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ background: 'var(--gradient-primary)', color: '#fff' }}
            >
              + Create Project
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p, i) => (
              <motion.div
                key={p.project_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="group relative rounded-2xl p-5 transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  backdropFilter: 'blur(12px)',
                }}
                onClick={() => onOpenProject(p.project_id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 14px var(--color-primary-glow)' }}>
                    <FolderOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{ background: `${statusColor(p.status)}18`, color: statusColor(p.status), border: `1px solid ${statusColor(p.status)}35` }}
                    >
                      {p.status || 'Active'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(p); }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:bg-red-500/15"
                      style={{ color: '#f87171' }}
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-1 truncate">{p.project_name}</h3>
                <p className="text-xs mb-4 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                  {p.description || 'No description'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    <Clock className="w-3 h-3" />
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium transition-colors" style={{ color: 'var(--color-primary)' }}>
                    Open <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(5,6,10,0.8)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--color-bg-default)', border: '1px solid var(--color-border)', boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-white">Create New Project</h3>
                <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name (e.g. My Portfolio)"
                  autoFocus
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', boxShadow: '0 0 0 1px rgba(75,139,252,0)' }}
                />
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                <button
                  onClick={create}
                  disabled={!name.trim() || creating}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'var(--gradient-primary)', color: '#fff' }}
                >
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}