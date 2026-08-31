import React, { useState, useEffect } from 'react';
import {
  Compass, Plug, Plus, Save, Trash2, X,
  CheckCircle2, Server, Terminal, Shield, RefreshCw
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

export default function McpPanel({ onConfigSelect, onToast }) {
  const [configs, setConfigs] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: '', command: '', args: '' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mcp_configs');
      if (saved) {
        setConfigs(JSON.parse(saved));
      } else {
        const defaults = [
          { id: 1, name: 'SQLite DB Server', command: 'npx', args: '-y @modelcontextprotocol/server-sqlite --db test.db', status: 'Connected' },
          { id: 2, name: 'GitHub Integration', command: 'npx', args: '-y @modelcontextprotocol/server-github', status: 'Connected' },
          { id: 3, name: 'Filesystem Bridge', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem /workspace', status: 'Connected' }
        ];
        setConfigs(defaults);
        localStorage.setItem('mcp_configs', JSON.stringify(defaults));
      }
    } catch (_) {
      setConfigs([]);
    }
  }, []);

  const saveConfig = (e) => {
    e.preventDefault();
    if (!newConfig.name.trim() || !newConfig.command.trim()) return;
    const updated = [...configs, { ...newConfig, id: Date.now(), status: 'Connected' }];
    setConfigs(updated);
    localStorage.setItem('mcp_configs', JSON.stringify(updated));
    setIsEditing(false);
    setNewConfig({ name: '', command: '', args: '' });
    if (onToast) onToast(`Added MCP Server "${newConfig.name}"`, 'success');
  };

  const deleteConfig = (id, e) => {
    e.stopPropagation();
    const updated = configs.filter((c) => c.id !== id);
    setConfigs(updated);
    localStorage.setItem('mcp_configs', JSON.stringify(updated));
    if (onToast) onToast('Removed MCP Server', 'success');
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-paper-100 font-display">
              Model Context Protocol (MCP) Connectors
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Connect external databases, cloud filesystems, and developer tools to the autonomous Supervisor runtime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsEditing(true)}
            >
              Add Connector
            </Button>
          </div>
        </div>

        {/* MCP Connectors Table */}
        {configs.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No MCP connectors configured"
            description="Add your first Model Context Protocol server to allow AI-Dost to query local databases and APIs."
            actionLabel="Add Connector"
            onAction={() => setIsEditing(true)}
          />
        ) : (
          <div className="rounded-sm border border-border bg-canvas-surface overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2.5 bg-canvas-subtle border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              <div className="col-span-4 sm:col-span-3">Connector Name</div>
              <div className="col-span-5 sm:col-span-6">Command / Args</div>
              <div className="col-span-3 sm:col-span-3 text-right">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border-subtle font-sans text-xs">
              {configs.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-12 items-center px-4 py-3 hover:bg-canvas-elevated transition-fast group"
                >
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-2.5 min-w-0 pr-2">
                    <Plug className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    <span className="font-medium text-paper-100 truncate">
                      {c.name}
                    </span>
                  </div>

                  <div className="col-span-5 sm:col-span-6 font-mono text-[11px] text-ink-muted truncate pr-2">
                    {c.command} {c.args}
                  </div>

                  <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onConfigSelect && onConfigSelect(c)}
                      className="px-2 py-0.5 rounded-xs bg-canvas-base hover:bg-canvas-surface border border-border text-[11px] text-paper-200 hover:text-paper-100 transition-fast cursor-pointer"
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteConfig(c.id, e)}
                      className="p-1 rounded-xs text-ink-muted hover:text-signal-error hover:bg-canvas-base transition-fast cursor-pointer"
                      title="Delete Connector"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Connector Modal */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-sm bg-canvas-surface border border-border p-5 shadow-modal space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                <h3 className="text-sm font-semibold text-paper-100 font-display">
                  Add MCP Server
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1 text-ink-muted hover:text-paper-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={saveConfig} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-paper-200 mb-1">
                    Server Name
                  </label>
                  <input
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                    placeholder="e.g. Postgres DB"
                    className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-sans focus:outline-none focus:border-accent-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-paper-200 mb-1">
                    Executable Command
                  </label>
                  <input
                    value={newConfig.command}
                    onChange={(e) => setNewConfig({ ...newConfig, command: e.target.value })}
                    placeholder="e.g. npx"
                    className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-paper-200 mb-1">
                    Arguments
                  </label>
                  <input
                    value={newConfig.args}
                    onChange={(e) => setNewConfig({ ...newConfig, args: e.target.value })}
                    placeholder="e.g. -y @modelcontextprotocol/server-postgres"
                    className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={!newConfig.name.trim() || !newConfig.command.trim()}>
                    Save Connector
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
