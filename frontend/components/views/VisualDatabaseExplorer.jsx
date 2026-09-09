import React, { useState, useEffect, useCallback } from 'react';
import { Database, Table, Plus, RefreshCw, Trash2, Search, Play, Terminal, ChevronDown, Check, X, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function VisualDatabaseExplorer({ projectId = 'copilot-workspace', onToast }) {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dbMeta, setDbMeta] = useState({ isRealSqlite: false, dbPath: '' });

  // SQL Console state
  const [sqlConsoleOpen, setSqlConsoleOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlError, setSqlError] = useState('');

  // Add Row Modal state
  const [addRowModalOpen, setAddRowModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState({});

  const showToast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
  }, [onToast]);

  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/database/${projectId}/tables`);
      if (res.data?.success) {
        const tableList = res.data.tables || [];
        setTables(tableList);
        setDbMeta({ isRealSqlite: res.data.isRealSqlite, dbPath: res.data.dbPath || '' });
        if (tableList.length > 0 && (!activeTable || !tableList.includes(activeTable))) {
          setActiveTable(tableList[0]);
        }
      }
    } catch (err) {
      showToast(`Failed to load tables: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTable, showToast]);

  const loadTableData = useCallback(async (tableName) => {
    if (!tableName) return;
    try {
      setLoading(true);
      const res = await api.get(`/database/${projectId}/table/${tableName}`);
      if (res.data?.success) {
        setColumns(res.data.columns || []);
        setRows(res.data.rows || []);
      }
    } catch (err) {
      showToast(`Failed to load rows: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (activeTable) {
      loadTableData(activeTable);
      setSqlQuery(`SELECT * FROM ${activeTable} LIMIT 20;`);
    }
  }, [activeTable, loadTableData]);

  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlRunning(true);
    setSqlError('');
    try {
      const res = await api.post(`/database/${projectId}/query`, { sql: sqlQuery });
      if (res.data?.success) {
        if (res.data.rows) {
          setRows(res.data.rows);
          if (res.data.rows.length > 0) {
            setColumns(Object.keys(res.data.rows[0]).map(k => ({ name: k, type: 'QUERY' })));
          }
        }
        showToast(`Query executed! (${res.data.count ?? res.data.changes ?? 0} results)`, 'success');
      } else {
        setSqlError(res.data?.error || 'Query failed');
      }
    } catch (err) {
      setSqlError(err.response?.data?.error || err.message);
    } finally {
      setSqlRunning(false);
    }
  };

  const handleCreateRow = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await api.post(`/database/${projectId}/table/${activeTable}/row`, newRowData);
      if (res.data?.success) {
        showToast(`Record added to ${activeTable}`, 'success');
        setAddRowModalOpen(false);
        setNewRowData({});
        loadTableData(activeTable);
      }
    } catch (err) {
      showToast(`Insert failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteRow = async (rowId) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      const res = await api.delete(`/database/${projectId}/table/${activeTable}/row/${rowId}`);
      if (res.data?.success) {
        setRows(prev => prev.filter(r => String(r.id) !== String(rowId)));
        showToast('Record deleted', 'info');
      }
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const filteredRows = rows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(r).some(val => String(val).toLowerCase().includes(q));
  });

  return (
    <div className="h-full flex flex-col bg-canvas-base text-paper-100 font-sans select-none overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-canvas-surface border-b border-border text-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-accent font-mono">
            <Database size={13} className="text-accent" />
            <span>DB Explorer</span>
          </div>

          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-canvas-base border border-border text-ink-muted">
            {dbMeta.dbPath || 'Database'}
          </span>

          {/* Table Selector */}
          <div className="relative flex items-center">
            <select
              value={activeTable}
              onChange={(e) => setActiveTable(e.target.value)}
              className="bg-canvas-elevated text-paper-100 border border-border rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer pr-6 appearance-none"
            >
              {tables.map(t => (
                <option key={t} value={t}>📊 {t}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 text-ink-muted pointer-events-none" />
          </div>

          <button
            onClick={() => loadTableData(activeTable)}
            className="p-1 rounded hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time search */}
          <div className="relative flex items-center">
            <Search size={11} className="absolute left-2.5 text-ink-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table rows..."
              className="bg-canvas-base text-paper-100 border border-border rounded-md pl-7 pr-2 py-0.8 text-[11px] focus:outline-none focus:border-accent w-36 sm:w-48 placeholder:text-ink-muted"
            />
          </div>

          <button
            onClick={() => {
              setNewRowData({});
              setAddRowModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent font-semibold text-[11px] border border-accent/40 cursor-pointer transition-colors"
          >
            <Plus size={12} /> Add Record
          </button>

          <button
            onClick={() => setSqlConsoleOpen(!sqlConsoleOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
              sqlConsoleOpen
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-canvas-elevated hover:bg-canvas-surface text-ink-muted hover:text-paper-100 border-border'
            }`}
          >
            <Terminal size={11} /> SQL
          </button>
        </div>
      </div>

      {/* SQL Console Bar (Collapsible) */}
      {sqlConsoleOpen && (
        <div className="p-2.5 bg-canvas-elevated border-b border-border space-y-2 shrink-0 animate-in slide-in-from-top-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-accent uppercase">SQL Query Console</span>
            <button onClick={() => setSqlConsoleOpen(false)} className="text-ink-muted hover:text-paper-100 p-0.5 cursor-pointer">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleExecuteSql(); }}
              placeholder="Enter SQL (e.g. SELECT * FROM transactions WHERE total_usd > 5000;)"
              className="flex-1 bg-canvas-base border border-border rounded-md px-3 py-1.5 font-mono text-xs text-paper-100 focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleExecuteSql}
              disabled={sqlRunning}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-all shadow-xs shrink-0"
            >
              <Play size={11} className="fill-white" /> {sqlRunning ? 'Running...' : 'Run SQL'}
            </button>
          </div>
          {sqlError && (
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono bg-red-950/30 p-1.5 rounded border border-red-500/30">
              <AlertCircle size={12} className="shrink-0" />
              <span>{sqlError}</span>
            </div>
          )}
        </div>
      )}

      {/* Table Data Grid */}
      <div className="flex-1 overflow-auto bg-canvas-base">
        {columns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-ink-muted text-xs">
            <Table size={24} className="opacity-40 mb-2" />
            <p>No table or schema selected</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead className="sticky top-0 bg-canvas-surface border-b border-border z-10">
              <tr>
                <th className="py-2 px-3 text-[10px] font-bold text-ink-muted uppercase tracking-wider w-10">#</th>
                {columns.map(col => (
                  <th key={col.name} className="py-2 px-3 text-[10px] font-bold text-paper-200 uppercase tracking-wider whitespace-nowrap">
                    <span>{col.name}</span>
                    <span className="ml-1 text-[8px] opacity-50 font-normal lowercase font-sans">({col.type})</span>
                  </th>
                ))}
                <th className="py-2 px-3 text-[10px] font-bold text-ink-muted uppercase tracking-wider text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="text-center py-8 text-ink-muted text-xs font-sans">
                    {searchQuery ? `No records matching "${searchQuery}"` : 'Table is empty. Click "+ Add Record" to insert data.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-canvas-surface/60 transition-colors group">
                    <td className="py-1.5 px-3 text-[10px] text-ink-muted">{idx + 1}</td>
                    {columns.map(col => (
                      <td key={col.name} className="py-1.5 px-3 text-paper-100 whitespace-nowrap truncate max-w-xs" title={String(row[col.name] ?? '')}>
                        {typeof row[col.name] === 'boolean' ? (
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${row[col.name] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {String(row[col.name])}
                          </span>
                        ) : typeof row[col.name] === 'number' ? (
                          <span className="text-sky-400 font-semibold">{row[col.name]}</span>
                        ) : (
                          String(row[col.name] ?? '')
                        )}
                      </td>
                    ))}
                    <td className="py-1.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteRow(row.id || idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-ink-muted hover:text-red-400 rounded transition-all cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-canvas-surface border-t border-border flex items-center justify-between text-[10px] text-ink-muted font-mono shrink-0">
        <span>Table: <b className="text-paper-100">{activeTable || 'none'}</b> ({filteredRows.length} rows)</span>
        <span>Connected to live workspace runtime</span>
      </div>

      {/* Add Row Modal */}
      {addRowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-canvas-surface border border-border rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-paper-100">Add Record to {activeTable}</h3>
              </div>
              <button onClick={() => setAddRowModalOpen(false)} className="text-ink-muted hover:text-paper-100 p-1 cursor-pointer">
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateRow} className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {columns.filter(c => c.name !== 'id').map(col => (
                <div key={col.name} className="space-y-1">
                  <label className="text-[11px] font-mono text-ink-muted uppercase">{col.name} ({col.type})</label>
                  <input
                    type={col.type.toLowerCase().includes('int') || col.type.toLowerCase().includes('num') ? 'number' : 'text'}
                    value={newRowData[col.name] ?? ''}
                    onChange={(e) => setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                    placeholder={`Enter ${col.name}...`}
                    className="w-full bg-canvas-base border border-border rounded-lg px-3 py-1.5 text-xs text-paper-100 focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              ))}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddRowModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-ink-muted hover:text-paper-100 text-xs cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
