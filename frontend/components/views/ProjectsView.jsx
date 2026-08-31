import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen, Plus, Trash2, Code2, X, RefreshCw,
  ArrowRight, GitBranch, Clock, FileCode2
} from 'lucide-react';
import api from '../../services/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

export default function ProjectsView({ onOpenProject, onToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  }), [onToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/memory/projects');
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      showToast(e?.message || 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await api.post('/memory/project', {
        project_name: name.trim(),
        description: desc.trim() || 'Interactive AI Copilot Workspace',
      });
      showToast('Project created', 'success');
      setShowCreate(false);
      setName('');
      setDesc('');
      await load();
      if (res.data?.project_id && onOpenProject) {
        onOpenProject(res.data.project_id);
      }
    } catch (e) {
      showToast(e?.message || 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (project, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${project.project_name}"?`)) return;
    try {
      await api.delete(`/memory/project/${project.project_id}`);
      showToast('Project deleted', 'success');
      load();
    } catch (err) {
      showToast(err?.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-paper-100 font-display">
              Projects & Workspaces
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Persistent local projects backed by SQLite universal store and autonomous agent coordinator.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={load}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowCreate(true)}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Editorial Table / List */}
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-muted bg-canvas-surface border border-border rounded-sm">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects found"
            description="Create your first workspace or initialize a scaffold from the autonomous agent."
            actionLabel="Create Project"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <div className="rounded-sm border border-border bg-canvas-surface overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2.5 bg-canvas-subtle border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              <div className="col-span-5 sm:col-span-4">Project Name</div>
              <div className="col-span-4 sm:col-span-4 hidden sm:block">Description</div>
              <div className="col-span-4 sm:col-span-2">Activity</div>
              <div className="col-span-3 sm:col-span-2 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border-subtle font-sans text-xs">
              {projects.map((p) => (
                <div
                  key={p.project_id}
                  onClick={() => onOpenProject && onOpenProject(p.project_id)}
                  className="grid grid-cols-12 items-center px-4 py-3 hover:bg-canvas-elevated transition-fast cursor-pointer group"
                >
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
                    <FolderOpen className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-paper-100 truncate group-hover:text-accent-primary transition-fast">
                        {p.project_name}
                      </div>
                      <div className="font-mono text-[10px] text-ink-muted truncate sm:hidden">
                        {p.description || 'Workspace'}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 sm:col-span-4 text-ink-muted truncate pr-3 hidden sm:block">
                    {p.description || 'Interactive AI Copilot Workspace'}
                  </div>

                  <div className="col-span-4 sm:col-span-2 text-ink-muted font-mono text-[11px]">
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Active'}
                  </div>

                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => remove(p, e)}
                      className="p-1 rounded-xs text-ink-muted hover:text-signal-error hover:bg-canvas-base transition-fast cursor-pointer focus-ring"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-base transition-fast cursor-pointer focus-ring"
                      title="Open workspace"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-sm bg-canvas-surface border border-border p-5 shadow-modal">
            <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2">
              <h3 className="text-sm font-semibold text-paper-100 font-display">New Project</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1 text-ink-muted hover:text-paper-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name (e.g. ecommerce-api)"
                className="w-full px-3 py-2 rounded-xs text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent-primary"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 rounded-xs text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent-primary resize-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={create} disabled={!name.trim() || creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}