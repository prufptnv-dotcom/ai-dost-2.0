/**
 * AI Studio & Prompt Engineering Blueprint
 */

function getAiStudioBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: name || 'ai-studio-app',
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
      content: `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"/><title>${title || 'AI Studio'}</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`
    },
    {
      path: 'server.js',
      content: `import express from 'express';\nimport cors from 'cors';\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.listen(5000, () => console.log('AI Studio server on 5000'));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function generateText() { return ''; }`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { background: #0c0f1d; color: #fff; margin: 0; font-family: sans-serif; }`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { Sparkles, Bot, Zap, Copy, Check, Sliders } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setOutput(\`Generated response for: "\${prompt}"\\n\\n1. High-speed multi-model cascade\\n2. Deterministic blueprint generation\\n3. Zero latency live preview sync\`);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0c0f1d] text-zinc-100 p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Generative AI Studio Pro</h1>
          <p className="text-xs text-zinc-400">Prompt engineering sandbox with real-time output</p>
        </div>
      </header>

      <form onSubmit={handleGenerate} className="bg-[#14182a] p-5 rounded-2xl border border-zinc-800 space-y-3 shadow-xl">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Input Prompt</label>
        <textarea
          rows={4}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Enter prompt for model..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Zap size={14} />
          <span>{loading ? 'Generating...' : 'Run Generation'}</span>
        </button>
      </form>

      {output && (
        <div className="bg-[#14182a] p-5 rounded-2xl border border-zinc-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Model Output</span>
            <button
              onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <pre className="text-xs bg-zinc-900/80 p-4 rounded-xl text-zinc-300 font-mono whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title || 'AI Studio App'}`
    }
  ];
}

module.exports = { getAiStudioBlueprint };
