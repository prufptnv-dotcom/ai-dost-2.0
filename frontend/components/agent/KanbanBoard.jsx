'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STATUS_COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: '#6b7280' },
  { key: 'planned', label: 'Planned', color: '#3b82f6' },
  { key: 'running', label: 'Running', color: '#10b981' },
  { key: 'review', label: 'Review', color: '#f59e0b' },
  { key: 'done', label: 'Done', color: '#10b981' }
];

const MOCK_TASKS = [
  { id: '1', title: 'Implement agent loop', column: 'backlog', description: 'Design and implement the core agent reasoning loop' },
  { id: '2', title: 'Add RAG integration', column: 'planned', description: 'Integrate Pinecone/ChromaDB vector search' },
  { id: '3', title: 'Terminal integration', column: 'running', description: 'Implement sandbox exec and terminal streaming' },
  { id: '4', title: 'Add live preview', column: 'review', description: 'Implement Yjs real-time collaboration and dev server preview' },
  { id: '5', title: 'Deploy service', column: 'done', description: 'Implement Vercel/Netlify/CF deployment adapters' }
];

export function KanbanBoard({ agentId, onTaskUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [newTaskText, setNewTaskText] = useState('');
  const taskSeqRef = useRef(0);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/tasks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.tasks) ? data.tasks : []);
      if (list.length > 0) {
        setTasks(list);
        return;
      }
    } catch (_) { /* backend unreachable — fall back to demo tasks */ }
    setTasks(MOCK_TASKS.map(t => ({ ...t, agentId })));
  }, [agentId]);

  useEffect(() => {
    // Load tasks from agent session
    loadTasks();
  }, [loadTasks]);

  const handleDragStart = (e, task) => {
    setDragging(task.id);
    try { e.dataTransfer.setData('text/plain', task.id); } catch (_) {}
    try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
  };

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    setHoveredColumn(columnKey);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setHoveredColumn(null);
  };

  const handleDrop = (e, columnKey) => {
    e.preventDefault();
    let id = dragging;
    if (!id) {
      try { id = e.dataTransfer.getData('text/plain'); } catch (_) {}
    }
    const task = tasks.find(t => t.id === id);
    if (task && task.column !== columnKey) {
      onTaskUpdate?.(agentId, { taskId: id, fromColumn: task.column, toColumn: columnKey });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, column: columnKey } : t));
    }
    setDragging(null);
    setHoveredColumn(null);
  };

  const addNewTask = (text, column = 'backlog') => {
    const title = (text || '').trim();
    if (!title) return false;
    const newTask = {
      id: `task-${++taskSeqRef.current}`,
      title,
      column,
      description: '',
      agentId
    };
    setTasks(prev => [...prev, newTask]);
    onTaskUpdate?.(agentId, { type: 'newTask', task: newTask, column });
    return true;
  };

  const handleNewTaskKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (addNewTask(newTaskText)) setNewTaskText('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', gap: 8, background: '#0f172a' }}>
      <div style={{ flex: 1, borderRight: '1px solid #334155', background: '#1e293b', minWidth: 200 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>Agent Tasks</span>
          <span style={{ fontSize: 12, color: '#94a3b8', background: 'transparent', border: '1px solid #475569', borderRadius: '4px', padding: '2px 6px' }}>+</span>
        </div>

        {STATUS_COLUMNS.map(column => (
          <div
            key={column.key}
            onDragOver={(e) => handleDragOver(e, column.key)}
            onDrop={(e) => handleDrop(e, column.key)}
            style={{
              borderBottom: '1px solid #334155',
              background: column.color === '#10b981' ? '#052e36' : '#1e293b',
              marginBottom: column.key === 'done' ? '8px' : '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
              <span style={{ 
                color: column.color === '#10b981' ? '#ffffff' : '#94a3b8', 
                fontWeight: column.key === 'done' ? 600 : 500,
                fontSize: 12 
              }}>
                {column.label} <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>({tasks.filter(t => t.column === column.key).length})</span>
              </span>
              <button
                style={{
                  padding: '2px 6px', fontSize: 10, background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer', fontWeight: 500
                }}
                onClick={() => addNewTask('New task', column.key)}
              >
                Add
              </button>
            </div>

            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)', padding: '8px' }}>
              {tasks
                .filter(t => t.column === column.key)
                .map(task => (
                  <div
                    key={task.id}
                    draggable
                    style={{
                      padding: '8px 12px',
                      marginBottom: '4px',
                      background: dragging === task.id ? '#3b82f61a' : 'transparent',
                      borderRadius: '4px',
                      cursor: 'grab',
                      userSelect: 'none'
                    }}
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragOver={(e) => handleDragOver(e, column.key)}
                    onDragEnd={handleDragEnd}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ 
                        width: 10, height: 10, 
                        background: column.color, borderRadius: '50%', marginRight: 6 
                      }} />
                      <span style={{ flex: 1, color: '#e2e8f0', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                      <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{task.description?.substring(0, 30)}...</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: 12, background: '#0f172a' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>New Task</h3>
        <input
          type="text"
          placeholder="Describe a new task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          style={{
            width: '100%', padding: '8px', background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', fontSize: 12
          }}
          onKeyDown={handleNewTaskKeyDown}
        />
        </div>
    </div>
  );
}

KanbanBoard.propTypes = {};

export default KanbanBoard;
