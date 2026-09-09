/**
 * Interactive Kanban & Project Management Blueprint
 */

function getKanbanBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: name || 'kanban-board',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'lucide-react': '^1.16.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^6.0.7' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"/><title>${title || 'Kanban Studio'}</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`
    },
    {
      path: 'server.js',
      content: `import express from 'express';\nimport cors from 'cors';\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.listen(5000, () => console.log('Kanban server on 5000'));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function getTasks() { return []; }`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { background: #0f111a; color: #fff; margin: 0; font-family: sans-serif; }`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { Kanban, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const INITIAL_COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#6366f1', tasks: [{ id: '1', title: 'Design system tokens', tag: 'UI' }] },
  { id: 'in_progress', title: 'In Progress', color: '#f59e0b', tasks: [{ id: '2', title: 'Auth API endpoints', tag: 'Backend' }] },
  { id: 'done', title: 'Completed', color: '#10b981', tasks: [{ id: '3', title: 'Vite scaffold setup', tag: 'DevOps' }] }
];

export default function App() {
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const addTask = (colId) => {
    if (!newTaskTitle.trim()) return;
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, tasks: [...c.tasks, { id: String(Date.now()), title: newTaskTitle.trim(), tag: 'Task' }] } : c));
    setNewTaskTitle('');
  };

  return (
    <div className="min-h-screen bg-[#0f111a] text-zinc-100 p-6">
      <header className="flex items-center gap-3 mb-6">
        <Kanban className="w-6 h-6 text-indigo-400" />
        <h1 className="text-xl font-bold">Agile Kanban Flow</h1>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map(col => (
          <div key={col.id} className="bg-[#161926] p-4 rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <h3 className="font-bold text-sm">{col.title}</h3>
              </div>
              <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">{col.tasks.length}</span>
            </div>
            <div className="space-y-2">
              {col.tasks.map(t => (
                <div key={t.id} className="bg-[#1f2336] p-3 rounded-xl border border-zinc-700/60 shadow text-xs">
                  <div className="font-semibold text-white">{t.title}</div>
                  <span className="inline-block mt-2 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{t.tag}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 flex gap-1.5">
              <input
                type="text"
                placeholder="Add card..."
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask(col.id)}
                className="w-full bg-zinc-900 border border-zinc-800 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
              <button onClick={() => addTask(col.id)} className="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded-lg text-white">
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title || 'Kanban Project Management'}`
    }
  ];
}

module.exports = { getKanbanBlueprint };
