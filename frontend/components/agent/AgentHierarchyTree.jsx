import React from 'react';
import { Compass, Search, Code2, ShieldCheck, ChevronRight, ArrowDown } from 'lucide-react';
import { Badge } from '../ui/Badge';

const ROLE_CONFIG = {
  SUPERVISOR: { icon: Compass, label: 'Supervisor', desc: 'Plan & Orchestration', color: 'text-accent' },
  RESEARCHER: { icon: Search, label: 'Researcher', desc: 'Codebase RAG & Search', color: 'text-status-info' },
  CODER: { icon: Code2, label: 'Coder', desc: 'Workspace Implementation', color: 'text-txt-primary' },
  VERIFIER: { icon: ShieldCheck, label: 'Verifier', desc: 'Independent Test & Integrity', color: 'text-status-success' },
};

export function AgentHierarchyTree({
  agents = [
    { id: 'sup_1', role: 'SUPERVISOR', status: 'active', currentAction: 'Coordinating execution plan' }
  ],
  selectedAgentId,
  onSelectAgent,
  className = '',
}) {
  const supervisor = agents.find((a) => a.role === 'SUPERVISOR') || agents[0];
  const workers = agents.filter((a) => a.id !== (supervisor ? supervisor.id : null));

  return (
    <div className={`p-4 bg-canvas-surface border border-border rounded-lg flex flex-col gap-3 select-none ${className}`}>
      <div className="text-[11px] font-mono uppercase tracking-wider text-txt-muted">
        Agent Coordinator Hierarchy
      </div>

      {/* Supervisor Root Node */}
      {supervisor && (
        <AgentNodeItem
          agent={supervisor}
          isSelected={selectedAgentId === supervisor.id}
          onClick={() => onSelectAgent && onSelectAgent(supervisor.id)}
          isSupervisor
        />
      )}

      {/* Handoff Branch Line */}
      {workers.length > 0 && (
        <div className="flex items-center gap-2 pl-4 py-0.5 text-txt-muted">
          <div className="w-[1px] h-4 bg-border" />
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <ArrowDown className="w-3 h-3 text-accent" />
            <span>Delegated Workers ({workers.length})</span>
          </div>
        </div>
      )}

      {/* Delegated Workers */}
      <div className="flex flex-col gap-1.5 pl-3 border-l border-border-subtle ml-4">
        {workers.map((worker) => (
          <AgentNodeItem
            key={worker.id}
            agent={worker}
            isSelected={selectedAgentId === worker.id}
            onClick={() => onSelectAgent && onSelectAgent(worker.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentNodeItem({ agent, isSelected, onClick, isSupervisor = false }) {
  const config = ROLE_CONFIG[agent.role] || ROLE_CONFIG.CODER;
  const Icon = config.icon;

  const STATUS_VARIANTS = {
    active: 'info',
    running: 'info',
    working: 'info',
    verifying: 'warning',
    complete: 'success',
    succeeded: 'success',
    failed: 'error',
    idle: 'default',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 p-2.5 rounded-md border text-left transition-fast cursor-pointer focus-ring ${
        isSelected
          ? 'bg-canvas-elevated border-accent text-txt-primary shadow-xs'
          : 'bg-canvas-subtle/50 hover:bg-canvas-subtle border-border-subtle text-txt-secondary hover:text-txt-primary'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-7 h-7 rounded-xs bg-canvas-base border border-border flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-txt-primary font-sans truncate">
              {config.label}
            </span>
            {isSupervisor && (
              <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-accent/10 text-accent font-medium">
                Root
              </span>
            )}
          </div>
          <p className="text-[11px] text-txt-muted truncate mt-0.5 max-w-[180px]">
            {agent.currentAction || config.desc}
          </p>
        </div>
      </div>

      <Badge variant={STATUS_VARIANTS[agent.status] || 'default'} size="sm">
        {agent.status || 'idle'}
      </Badge>
    </button>
  );
}

export default AgentHierarchyTree;
