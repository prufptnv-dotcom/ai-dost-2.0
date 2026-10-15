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
    // P2 #97: JSON.parse can succeed with a non-array (object/string) —
    // configs.map would crash render. Invalid/non-array storage behaves like
    // missing storage: seed defaults.
    const defaults = [
      { id: 1, name: 'SQLite DB Server', command: 'npx', args: '-y @modelcontextprotocol/server-sqlite --db test.db', status: 'Connected' },
      { id: 2, name: 'GitHub Integration', command: 'npx', args: '-y @modelcontextprotocol/server-github', status: 'Connected' },
      { id: 3, name: 'Filesystem Bridge', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem /workspace', status: 'Connected' }
    ];
    try {
      const saved = localStorage.getItem('mcp_configs');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        setConfigs(parsed);
      } else {
        setConfigs(defaults);
        localStorage.setItem('mcp_configs', JSON.stringify(defaults));
      }
    } catch (_) {
      setConfigs(defaults);
      try { localStorage.setItem('mcp_configs', JSON.stringify(defaults)); } catch (_) {}
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

  const [connectingId, setConnectingId] = useState(null);
  const [connectedIds, setConnectedIds] = useState(new Set([1, 2, 3])); // default connected

  const handleConnect = (c) => {
    if (connectedIds.has(c.id)) {
      // Disconnect
      setConnectedIds(prev => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
      if (onToast) onToast(`Disconnected from ${c.name}`, 'warning');
      return;
    }
    setConnectingId(c.id);
    setTimeout(() => {
      setConnectingId(null);
      setConnectedIds(prev => new Set(prev).add(c.id));
      if (onToast) onToast(`Successfully connected to ${c.name}`, 'success');
      if (onConfigSelect) onConfigSelect(c);
    }, 1200);
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base">
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
              {configs.map((c) => {
                const isConnected = connectedIds.has(c.id);
                const isConnecting = connectingId === c.id;
                
                return (
                <div
                  key={c.id}
                  className="grid grid-cols-12 items-center px-4 py-3 hover:bg-canvas-elevated transition-fast group"
                >
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-2.5 min-w-0 pr-2">
                    <Plug className={`w-4 h-4 flex-shrink-0 ${isConnected ? 'text-emerald-400' : 'text-accent-primary'}`} />
                    <span className="font-medium text-paper-100 truncate">
                      {c.name}
                    </span>
                  </div>

                  <div className="col-span-5 sm:col-span-6 font-mono text-[11px] text-ink-muted truncate pr-2 flex items-center gap-3">
                    <span>{c.command} {c.args}</span>
                    {isConnected && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-bold shrink-0">
                        Live
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnect(c)}
                      disabled={isConnecting}
                      className={`px-3 py-1 rounded bg-canvas-base border text-[11px] font-medium transition-fast cursor-pointer min-w-[70px] flex justify-center items-center gap-1.5 ${
                        isConnected 
                          ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' 
                          : 'border-border text-paper-200 hover:text-paper-100 hover:bg-canvas-surface'
                      }`}
                    >
                      {isConnecting ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      <span>{isConnecting ? '...' : isConnected ? 'Connected' : 'Connect'}</span>
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
              )})}
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
