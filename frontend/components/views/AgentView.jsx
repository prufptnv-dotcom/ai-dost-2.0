import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Play, Square, Loader2, Compass, Search, Code2, ShieldCheck,
  Layout, Users, Sparkles, Terminal, FileCode2, Trash2
} from 'lucide-react';
import { TaskHeader } from '../agent/TaskHeader';
import { AgentHierarchyTree } from '../agent/AgentHierarchyTree';
import { ActiveWorkPanel } from '../agent/ActiveWorkPanel';
import { ApprovalBanner } from '../agent/ApprovalBanner';
import { ActivityTimeline } from '../agent/ActivityTimeline';
import { WorkspaceChangesPanel } from '../agent/WorkspaceChangesPanel';
import { KanbanBoard } from '../agent/KanbanBoard';
import SpecWizard from '../agent/SpecWizard';
import { CrewPanel } from '../agent/CrewPanel';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { EmptyState } from '../ui/EmptyState';

const QUICK_PROMPTS = [
  { label: 'Scaffold fullstack app', prompt: 'Build a fullstack React + Node.js application with authentication and database integration.' },
  { label: 'Audit & fix codebase bugs', prompt: 'Inspect all project files, identify syntax and logic bugs, and provide verified fixes.' },
  { label: 'Write unit & integration tests', prompt: 'Generate comprehensive unit tests for backend APIs and frontend components.' },
  { label: 'Refactor state architecture', prompt: 'Optimize React component state and separate business logic into reusable hooks.' },
];

export default function AgentView({ onToast, onOpenFile }) {
  const BACKEND = (typeof window !== 'undefined' && window.__AI_DOST_BACKEND__) || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

  const [tab, setTab] = useState('workbench'); // 'workbench' | 'kanban' | 'spec' | 'crew'
  const [objective, setObjective] = useState('Autonomous Developer Runtime');
  const [status, setStatus] = useState('idle'); // 'idle' | 'planning' | 'working' | 'verifying' | 'waiting_for_user' | 'complete' | 'failed'
  const [activeRole, setActiveRole] = useState('SUPERVISOR');
  const [selectedAgentId, setSelectedAgentId] = useState('sup_1');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const [input, setInput] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [toolHistory, setToolHistory] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [workspaceChanges, setWorkspaceChanges] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [waitingApproval, setWaitingApproval] = useState(null);

  const [agents, setAgents] = useState([
    { id: 'sup_1', role: 'SUPERVISOR', status: 'idle', currentAction: 'Orchestrating task pipeline' },
  ]);

  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const showToast = onToast || ((m, t) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  });

  // Elapsed timer
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const stopRun = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setRunning(false);
    setStatus('failed');
    addTimelineEvent('SUPERVISOR', 'Agent execution stopped by user', 'failed');
    showToast('Agent run stopped', 'info');
  };

  const addTimelineEvent = (role, text, evtStatus = 'success') => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setTimelineEvents((prev) => [
      {
        id: `evt_${Date.now()}_${Math.random()}`,
        time: timeStr,
        role,
        text,
        status: evtStatus,
      },
      ...prev,
    ]);
  };

  const handleSpecComplete = (spec, plan) => {
    setTab('workbench');
    const taskName = spec.steps?.overview?.data?.name || 'Project Spec';
    setObjective(`Build: ${taskName}`);
    runAgent(`Build this project from spec: ${JSON.stringify(spec)}`);
  };

  const runAgent = async (text) => {
    const prompt = (text || input).trim();
    if (!prompt || running) return;

    setInput('');
    setRunning(true);
    setStatus('planning');
    setObjective(prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt);
    setElapsedSeconds(0);
    setToolHistory([]);
    setTimelineEvents([]);
    setWorkspaceChanges([]);
    setVerificationResult(null);
    setScreenshot(null);
    setWaitingApproval(null);

    // Initial Supervisor and Workers
    setAgents([
      { id: 'sup_1', role: 'SUPERVISOR', status: 'running', currentAction: 'Generating execution plan' },
      { id: 'res_1', role: 'RESEARCHER', status: 'idle', currentAction: 'Awaiting codebase query' },
      { id: 'cod_1', role: 'CODER', status: 'idle', currentAction: 'Awaiting implementation spec' },
      { id: 'ver_1', role: 'VERIFIER', status: 'idle', currentAction: 'Awaiting validation artifacts' },
    ]);

    addTimelineEvent('SUPERVISOR', `Task initialized: "${prompt}"`, 'working');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          userPrompt: prompt,
          projectPath: '',
          saveToRepo: false,
          forceLocal: false,
          takeScreenshot: true,
        }),
      });

      if (!res.ok) throw new Error(`Agent API failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const newToolHistory = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const evt of chunk.split('\n\n').filter(Boolean)) {
          const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine.slice(5));

            if (data.type === 'thinking') {
              setCurrentStep(data.message || 'Thinking...');
            } else if (data.type === 'plan' && data.plan) {
              setStatus('working');
              setActiveRole('SUPERVISOR');
              addTimelineEvent('SUPERVISOR', `Execution plan generated with ${data.plan.tasks?.length || 0} subtasks`, 'success');
            } else if (data.type === 'tool_call') {
              const toolName = data.action || data.tool || 'tool';
              const argsStr = typeof data.parameters === 'object' ? JSON.stringify(data.parameters) : String(data.arguments || '');

              // Determine active worker role
              let role = 'CODER';
              if (['search_code', 'read_file', 'list_dir', 'list_directory'].includes(toolName)) {
                role = 'RESEARCHER';
              } else if (['verify', 'test', 'lint'].includes(toolName)) {
                role = 'VERIFIER';
              } else if (['plan', 'coordinate'].includes(toolName)) {
                role = 'SUPERVISOR';
              }

              setActiveRole(role);
              setStatus(role === 'VERIFIER' ? 'verifying' : 'working');
              setCurrentStep(`Executing ${toolName}...`);

              // Track workspace changes
              if (['write_file', 'create_file', 'edit_file'].includes(toolName)) {
                const targetFile = data.parameters?.filePath || data.parameters?.path || 'workspace file';
                setWorkspaceChanges((prev) => [
                  ...prev,
                  { type: toolName.includes('create') ? 'create' : 'modify', path: targetFile, lines: '+modified' }
                ]);
              }

              const newTool = {
                id: `tool_${Date.now()}_${Math.random()}`,
                tool: toolName,
                args: argsStr,
                status: 'running',
                result: null,
                error: null,
                duration: 'running...',
              };

              newToolHistory.push(newTool);
              setToolHistory([...newToolHistory]);
              addTimelineEvent(role, `Called tool: ${toolName}`, 'running');
            } else if (data.type === 'tool_result' || (data.type === 'step' && data.stepLog)) {
              const last = newToolHistory[newToolHistory.length - 1];
              if (last) {
                const r = data.stepLog ? (data.stepLog.result || {}) : data;
                last.status = r.success !== false ? 'done' : 'error';
                last.result = (r.message || r.result || '').slice(0, 400);
                last.error = r.success === false ? (r.error || r.message || 'Step failed') : null;
                last.duration = 'completed';
              }
              setToolHistory([...newToolHistory]);
            } else if (data.type === 'screenshot') {
              const sUrl = data.url || (data.data ? `data:${data.mimeType || 'image/png'};base64,${data.data}` : null);
              if (sUrl) {
                setScreenshot(sUrl);
                addTimelineEvent('VERIFIER', 'Captured visual verification screenshot', 'success');
              }
            } else if (data.type === 'verification') {
              setVerificationResult(data.result);
              addTimelineEvent('VERIFIER', `Verification finished: ${data.result?.verdict || 'PASS'}`, data.result?.verdict === 'PASS' ? 'success' : 'failed');
            } else if (data.type === 'waiting_for_user') {
              setStatus('waiting_for_user');
              setWaitingApproval(data.reason || 'User approval required to proceed.');
              addTimelineEvent('SUPERVISOR', 'Execution paused: WAITING FOR USER', 'waiting');
            } else if (data.type === 'done') {
              setStatus('complete');
              setActiveRole('SUPERVISOR');
              addTimelineEvent('SUPERVISOR', 'Task completed successfully', 'success');
            }
          } catch (e) {
            // ignore malformed chunk
          }
        }
      }

      setStatus((s) => (s === 'working' || s === 'verifying' ? 'complete' : s));
      showToast('Agent run complete', 'success');
    } catch (e) {
      if (e.name !== 'AbortError') {
        setStatus('failed');
        addTimelineEvent('SUPERVISOR', `Error: ${e.message}`, 'failed');
        showToast('Agent run encountered an error', 'error');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleApprove = () => {
    setWaitingApproval(null);
    setStatus('working');
    addTimelineEvent('SUPERVISOR', 'User approved pending operation. Resuming...', 'working');
  };

  const handleReject = () => {
    setWaitingApproval(null);
    setStatus('failed');
    addTimelineEvent('SUPERVISOR', 'User rejected pending operation. Aborted.', 'failed');
  };

  const topTabs = [
    { id: 'workbench', label: 'Agent Workbench', icon: Bot },
    { id: 'kanban', label: 'Kanban Tasks', icon: Layout },
    { id: 'spec', label: 'Spec Wizard', icon: FileCode2 },
    { id: 'crew', label: 'Multi-Agent Crew', icon: Users },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas-base">
      {/* Task Header */}
      <TaskHeader
        objective={objective}
        status={status}
        activeRole={activeRole}
        elapsedSeconds={elapsedSeconds}
        running={running}
        onStop={stopRun}
        onStart={() => runAgent()}
      />

      {/* Top View Selector Sub-Bar */}
      <div className="px-4 sm:px-6 py-2 border-b border-border bg-canvas-subtle/60 flex items-center justify-between gap-3 select-none">
        <Tabs
          tabs={topTabs}
          activeTab={tab}
          onChange={setTab}
        />

        {toolHistory.length > 0 && !running && (
          <button
            type="button"
            onClick={() => {
              setToolHistory([]);
              setTimelineEvents([]);
              setWorkspaceChanges([]);
              setVerificationResult(null);
              setScreenshot(null);
              setStatus('idle');
            }}
            title="Reset workbench session"
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium text-txt-muted hover:text-txt-primary border border-border hover:bg-canvas-elevated transition-fast cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Waiting For User Approval Banner */}
        {status === 'waiting_for_user' && (
          <ApprovalBanner
            reason={waitingApproval || 'Sensitive workspace mutation requires approval.'}
            onApprove={handleApprove}
            onReject={handleReject}
            onRetry={() => runAgent()}
          />
        )}

        {tab === 'workbench' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-[500px]">
            {/* Left Column: Coordinator Hierarchy & Workspace Changes (4 Cols on Desktop) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <AgentHierarchyTree
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />

              <WorkspaceChangesPanel
                changes={workspaceChanges}
                onOpenFile={onOpenFile}
              />

              <ActivityTimeline
                events={timelineEvents}
              />
            </div>

            {/* Right Column: Active Work Panel (8 Cols on Desktop) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <ActiveWorkPanel
                agent={agents.find((a) => a.id === selectedAgentId) || agents[0]}
                currentStep={currentStep}
                toolHistory={toolHistory}
                verification={verificationResult}
                artifacts={artifacts}
                screenshot={screenshot}
              />
            </div>
          </div>
        )}

        {tab === 'kanban' && (
          <div className="p-4 rounded-lg bg-canvas-surface border border-border">
            <KanbanBoard agentId="current-agent" />
          </div>
        )}

        {tab === 'spec' && (
          <SpecWizard
            BACKEND={BACKEND}
            onToast={showToast}
            onSpecComplete={handleSpecComplete}
          />
        )}

        {tab === 'crew' && (
          <CrewPanel
            BACKEND={BACKEND}
            onToast={showToast}
          />
        )}
      </div>

      {/* Bottom Composer / Action Trigger for Workbench */}
      {tab === 'workbench' && (
        <div className="p-4 bg-canvas-subtle border-t border-border select-none">
          <div className="max-w-4xl mx-auto">
            {timelineEvents.length <= 1 && !running && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {QUICK_PROMPTS.map(({ label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => runAgent(prompt)}
                    className="p-2.5 rounded-md text-left bg-canvas-surface hover:bg-canvas-elevated border border-border text-xs text-txt-secondary hover:text-txt-primary transition-fast cursor-pointer focus-ring"
                  >
                    <div className="font-medium text-txt-primary truncate">{label}</div>
                    <div className="text-[11px] text-txt-muted truncate mt-0.5">{prompt}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-canvas-surface border border-border p-1.5 focus-within:border-border-focus transition-fast">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runAgent();
                  }
                }}
                placeholder="Instruct the autonomous agent (e.g. Scaffold fullstack app, inspect bugs, run tests)..."
                className="flex-1 bg-transparent px-3 py-1.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={() => runAgent()}
                disabled={!input.trim() || running}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium transition-fast cursor-pointer shadow-xs focus-ring"
              >
                {running ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Execute</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}