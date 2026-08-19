import { useState, useEffect } from 'react';
import { Compass, Plug, Plus, Save, Trash2, X } from 'lucide-react';

export default function McpPanel({ onConfigSelect }) {
  const [configs, setConfigs] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newConfig, setNewConfig] = useState({ name: '', command: '', args: '' });

  useEffect(() => {
    const saved = localStorage.getItem('mcp_configs');
    if (saved) {
      setConfigs(JSON.parse(saved));
    } else {
      // Default examples
      const defaults = [
        { id: 1, name: 'SQLite DB', command: 'npx', args: '-y @modelcontextprotocol/server-sqlite --db test.db' },
        { id: 2, name: 'GitHub', command: 'npx', args: '-y @modelcontextprotocol/server-github' }
      ];
      setConfigs(defaults);
      localStorage.setItem('mcp_configs', JSON.stringify(defaults));
    }
  }, []);

  const saveConfig = () => {
    if (!newConfig.name || !newConfig.command) return;
    const updated = [...configs, { ...newConfig, id: Date.now() }];
    setConfigs(updated);
    localStorage.setItem('mcp_configs', JSON.stringify(updated));
    setIsEditing(false);
    setNewConfig({ name: '', command: '', args: '' });
  };

  const deleteConfig = (id) => {
    const updated = configs.filter(c => c.id !== id);
    setConfigs(updated);
    localStorage.setItem('mcp_configs', JSON.stringify(updated));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
          <Compass size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">MCP Connectors</h1>
          <p className="text-slate-400 text-sm">Connect your autonomous agent to external tools and databases</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {configs.map(config => (
          <div key={config.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plug size={18} className="text-blue-400" />
                {config.name}
              </h3>
              <button onClick={() => deleteConfig(config.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="font-mono text-xs text-slate-400 bg-slate-950 p-2 rounded break-all mb-4">
              {config.command} {config.args}
            </div>
            <button 
              onClick={() => onConfigSelect && onConfigSelect(config)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              Use this Server
            </button>
          </div>
        ))}

        {isEditing ? (
          <div className="p-4 bg-slate-800 rounded-xl border border-blue-500/50">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">Add New Server</h3>
              <button onClick={() => setIsEditing(false)}><X size={18}/></button>
            </div>
            <input 
              type="text" placeholder="Server Name (e.g., PostgreSQL)" 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-2 text-sm focus:border-blue-500 outline-none"
              value={newConfig.name} onChange={e => setNewConfig({...newConfig, name: e.target.value})}
            />
            <input 
              type="text" placeholder="Command (e.g., npx)" 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-2 text-sm focus:border-blue-500 outline-none"
              value={newConfig.command} onChange={e => setNewConfig({...newConfig, command: e.target.value})}
            />
            <input 
              type="text" placeholder="Args (e.g., -y @modelcontextprotocol/server-postgres)" 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-4 text-sm focus:border-blue-500 outline-none"
              value={newConfig.args} onChange={e => setNewConfig({...newConfig, args: e.target.value})}
            />
            <button onClick={saveConfig} className="w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium flex justify-center items-center gap-2">
              <Save size={16} /> Save Server
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="p-4 border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-slate-300 transition-colors min-h-[160px]"
          >
            <Plus size={32} className="mb-2" />
            <span className="font-medium">Add MCP Server</span>
          </button>
        )}
      </div>
      
      <div className="mt-auto p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
        <h4 className="font-bold text-blue-400 mb-2">How it works</h4>
        <p className="text-sm text-slate-300 mb-2">
          Model Context Protocol (MCP) allows your autonomous agent to securely connect to local and remote resources.
        </p>
        <p className="text-xs text-slate-400">
          When you click &quot;Use this Server&quot;, the connection settings will be passed to the Agent Workspace. The agent will then discover available tools (like database queries) and use them autonomously.
        </p>
      </div>
    </div>
  );
}
