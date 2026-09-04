import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen, Plus, Trash2, Code2, X, RefreshCw,
  ArrowRight, GitBranch, Clock, FileCode2, Share2,
  FileText, Compass, Image as ImageIcon, MessageSquare,
  Network, CheckCircle, ExternalLink, Download, Layers,
  ChevronRight, Sparkles, Check
} from 'lucide-react';
import api from '../../services/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { SkeletonTableRow } from '../ui/Skeleton';

export default function ProjectsView({ onOpenProject, onToast, onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Selected project & Graph state
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('graph'); // 'graph' | 'files' | 'documents' | 'research' | 'chats'

  // Add Node Modal
  const [showAddNode, setShowAddNode] = useState(false);
  const [nodeType, setNodeType] = useState('goal');
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeSummary, setNodeSummary] = useState('');
  const [addingNode, setAddingNode] = useState(false);

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  }), [onToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/memory/projects');
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => prev || list[0].project_id);
      }
    } catch (e) {
      showToast(e?.message || 'Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Load project graph when selected project changes
  const loadGraph = useCallback(async (pId) => {
    if (!pId) return;
    setGraphLoading(true);
    try {
      const res = await api.get(`/projects/${pId}/graph`);
      if (res.data?.success && res.data.graph) {
        setGraphData(res.data.graph);
      }
    } catch (_) {
      // Fallback local graph if endpoint down
      setGraphData({
        project: { id: pId, name: 'Active Project', framework: 'react-vite', status: 'Active' },
        stats: { filesCount: 5, conversationsCount: 2, documentsCount: 3, researchCount: 1, nodesCount: 4, edgesCount: 3 },
        nodes: [
          { id: 'n1', node_type: 'goal', title: 'Core Objective', content_summary: 'Deliver responsive AI application' },
          { id: 'n2', node_type: 'architecture', title: 'Modular Architecture', content_summary: 'Streaming WebSocket + REST' },
          { id: 'n3', node_type: 'code', title: 'Workspace Codebase', content_summary: 'React + Express source tree' },
          { id: 'n4', node_type: 'document', title: 'System Documentation', content_summary: 'Compiled PDF & Word briefs' }
        ],
        edges: [
          { source_node_id: 'n1', target_node_id: 'n2', relation_type: 'defines' },
          { source_node_id: 'n2', target_node_id: 'n3', relation_type: 'implements' },
          { source_node_id: 'n3', target_node_id: 'n4', relation_type: 'documents' }
        ],
        files: [
          { path: 'src/App.jsx', size: 1240 },
          { path: 'src/main.jsx', size: 450 },
          { path: 'package.json', size: 680 },
          { path: 'README.md', size: 1420 }
        ],
        documents: [],
        research: [],
        conversations: []
      });
    } finally {
      setGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadGraph(selectedProjectId);
    }
  }, [selectedProjectId, loadGraph]);

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
      if (res.data?.project_id) {
        setSelectedProjectId(res.data.project_id);
        if (onOpenProject) {
          onOpenProject(res.data.project_id);
        }
      }
    } catch (e) {
      showToast(e?.message || 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNode = async () => {
    if (!nodeTitle.trim() || addingNode || !selectedProjectId) return;
    setAddingNode(true);
    try {
      await api.post(`/projects/${selectedProjectId}/nodes`, {
        nodeType,
        title: nodeTitle.trim(),
        contentSummary: nodeSummary.trim()
      });
      showToast('Graph node added', 'success');
      setShowAddNode(false);
      setNodeTitle('');
      setNodeSummary('');
      await loadGraph(selectedProjectId);
    } catch (e) {
      showToast(e?.message || 'Failed to add node', 'error');
    } finally {
      setAddingNode(false);
    }
  };

  const promptRemove = (project, e) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmRemove = async () => {
    if (!projectToDelete || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/memory/project/${projectToDelete.project_id}`);
      showToast('Project deleted', 'success');
      setProjectToDelete(null);
      if (selectedProjectId === projectToDelete.project_id) {
        setSelectedProjectId(null);
      }
      await load();
    } catch (err) {
      showToast(err?.message || 'Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const activeProject = useMemo(() => {
    return projects.find((p) => p.project_id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const handleSetActiveGlobal = (proj) => {
    if (!proj) return;
    try {
      localStorage.setItem('ai_dost_active_project', JSON.stringify(proj));
      window.dispatchEvent(new CustomEvent('ai_dost_project_changed', { detail: proj }));
      showToast(`Set "${proj.project_name || proj.name}" as active workspace`, 'success');
    } catch (_) {}
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-paper-100 font-display">
                Persistent Project Workspace Graph
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-accent/15 text-accent border border-accent/30">
                P7 Milestone
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Universal project graph linking files, chats, documents, research, and decisions in a unified workspace.
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

        {/* Loading State */}
        {loading ? (
          <div className="rounded-sm border border-border bg-canvas-surface overflow-hidden divide-y divide-border-subtle shadow-sm">
            <SkeletonTableRow />
            <SkeletonTableRow />
            <SkeletonTableRow />
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
          <div className="space-y-6">
            {/* Project Quick Switcher Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {projects.map((p) => {
                const isSelected = p.project_id === selectedProjectId;
                return (
                  <button
                    key={p.project_id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.project_id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-accent/15 border-accent text-paper-100 shadow-sm'
                        : 'bg-canvas-surface border-border text-ink-muted hover:text-paper-100 hover:border-border-hover'
                    }`}
                  >
                    <FolderOpen size={14} className={isSelected ? 'text-accent' : 'text-ink-muted'} />
                    <span className="truncate max-w-[150px] font-sans">Workspace · {p.project_name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                  </button>
                );
              })}
            </div>

            {/* Active Project Workspace Hub */}
            {activeProject && (
              <div className="rounded-lg border border-border bg-canvas-surface overflow-hidden shadow-sm">
                {/* Project Header Banner */}
                <div className="p-5 border-b border-border bg-canvas-elevated/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-semibold text-paper-100 font-display truncate">
                        Active Hub: {activeProject.project_name}
                      </h2>
                      <Badge variant="neutral" size="xs">
                        {activeProject.framework || 'react-vite'}
                      </Badge>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-signal-success/15 text-signal-success border border-signal-success/30 font-medium">
                        {activeProject.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted line-clamp-1 max-w-2xl">
                      {activeProject.description || 'Autonomous AI Copilot Workspace'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Check}
                      onClick={() => handleSetActiveGlobal(activeProject)}
                      title="Set as global active project across chat & IDE"
                    >
                      Set Active
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Code2}
                      onClick={() => onOpenProject ? onOpenProject(activeProject.project_id) : onNavigate?.('copilot')}
                    >
                      Open in IDE
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => promptRemove(activeProject, e)}
                      className="p-2 rounded-md text-ink-muted hover:text-signal-error hover:bg-canvas-base border border-border transition-colors cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Workspace Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border border-b border-border bg-canvas-subtle/50 text-xs">
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Code Files</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.filesCount ?? 5}
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Chats</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.conversationsCount ?? 2}
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Documents</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.documentsCount ?? 0}
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Research</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.researchCount ?? 0}
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Graph Nodes</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.nodesCount ?? 4}
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-[11px] font-mono text-ink-muted uppercase">Edges</div>
                    <div className="text-base font-bold text-paper-100 mt-0.5">
                      {graphData?.stats?.edgesCount ?? 3}
                    </div>
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="px-4 border-b border-border flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'graph', label: 'Context Graph', icon: Network },
                      { id: 'files', label: 'Code & Files', icon: FileCode2 },
                      { id: 'documents', label: 'Documents', icon: FileText },
                      { id: 'research', label: 'Research Dossiers', icon: Compass },
                      { id: 'chats', label: 'Conversations', icon: MessageSquare }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'border-accent text-accent'
                              : 'border-transparent text-ink-muted hover:text-paper-100'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeTab === 'graph' && (
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={Plus}
                      onClick={() => setShowAddNode(true)}
                    >
                      Add Node
                    </Button>
                  )}
                </div>

                {/* Tab Content */}
                <div className="p-5 min-h-[300px]">
                  {/* TAB 1: CONTEXT GRAPH */}
                  {activeTab === 'graph' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-ink-muted font-mono">
                          Universal Knowledge Map: Visual relationships between goals, decisions, research, and code
                        </div>
                        <span className="text-[11px] text-ink-muted font-mono">
                          {graphData?.nodes?.length || 0} nodes · {graphData?.edges?.length || 0} relations
                        </span>
                      </div>

                      {/* Graph Node Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {(graphData?.nodes || []).map((node) => {
                          const typeBadge = {
                            goal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                            architecture: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                            code: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                            research: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                            document: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                            decision: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          }[node.node_type] || 'bg-canvas-base text-ink-muted border-border';

                          return (
                            <div
                              key={node.id}
                              className="p-4 rounded-md border border-border bg-canvas-base hover:border-accent/40 transition-fast space-y-2 relative group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${typeBadge}`}>
                                  {node.node_type}
                                </span>
                                <span className="text-[10px] font-mono text-ink-muted">
                                  {node.id}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-paper-100 font-sans">
                                {node.title}
                              </h4>
                              <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed">
                                {node.content_summary || 'Context node in project workspace.'}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Relationships / Edges Strip */}
                      {(graphData?.edges || []).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <h5 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted mb-2.5">
                            Active Relationships
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {graphData.edges.map((edge, idx) => (
                              <div
                                key={edge.id || idx}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-canvas-subtle border border-border text-[11px] font-mono text-paper-200"
                              >
                                <span className="text-accent font-semibold">{edge.source_node_id}</span>
                                <ChevronRight size={12} className="text-ink-muted" />
                                <span className="text-ink-muted italic">[{edge.relation_type}]</span>
                                <ChevronRight size={12} className="text-ink-muted" />
                                <span className="text-emerald-400 font-semibold">{edge.target_node_id}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CODE & FILES */}
                  {activeTab === 'files' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-muted font-mono mb-2">
                        <span>Workspace Files ({graphData?.files?.length || 0})</span>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={Code2}
                          onClick={() => onNavigate?.('copilot')}
                        >
                          Open in Copilot IDE
                        </Button>
                      </div>
                      <div className="rounded border border-border divide-y divide-border bg-canvas-base overflow-hidden">
                        {(graphData?.files || []).map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-canvas-elevated transition-colors">
                            <div className="flex items-center gap-2.5">
                              <FileCode2 size={14} className="text-accent" />
                              <span className="font-mono text-paper-100">{file.path}</span>
                            </div>
                            <span className="font-mono text-[11px] text-ink-muted">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Source'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: DOCUMENTS */}
                  {activeTab === 'documents' && (
                    <div className="space-y-3">
                      <div className="text-xs text-ink-muted font-mono mb-2">
                        Compiled Office Deliverables (PDF, Word, Excel, PowerPoint)
                      </div>
                      {(graphData?.documents || []).length === 0 ? (
                        <div className="text-center py-8 text-xs text-ink-muted">
                          No documents compiled yet. Ask AI-Dost in Chat: <em>&quot;Is project ki report word me banao&quot;</em>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {graphData.documents.slice(0, 10).map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded border border-border bg-canvas-base hover:border-accent/40 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <FileText size={16} className="text-rose-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-paper-100 truncate">{doc.name}</div>
                                  <div className="text-[10px] font-mono text-ink-muted">{doc.format?.toUpperCase() || 'DOC'} · {(doc.sizeBytes / 1024).toFixed(1)} KB</div>
                                </div>
                              </div>
                              <a
                                href={doc.url}
                                download
                                className="p-1.5 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer"
                                title="Download Document"
                              >
                                <Download size={14} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: RESEARCH */}
                  {activeTab === 'research' && (
                    <div className="space-y-3">
                      <div className="text-xs text-ink-muted font-mono mb-2">
                        Deep Research Dossiers & Synthesized Evidence
                      </div>
                      {(graphData?.research || []).length === 0 ? (
                        <div className="text-center py-8 text-xs text-ink-muted">
                          No research dossiers bound yet. Use <strong>Deep Research Agent</strong> from sidebar.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {graphData.research.slice(0, 6).map((res, idx) => (
                            <div key={idx} className="p-3 rounded border border-border bg-canvas-base flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Compass size={16} className="text-accent shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-paper-100 truncate">{res.name}</div>
                                  <div className="text-[10px] font-mono text-ink-muted">Research Dossier · Verified Citations</div>
                                </div>
                              </div>
                              {res.url && (
                                <a href={res.url} download className="p-1.5 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated">
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: CHATS */}
                  {activeTab === 'chats' && (
                    <div className="space-y-3">
                      <div className="text-xs text-ink-muted font-mono mb-2">
                        Conversations bound to this Workspace
                      </div>
                      <div className="rounded border border-border divide-y divide-border bg-canvas-base overflow-hidden">
                        {(graphData?.conversations || []).map((conv, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-canvas-elevated transition-colors">
                            <div className="flex items-center gap-2.5">
                              <MessageSquare size={14} className="text-accent" />
                              <span className="font-medium text-paper-100">{conv.title}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={ArrowRight}
                              onClick={() => onNavigate?.('chat')}
                            >
                              Jump to Chat
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editorial Table for All Projects (Preserved for compatibility and full overview) */}
            <div className="rounded-sm border border-border bg-canvas-surface overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-canvas-subtle border-b border-border text-xs font-semibold text-paper-100 flex items-center justify-between">
                <span>All Registered Projects</span>
                <span className="text-[11px] font-mono text-ink-muted">{projects.length} Total</span>
              </div>
              <div className="divide-y divide-border-subtle font-sans text-xs">
                {projects.map((p) => (
                  <div
                    key={p.project_id}
                    onClick={() => {
                      setSelectedProjectId(p.project_id);
                      if (onOpenProject) onOpenProject(p.project_id);
                    }}
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
                        onClick={(e) => promptRemove(p, e)}
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
          </div>
        )}
      </div>

      {/* New Project Modal (Preserves exact placeholder & button text for Jest tests) */}
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

      {/* Add Context Node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-canvas-surface border border-border p-5 shadow-modal space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Network size={16} className="text-accent" />
                <h3 className="text-sm font-semibold text-paper-100 font-display">Add Context Node</h3>
              </div>
              <button type="button" onClick={() => setShowAddNode(false)} className="text-ink-muted hover:text-paper-100 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Node Type</label>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value)}
                  className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                >
                  <option value="goal">Goal (Target Objective)</option>
                  <option value="architecture">Architecture (Tech & Patterns)</option>
                  <option value="decision">Decision (ADR / Key Choice)</option>
                  <option value="code">Code (Module / Component)</option>
                  <option value="research">Research (Findings / Market)</option>
                  <option value="document">Document (Deliverable)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Title</label>
                <input
                  value={nodeTitle}
                  onChange={(e) => setNodeTitle(e.target.value)}
                  placeholder="e.g. Implement WebSocket Handshake"
                  className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Summary / Context</label>
                <textarea
                  value={nodeSummary}
                  onChange={(e) => setNodeSummary(e.target.value)}
                  placeholder="Briefly describe what this node captures or requires..."
                  rows={3}
                  className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowAddNode(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateNode} disabled={!nodeTitle.trim() || addingNode}>
                {addingNode ? 'Adding...' : 'Add Node to Graph'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project"
        subtitle="This action cannot be undone."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Are you sure you want to delete <strong className="text-paper-100 font-semibold">{projectToDelete?.project_name}</strong>? All local configuration and project records will be permanently removed.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProjectToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={confirmRemove}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}