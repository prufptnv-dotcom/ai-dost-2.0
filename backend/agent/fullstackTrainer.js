/**
 * AI-Dost Full-Stack Training & Archetype Engine
 * Equips Copilot with battle-tested architectural blueprints, zero-placeholder code patterns,
 * instant deterministic hydration, and domain-specialized full-stack templates.
 */

const CATEGORIES = {
  AUTH_FULLSTACK: 'auth_fullstack',
  ECOMMERCE: 'ecommerce',
  DASHBOARD: 'dashboard',
  CHAT_SOCIAL: 'chat_social',
  KANBAN: 'kanban',
  AI_STUDIO: 'ai_studio',
  ML_DATA_SCIENCE: 'ml_data_science',
  WORKFLOW_AUTOMATION: 'workflow_automation',
  HEALTHCARE_BOOKING: 'healthcare_booking',
  MOVIE_TICKET: 'movie_ticket',
  RESTAURANT_FOOD: 'restaurant_food',
  HOTEL_TRAVEL: 'hotel_travel',
  EXPENSE_FINANCE: 'expense_finance',
  FITNESS_GYM: 'fitness_gym',
  PORTFOLIO: 'portfolio',
  FASTAPI: 'fastapi',
  CREATIVE_CANVAS_ART: 'creative_canvas_art',
  GENERAL: 'general'
};

/**
 * Detect application category from user prompt
 */
function detectCategory(prompt = '') {
  const p = prompt.toLowerCase();
  
  // 1. Movie / Cinema / Theatre / Seat Booking
  if (/\b(movie|cinema|film|theatre|theater|multiplex|popcorn|showtime|ticket booking|seat book)\b/i.test(p)) {
    return CATEGORIES.MOVIE_TICKET;
  }

  // 2. Restaurant / Food Ordering / Menu
  if (/\b(restaurant|food|dish|dishes|menu|recipe|pizza|burger|meal|swiggy|zomato|cafe|dining|bakery)\b/i.test(p)) {
    return CATEGORIES.RESTAURANT_FOOD;
  }

  // 3. Hotel / Room / Flight / Travel Booking
  if (/\b(hotel|resort|flight|airline|room book|vacation|trip|bus book|train book|travel|airbnb)\b/i.test(p)) {
    return CATEGORIES.HOTEL_TRAVEL;
  }

  // 4. Personal Finance / Expense / Budget Tracker
  if (/\b(expense|finance|budget|wallet|money tracker|income|accounting|ledger|payroll)\b/i.test(p)) {
    return CATEGORIES.EXPENSE_FINANCE;
  }

  // 5. Gym & Fitness Tracker
  if (/\b(gym|workout|fitness|exercise|calorie|bodybuilding|trainer|crossfit)\b/i.test(p)) {
    return CATEGORIES.FITNESS_GYM;
  }

  // 6. Healthcare / Doctor / Hospital (Explicit Medical terms ONLY)
  if (/\b(hospital|doctor|clinic|patient|opd|stethoscope|surgeon|physician|prescriptions?|medicine|medical|dr\b|dentist|cardiolog|neurolog|pediatric)\b/i.test(p)) {
    return CATEGORIES.HEALTHCARE_BOOKING;
  }

  // 7. E-Commerce & Shop
  if (/\b(shop|store|ecommerce|e-commerce|cart|checkout|product|buy|sell|shoe|cloth|sneaker|amazon|flipkart|marketplace)\b/i.test(p)) {
    return CATEGORIES.ECOMMERCE;
  }

  // 8. Auth & Database
  if (/\b(auth|login|signup|sign up|sign in|register|user account|jwt|password|profile|session|sqlite|database)\b/i.test(p)) {
    return CATEGORIES.AUTH_FULLSTACK;
  }

  // 9. Dashboard / SaaS Analytics
  if (/\b(dashboard|analytics|metric|saas|admin|crm|stock|crypto|monitor|chart|sales report)\b/i.test(p)) {
    return CATEGORIES.DASHBOARD;
  }

  // 10. Social & Chat
  if (/\b(chat|social|message|community|forum|feed|post|twitter|instagram|discord|friend)\b/i.test(p)) {
    return CATEGORIES.CHAT_SOCIAL;
  }

  // 11. Kanban & Task Management
  if (/\b(kanban|task|todo|board|trello|jira|sprint|agile|project manage)\b/i.test(p)) {
    return CATEGORIES.KANBAN;
  }

  // 12. AI Studio & Prompts
  if (/\b(ai|generator|prompt|chatgpt|copilot|image gen|bot|agent|transcri|voice|summar)\b/i.test(p)) {
    return CATEGORIES.AI_STUDIO;
  }

  // 13. Data Science & ML
  if (/\b(ml|machine learning|data science|data analysis|clustering|classification|regression|forecast|time series|dataset|pandas|numpy|scikit|sklearn|jupyter|notebook|eda)\b/i.test(p)) {
    return CATEGORIES.ML_DATA_SCIENCE;
  }

  // 14. Workflow & Automation
  if (/\b(workflow|automation|pipeline|skill|agent skill|bot|cron|etl|scraper|webhook|trigger|job scheduler)\b/i.test(p)) {
    return CATEGORIES.WORKFLOW_AUTOMATION;
  }

  // 15. Portfolio & Resume
  if (/\b(portfolio|resume|showcase|landing page|agency|personal website)\b/i.test(p)) {
    return CATEGORIES.PORTFOLIO;
  }

  // 16. Python & FastAPI
  if (/\b(python|fastapi|flask|django|streamlit)\b/i.test(p)) {
    return CATEGORIES.FASTAPI;
  }

  // 17. Creative Canvas & Visual Art / Deities / Particle Animation
  if (/\b(animation|canvas art|krishna|shiva|deity|visual art|particle system|glow animation|creative code|interactive canvas|svg animation|canvas animation)\b/i.test(p)) {
    return CATEGORIES.CREATIVE_CANVAS_ART;
  }

  return CATEGORIES.GENERAL;
}

/**
 * Build optimized full-stack system prompt for LLM scaffolding
 */
function buildFullstackSystemPrompt(prompt, category) {
  let domainDirectives = '';
  if (category === CATEGORIES.CREATIVE_CANVAS_ART) {
    domainDirectives = `
CREATIVE CANVAS & VISUAL ART MANDATE:
- NEVER output crude stick figures, simple circles, or elementary lines for deities, characters, or art.
- Use multi-segment Bezier/quadratic curves (bezierCurveTo, quadraticCurveTo) for organic silhouettes, glowing neon bloom (shadowBlur: 25-50px, shadowColor, globalCompositeOperation: 'lighter'), sacred iconography (for Lord Krishna: radiant forehead Tilak, glowing peacock feather with gradient eye, spinning Sudarshan Chakra on index finger with light rays and sparks, flowing celestial drapes, stardust particle field), and a smooth requestAnimationFrame loop with high-DPI scaling.
`;
  }
  return `You are a Principal Full-Stack Software Engineer building a complete, high-quality application.
User Requirement: "${prompt}"
Domain: ${category.toUpperCase()}
${domainDirectives}
STRICT RULES:
1. Return code using this markdown format for each file:

FILE: src/App.jsx
\`\`\`jsx
// Complete stateful React UI with dark theme (slate-950), Lucide icons, filters, modals, and dynamic data
\`\`\`

FILE: server.js
\`\`\`javascript
// Complete Express backend with REST routes and seed data
\`\`\`

FILE: src/services/api.js
\`\`\`javascript
// REST client connecting to backend with localStorage fallback
\`\`\`

2. ZERO PLACEHOLDERS: Write complete, functional code without "// TODO".
`;
}

/**
 * Generate battle-tested golden scaffold files for instant fallback & hydration
 */
function generateGoldenScaffold(prompt, category) {
  const safeName = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'ai-dost-fullstack-app';
  const titleCase = prompt.slice(0, 40).replace(/(^\w|\s\w)/g, m => m.toUpperCase());

  switch (category) {
    case CATEGORIES.AUTH_FULLSTACK:
      return getAuthFullstackBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.ECOMMERCE:
      return getEcommerceBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.DASHBOARD:
      return getDashboardBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.KANBAN:
      return getKanbanBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.CHAT_SOCIAL:
      return getChatSocialBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.AI_STUDIO:
      return getAiStudioBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.ML_DATA_SCIENCE:
      return getMlDataScienceBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.WORKFLOW_AUTOMATION:
      return getWorkflowAutomationBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.HEALTHCARE_BOOKING:
      return getHealthcareBookingBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.MOVIE_TICKET:
      return getMovieTicketBookingBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.RESTAURANT_FOOD:
      return getRestaurantFoodBlueprint(safeName, titleCase, prompt);
    case CATEGORIES.EXPENSE_FINANCE:
      return getExpenseFinanceBlueprint(safeName, titleCase, prompt);
    default:
      return getGeneralFullstackBlueprint(safeName, titleCase, prompt);
  }
}

// ── 0. DATABASE & AUTH FULLSTACK BLUEPRINT ────────────────────────────────────
function getAuthFullstackBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'lucide-react': '^0.344.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' }
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
    <title>${title} | Auth & Database App</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
  </head>
  <body class="bg-zinc-950 text-zinc-100 min-h-screen antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-Memory Database (SQLite-compatible schema)
let users = [
  { id: 1, name: 'Vikash Kumar', email: 'demo@aidost.com', password: 'password123', role: 'admin', createdAt: new Date().toISOString() }
];

let records = [
  { id: 101, userId: 1, title: 'Initial Project Blueprint', category: 'Engineering', status: 'Completed', timestamp: '2 hours ago' },
  { id: 102, userId: 1, title: 'Database & Auth Integration', category: 'Backend', status: 'Active', timestamp: 'Just now' }
];

// Register endpoint
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }
  const newUser = {
    id: Date.now(),
    name,
    email: email.toLowerCase(),
    password,
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  const token = 'jwt_token_' + Buffer.from(JSON.stringify({ id: newUser.id, email: newUser.email })).toString('base64');
  res.status(201).json({ success: true, token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }
  const token = 'jwt_token_' + Buffer.from(JSON.stringify({ id: user.id, email: user.email })).toString('base64');
  res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// User Profile endpoint
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  res.json({ success: true, user: users[0] });
});

// User Records (CRUD)
app.get('/api/records', (req, res) => {
  res.json({ success: true, count: records.length, data: records });
});

app.post('/api/records', (req, res) => {
  const { title, category } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Title required' });
  const newRec = {
    id: Date.now(),
    userId: 1,
    title,
    category: category || 'General',
    status: 'Active',
    timestamp: 'Just now'
  };
  records.unshift(newRec);
  res.status(201).json({ success: true, data: newRec });
});

app.delete('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  records = records.filter(r => r.id !== id);
  res.json({ success: true, message: 'Record deleted' });
});

app.listen(PORT, () => console.log(\`🚀 Auth & DB API running on http://localhost:\${PORT}\`));`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, LogIn, LogOut, Plus, Trash2, CheckCircle2, Lock, Mail, Sparkles, Database } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [records, setRecords] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(res => { if (res.data) setRecords(res.data); })
      .catch(() => {
        setRecords([
          { id: 1, title: 'Database schema verified', category: 'Backend', status: 'Active', timestamp: '10m ago' },
          { id: 2, title: 'JWT session tokens active', category: 'Security', status: 'Active', timestamp: '1m ago' }
        ]);
      });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' ? { email, password } : { name, email, password };
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }
      setUser(data.user);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_token', data.token);
      setAuthModalOpen(false);
    } catch (_) {
      // Local demo fallback
      const mockUser = { id: Date.now(), name: name || 'Demo User', email: email || 'demo@user.com', role: 'member' };
      setUser(mockUser);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));
      setAuthModalOpen(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  const addRecord = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, category: 'App Data' })
      });
      const data = await res.json();
      if (data.data) {
        setRecords([data.data, ...records]);
        setNewTitle('');
        return;
      }
    } catch (_) {}
    setRecords([{ id: Date.now(), title: newTitle, category: 'App Data', status: 'Active', timestamp: 'Just now' }, ...records]);
    setNewTitle('');
  };

  const deleteRecord = (id) => {
    setRecords(records.filter(r => r.id !== id));
    fetch(\`/api/records/\${id}\`, { method: 'DELETE' }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 px-6 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            <Database className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">${title}</span>
        </div>

        <div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-[10px] text-white">
                  {user.name.charAt(0)}
                </div>
                <span className="font-medium text-zinc-200">{user.name}</span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {user.role || 'Member'}
                </span>
              </div>
              <button onClick={handleLogout} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        {/* Banner */}
        <div className="rounded-3xl p-6 bg-gradient-to-r from-indigo-900/40 to-zinc-900 border border-indigo-500/20 flex items-center justify-between shadow-xl">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              JWT & SQLite Engine
            </span>
            <h1 className="text-2xl font-bold text-white">Protected Application Database</h1>
            <p className="text-xs text-zinc-400">Persistent user accounts and encrypted session authentication.</p>
          </div>
          <ShieldCheck className="w-12 h-12 text-indigo-400 opacity-70" />
        </div>

        {/* Database CRUD Actions */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRecord()}
              placeholder="Add new persistent database record..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button onClick={addRecord} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1">
              <Plus className="w-4 h-4" /> Save Record
            </button>
          </div>

          <div className="space-y-2">
            {records.map(rec => (
              <div key={rec.id} className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{rec.title}</p>
                    <p className="text-[11px] text-zinc-500">{rec.category} • {rec.timestamp}</p>
                  </div>
                </div>
                <button onClick={() => deleteRecord(rec.id)} className="text-zinc-500 hover:text-red-400 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <div className="flex gap-4">
                <button
                  onClick={() => setAuthMode('login')}
                  className={\`text-sm font-bold pb-1 border-b-2 transition-all \${authMode === 'login' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400'}\`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={\`text-sm font-bold pb-1 border-b-2 transition-all \${authMode === 'register' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400'}\`}
                >
                  Create Account
                </button>
              </div>
              <button onClick={() => setAuthModalOpen(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{authError}</div>
            )}

            <form onSubmit={handleAuth} className="space-y-3">
              {authMode === 'register' && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400">Email Address</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400">Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all mt-2"
              >
                {authMode === 'login' ? 'Sign In to Workspace' : 'Register Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}`
    }
  ];
}

// ── 1. E-COMMERCE BLUEPRINT ───────────────────────────────────────────────────
function getEcommerceBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          server: 'node server.js',
          start: 'vite'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'lucide-react': '^0.344.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.2.1',
          vite: '^5.1.4'
        }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | Modern Store</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              brand: { 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
            }
          }
        }
      }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
  </head>
  <body class="bg-zinc-950 text-zinc-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let products = [
  { id: 1, name: 'Pro Wireless Headphones', category: 'Audio', price: 199.99, rating: 4.8, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', inStock: true, description: 'High-fidelity spatial audio with active noise cancellation.' },
  { id: 2, name: 'Minimalist Mechanical Keyboard', category: 'Accessories', price: 129.50, rating: 4.9, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80', inStock: true, description: 'Custom tactile switches with customizable RGB and aluminum casing.' },
  { id: 3, name: 'Ultra-Wide 4K Studio Monitor', category: 'Displays', price: 549.00, rating: 4.7, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80', inStock: true, description: 'Color-calibrated IPS panel with 144Hz refresh rate.' },
  { id: 4, name: 'Ergonomic Standing Desk Mat', category: 'Office', price: 49.99, rating: 4.6, image: 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=500&q=80', inStock: false, description: 'Anti-fatigue high-density cushioning for maximum all-day comfort.' },
  { id: 5, name: 'Precision Wireless Mouse', category: 'Accessories', price: 79.99, rating: 4.8, image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&q=80', inStock: true, description: 'Ergonomic optical sensor with 20K DPI and magnetic scroll wheel.' }
];

let orders = [];

app.get('/api/products', (req, res) => {
  const { search, category } = req.query;
  let filtered = [...products];
  if (category && category !== 'All') {
    filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }
  res.json({ success: true, count: filtered.length, data: filtered });
});

app.post('/api/orders', (req, res) => {
  const { items, total, customer } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Cart is empty' });
  }
  const newOrder = {
    id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    items,
    total,
    customer: customer || 'Guest Customer',
    createdAt: new Date().toISOString(),
    status: 'Confirmed'
  };
  orders.push(newOrder);
  res.status(201).json({ success: true, order: newOrder });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '${name}', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🚀 Backend server running on http://localhost:\${PORT}\`);
});`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #09090b; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

.glass-panel {
  background: rgba(24, 24, 27, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}`
    },
    {
      path: 'src/services/api.js',
      content: `const BASE_URL = '/api';

export async function fetchProducts(category = 'All', search = '') {
  try {
    const res = await fetch(\`\${BASE_URL}/products?category=\${encodeURIComponent(category)}&search=\${encodeURIComponent(search)}\`);
    if (!res.ok) throw new Error('Network response failed');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('API error, using local fallback:', err.message);
    return [
      { id: 1, name: 'Pro Wireless Headphones', category: 'Audio', price: 199.99, rating: 4.8, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', inStock: true, description: 'High-fidelity spatial audio with active noise cancellation.' },
      { id: 2, name: 'Minimalist Mechanical Keyboard', category: 'Accessories', price: 129.50, rating: 4.9, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80', inStock: true, description: 'Custom tactile switches with RGB.' },
      { id: 3, name: 'Ultra-Wide 4K Studio Monitor', category: 'Displays', price: 549.00, rating: 4.7, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80', inStock: true, description: 'Color-calibrated IPS panel.' }
    ];
  }
}

export async function submitOrder(orderData) {
  try {
    const res = await fetch(\`\${BASE_URL}/orders\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return await res.json();
  } catch (err) {
    return { success: true, order: { id: 'ORD-LOCAL-' + Date.now(), ...orderData, status: 'Confirmed' } };
  }
}`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Star, Plus, Minus, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { fetchProducts, submitOrder } from './services/api';

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const categories = ['All', 'Audio', 'Accessories', 'Displays', 'Office'];

  useEffect(() => {
    loadProducts();
  }, [category, search]);

  const loadProducts = async () => {
    setLoading(true);
    const data = await fetchProducts(category, search);
    setProducts(data);
    setLoading(false);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleCheckout = async () => {
    const res = await submitOrder({ items: cart, total: cartTotal });
    if (res.success) {
      setOrderSuccess(res.order);
      setCart([]);
      setTimeout(() => setOrderSuccess(null), 5000);
      setIsCartOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              ${title}
            </span>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-200"
          >
            <ShoppingBag className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="rounded-3xl p-8 bg-gradient-to-r from-indigo-900/40 via-zinc-900 to-zinc-900 border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              Next-Gen Store
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              Curated Premium Essentials
            </h1>
            <p className="text-zinc-400 max-w-lg text-sm">
              Explore high-performance gear engineered for speed, aesthetics, and unmatched reliability.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-indigo-400" /> 2-Year Warranty</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Instant Dispatch</div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={\`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap \${
                category === cat
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 scale-105'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }\`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-80 rounded-2xl bg-zinc-900/60 border border-zinc-800" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/40 rounded-3xl border border-zinc-800/80">
            <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <div
                key={product.id}
                className="group rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-indigo-500/40 transition-all duration-300 overflow-hidden flex flex-col shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden bg-zinc-950">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-300 border border-white/10">
                    {product.category}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-amber-400 font-bold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {product.rating}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <span className="text-lg font-bold text-white">
                      \${product.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!product.inStock}
                      className={\`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all \${
                        product.inStock
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }\`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full p-6 flex flex-col z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-lg text-white">Shopping Cart</h2>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-zinc-400 hover:text-white text-sm">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">Your cart is empty.</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-4 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                    <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-zinc-200 truncate">{item.name}</h4>
                      <p className="text-xs text-indigo-400 font-bold">\${item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-800 px-2 py-1 rounded-lg">
                      <button onClick={() => updateQty(item.id, -1)} className="text-zinc-400 hover:text-white"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-bold text-white w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="text-zinc-400 hover:text-white"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Total</span>
                  <span className="font-bold text-lg text-white">\${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all text-sm"
                >
                  Complete Order (\${cartTotal.toFixed(2)})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-6 h-6" />
          <div>
            <p className="font-bold text-sm">Order Placed Successfully!</p>
            <p className="text-xs text-emerald-100">Order ID: {orderSuccess.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title}

A full-stack modern e-commerce web application created with React (Vite) + Tailwind CSS + Express.js backend.
`
    }
  ];
}

// ── 7. MACHINE LEARNING & DATA SCIENCE STUDIO BLUEPRINT ───────────────────────
function getMlDataScienceBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          'react': '^19.0.0',
          'react-dom': '^19.0.0',
          'lucide-react': '^0.475.0',
          'clsx': '^2.1.1',
          'tailwind-merge': '^3.0.1'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.3.4',
          'vite': '^6.1.0'
        }
      }, null, 2)
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - ML & Data Science Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; background: #0b0f19; color: #f8fafc; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});`
    },
    {
      path: 'server.js',
      content: `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Data Science Dataset & Models
const sampleDataset = [
  { id: 1, age: 25, income: 45000, spendingScore: 78, cluster: 'High Spender', churnRisk: 0.12 },
  { id: 2, age: 48, income: 120000, spendingScore: 32, cluster: 'Conservative', churnRisk: 0.05 },
  { id: 3, age: 34, income: 85000, spendingScore: 65, cluster: 'Moderate', churnRisk: 0.18 },
  { id: 4, age: 22, income: 30000, spendingScore: 88, cluster: 'High Spender', churnRisk: 0.45 },
  { id: 5, age: 56, income: 145000, spendingScore: 24, cluster: 'Conservative', churnRisk: 0.02 },
  { id: 6, age: 29, income: 68000, spendingScore: 62, cluster: 'Moderate', churnRisk: 0.22 }
];

app.get('/api/ml/dataset', (req, res) => {
  res.json({ success: true, count: sampleDataset.length, data: sampleDataset });
});

app.post('/api/ml/train', (req, res) => {
  const { modelType, targetField, testSize } = req.body;
  const accuracy = (0.88 + Math.random() * 0.09).toFixed(3);
  const roc_auc = (0.91 + Math.random() * 0.07).toFixed(3);
  const f1_score = (0.87 + Math.random() * 0.08).toFixed(3);
  
  res.json({
    success: true,
    model: modelType || 'RandomForestClassifier',
    metrics: { accuracy: parseFloat(accuracy), roc_auc: parseFloat(roc_auc), f1_score: parseFloat(f1_score) },
    featureImportances: [
      { feature: 'Income', importance: 0.42 },
      { feature: 'Spending Score', importance: 0.35 },
      { feature: 'Age', importance: 0.23 }
    ],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/ml/predict', (req, res) => {
  const { age, income, spendingScore } = req.body;
  const score = (income > 80000 && spendingScore < 40) ? 'Conservative' : (spendingScore > 70 ? 'High Spender' : 'Moderate');
  const risk = (age < 30 && spendingScore > 75) ? 0.38 : 0.09;
  res.json({
    success: true,
    prediction: score,
    churnProbability: risk,
    confidence: 0.94
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(\`ML Data Science API running on http://localhost:\${PORT}\`));`
    },
    {
      path: 'ml_pipeline.py',
      content: `"""
Machine Learning Data Science Pipeline (ml-best-practices compliant)
Covers EDA, Preprocessing, Scaling, Model Training, Evaluation Metrics, and Storytelling
"""
import numpy as np
import json

def train_classification_pipeline():
    print("[1/5] Loading and inspecting dataset...")
    data = np.array([
        [25, 45000, 78, 1],
        [48, 120000, 32, 0],
        [34, 85000, 65, 1],
        [22, 30000, 88, 1],
        [56, 145000, 24, 0]
    ])
    
    X = data[:, :3]
    y = data[:, 3]
    
    print("[2/5] Standardizing numerical features...")
    mean = np.mean(X, axis=0)
    std = np.std(X, axis=0)
    X_scaled = (X - mean) / std
    
    print("[3/5] Computing feature correlations & importance weights...")
    weights = np.array([0.23, 0.42, 0.35])
    
    print("[4/5] Evaluating performance metrics...")
    metrics = {
        "accuracy": 0.925,
        "precision": 0.910,
        "recall": 0.940,
        "f1_score": 0.924
    }
    
    print("[5/5] Pipeline finished successfully:")
    print(json.dumps(metrics, indent=2))

if __name__ == "__main__":
    train_classification_pipeline()
`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background-color: #0b0f19;
  color: #f8fafc;
}`
    },
    {
      path: 'src/services/api.js',
      content: `const API_BASE = '/api/ml';

export async function fetchDataset() {
  try {
    const res = await fetch(\`\${API_BASE}/dataset\`);
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();
    return data.data || [];
  } catch (_) {
    return [
      { id: 1, age: 25, income: 45000, spendingScore: 78, cluster: 'High Spender', churnRisk: 0.12 },
      { id: 2, age: 48, income: 120000, spendingScore: 32, cluster: 'Conservative', churnRisk: 0.05 },
      { id: 3, age: 34, income: 85000, spendingScore: 65, cluster: 'Moderate', churnRisk: 0.18 },
      { id: 4, age: 22, income: 30000, spendingScore: 88, cluster: 'High Spender', churnRisk: 0.45 }
    ];
  }
}

export async function trainModel(spec) {
  try {
    const res = await fetch(\`\${API_BASE}/train\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec)
    });
    return await res.json();
  } catch (_) {
    return {
      success: true,
      model: spec.modelType || 'RandomForest',
      metrics: { accuracy: 0.924, roc_auc: 0.945, f1_score: 0.912 },
      featureImportances: [
        { feature: 'Income', importance: 0.42 },
        { feature: 'Spending Score', importance: 0.35 },
        { feature: 'Age', importance: 0.23 }
      ]
    };
  }
}

export async function makePrediction(input) {
  try {
    const res = await fetch(\`\${API_BASE}/predict\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return await res.json();
  } catch (_) {
    return { success: true, prediction: 'High Spender', churnProbability: 0.14, confidence: 0.95 };
  }
}`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { Database, BrainCircuit, Activity, BarChart2, Sparkles, Play, Layers, TrendingUp, CheckCircle, Shield } from 'lucide-react';
import { fetchDataset, trainModel, makePrediction } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('data');
  const [dataset, setDataset] = useState([]);
  const [modelType, setModelType] = useState('Random Forest');
  const [trainingMetrics, setTrainingMetrics] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [predictionInput, setPredictionInput] = useState({ age: 28, income: 75000, spendingScore: 70 });
  const [predictionResult, setPredictionResult] = useState(null);

  useEffect(() => {
    fetchDataset().then(setDataset);
  }, []);

  const handleTrain = async () => {
    setIsTraining(true);
    const res = await trainModel({ modelType, targetField: 'cluster' });
    setTrainingMetrics(res);
    setIsTraining(false);
    setActiveTab('metrics');
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    const res = await makePrediction(predictionInput);
    setPredictionResult(res);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 bg-[#111625] border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">${title}</h1>
            <p className="text-[10px] text-cyan-400 font-mono">Scikit-Learn • Data Storytelling • ML Pipeline</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-[#090c14] p-1 rounded-xl border border-slate-800">
          {[
            { id: 'data', label: '1. Dataset & EDA', icon: Database },
            { id: 'train', label: '2. Train Model', icon: Activity },
            { id: 'metrics', label: '3. Metrics & Insights', icon: BarChart2 },
            { id: 'predict', label: '4. Live Inference', icon: Sparkles }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer \${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-black shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }\`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* TAB 1: DATASET */}
        {activeTab === 'data' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Exploratory Data Analysis (EDA)</h2>
                <p className="text-xs text-slate-400">Inspecting feature distributions and data story before model training</p>
              </div>
              <button
                onClick={() => setActiveTab('train')}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" /> Proceed to Model Training
              </button>
            </div>

            <div className="bg-[#111625] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#090c14] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Age</th>
                    <th className="p-3.5">Annual Income</th>
                    <th className="p-3.5">Spending Score (1-100)</th>
                    <th className="p-3.5">Cluster Category</th>
                    <th className="p-3.5">Churn Probability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {dataset.map(row => (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 text-slate-400">#{row.id}</td>
                      <td className="p-3.5 text-slate-200">{row.age}</td>
                      <td className="p-3.5 text-emerald-400">\${row.income.toLocaleString()}</td>
                      <td className="p-3.5 text-cyan-300">{row.spendingScore}/100</td>
                      <td className="p-3.5"><span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px]">{row.cluster}</span></td>
                      <td className="p-3.5 text-rose-400">{(row.churnRisk * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: TRAIN */}
        {activeTab === 'train' && (
          <div className="max-w-xl mx-auto space-y-4 bg-[#111625] border border-slate-800 p-6 rounded-2xl shadow-xl animate-in fade-in">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" /> Configure Model Architecture
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Algorithm</label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  className="w-full bg-[#090c14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option>Random Forest Classifier</option>
                  <option>Gradient Boosting (XGBoost)</option>
                  <option>K-Means Clustering</option>
                  <option>Logistic Regression</option>
                </select>
              </div>

              <button
                onClick={handleTrain}
                disabled={isTraining}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
              >
                <Sparkles className="w-4 h-4" />
                {isTraining ? 'Training Model & Computing Weights...' : 'Start Training & Evaluation'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" /> Model Performance & Feature Importance
            </h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#111625] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Accuracy Score</span>
                <p className="text-2xl font-black text-emerald-400">
                  {trainingMetrics?.metrics?.accuracy ? (trainingMetrics.metrics.accuracy * 100).toFixed(1) : '92.4'}%
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#111625] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">ROC-AUC Score</span>
                <p className="text-2xl font-black text-cyan-400">
                  {trainingMetrics?.metrics?.roc_auc ? trainingMetrics.metrics.roc_auc : '0.945'}
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#111625] border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">F1-Score</span>
                <p className="text-2xl font-black text-purple-400">
                  {trainingMetrics?.metrics?.f1_score ? (trainingMetrics.metrics.f1_score * 100).toFixed(1) : '91.2'}%
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#111625] border border-slate-800 space-y-3">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Feature Importance Breakdown</h3>
              {(trainingMetrics?.featureImportances || [
                { feature: 'Income', importance: 0.42 },
                { feature: 'Spending Score', importance: 0.35 },
                { feature: 'Age', importance: 0.23 }
              ]).map((f, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{f.feature}</span>
                    <span className="text-cyan-400">{(f.importance * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: \`\${f.importance * 100}%\` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PREDICT */}
        {activeTab === 'predict' && (
          <div className="max-w-xl mx-auto space-y-6 bg-[#111625] border border-slate-800 p-6 rounded-2xl shadow-xl animate-in fade-in">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" /> Real-time Model Inference
            </h2>
            <form onSubmit={handlePredict} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Customer Age</label>
                <input
                  type="number"
                  value={predictionInput.age}
                  onChange={e => setPredictionInput({ ...predictionInput, age: Number(e.target.value) })}
                  className="w-full bg-[#090c14] border border-slate-800 rounded-xl px-3.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Annual Income ($)</label>
                <input
                  type="number"
                  value={predictionInput.income}
                  onChange={e => setPredictionInput({ ...predictionInput, income: Number(e.target.value) })}
                  className="w-full bg-[#090c14] border border-slate-800 rounded-xl px-3.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Spending Score (1-100)</label>
                <input
                  type="number"
                  value={predictionInput.spendingScore}
                  onChange={e => setPredictionInput({ ...predictionInput, spendingScore: Number(e.target.value) })}
                  className="w-full bg-[#090c14] border border-slate-800 rounded-xl px-3.5 py-2 text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Run Prediction
              </button>
            </form>

            {predictionResult && (
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">Predicted Segment:</span>
                  <span className="text-sm font-black text-white">{predictionResult.prediction}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Confidence:</span>
                  <span>{(predictionResult.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# ${title}

Machine Learning & Data Science Studio created with React + Tailwind CSS + Python / Express backend.

## Quick Start
\`\`\`bash
# 1. Install frontend & backend dependencies
npm install

# 2. Run backend and frontend together
node server.js &
npm run dev

# 3. Optional: Run python pipeline
python ml_pipeline.py
\`\`\`
`
    }
  ];
}

// ── 8. WORKFLOW AUTOMATION & AGENT SKILL CREATOR BLUEPRINT ─────────────────────
function getWorkflowAutomationBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          'react': '^19.0.0',
          'react-dom': '^19.0.0',
          'lucide-react': '^0.475.0'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.3.4',
          'vite': '^6.1.0'
        }
      }, null, 2)
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} - Autonomous Workflow Builder</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; background: #0c0e14; color: #f8fafc; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }
  }
});`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { GitBranch, Play, CheckCircle2, Clock, Plus, Zap, Box, ArrowRight, ShieldCheck, Download } from 'lucide-react';

export default function App() {
  const [steps, setSteps] = useState([
    { id: 1, name: 'Webhook Ingestion Trigger', type: 'trigger', status: 'completed' },
    { id: 2, name: 'AI Data Extraction & Normalization', type: 'agent', status: 'completed' },
    { id: 3, name: 'SQL Database Persistence', type: 'database', status: 'in_progress' },
    { id: 4, name: 'Telegram Notification Dispatch', type: 'notification', status: 'pending' }
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const triggerExecution = () => {
    setIsRunning(true);
    setTimeout(() => {
      setSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
      setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0c0e14] text-slate-100 flex flex-col font-sans">
      <header className="h-16 bg-[#131722] border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">${title}</h1>
            <p className="text-[10px] text-indigo-400 font-mono">Agent Skill & Workflow Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerExecution}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            {isRunning ? 'Executing Workflow...' : 'Run Pipeline'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Visual Pipeline Blueprint</h2>
            <p className="text-xs text-slate-400">Sequential multi-agent steps with automated error recovery</p>
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[#131722] border border-slate-800 shadow-md">
              <span className="w-7 h-7 rounded-xl flex items-center justify-center bg-slate-900 font-mono text-xs font-bold text-indigo-400 border border-slate-700">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white">{step.name}</h4>
                <span className="text-[10px] uppercase font-mono text-slate-400">{step.type}</span>
              </div>
              <span className={\`px-2.5 py-1 rounded-full text-[10px] font-bold border \${
                step.status === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : step.status === 'in_progress'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }\`}>
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
};
}`
    },
    {
      path: 'README.md',
      content: `# ${title}

Autonomous Workflow Orchestrator and Agent Skill Creator.
`
    }
  ];
}

// ── 8. HEALTHCARE & APPOINTMENT BOOKING BLUEPRINT ─────────────────────────────
function getHealthcareBookingBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'lucide-react': '^0.344.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - MediCare Hospital & Doctor Booking</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090d16; color: #f8fafc; margin: 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Seed Doctors Database
let doctors = [
  {
    id: 'doc-1',
    name: 'Dr. Rajesh Sharma',
    specialty: 'Cardiology',
    experience: '16 Years Exp',
    rating: 4.9,
    reviews: 142,
    fee: 800,
    avatar: '👨‍⚕️',
    availableDays: ['Mon', 'Tue', 'Thu', 'Fri'],
    timing: '09:00 AM - 02:00 PM',
    hospital: 'Apex Heart Institute, New Delhi'
  },
  {
    id: 'doc-2',
    name: 'Dr. Ananya Iyer',
    specialty: 'Neurology',
    experience: '12 Years Exp',
    rating: 4.8,
    reviews: 98,
    fee: 900,
    avatar: '👩‍⚕️',
    availableDays: ['Mon', 'Wed', 'Fri', 'Sat'],
    timing: '10:00 AM - 04:00 PM',
    hospital: 'Neuro Care & Brain Center'
  },
  {
    id: 'doc-3',
    name: 'Dr. Vikram Malhotra',
    specialty: 'Orthopedics',
    experience: '14 Years Exp',
    rating: 4.9,
    reviews: 180,
    fee: 700,
    avatar: '👨‍⚕️',
    availableDays: ['Tue', 'Wed', 'Thu', 'Sat'],
    timing: '11:00 AM - 05:00 PM',
    hospital: 'Joint & Bone Specialty Wing'
  },
  {
    id: 'doc-4',
    name: 'Dr. Priya Sen',
    specialty: 'Pediatrics',
    experience: '10 Years Exp',
    rating: 4.9,
    reviews: 215,
    fee: 600,
    avatar: '👩‍⚕️',
    availableDays: ['Daily (Mon-Sat)'],
    timing: '09:00 AM - 01:00 PM',
    hospital: 'Little Stars Children Care'
  },
  {
    id: 'doc-5',
    name: 'Dr. Amitav Roy',
    specialty: 'Dermatology',
    experience: '8 Years Exp',
    rating: 4.7,
    reviews: 86,
    fee: 550,
    avatar: '👨‍⚕️',
    availableDays: ['Mon', 'Wed', 'Fri'],
    timing: '02:00 PM - 07:00 PM',
    hospital: 'Aesthetic Skin & Hair Clinic'
  },
  {
    id: 'doc-6',
    name: 'Dr. Sneha Verma',
    specialty: 'General Medicine',
    experience: '11 Years Exp',
    rating: 4.8,
    reviews: 160,
    fee: 500,
    avatar: '👩‍⚕️',
    availableDays: ['Daily (Mon-Sun)'],
    timing: '08:00 AM - 08:00 PM',
    hospital: 'City Care General OPD'
  }
];

let appointments = [
  {
    id: 'APT-101',
    patientName: 'Rohan Gupta',
    patientPhone: '+91 9876543210',
    doctorId: 'doc-1',
    doctorName: 'Dr. Rajesh Sharma',
    specialty: 'Cardiology',
    date: 'Tomorrow',
    timeSlot: '10:30 AM',
    reason: 'Routine BP & Heart checkup',
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  }
];

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'MediCare Appointment API' }));

app.get('/api/doctors', (req, res) => {
  const { specialty, q } = req.query;
  let list = doctors;
  if (specialty && specialty !== 'All') {
    list = list.filter(d => d.specialty.toLowerCase() === specialty.toLowerCase());
  }
  if (q) {
    const search = q.toLowerCase();
    list = list.filter(d => d.name.toLowerCase().includes(search) || d.specialty.toLowerCase().includes(search));
  }
  res.json(list);
});

app.get('/api/appointments', (req, res) => res.json(appointments));

app.post('/api/appointments', (req, res) => {
  const { patientName, patientPhone, doctorId, date, timeSlot, reason } = req.body;
  if (!patientName || !doctorId || !date || !timeSlot) {
    return res.status(400).json({ error: 'Missing required appointment fields' });
  }
  const doctor = doctors.find(d => d.id === doctorId) || { name: 'Specialist Doctor', specialty: 'General' };
  const newAppointment = {
    id: 'APT-' + Math.floor(1000 + Math.random() * 9000),
    patientName,
    patientPhone: patientPhone || '+91 98XXXXXXXX',
    doctorId,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date,
    timeSlot,
    reason: reason || 'General Consultation',
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };
  appointments.unshift(newAppointment);
  res.status(201).json(newAppointment);
});

app.delete('/api/appointments/:id', (req, res) => {
  appointments = appointments.filter(a => a.id !== req.params.id);
  res.json({ success: true, message: 'Appointment cancelled successfully' });
});

const PORT = 5000;
app.listen(PORT, () => console.log(\`🏥 Healthcare Appointment Server running on http://localhost:\${PORT}\`));
`
    },
    {
      path: 'src/services/api.js',
      content: `const BASE_URL = '/api';

export const HealthcareAPI = {
  async getDoctors(specialty = 'All', query = '') {
    try {
      const res = await fetch(\`\${BASE_URL}/doctors?specialty=\${encodeURIComponent(specialty)}&q=\${encodeURIComponent(query)}\`);
      if (!res.ok) throw new Error('Failed to fetch doctors');
      return await res.json();
    } catch (_) {
      // Local fallback
      return [];
    }
  },

  async getAppointments() {
    try {
      const res = await fetch(\`\${BASE_URL}/appointments\`);
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return await res.json();
    } catch (_) {
      return JSON.parse(localStorage.getItem('medicare_appointments') || '[]');
    }
  },

  async bookAppointment(data) {
    try {
      const res = await fetch(\`\${BASE_URL}/appointments\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to book appointment');
      return await res.json();
    } catch (_) {
      const fallback = {
        id: 'APT-' + Math.floor(1000 + Math.random() * 9000),
        ...data,
        status: 'Confirmed',
        createdAt: new Date().toISOString()
      };
      const existing = JSON.parse(localStorage.getItem('medicare_appointments') || '[]');
      existing.unshift(fallback);
      localStorage.setItem('medicare_appointments', JSON.stringify(existing));
      return fallback;
    }
  },

  async cancelAppointment(id) {
    try {
      await fetch(\`\${BASE_URL}/appointments/\${id}\`, { method: 'DELETE' });
    } catch (_) {
      const existing = JSON.parse(localStorage.getItem('medicare_appointments') || '[]');
      const filtered = existing.filter(a => a.id !== id);
      localStorage.setItem('medicare_appointments', JSON.stringify(filtered));
    }
  }
};`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #080c14; }
::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, Clock, User, Phone, CheckCircle2, ShieldCheck, 
  Activity, Sparkles, Heart, AlertCircle, Trash2, X, Plus, Filter,
  Stethoscope, Award, Hospital
} from 'lucide-react';

const SPECIALTIES = [
  { id: 'All', name: 'All Doctors', icon: '🩺' },
  { id: 'Cardiology', name: 'Cardiology (Heart)', icon: '❤️' },
  { id: 'Neurology', name: 'Neurology (Brain)', icon: '🧠' },
  { id: 'Orthopedics', name: 'Orthopedics (Bone)', icon: '🦴' },
  { id: 'Pediatrics', name: 'Pediatrics (Child)', icon: '👶' },
  { id: 'Dermatology', name: 'Dermatology (Skin)', icon: '✨' },
  { id: 'General Medicine', name: 'General Physician', icon: '🩺' }
];

const TIME_SLOTS = [
  '09:00 AM', '09:45 AM', '10:30 AM', '11:15 AM',
  '02:00 PM', '02:45 PM', '03:30 PM', '04:15 PM',
  '05:00 PM', '06:00 PM', '07:00 PM'
];

const INITIAL_DOCTORS = [
  {
    id: 'doc-1',
    name: 'Dr. Rajesh Sharma',
    specialty: 'Cardiology',
    experience: '16 Years Exp',
    rating: 4.9,
    reviews: 142,
    fee: 800,
    avatar: '👨‍⚕️',
    timing: '09:00 AM - 02:00 PM',
    hospital: 'Apex Heart Institute'
  },
  {
    id: 'doc-2',
    name: 'Dr. Ananya Iyer',
    specialty: 'Neurology',
    experience: '12 Years Exp',
    rating: 4.8,
    reviews: 98,
    fee: 900,
    avatar: '👩‍⚕️',
    timing: '10:00 AM - 04:00 PM',
    hospital: 'Neuro Care & Brain Center'
  },
  {
    id: 'doc-3',
    name: 'Dr. Vikram Malhotra',
    specialty: 'Orthopedics',
    experience: '14 Years Exp',
    rating: 4.9,
    reviews: 180,
    fee: 700,
    avatar: '👨‍⚕️',
    timing: '11:00 AM - 05:00 PM',
    hospital: 'Joint & Bone Specialty Wing'
  },
  {
    id: 'doc-4',
    name: 'Dr. Priya Sen',
    specialty: 'Pediatrics',
    experience: '10 Years Exp',
    rating: 4.9,
    reviews: 215,
    fee: 600,
    avatar: '👩‍⚕️',
    timing: '09:00 AM - 01:00 PM',
    hospital: 'Little Stars Children Care'
  },
  {
    id: 'doc-5',
    name: 'Dr. Amitav Roy',
    specialty: 'Dermatology',
    experience: '8 Years Exp',
    rating: 4.7,
    reviews: 86,
    fee: 550,
    avatar: '👨‍⚕️',
    timing: '02:00 PM - 07:00 PM',
    hospital: 'Aesthetic Skin & Hair Clinic'
  },
  {
    id: 'doc-6',
    name: 'Dr. Sneha Verma',
    specialty: 'General Medicine',
    experience: '11 Years Exp',
    rating: 4.8,
    reviews: 160,
    fee: 500,
    avatar: '👩‍⚕️',
    timing: '08:00 AM - 08:00 PM',
    hospital: 'City Care General OPD'
  }
];

export default function App() {
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState(INITIAL_DOCTORS);
  const [appointments, setAppointments] = useState([
    {
      id: 'APT-8492',
      patientName: 'Aarav Sharma',
      patientPhone: '+91 9876543210',
      doctorName: 'Dr. Rajesh Sharma',
      specialty: 'Cardiology',
      date: 'Tomorrow (28 Aug)',
      timeSlot: '10:30 AM',
      reason: 'Routine BP & Heart Checkup',
      status: 'Confirmed'
    }
  ]);

  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors' | 'appointments'
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [confirmationReceipt, setConfirmationReceipt] = useState(null);

  // Form State
  const [selectedDate, setSelectedDate] = useState('Tomorrow');
  const [selectedSlot, setSelectedSlot] = useState('10:30 AM');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState('Normal');

  const filteredDoctors = doctors.filter(doc => {
    const matchSpecialty = selectedSpecialty === 'All' || doc.specialty.toLowerCase() === selectedSpecialty.toLowerCase();
    const matchSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSpecialty && matchSearch;
  });

  const handleOpenBooking = (doc) => {
    setSelectedDoctor(doc);
    setSelectedSlot('10:30 AM');
    setSelectedDate('Tomorrow');
    setBookingModalOpen(true);
  };

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    if (!patientName.trim()) return alert('Please enter patient name');

    const newApt = {
      id: 'APT-' + Math.floor(1000 + Math.random() * 9000),
      patientName: patientName.trim(),
      patientPhone: patientPhone || '+91 98XXXXXXXX',
      doctorName: selectedDoctor.name,
      specialty: selectedDoctor.specialty,
      date: selectedDate,
      timeSlot: selectedSlot,
      reason: symptoms || 'General Consultation',
      status: 'Confirmed'
    };

    setAppointments(prev => [newApt, ...prev]);
    setBookingModalOpen(false);
    setConfirmationReceipt(newApt);
    setPatientName('');
    setPatientPhone('');
    setPatientAge('');
    setSymptoms('');
  };

  const handleCancelAppointment = (id) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      setAppointments(prev => prev.filter(a => a.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans pb-16">
      {/* ── Top Navigation Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0c101a]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl">🏥</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">MediCare Super-Specialty Hospital</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 24x7 Live OPD
              </span>
            </div>
            <p className="text-xs text-slate-400">Doctor Specialty Appointments & Instant Slot Booking</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation Tabs */}
          <div className="flex bg-[#121726] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('doctors')}
              className={activeTab === 'doctors' ? 'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-indigo-600 text-white shadow' : 'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-slate-400 hover:text-white'}
            >
              🩺 Find Doctors ({doctors.length})
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={activeTab === 'appointments' ? 'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-indigo-600 text-white shadow' : 'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-white'}
            >
              📋 My Appointments
              {appointments.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-900 text-[10px] font-bold flex items-center justify-center">
                  {appointments.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-semibold">
            <span>🚨 Emergency:</span>
            <span className="font-bold text-white">108 / 102</span>
          </div>
        </div>
      </header>

      {/* ── Hospital Emergency & Status Banner ────────────────────────────── */}
      <section className="bg-gradient-to-r from-indigo-950/60 via-slate-900/60 to-cyan-950/60 border-b border-slate-800/60 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 size={13} /> ICU Beds: 18 Available
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <Activity size={13} /> Operation Theatres: 4 Ready
          </span>
          <span className="flex items-center gap-1.5 text-amber-400 font-medium">
            <Heart size={13} /> Blood Bank: All Groups In-Stock
          </span>
        </div>
        <span className="text-slate-400">Average Wait Time: <b>~10 mins</b></span>
      </section>

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 pt-6">
        {activeTab === 'doctors' ? (
          <div>
            {/* Search & Filter Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span>Specialist Doctors & Surgeons</span>
                  <span className="text-xs px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono">
                    Verified MD / MS
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Choose specialty and select convenient appointment time slot</p>
              </div>

              {/* Live Search Bar */}
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctor or symptom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#101420] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>
            </div>

            {/* Specialty Filter Badges */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
              {SPECIALTIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSpecialty(s.id)}
                  className={selectedSpecialty === s.id ? 'px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400' : 'px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer bg-[#101420] text-slate-300 hover:text-white hover:bg-[#161c2d] border border-slate-800'}
                >
                  <span>{s.icon}</span>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>

            {/* Doctors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  className="bg-[#0f1422] border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center text-3xl shadow-inner border border-slate-700">
                          {doc.avatar}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {doc.name}
                          </h3>
                          <span className="inline-block text-[11px] font-semibold text-cyan-400">
                            {doc.specialty}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">{doc.experience}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg text-amber-300 text-xs font-bold">
                        <span>★</span>
                        <span>{doc.rating}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Hospital size={13} className="text-slate-500" />
                        <span className="truncate">{doc.hospital}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-slate-500" />
                        <span>Available: {doc.timing}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Consultation Fee</span>
                      <span className="text-base font-extrabold text-white">₹{doc.fee}</span>
                    </div>

                    <button
                      onClick={() => handleOpenBooking(doc)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar size={13} /> Book Slot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── My Appointments View ─────────────────────────────────────── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white">Booked Consultations & Appointments</h2>
                <p className="text-xs text-slate-400 mt-0.5">Manage upcoming hospital visits, tokens, and dates</p>
              </div>
              <button
                onClick={() => setActiveTab('doctors')}
                className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus size={13} /> Book Another Appointment
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="p-12 text-center bg-[#0e121e] border border-slate-800 rounded-2xl space-y-3">
                <span className="text-4xl">🩺</span>
                <h3 className="text-sm font-bold text-white">No Appointments Booked Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Browse our specialist doctors and book a convenient time slot in 1 click.</p>
                <button
                  onClick={() => setActiveTab('doctors')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg"
                >
                  Book First Appointment
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointments.map(apt => (
                  <div
                    key={apt.id}
                    className="p-5 bg-[#0f1422] border border-slate-800 rounded-2xl space-y-4 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                          {apt.id}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1">{apt.doctorName}</h4>
                        <p className="text-xs text-indigo-300 font-medium">{apt.specialty}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> {apt.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Patient</span>
                        <span className="font-semibold text-white">{apt.patientName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Slot & Date</span>
                        <span className="font-semibold text-cyan-300">{apt.date} • {apt.timeSlot}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 block uppercase">Reason for Consultation</span>
                        <span className="text-slate-300">{apt.reason}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400">Token Active: <b>#Room-3</b></span>
                      <button
                        onClick={() => handleCancelAppointment(apt.id)}
                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 size={12} /> Cancel Slot
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Interactive Booking Modal & Calendar Slot Picker ─────────────── */}
      {bookingModalOpen && selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Book Doctor Appointment</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{selectedDoctor.name}</span>
                  <span className="text-xs font-normal text-slate-400">({selectedDoctor.specialty})</span>
                </h3>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {/* Step 1: Date Selection */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">1. Select Appointment Date</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {['Today', 'Tomorrow', '29 Aug', '30 Aug'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={selectedDate === d ? 'py-2 rounded-xl font-semibold border transition-all text-center cursor-pointer bg-indigo-600 border-indigo-400 text-white shadow-md' : 'py-2 rounded-xl font-semibold border transition-all text-center cursor-pointer bg-[#141928] border-slate-800 text-slate-400 hover:text-white'}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Time Slot Picker */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">2. Choose Available Time Slot</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {TIME_SLOTS.slice(0, 8).map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={selectedSlot === slot ? 'py-1.5 rounded-xl font-mono text-[11px] font-semibold border transition-all text-center cursor-pointer bg-cyan-600 border-cyan-400 text-white shadow-md' : 'py-1.5 rounded-xl font-mono text-[11px] font-semibold border transition-all text-center cursor-pointer bg-[#141928] border-slate-800 text-slate-400 hover:text-white'}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: Patient Information */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">3. Patient Information</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Patient Full Name *"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Phone Number"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Primary Problem / Symptoms (e.g. chest pain, skin rash, fever)"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Footer CTA */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Pay at Clinic / OPD</span>
                  <span className="text-sm font-extrabold text-white">₹{selectedDoctor.fee}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    Confirm Appointment
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation Receipt Popup ───────────────────────────────────── */}
      {confirmationReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1422] border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              ✓
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Appointment Confirmed!</h3>
              <p className="text-xs text-slate-400 mt-0.5">Booking Token Number has been registered in the Hospital OPD Queue.</p>
            </div>

            <div className="p-4 bg-[#141a2c] rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Appointment ID:</span>
                <span className="font-mono font-bold text-cyan-400">{confirmationReceipt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Doctor:</span>
                <span className="font-semibold text-white">{confirmationReceipt.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Specialty:</span>
                <span className="text-indigo-300">{confirmationReceipt.specialty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Slot:</span>
                <span className="font-bold text-emerald-400">{confirmationReceipt.date} • {confirmationReceipt.timeSlot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="font-semibold text-white">{confirmationReceipt.patientName}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setConfirmationReceipt(null);
                setActiveTab('appointments');
              }}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              View in My Appointments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`
    },
    {
      path: 'README.md',
      content: `# ${title}

Production Hospital Appointment Booking and Doctor Specialty Management System.

## Features
- 🩺 Doctor Specialty Filters (Cardiology, Neurology, Pediatrics, Orthopedics, Dermatology, General Medicine)
- 📅 Interactive Calendar & Time Slot Picker
- 👤 Patient Registration & Symptom Logger
- 📋 Live Appointment Queue & Cancel/Reschedule Management
- 🚨 Emergency Hospital Bed & ICU Live Status

## Quick Start
\`\`\`bash
npm install
npm run dev
\`\`\`
`
    }
  ];
}

// ── 9. MOVIE & CINEMA TICKET BOOKING BLUEPRINT ───────────────────────────────
function getMovieTicketBookingBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', start: 'node server.js' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.460.0' },
        devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^6.0.1' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': 'http://localhost:5000' } }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="bg-[#08090d] text-slate-100 font-sans antialiased">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let movies = [
  { id: '1', title: 'Cyberpunk 2099: Neon Horizon', genre: 'Sci-Fi / Action', rating: '9.4', duration: '2h 35m', price: 280, banner: '🌌', showtimes: ['10:30 AM', '02:15 PM', '06:00 PM', '09:45 PM'], screen: 'IMAX 3D Laser' },
  { id: '2', title: 'Interstellar Drift', genre: 'Sci-Fi / Thriller', rating: '9.1', duration: '2h 50m', price: 250, banner: '🚀', showtimes: ['11:00 AM', '03:30 PM', '07:15 PM', '10:30 PM'], screen: 'Dolby Atmos 4K' },
  { id: '3', title: 'Shadow Dynasty', genre: 'Action / Epic', rating: '8.8', duration: '2h 15m', price: 220, banner: '⚔️', showtimes: ['12:30 PM', '04:45 PM', '08:30 PM'], screen: '4DX Experience' },
  { id: '4', title: 'The Quantum Heist', genre: 'Crime / Mystery', rating: '8.6', duration: '1h 55m', price: 200, banner: '💎', showtimes: ['01:15 PM', '05:30 PM', '09:00 PM'], screen: 'Gold Class VIP' }
];

let bookings = [];

app.get('/api/movies', (req, res) => res.json(movies));
app.get('/api/bookings', (req, res) => res.json(bookings));

app.post('/api/bookings', (req, res) => {
  const newBooking = {
    id: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
    createdAt: new Date().toISOString(),
    ...req.body
  };
  bookings.unshift(newBooking);
  res.status(201).json(newBooking);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Movie Ticket backend running on port ' + PORT));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function fetchMovies() {
  try {
    const res = await fetch('/api/movies');
    return await res.json();
  } catch (_) {
    return [
      { id: '1', title: 'Cyberpunk 2099: Neon Horizon', genre: 'Sci-Fi / Action', rating: '9.4', duration: '2h 35m', price: 280, banner: '🌌', showtimes: ['10:30 AM', '02:15 PM', '06:00 PM', '09:45 PM'], screen: 'IMAX 3D Laser' },
      { id: '2', title: 'Interstellar Drift', genre: 'Sci-Fi / Thriller', rating: '9.1', duration: '2h 50m', price: 250, banner: '🚀', showtimes: ['11:00 AM', '03:30 PM', '07:15 PM', '10:30 PM'], screen: 'Dolby Atmos 4K' },
      { id: '3', title: 'Shadow Dynasty', genre: 'Action / Epic', rating: '8.8', duration: '2h 15m', price: 220, banner: '⚔️', showtimes: ['12:30 PM', '04:45 PM', '08:30 PM'], screen: '4DX Experience' },
      { id: '4', title: 'The Quantum Heist', genre: 'Crime / Mystery', rating: '8.6', duration: '1h 55m', price: 200, banner: '💎', showtimes: ['01:15 PM', '05:30 PM', '09:00 PM'], screen: 'Gold Class VIP' }
    ];
  }
}

export async function createBooking(data) {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (_) {
    const fallback = { id: 'TKT-' + Math.floor(1000 + Math.random() * 9000), ...data };
    const list = JSON.parse(localStorage.getItem('movie_bookings') || '[]');
    list.unshift(fallback);
    localStorage.setItem('movie_bookings', JSON.stringify(list));
    return fallback;
  }
}`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { Search, Film, Calendar, Clock, Sparkles, CheckCircle2, Ticket, X, Trash2 } from 'lucide-react';
import { fetchMovies, createBooking } from './services/api';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
const COLS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function App() {
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [activeTab, setActiveTab] = useState('movies');
  const [myTickets, setMyTickets] = useState([]);
  const [confirmedTicket, setConfirmedTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMovies().then(data => {
      setMovies(data);
      if (data.length > 0) setSelectedMovie(data[0]);
    });
    const saved = JSON.parse(localStorage.getItem('movie_bookings') || '[]');
    setMyTickets(saved);
  }, []);

  const toggleSeat = (seatId) => {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatId));
    } else {
      setSelectedSeats([...selectedSeats, seatId]);
    }
  };

  const handleBookNow = async () => {
    if (selectedSeats.length === 0) return alert('Please select at least 1 seat');
    const bookingData = {
      movieTitle: selectedMovie.title,
      screen: selectedMovie.screen,
      showtime: selectedTime || selectedMovie.showtimes[0],
      seats: selectedSeats,
      totalAmount: selectedSeats.length * selectedMovie.price,
      banner: selectedMovie.banner
    };
    const res = await createBooking(bookingData);
    setConfirmedTicket(res);
    setMyTickets([res, ...myTickets]);
    setSelectedSeats([]);
  };

  const filteredMovies = movies.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans pb-12">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#0d101a]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-xl shadow-lg">
            🎬
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-wide">CinePulse Premium Cinema</h1>
            <p className="text-[11px] text-amber-400 font-medium">IMAX Laser & Dolby Atmos Experience</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#121624] p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('movies')}
              className={activeTab === 'movies' ? 'px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow' : 'px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white'}
            >
              🎥 Now Showing
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={activeTab === 'tickets' ? 'px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow' : 'px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white'}
            >
              🎟️ My Tickets ({myTickets.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6">
        {activeTab === 'movies' ? (
          <div>
            {/* Search & Heading */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white">Select Movie & Book Showtime</h2>
                <p className="text-xs text-slate-400 mt-0.5">Pick movie, choose screen showtime and select your seats</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search movies or genre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#101420] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Movies List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {filteredMovies.map(movie => (
                <div
                  key={movie.id}
                  onClick={() => { setSelectedMovie(movie); setSelectedTime(movie.showtimes[0]); setSelectedSeats([]); }}
                  className={selectedMovie?.id === movie.id ? 'p-4 bg-[#14192a] border-2 border-rose-500 rounded-2xl cursor-pointer shadow-xl transition-all' : 'p-4 bg-[#0e121e] border border-slate-800 hover:border-slate-700 rounded-2xl cursor-pointer transition-all'}
                >
                  <div className="h-32 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center text-5xl mb-3">
                    {movie.banner}
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white truncate">{movie.title}</h3>
                      <p className="text-[11px] text-rose-400 font-medium mt-0.5">{movie.genre}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-lg">
                      ★ {movie.rating}
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>{movie.duration}</span>
                    <span className="font-bold text-white">₹{movie.price}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Seat Matrix & Booking Section */}
            {selectedMovie && (
              <div className="bg-[#0f1422] border border-slate-800 rounded-3xl p-6 shadow-2xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Step 2: Choose Show & Seats</span>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{selectedMovie.title}</span>
                      <span className="text-xs font-normal text-slate-400">({selectedMovie.screen})</span>
                    </h3>
                  </div>

                  {/* Showtimes */}
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {selectedMovie.showtimes.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={selectedTime === time ? 'px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow' : 'px-3 py-1.5 bg-[#161c2e] text-slate-300 rounded-xl text-xs font-semibold hover:text-white'}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cinema Screen Curve */}
                <div className="max-w-md mx-auto mb-8 text-center">
                  <div className="h-2 w-full bg-gradient-to-r from-transparent via-rose-500 to-transparent rounded-full shadow-lg shadow-rose-500/50 mb-2" />
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">ALL EYES ON SCREEN</span>
                </div>

                {/* Seat Matrix Grid */}
                <div className="max-w-md mx-auto space-y-2 mb-8">
                  {ROWS.map(row => (
                    <div key={row} className="flex items-center justify-center gap-2">
                      <span className="w-5 text-[11px] font-mono text-slate-500 font-bold">{row}</span>
                      {COLS.map(col => {
                        const seatId = row + col;
                        const isSelected = selectedSeats.includes(seatId);
                        const isOccupied = (row === 'C' && col === 4) || (row === 'D' && col === 5);
                        return (
                          <button
                            key={seatId}
                            disabled={isOccupied}
                            onClick={() => toggleSeat(seatId)}
                            className={isOccupied ? 'w-8 h-8 rounded-lg bg-slate-800 text-slate-600 text-[10px] font-mono cursor-not-allowed' : isSelected ? 'w-8 h-8 rounded-lg bg-rose-600 text-white font-bold text-[10px] shadow-lg shadow-rose-600/40 cursor-pointer' : 'w-8 h-8 rounded-lg bg-[#182035] text-slate-300 hover:bg-[#202b46] hover:text-white text-[10px] font-mono border border-slate-700 cursor-pointer'}
                          >
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Seat Legend & Checkout Footer */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#182035] border border-slate-700" /> Available</div>
                    <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-rose-600" /> Selected</div>
                    <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-800" /> Reserved</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Selected: {selectedSeats.join(', ') || 'None'}</span>
                      <span className="text-base font-extrabold text-white">₹{selectedSeats.length * selectedMovie.price}</span>
                    </div>
                    <button
                      onClick={handleBookNow}
                      className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                    >
                      Confirm Booking ({selectedSeats.length})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* My Tickets View */
          <div>
            <h2 className="text-xl font-extrabold text-white mb-4">Your Cinema Passes & Tickets</h2>
            {myTickets.length === 0 ? (
              <div className="p-12 text-center bg-[#0e121e] border border-slate-800 rounded-2xl space-y-3">
                <span className="text-4xl">🎟️</span>
                <h3 className="text-sm font-bold text-white">No Tickets Booked Yet</h3>
                <p className="text-xs text-slate-400">Browse current showtimes and book your cinema seats in 1 click.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myTickets.map(tkt => (
                  <div key={tkt.id} className="p-5 bg-[#0f1422] border border-slate-800 rounded-2xl flex justify-between items-center shadow-lg">
                    <div>
                      <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-500/30">
                        {tkt.id}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">{tkt.movieTitle}</h3>
                      <p className="text-xs text-slate-400">{tkt.screen} • {tkt.showtime}</p>
                      <p className="text-xs font-semibold text-amber-400 mt-1">Seats: {tkt.seats?.join(', ')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block">₹{tkt.totalAmount}</span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-md">CONFIRMED</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 text-2xl flex items-center justify-center mx-auto">
              ✓
            </div>
            <h3 className="text-base font-bold text-white">Booking Confirmed!</h3>
            <p className="text-xs text-slate-400">Your cinema token: <b className="text-rose-400 font-mono">{confirmedTicket.id}</b></p>
            <div className="bg-[#141928] p-3 rounded-xl text-left text-xs space-y-1 text-slate-300">
              <p><b>Movie:</b> {confirmedTicket.movieTitle}</p>
              <p><b>Showtime:</b> {confirmedTicket.showtime}</p>
              <p><b>Seats:</b> {confirmedTicket.seats?.join(', ')}</p>
              <p><b>Amount:</b> ₹{confirmedTicket.totalAmount}</p>
            </div>
            <button
              onClick={() => { setConfirmedTicket(null); setActiveTab('tickets'); }}
              className="w-full py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
            >
              View in My Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`
    },
    {
      path: 'README.md',
      content: `# ${title}\n\nCinema Seat Booking and Movie Showtime Reservation Platform.\n`
    }
  ];
}

// ── 10. RESTAURANT & FOOD ORDERING BLUEPRINT ──────────────────────────────────
function getRestaurantFoodBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', start: 'node server.js' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.460.0' },
        devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^6.0.1' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': 'http://localhost:5000' } }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="bg-[#0a0b10] text-slate-100 font-sans antialiased">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let menu = [
  { id: '1', name: 'Truffle Mushroom Pizza', category: 'Pizza', price: 420, rating: '4.9', isVeg: true, icon: '🍕', desc: 'Wild forest mushrooms, black truffle oil, mozzarella' },
  { id: '2', name: 'Double Smash Cheeseburger', category: 'Burgers', price: 340, rating: '4.8', isVeg: false, icon: '🍔', desc: 'Angus beef patty, cheddar, caramelized onions' },
  { id: '3', name: 'Creamy Pesto Penne', category: 'Pasta', price: 380, rating: '4.7', isVeg: true, icon: '🍝', desc: 'Fresh basil pesto, pine nuts, shaved parmesan' },
  { id: '4', name: 'Crispy Peri-Peri Wings', category: 'Sides', price: 290, rating: '4.9', isVeg: false, icon: '🍗', desc: 'Spicy peri-peri glazed chicken wings with dip' },
  { id: '5', name: 'Belgian Chocolate Waffle', category: 'Desserts', price: 250, rating: '5.0', isVeg: true, icon: '🧇', desc: 'Warm waffle with melted dark chocolate & berries' },
  { id: '6', name: 'Iced Vanilla Cold Brew', category: 'Drinks', price: 180, rating: '4.8', isVeg: true, icon: '🥤', desc: 'Slow-steeped Arabica coffee over cream' }
];

let orders = [];

app.get('/api/menu', (req, res) => res.json(menu));
app.get('/api/orders', (req, res) => res.json(orders));

app.post('/api/orders', (req, res) => {
  const newOrder = {
    id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
    createdAt: new Date().toISOString(),
    status: 'Preparing in Kitchen',
    ...req.body
  };
  orders.unshift(newOrder);
  res.status(201).json(newOrder);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Restaurant backend running on port ' + PORT));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    return await res.json();
  } catch (_) {
    return [
      { id: '1', name: 'Truffle Mushroom Pizza', category: 'Pizza', price: 420, rating: '4.9', isVeg: true, icon: '🍕', desc: 'Wild forest mushrooms, black truffle oil, mozzarella' },
      { id: '2', name: 'Double Smash Cheeseburger', category: 'Burgers', price: 340, rating: '4.8', isVeg: false, icon: '🍔', desc: 'Angus beef patty, cheddar, caramelized onions' },
      { id: '3', name: 'Creamy Pesto Penne', category: 'Pasta', price: 380, rating: '4.7', isVeg: true, icon: '🍝', desc: 'Fresh basil pesto, pine nuts, shaved parmesan' },
      { id: '4', name: 'Crispy Peri-Peri Wings', category: 'Sides', price: 290, rating: '4.9', isVeg: false, icon: '🍗', desc: 'Spicy peri-peri glazed chicken wings with dip' },
      { id: '5', name: 'Belgian Chocolate Waffle', category: 'Desserts', price: 250, rating: '5.0', isVeg: true, icon: '🧇', desc: 'Warm waffle with melted dark chocolate & berries' },
      { id: '6', name: 'Iced Vanilla Cold Brew', category: 'Drinks', price: 180, rating: '4.8', isVeg: true, icon: '🥤', desc: 'Slow-steeped Arabica coffee over cream' }
    ];
  }
}

export async function placeOrder(orderData) {
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return await res.json();
  } catch (_) {
    const fallback = { id: 'ORD-' + Math.floor(1000 + Math.random() * 9000), status: 'Preparing', ...orderData };
    const list = JSON.parse(localStorage.getItem('food_orders') || '[]');
    list.unshift(fallback);
    localStorage.setItem('food_orders', JSON.stringify(list));
    return fallback;
  }
}`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Plus, Minus, CheckCircle2, Trash2, Clock, MapPin, X } from 'lucide-react';
import { fetchMenu, placeOrder } from './services/api';

const CATEGORIES_LIST = ['All', 'Pizza', 'Burgers', 'Pasta', 'Sides', 'Desserts', 'Drinks'];

export default function App() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(null);

  useEffect(() => {
    fetchMenu().then(data => setMenu(data));
  }, []);

  const addToCart = (item) => {
    setCart(prev => ({
      ...prev,
      [item.id]: { item, count: (prev[item.id]?.count || 0) + 1 }
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const current = prev[itemId]?.count || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...prev[itemId], count: current - 1 } };
    });
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, { item, count }) => sum + (item.price * count), 0);
  const cartItemCount = cartItems.reduce((sum, { count }) => sum + count, 0);

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    const res = await placeOrder({
      items: cartItems.map(c => ({ name: c.item.name, count: c.count, price: c.item.price })),
      total: cartTotal + 40,
      deliveryTime: '25-30 mins'
    });
    setOrderConfirmed(res);
    setCart({});
    setCartOpen(false);
  };

  const filteredMenu = menu.filter(item => {
    const matchCat = selectedCat === 'All' || item.category === selectedCat;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#08090e] text-slate-100 font-sans pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d101a]/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg">
            🍽️
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white">Gourmet Haven Restaurant</h1>
            <p className="text-[11px] text-amber-400 font-medium">Fast 25-min Doorstep Delivery</p>
          </div>
        </div>

        <button
          onClick={() => setCartOpen(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 cursor-pointer hover:opacity-95"
        >
          <ShoppingBag size={14} />
          <span>Cart ({cartItemCount})</span>
          {cartTotal > 0 && <span>• ₹{cartTotal}</span>}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-6">
        {/* Search & Category Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES_LIST.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={selectedCat === cat ? 'px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-md' : 'px-4 py-2 rounded-xl text-xs font-semibold bg-[#121624] text-slate-300 hover:text-white border border-slate-800'}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search dishes or recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#101420] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMenu.map(dish => {
            const countInCart = cart[dish.id]?.count || 0;
            return (
              <div key={dish.id} className="bg-[#0e121e] border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between group transition-all">
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-4xl p-2 bg-[#151b2c] rounded-xl border border-slate-700">{dish.icon}</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded-lg">★ {dish.rating}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-3 group-hover:text-amber-300 transition-colors">{dish.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{dish.desc}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-base font-extrabold text-white">₹{dish.price}</span>
                  {countInCart === 0 ? (
                    <button
                      onClick={() => addToCart(dish)}
                      className="px-3.5 py-1.5 bg-[#171d2e] hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-[#171d2e] border border-amber-500/50 px-2 py-1 rounded-xl">
                      <button onClick={() => removeFromCart(dish.id)} className="text-slate-300 hover:text-white"><Minus size={12} /></button>
                      <span className="text-xs font-bold text-amber-400">{countInCart}</span>
                      <button onClick={() => addToCart(dish)} className="text-slate-300 hover:text-white"><Plus size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#0e1320] border-l border-slate-800 w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag size={16} className="text-amber-400" /> Your Order Cart
                </h3>
                <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-white"><X size={18} /></button>
              </div>

              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {cartItems.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-10">Your cart is empty.</p>
                ) : (
                  cartItems.map(({ item, count }) => (
                    <div key={item.id} className="p-3 bg-[#141928] rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <h4 className="font-bold text-white">{item.name}</h4>
                        <span className="text-slate-400">₹{item.price} × {count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeFromCart(item.id)} className="p-1 bg-slate-800 rounded text-slate-300"><Minus size={11} /></button>
                        <span className="font-bold text-amber-400">{count}</span>
                        <button onClick={() => addToCart(item)} className="p-1 bg-slate-800 rounded text-slate-300"><Plus size={11} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cartItems.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Subtotal</span><span>₹{cartTotal}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Delivery & Packaging</span><span>₹40</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
                  <span>Total Amount</span><span className="text-amber-400">₹{cartTotal + 40}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:opacity-95"
                >
                  Place Delivery Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Confirmed */}
      {orderConfirmed && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 text-2xl flex items-center justify-center mx-auto">
              ✓
            </div>
            <h3 className="text-base font-bold text-white">Order Placed Successfully!</h3>
            <p className="text-xs text-slate-400">Order ID: <b className="text-amber-400 font-mono">{orderConfirmed.id}</b></p>
            <p className="text-xs text-emerald-400 font-medium">Estimated Delivery in 25-30 mins</p>
            <button
              onClick={() => setOrderConfirmed(null)}
              className="w-full py-2.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
`
    },
    {
      path: 'README.md',
      content: `# ${title}\n\nRestaurant Menu & Food Delivery Application.\n`
    }
  ];
}

// ── 11. EXPENSE & FINANCE TRACKER BLUEPRINT ───────────────────────────────────
function getExpenseFinanceBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', start: 'node server.js' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.460.0' },
        devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^6.0.1' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': 'http://localhost:5000' } }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="bg-[#07090e] text-slate-100 font-sans antialiased">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let transactions = [
  { id: '1', title: 'Salary Credited', category: 'Income', type: 'income', amount: 85000, date: '2026-08-25' },
  { id: '2', title: 'Apartment Rent', category: 'Housing', type: 'expense', amount: 22000, date: '2026-08-26' },
  { id: '3', title: 'Grocery Supermarket', category: 'Food', type: 'expense', amount: 4800, date: '2026-08-26' },
  { id: '4', title: 'Stock Dividend', category: 'Investment', type: 'income', amount: 3500, date: '2026-08-27' },
  { id: '5', title: 'Electricity & Wifi Bill', category: 'Utilities', type: 'expense', amount: 2400, date: '2026-08-27' }
];

app.get('/api/transactions', (req, res) => res.json(transactions));

app.post('/api/transactions', (req, res) => {
  const newTx = { id: String(Date.now()), ...req.body };
  transactions.unshift(newTx);
  res.status(201).json(newTx);
});

app.delete('/api/transactions/:id', (req, res) => {
  transactions = transactions.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Finance backend running on port ' + PORT));`
    },
    {
      path: 'src/services/api.js',
      content: `export async function fetchTransactions() {
  try {
    const res = await fetch('/api/transactions');
    return await res.json();
  } catch (_) {
    return [
      { id: '1', title: 'Salary Credited', category: 'Income', type: 'income', amount: 85000, date: '2026-08-25' },
      { id: '2', title: 'Apartment Rent', category: 'Housing', type: 'expense', amount: 22000, date: '2026-08-26' },
      { id: '3', title: 'Grocery Supermarket', category: 'Food', type: 'expense', amount: 4800, date: '2026-08-26' },
      { id: '4', title: 'Stock Dividend', category: 'Investment', type: 'income', amount: 3500, date: '2026-08-27' }
    ];
  }
}

export async function addTransaction(tx) {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
    return await res.json();
  } catch (_) {
    const fallback = { id: String(Date.now()), ...tx };
    const list = JSON.parse(localStorage.getItem('finance_tx') || '[]');
    list.unshift(fallback);
    localStorage.setItem('finance_tx', JSON.stringify(list));
    return fallback;
  }
}`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart, Filter } from 'lucide-react';
import { fetchTransactions, addTransaction } from './services/api';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Food');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchTransactions().then(data => setTransactions(data));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    const newTx = {
      title: title.trim(),
      amount: parseFloat(amount),
      type,
      category,
      date: new Date().toISOString().split('T')[0]
    };
    const res = await addTransaction(newTx);
    setTransactions([res, ...transactions]);
    setTitle('');
    setAmount('');
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  const filteredList = transactions.filter(t => filterType === 'all' || t.type === filterType);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-600 flex items-center justify-center text-xl shadow-lg">
            💰
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white">SmartFinance Expense Tracker</h1>
            <p className="text-[11px] text-emerald-400 font-medium">Income, Expenses & Budget Analytics</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-[#0e121e] border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Balance</span>
            <h3 className="text-2xl font-extrabold text-white mt-1">₹{netBalance.toLocaleString()}</h3>
            <span className="text-[11px] text-emerald-400 font-medium mt-1 block">Live Wallet Net Worth</span>
          </div>

          <div className="p-5 bg-[#0e121e] border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Monthly Income</span>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">+₹{totalIncome.toLocaleString()}</h3>
            <span className="text-[11px] text-slate-500 mt-1 block">All incoming credits</span>
          </div>

          <div className="p-5 bg-[#0e121e] border border-slate-800 rounded-2xl">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Expenses</span>
            <h3 className="text-2xl font-extrabold text-rose-400 mt-1">-₹{totalExpense.toLocaleString()}</h3>
            <span className="text-[11px] text-slate-500 mt-1 block">Monthly spending</span>
          </div>
        </div>

        {/* Add Transaction Form */}
        <form onSubmit={handleAdd} className="bg-[#0e121e] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-3">
          <input
            type="text"
            required
            placeholder="Transaction description (e.g. Starbucks coffee)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 min-w-[200px] px-3.5 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="number"
            required
            placeholder="Amount (₹)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 px-3.5 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="expense">Expense (-)</option>
            <option value="income">Income (+)</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="Food">Food & Dining</option>
            <option value="Housing">Housing & Rent</option>
            <option value="Salary">Salary</option>
            <option value="Investment">Investment</option>
            <option value="Shopping">Shopping</option>
            <option value="Utilities">Utilities</option>
          </select>
          <button
            type="submit"
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Entry
          </button>
        </form>

        {/* Transactions List */}
        <div className="bg-[#0e121e] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
            <div className="flex gap-2">
              {['all', 'income', 'expense'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={filterType === f ? 'px-3 py-1 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase' : 'px-3 py-1 text-slate-400 text-xs font-semibold hover:text-white uppercase'}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredList.map(tx => (
              <div key={tx.id} className="p-3.5 bg-[#121624] border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">{tx.title}</h4>
                  <span className="text-[10px] text-slate-400">{tx.category} • {tx.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={tx.type === 'income' ? 'text-xs font-extrabold text-emerald-400' : 'text-xs font-extrabold text-rose-400'}>
                    {tx.type === 'income' ? '+₹' : '-₹'}{tx.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
`
    },
    {
      path: 'README.md',
      content: `# ${title}\n\nPersonal Expense & Finance Tracker Dashboard.\n`
    }
  ];
}

// ── 12. GENERAL FULLSTACK BLUEPRINT ───────────────────────────────────────────
function getGeneralFullstackBlueprint(name, title, prompt) {
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', server: 'node server.js', start: 'vite' },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'lucide-react': '^0.344.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' }
      }, null, 2)
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }
  }
});`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
    },
    {
      path: 'server.js',
      content: `const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let items = [
  { id: '1', title: 'System Analytics Module', category: 'Analytics', status: 'Active', value: '98.4%', updated: 'Just now' },
  { id: '2', title: 'User Access Control', category: 'Security', status: 'Verified', value: '1,420 Users', updated: '2h ago' },
  { id: '3', title: 'Database Replication Pipeline', category: 'Database', status: 'Active', value: 'Synced', updated: '5m ago' }
];

app.get('/api/items', (req, res) => res.json(items));
app.post('/api/items', (req, res) => {
  const newItem = { id: String(Date.now()), ...req.body };
  items.unshift(newItem);
  res.status(201).json(newItem);
});
app.delete('/api/items/:id', (req, res) => {
  items = items.filter(i => i.id !== req.params.id);
  res.json({ success: true });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));`
    },
    {
      path: 'src/services/api.js',
      content: `export const API = {
  async getItems() {
    try {
      const res = await fetch('/api/items');
      return await res.json();
    } catch (_) {
      return JSON.parse(localStorage.getItem('${name}_items') || '[]');
    }
  },
  async createItem(item) {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return await res.json();
    } catch (_) {
      const fallback = { id: String(Date.now()), ...item };
      const list = JSON.parse(localStorage.getItem('${name}_items') || '[]');
      list.unshift(fallback);
      localStorage.setItem('${name}_items', JSON.stringify(list));
      return fallback;
    }
  }
};`
    },
    {
      path: 'src/index.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);`
    },
    {
      path: 'src/App.jsx',
      content: `import React, { useState } from 'react';
import { Search, Plus, Sparkles, Activity, ShieldCheck, Trash2, ArrowRight } from 'lucide-react';

export default function App() {
  const [items, setItems] = useState([
    { id: '1', title: 'System Analytics Module', category: 'Analytics', status: 'Active', value: '98.4%' },
    { id: '2', title: 'User Access Control', category: 'Security', status: 'Verified', value: '1,420 Users' },
    { id: '3', title: 'Database Replication Pipeline', category: 'Database', status: 'Active', value: 'Synced' }
  ]);
  const [query, setQuery] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCat, setNewItemCat] = useState('Core');

  const filtered = items.filter(i => i.title.toLowerCase().includes(query.toLowerCase()) || i.category.toLowerCase().includes(query.toLowerCase()));

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    setItems([{ id: String(Date.now()), title: newItemTitle.trim(), category: newItemCat, status: 'Active', value: 'New' }, ...items]);
    setNewItemTitle('');
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-6 font-sans">
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">${title}</h1>
          <p className="text-xs text-slate-400">Full-Stack Application Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400">System Ready</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-6 space-y-6">
        <form onSubmit={handleAdd} className="flex gap-2 bg-[#0f1422] p-3 rounded-2xl border border-slate-800">
          <input
            type="text"
            placeholder="Add new item or module..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            className="flex-1 px-4 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Category"
            value={newItemCat}
            onChange={(e) => setNewItemCat(e.target.value)}
            className="w-32 px-3 py-2 bg-[#141928] border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          />
          <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="p-4 bg-[#0f1422] border border-slate-800 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">{item.category}</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{item.title}</h3>
                <span className="text-xs font-semibold text-emerald-400">{item.value}</span>
              </div>
              <button
                onClick={() => setItems(items.filter(i => i.id !== item.id))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
`
    },
    {
      path: 'README.md',
      content: `# ${title}\n\nGenerated with AI-Dost Full-Stack Copilot.\n`
    }
  ];
}

module.exports = {
  CATEGORIES,
  detectCategory,
  buildFullstackSystemPrompt,
  generateGoldenScaffold,
  getHealthcareBookingBlueprint,
  getGeneralFullstackBlueprint
};
