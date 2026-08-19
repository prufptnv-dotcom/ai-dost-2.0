'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { KanbanBoard } from './KanbanBoard';

export function AgentDashboard({ agentId }) {
  const [tasks, setTasks] = useState([]);
  const router = useRouter();
  const [sidebar, setSidebar] = useState('kanban');
  const [filters, setFilters] = useState({ status: 'all', search: '' });

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/tasks?agentId=${agentId}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, [agentId]);

  useEffect(() => {
    // Load agent tasks from backend
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filters.status === 'all' || task.column === filters.status;
    const matchesSearch = task.title.toLowerCase().includes(filters.search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleTaskUpdate = useCallback(({ type, task, fromColumn, toColumn }) => {
    if (type === 'newTask') {
      setTasks(prev => [...prev, task]);
    } else if (type === 'move') {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === task.taskId);
        if (idx > -1) {
          const newTasks = [...prev];
          newTasks[idx].column = toColumn;
          return newTasks;
        }
        return prev;
      });
    }
  }, []);

  return (
    <div style={{ flex: 1, background: '#0f172a', minHeight: '100vh' }}>
      <div style={{ display: 'flex', height: '100%' }}>
        
        {/* Sidebar */}
        <div style={{ width: 240, borderRight: '1px solid #334155', background: '#1e293b' }}>
          <div style={{ padding: '20px 16px', borderBottom: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#e2e8f0' }}>AI-Dost Agent</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: '12px' }}>Agent workspace</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ padding: '6px 12px', fontSize: 12, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Kanban
              </button>
              <button style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#64748b', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer' }}>
                Analytics
              </button>
              <button style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#64748b', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer' }}>
                Settings
              </button>
            </div>
          </div>

          <nav style={{ marginTop: '12px' }}>
            <button
              style={{
                width: '100%', padding: '8px', marginBottom: '4px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: 12, textAlign: 'left'
              }}
              onClick={() => setSidebar('kanban')}
            >
              <span style={{ marginRight: 8 }}>📋</span> Kanban
            </button>
            <button
              style={{
                width: '100%', padding: '8px', marginBottom: '4px', background: 'transparent', color: '#64748b', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer'
              }}
              onClick={() => setSidebar('analytics')}
            >
              <span style={{ marginRight: 8 }}>📊</span> Analytics
            </button>
            <button
              style={{
                width: '100%', padding: '8px', marginBottom: '4px', background: 'transparent', color: '#64748b', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer'
              }}
              onClick={() => setSidebar('settings')}
            >
              <span style={{ marginRight: 8 }}>⚙️</span> Settings
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#0b1120' }}>
          {sidebar === 'kanban' && (
            <KanbanBoard agentId={agentId} onTaskUpdate={handleTaskUpdate} />
          )}
          {sidebar === 'analytics' && (
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: 18 }}>Agent Analytics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '6px' }}>
                  <div style={{ fontSize: 24, color: '#10b981' }}>42</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Tasks completed</div>
                </div>
                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '6px' }}>
                  <div style={{ fontSize: 24, color: '#f59e0b' }}>18</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Tasks in progress</div>
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>
                  Agent has completed <strong>42</strong> tasks with a <strong>85%</strong> success rate
                </p>
              </div>
            </div>
          )}
          {sidebar === 'settings' && (
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#e2e8f0', fontSize: 18 }}>Agent Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: '4px' }}>Agent Name</label>
                  <input style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0' }} placeholder='AI-Dost Agent' />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: '4px' }}>Auto-Save</label>
                  <select style={{ width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0' }}>
                    <option value='true'>Enabled</option>
                    <option value='false'>Disabled</option>
                  </select>
                </div>
              </div>
              <button
                style={{
                  width: '100%', padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: 14, cursor: 'pointer'
                }}
                onClick={() => window.alert('Settings saved')}
                >Save Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

AgentDashboard.propTypes = {};

export default AgentDashboard;