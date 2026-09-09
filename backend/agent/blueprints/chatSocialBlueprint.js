/**
 * Real-Time Chat & Social App Blueprint
 */

function getChatSocialBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: name || 'chat-social-app',
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
      content: `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"/><title>${title || 'Chat Space'}</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`
    },
    {
      path: 'server.js',
      content: `import express from 'express';\nimport cors from 'cors';\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.listen(5000, () => console.log('Chat server on 5000'));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function getMessages() { return []; }`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { background: #0c101c; color: #fff; margin: 0; font-family: sans-serif; }`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { MessageSquare, Send, User, Hash, Users, Sparkles } from 'lucide-react';

const INITIAL_MESSAGES = [
  { id: '1', user: 'Alex', content: 'Hey team! Real-time workspace is live 🚀', time: '12:04 PM', isMe: false },
  { id: '2', user: 'You', content: 'Awesome, checking the live preview and chat state.', time: '12:05 PM', isMe: true }
];

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [text, setText] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: String(Date.now()), user: 'You', content: text.trim(), time: 'Just now', isMe: true }]);
    setText('');
  };

  return (
    <div className="flex h-screen bg-[#0c101c] text-zinc-100">
      <aside className="w-64 border-r border-zinc-800 p-4 space-y-4 hidden md:block">
        <div className="flex items-center gap-2 font-bold text-sm text-indigo-400">
          <MessageSquare size={18} />
          <span>Chat Space</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 text-indigo-300 rounded-xl text-xs font-bold">
            <Hash size={14} />
            <span>#general</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-zinc-400 hover:bg-zinc-800/40 rounded-xl text-xs font-semibold">
            <Hash size={14} />
            <span>#announcements</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Hash size={16} className="text-zinc-400" />
            <span>general</span>
          </div>
          <span className="text-xs text-emerald-400 font-mono">🟢 14 Members Online</span>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map(m => (
            <div key={m.id} className={\`flex gap-3 \${m.isMe ? 'justify-end' : ''}\`}>
              <div className={\`max-w-md p-3.5 rounded-2xl text-xs space-y-1 \${m.isMe ? 'bg-indigo-600 text-white' : 'bg-[#181d2e] border border-zinc-800 text-zinc-200'}\`}>
                <div className="flex items-center justify-between gap-4 font-bold text-[10px] text-zinc-400">
                  <span>{m.user}</span>
                  <span>{m.time}</span>
                </div>
                <p className="leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-zinc-800 flex gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5">
            <Send size={14} />
            <span>Send</span>
          </button>
        </form>
      </main>
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title || 'Chat Social App'}`
    }
  ];
}

module.exports = { getChatSocialBlueprint };
