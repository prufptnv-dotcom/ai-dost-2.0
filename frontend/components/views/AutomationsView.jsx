import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap, Clock, Play, Pause, RefreshCw, Plus, CheckCircle2,
  AlertCircle, FileText, Search, Shield, ChevronRight, X,
  Trash2, ExternalLink, Activity, Send, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

const STARTER_TEMPLATES = [
  {
    id: 'tpl-research',
    name: 'Daily AI & Market Tech Brief',
    description: 'Autonomous research pipeline searching latest AI developments and synthesizing evidence dossier.',
    triggerType: 'schedule',
    triggerConfig: { intervalMinutes: 1440, label: 'Every 24 hours' },
    actionType: 'deep_research',
    actionConfig: { topic: 'Autonomous Agent Frameworks & Production Benchmarks 2026', depth: 'deep' },
    notifyChannels: ['in_app', 'telegram'],
    icon: Search,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/30',
  },
  {
    id: 'tpl-audit',
    name: 'Nightly Codebase Health & Git Audit',
    description: 'Automated workspace integrity analysis, lint verification, and uncommitted diff detection.',
    triggerType: 'schedule',
    triggerConfig: { intervalMinutes: 720, label: 'Every 12 hours' },
    actionType: 'repo_health_check',
    actionConfig: { checks: ['git_status', 'files_integrity', 'disk_usage'] },
    notifyChannels: ['in_app'],
    icon: Shield,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
  },
  {
    id: 'tpl-report',
    name: 'Weekly Project Status Deliverable',
    description: 'Autonomous compilation of project roadmap, deliverables, and metrics into a Word report.',
    triggerType: 'schedule',
    triggerConfig: { intervalMinutes: 10080, label: 'Every 7 days' },
    actionType: 'generate_document',
    actionConfig: { topic: 'AI-Dost Milestone & Project Deliverables Executive Brief', type: 'docx' },
    notifyChannels: ['in_app', 'telegram'],
    icon: FileText,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  {
    id: 'tpl-event',
    name: 'Agent Completion Deliverable Watcher',
    description: 'Watches for finished autonomous agent runs and triggers deliverable digest notification.',
    triggerType: 'event',
    triggerConfig: { event: 'agent_run_completed' },
    actionType: 'generate_document',
    actionConfig: { topic: 'Autonomous Agent Execution Summary & Artifacts', type: 'docx' },
    notifyChannels: ['in_app', 'telegram'],
    icon: Zap,
    color: 'text-accent',
    bgColor: 'bg-accent/10 border-accent/30',
  },
];

export default function AutomationsView({ onToast, onNavigate }) {
  const [workflows, setWorkflows] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [selectedWorkflowForRuns, setSelectedWorkflowForRuns] = useState(null);
  const [runsModalOpen, setRunsModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('schedule');
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [eventName, setEventName] = useState('agent_run_completed');
  const [actionType, setActionType] = useState('deep_research');
  const [topic, setTopic] = useState('');
  const [docType, setDocType] = useState('docx');
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [creating, setCreating] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    if (onToast) onToast(message, type);
    else {
      try {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { message, type } }));
      } catch (_) {}
    }
  }, [onToast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, runsRes] = await Promise.all([
        api.get('/workflows').catch(() => ({ data: { workflows: [] } })),
        api.get('/workflows/recent-runs?limit=15').catch(() => ({ data: { runs: [] } }))
      ]);

      const wfs = wfRes.data?.workflows || [];
      const rns = runsRes.data?.runs || [];
      setWorkflows(wfs);
      setRecentRuns(rns);
    } catch (e) {
      showToast(e.message || 'Failed to load automations', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunNow = async (wf) => {
    if (runningId) return;
    setRunningId(wf.id);
    showToast(`Triggering "${wf.name}"...`, 'info');
    try {
      const res = await api.post(`/workflows/${wf.id}/run`);
      if (res.data?.success) {
        showToast(`Workflow "${wf.name}" completed successfully!`, 'success');
        await loadData();
      } else {
        throw new Error(res.data?.error || 'Execution failed');
      }
    } catch (e) {
      showToast(e.message || 'Workflow run failed', 'error');
    } finally {
      setRunningId(null);
    }
  };

  const handleToggleStatus = async (wf) => {
    const nextStatus = wf.status === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/workflows/${wf.id}`, { status: nextStatus });
      showToast(`Workflow ${nextStatus === 'active' ? 'activated' : 'paused'}`, 'success');
      setWorkflows((prev) => prev.map((w) => (w.id === wf.id ? { ...w, status: nextStatus } : w)));
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (wf) => {
    try {
      await api.delete(`/workflows/${wf.id}`);
      showToast(`Deleted workflow "${wf.name}"`, 'success');
      setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
    } catch (e) {
      showToast(e.message || 'Failed to delete workflow', 'error');
    }
  };

  const handleApplyTemplate = (tpl) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setTriggerType(tpl.triggerType);
    if (tpl.triggerType === 'schedule') {
      setIntervalMinutes(tpl.triggerConfig.intervalMinutes || 1440);
    } else {
      setEventName(tpl.triggerConfig.event || 'agent_run_completed');
    }
    setActionType(tpl.actionType);
    if (tpl.actionType === 'deep_research') {
      setTopic(tpl.actionConfig.topic || '');
    } else if (tpl.actionType === 'generate_document') {
      setTopic(tpl.actionConfig.topic || '');
      setDocType(tpl.actionConfig.type || 'docx');
    }
    setNotifyInApp(tpl.notifyChannels.includes('in_app'));
    setNotifyTelegram(tpl.notifyChannels.includes('telegram'));
    setShowCreateModal(true);
  };

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);

    const triggerConfig = triggerType === 'schedule'
      ? { intervalMinutes: Number(intervalMinutes), label: `Every ${Math.round(intervalMinutes / 60)} hours` }
      : { event: eventName };

    const actionConfig = actionType === 'deep_research'
      ? { topic: topic || name, depth: 'standard' }
      : actionType === 'generate_document'
        ? { topic: topic || name, type: docType }
        : { checks: ['git_status', 'files_integrity'] };

    const notifyChannels = [];
    if (notifyInApp) notifyChannels.push('in_app');
    if (notifyTelegram) notifyChannels.push('telegram');

    try {
      const res = await api.post('/workflows', {
        name: name.trim(),
        description: description.trim(),
        triggerType,
        triggerConfig,
        actionType,
        actionConfig,
        notifyChannels,
        projectId: 'default',
        status: 'active',
      });

      if (res.data?.success) {
        showToast(`Created workflow "${name}"`, 'success');
        setShowCreateModal(false);
        resetForm();
        await loadData();
      }
    } catch (err) {
      showToast(err.message || 'Creation failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setTriggerType('schedule');
    setIntervalMinutes(1440);
    setEventName('agent_run_completed');
    setActionType('deep_research');
    setTopic('');
    setDocType('docx');
    setNotifyInApp(true);
    setNotifyTelegram(true);
  };

  const handleViewRuns = async (wf) => {
    setSelectedWorkflowForRuns(wf);
    setRunsModalOpen(true);
  };

  // Metrics
  const activeCount = useMemo(() => workflows.filter((w) => w.status === 'active').length, [workflows]);
  const totalRunsCount = useMemo(() => workflows.reduce((acc, w) => acc + (w.run_count || 0), 0), [workflows]);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-paper-100 font-display">
                Automated Workflows & Background Watchers
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-accent/15 text-accent border border-accent/30">
                P8 Automation
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Autonomous schedulers and reactive event watchers with multi-channel Telegram notifications.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              New Watcher
            </Button>
          </div>
        </div>

        {/* Metrics Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-border bg-canvas-surface shadow-sm">
            <div className="text-[11px] font-mono text-ink-muted uppercase">Active Watchers</div>
            <div className="text-xl font-semibold text-paper-100 mt-1 flex items-center gap-2">
              {activeCount}
              <span className="w-2 h-2 rounded-full bg-signal-success animate-pulse" />
            </div>
            <div className="text-[10px] text-ink-muted mt-0.5">{workflows.length} total configured</div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-canvas-surface shadow-sm">
            <div className="text-[11px] font-mono text-ink-muted uppercase">Total Executions</div>
            <div className="text-xl font-semibold text-paper-100 mt-1">{totalRunsCount}</div>
            <div className="text-[10px] text-ink-muted mt-0.5">Autonomous background runs</div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-canvas-surface shadow-sm">
            <div className="text-[11px] font-mono text-ink-muted uppercase">Scheduler Status</div>
            <div className="text-xl font-semibold text-signal-success mt-1">Healthy</div>
            <div className="text-[10px] text-ink-muted mt-0.5">Ticking every 30s</div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-canvas-surface shadow-sm">
            <div className="text-[11px] font-mono text-ink-muted uppercase">Telegram Channel</div>
            <div className="text-xl font-semibold text-paper-100 mt-1 flex items-center gap-1.5">
              <Send size={14} className="text-sky-400" />
              <span>Enabled</span>
            </div>
            <div className="text-[10px] text-ink-muted mt-0.5">Instant delivery alerts</div>
          </div>
        </div>

        {/* Starter Templates Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <h2 className="text-xs font-mono uppercase font-semibold text-paper-100 tracking-wider">
              Quick Starter Watcher Templates
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STARTER_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleApplyTemplate(tpl)}
                  className="group p-4 rounded-lg border border-border bg-canvas-surface hover:border-accent/50 hover:bg-canvas-elevated/40 transition-all cursor-pointer flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-md ${tpl.bgColor} border`}>
                        <Icon size={16} className={tpl.color} />
                      </div>
                      <Badge variant="neutral" size="xs">
                        {tpl.triggerType === 'schedule' ? 'Schedule' : 'Event'}
                      </Badge>
                    </div>
                    <h3 className="text-xs font-semibold text-paper-100 group-hover:text-accent transition-colors font-display line-clamp-1">
                      {tpl.name}
                    </h3>
                    <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-accent font-medium">
                    <span>Instantiate Watcher</span>
                    <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configured Workflows List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-paper-100" />
              <h2 className="text-xs font-mono uppercase font-semibold text-paper-100 tracking-wider">
                Configured Workflows ({workflows.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-ink-muted border border-border rounded-lg bg-canvas-surface">
              Loading active workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-8 text-center border border-border rounded-lg bg-canvas-surface space-y-3">
              <Zap size={24} className="text-ink-muted mx-auto" />
              <div className="text-sm font-medium text-paper-100">No active watchers configured</div>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                Instantiate one of the starter templates above to start autonomous research, codebase audits, or document generation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {workflows.map((wf) => {
                const isActive = wf.status === 'active';
                const isRunning = runningId === wf.id;

                return (
                  <div
                    key={wf.id}
                    className="p-4 rounded-lg border border-border bg-canvas-surface hover:border-border-strong transition-all shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-paper-100 font-display">
                            {wf.name}
                          </h3>
                          <Badge variant={isActive ? 'success' : 'neutral'} size="xs">
                            {isActive ? 'Active' : 'Paused'}
                          </Badge>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-canvas-elevated text-ink-muted border border-border">
                            {wf.trigger_type === 'schedule'
                              ? (wf.trigger_config?.label || `Every ${wf.trigger_config?.intervalMinutes || 60}m`)
                              : `Event: ${wf.trigger_config?.event || 'custom'}`}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
                            {wf.action_type}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted max-w-3xl">
                          {wf.description || 'Autonomous watcher process'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="xs"
                          icon={Play}
                          disabled={isRunning}
                          onClick={() => handleRunNow(wf)}
                        >
                          {isRunning ? 'Running...' : 'Run Now'}
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(wf)}
                          title={isActive ? 'Pause watcher' : 'Activate watcher'}
                          className="p-1.5 rounded-md border border-border text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                        >
                          {isActive ? <Pause size={14} /> : <Play size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleViewRuns(wf)}
                          title="View run history"
                          className="p-1.5 rounded-md border border-border text-ink-muted hover:text-accent hover:bg-canvas-elevated transition-colors cursor-pointer"
                        >
                          <Activity size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(wf)}
                          title="Delete watcher"
                          className="p-1.5 rounded-md border border-border text-ink-muted hover:text-signal-error hover:bg-canvas-elevated transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-muted">
                      <div className="flex items-center gap-4">
                        <span>Runs: <strong className="text-paper-100">{wf.run_count || 0}</strong></span>
                        <span>
                          Last Run: <strong className="text-paper-100">{wf.last_run_at ? new Date(wf.last_run_at).toLocaleTimeString() : 'Never'}</strong>
                        </span>
                        {wf.next_run_at && (
                          <span>
                            Next Run: <strong className="text-paper-100">{new Date(wf.next_run_at).toLocaleTimeString()}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span>Channels:</span>
                        {(wf.notify_channels || ['in_app']).map((ch) => (
                          <span key={ch} className="px-1.5 py-0.5 rounded text-[10px] bg-canvas-base border border-border text-ink-muted">
                            {ch === 'telegram' ? '📱 Telegram' : '🔔 In-App'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Execution Activity Feed */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <h2 className="text-xs font-mono uppercase font-semibold text-paper-100 tracking-wider">
              Recent Execution Activity
            </h2>
          </div>

          <div className="rounded-lg border border-border bg-canvas-surface overflow-hidden shadow-sm">
            {recentRuns.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-muted">
                No recent workflow runs recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle text-xs">
                {recentRuns.map((r) => {
                  const isSuccess = r.status === 'success';
                  const isRunning = r.status === 'running';

                  return (
                    <div key={r.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-canvas-elevated/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-signal-success' : isRunning ? 'bg-amber-400 animate-pulse' : 'bg-signal-error'}`} />
                          <strong className="text-paper-100 font-medium">
                            {r.workflow_name || 'Autonomous Action'}
                          </strong>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {r.started_at ? new Date(r.started_at).toLocaleTimeString() : ''}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-canvas-base border border-border text-ink-muted">
                            {r.duration_ms ? `${r.duration_ms}ms` : 'running'}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-muted line-clamp-1">
                          {r.output_summary || r.error_message || 'In progress...'}
                        </p>
                      </div>

                      {r.output_data?.downloadUrl && (
                        <a
                          href={r.output_data.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 transition-colors shrink-0"
                        >
                          <span>Download Deliverable</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg bg-canvas-surface border border-border p-5 shadow-modal space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-accent" />
                <h3 className="text-sm font-semibold text-paper-100 font-display">Configure Autonomous Watcher</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-ink-muted hover:text-paper-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Watcher Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Market Intelligence Brief"
                  className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this workflow accomplishes..."
                  className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Trigger Type</label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value)}
                    className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                  >
                    <option value="schedule">Schedule (Time Interval)</option>
                    <option value="event">Event (System Trigger)</option>
                  </select>
                </div>

                {triggerType === 'schedule' ? (
                  <div>
                    <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Interval</label>
                    <select
                      value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                    >
                      <option value={60}>Every 1 Hour</option>
                      <option value={360}>Every 6 Hours</option>
                      <option value={720}>Every 12 Hours</option>
                      <option value={1440}>Every 24 Hours</option>
                      <option value={10080}>Every 7 Days</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Trigger Event</label>
                    <input
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g. agent_run_completed"
                      className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Action Type</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                  >
                    <option value="deep_research">Deep Research Agent</option>
                    <option value="generate_document">Office Document Engine</option>
                    <option value="repo_health_check">Codebase Health Audit</option>
                  </select>
                </div>

                {actionType === 'generate_document' && (
                  <div>
                    <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Document Format</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 focus:outline-none focus:border-accent"
                    >
                      <option value="docx">Word (.docx)</option>
                      <option value="pdf">PDF (.pdf)</option>
                      <option value="pptx">PowerPoint (.pptx)</option>
                      <option value="xlsx">Excel (.xlsx)</option>
                      <option value="csv">CSV (.csv)</option>
                    </select>
                  </div>
                )}
              </div>

              {(actionType === 'deep_research' || actionType === 'generate_document') && (
                <div>
                  <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Topic / Subject</label>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Next.js 16 and Turbopack Production Performance"
                    className="w-full px-3 py-2 rounded text-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-mono text-ink-muted uppercase block mb-1">Notification Channels</label>
                <div className="flex items-center gap-4 text-xs text-paper-100">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyInApp}
                      onChange={(e) => setNotifyInApp(e.target.checked)}
                      className="rounded accent-accent"
                    />
                    <span>🔔 In-App Event Feed</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyTelegram}
                      onChange={(e) => setNotifyTelegram(e.target.checked)}
                      className="rounded accent-accent"
                    />
                    <span>📱 Telegram Bot</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" disabled={!name.trim() || creating} type="submit">
                  {creating ? 'Saving...' : 'Save Watcher'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execution Runs Modal */}
      {runsModalOpen && selectedWorkflowForRuns && (
        <Modal
          isOpen={runsModalOpen}
          onClose={() => setRunsModalOpen(false)}
          title={`Run History: ${selectedWorkflowForRuns.name}`}
          subtitle="Audit log of previous autonomous background runs"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-ink-muted border-b border-border pb-2">
              <span>Action: <strong className="text-paper-100">{selectedWorkflowForRuns.action_type}</strong></span>
              <span>Total Runs: <strong className="text-paper-100">{selectedWorkflowForRuns.run_count}</strong></span>
            </div>

            <div className="space-y-2">
              {recentRuns
                .filter((r) => r.workflow_id === selectedWorkflowForRuns.id)
                .map((run) => (
                  <div key={run.id} className="p-3 rounded border border-border bg-canvas-elevated/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${run.status === 'success' ? 'bg-signal-success' : 'bg-signal-error'}`} />
                        <span className="font-mono text-paper-100 font-medium uppercase text-[10px]">{run.status}</span>
                        <span className="text-ink-muted text-[11px]">{new Date(run.started_at).toLocaleString()}</span>
                      </div>
                      <span className="font-mono text-ink-muted text-[10px]">{run.duration_ms}ms</span>
                    </div>

                    <p className="text-xs text-paper-100">{run.output_summary}</p>

                    {run.output_data?.downloadUrl && (
                      <div className="pt-1">
                        <a
                          href={run.output_data.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                        >
                          <span>Open compiled deliverable</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                ))}

              {recentRuns.filter((r) => r.workflow_id === selectedWorkflowForRuns.id).length === 0 && (
                <div className="p-4 text-center text-xs text-ink-muted">
                  No previous runs found for this watcher. Click &quot;Run Now&quot; to trigger one immediately.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setRunsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
