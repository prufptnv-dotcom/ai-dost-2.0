/**
 * Modern SaaS Analytics Dashboard Blueprint
 */

function getDashboardBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: name || 'saas-analytics-dashboard',
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
        devDependencies: {
          '@vitejs/plugin-react': '^4.3.4',
          vite: '^6.0.7'
        }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0', proxy: { '/api': 'http://localhost:5000' } }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title || 'SaaS Analytics'} | Executive Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; background-color: #0b0f19; color: #f8fafc; }</style>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/api/metrics', (req, res) => {
  res.json({
    mrr: 48920,
    activeUsers: 14205,
    growthRate: 18.4,
    churn: 1.2
  });
});

app.listen(PORT, () => console.log('SaaS server running on port ' + PORT));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function getMetrics() {
  try {
    const res = await fetch('/api/metrics');
    return await res.json();
  } catch (_) {
    return { mrr: 48920, activeUsers: 14205, growthRate: 18.4, churn: 1.2 };
  }
}`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody { background: #0b0f19; color: #f8fafc; margin: 0; font-family: 'Inter', sans-serif; }`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Bell, Search, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

export default function App() {
  const [timeframe, setTimeframe] = useState('30D');

  const metrics = [
    { label: 'Monthly Recurring Revenue', value: '$48,920', change: '+14.2%', isPositive: true, icon: DollarSign },
    { label: 'Active Subscribers', value: '14,205', change: '+8.1%', isPositive: true, icon: Users },
    { label: 'Average Contract Value', value: '$1,840', change: '+5.4%', isPositive: true, icon: Activity },
    { label: 'Gross Churn Rate', value: '1.2%', change: '-0.4%', isPositive: true, icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-zinc-100 font-sans pb-12">
      <header className="sticky top-0 z-20 bg-[#0e1424]/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-white text-base">Linear Metrics Pro</span>
        </div>
        <div className="flex items-center gap-2">
          {['7D', '30D', '90D', '1Y'].map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={\`px-3 py-1 text-xs font-bold rounded-lg transition-all \${timeframe === t ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}\`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="p-5 rounded-2xl bg-[#111728] border border-zinc-800 shadow-xl">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-bold uppercase tracking-wider">{m.label}</span>
                <m.icon size={16} className="text-indigo-400" />
              </div>
              <div className="text-2xl font-mono font-black text-white mt-3">{m.value}</div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 mt-1.5 font-mono">
                <ArrowUpRight size={12} />
                <span>{m.change} vs previous period</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title || 'SaaS Analytics Dashboard'}\n\nA high-performance modern analytics dashboard.`
    }
  ];
}

module.exports = { getDashboardBlueprint };
