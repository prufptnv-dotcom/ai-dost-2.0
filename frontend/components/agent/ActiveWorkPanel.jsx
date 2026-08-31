import React, { useState } from 'react';
import { Compass, Search, Code2, ShieldCheck, Terminal, FileCode2, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { ToolExecutionCard } from '../chat/ToolExecutionCard';
import { VerificationCard } from '../chat/VerificationCard';
import { ArtifactCard } from '../chat/ArtifactCard';
import { EmptyState } from '../ui/EmptyState';

export function ActiveWorkPanel({
  agent = {
    role: 'SUPERVISOR',
    objective: 'Orchestrate build pipeline',
    status: 'working',
  },
  currentStep,
  toolHistory = [],
  verification,
  artifacts = [],
  screenshot,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('execution');

  const tabs = [
    { id: 'execution', label: 'Current Execution', badge: toolHistory.length || null },
    { id: 'verification', label: 'Verification', badge: verification ? '1' : null },
    { id: 'artifacts', label: 'Artifacts', badge: artifacts.length || null },
  ];

  return (
    <div className={`flex flex-col h-full bg-canvas-surface border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Active Agent Header */}
      <div className="px-4 py-3 border-b border-border bg-canvas-subtle flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Badge variant="primary" size="sm">
            {agent.role || 'AGENT'}
          </Badge>
          <h3 className="text-ui-default font-semibold text-txt-primary truncate">
            {agent.objective || 'Autonomous task execution in progress'}
          </h3>
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="flex-shrink-0"
        />
      </div>

      {/* Panel Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'execution' && (
          <div className="space-y-3">
            {currentStep && (
              <div className="p-3 rounded-md bg-canvas-base border border-border text-xs text-txt-secondary flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse mt-1 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-txt-primary mb-0.5">Active Step:</div>
                  <p className="leading-relaxed">{currentStep}</p>
                </div>
              </div>
            )}

            {/* Tool Executions */}
            {toolHistory.length === 0 ? (
              <EmptyState
                icon={Terminal}
                title="No tool executions yet"
                description="When the agent performs tool actions (read, write, test, search), live results will appear here."
              />
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-txt-muted">
                  Executed Tools ({toolHistory.length})
                </div>
                {toolHistory.map((tool, idx) => (
                  <ToolExecutionCard
                    key={tool.id || idx}
                    tool={tool.tool || tool.action}
                    target={tool.args || tool.target}
                    status={tool.status === 'done' ? 'success' : tool.status === 'error' ? 'error' : 'running'}
                    output={tool.result || tool.error}
                    duration={tool.duration}
                  />
                ))}
              </div>
            )}

            {/* Screenshot if available */}
            {screenshot && (
              <div className="mt-4 p-3 rounded-lg border border-border bg-canvas-base">
                <div className="text-xs font-semibold text-txt-primary mb-2 flex items-center gap-2">
                  <span>Visual Sandbox Preview</span>
                </div>
                <img
                  src={screenshot}
                  alt="Sandbox visual verification"
                  className="rounded-md border border-border max-h-64 object-contain w-full bg-canvas-subtle"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'verification' && (
          <div>
            {verification ? (
              <VerificationCard {...verification} />
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Verification pending"
                description="Independent multi-agent verification will validate unit tests, build integrity, and security after worker execution."
              />
            )}
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div>
            {artifacts.length === 0 ? (
              <EmptyState
                icon={FileCode2}
                title="No artifacts generated yet"
                description="Generated files, documents, and reports will appear here."
              />
            ) : (
              <div className="space-y-2">
                {artifacts.map((art, i) => (
                  <ArtifactCard key={i} {...art} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActiveWorkPanel;
