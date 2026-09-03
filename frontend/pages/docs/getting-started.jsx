import React from 'react';
import Link from 'next/link';
import { DocsLayout } from '../../components/public/DocsLayout';
import { Terminal, CheckCircle2, AlertCircle } from 'lucide-react';

export default function GettingStartedDoc() {
  return (
    <DocsLayout
      title="Quickstart & Installation"
      category="Start Here"
      description="Step-by-step setup guide to get AI-Dost running on your local workstation in under 3 minutes."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is AI-Dost Setup?</h2>
          <p>
            AI-Dost runs as a lightweight dual-service architecture: an Express API backend (running by default on <code>localhost:5000</code>) that orchestrates autonomous agents and SQLite persistence, and a modern Next.js 16 frontend (running on <code>localhost:3000</code>) that provides the conversational UI, IDE, and dashboard.
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why Run Locally?</h2>
          <p>
            Running locally gives you 100% data sovereignty. Your code, project files, conversation histories, and git repositories stay on your local disk. It also enables the agent to directly execute authorized terminal commands, run test suites, and scaffold applications in real time.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When to Use AI-Dost?</h2>
          <p>
            Whenever you need an autonomous pair programmer to build full-stack web applications, diagnose failing tests, generate enterprise documents (Word, Excel, PowerPoint, PDF), perform deep technical research, or refactor code in your local repository.
          </p>
        </section>

        {/* 4. How */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How to Install and Run</h2>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-paper-100 font-display">Step 1: Configure Environment Variables</h3>
            <p>Copy <code>.env.example</code> to <code>.env</code> in the repository root and add your free Google Gemini API key:</p>
            <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-accent-primary">
              GEMINI_API_KEY=your_gemini_api_key_here
            </div>
            <p className="text-[11px] text-ink-muted">
              Get a free key from Google AI Studio (1,500 requests/day free tier).
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-paper-100 font-display">Step 2: Start the Backend Server (:5000)</h3>
            <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-paper-100 space-y-1">
              <div className="text-ink-muted"># Open terminal 1</div>
              <div>cd backend</div>
              <div>node server.js</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-paper-100 font-display">Step 3: Start the Next.js Frontend (:3000)</h3>
            <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-paper-100 space-y-1">
              <div className="text-ink-muted"># Open terminal 2</div>
              <div>cd frontend</div>
              <div>npm run dev</div>
            </div>
            <p className="text-[11px] text-ink-muted">
              Open your browser at <code>http://localhost:3000</code>. API requests are automatically proxied to port 5000.
            </p>
          </div>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. First Conversation Example</h2>
          <p>Once loaded, navigate to the Chat view and type:</p>
          <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-paper-100">
            &ldquo;Build me a full-stack task manager app with React and Express.&rdquo;
          </div>
          <p className="text-ink-muted text-[11px]">
            AI-Dost will autonomously create a plan, scaffold 15+ project files in your workspace, install dependencies, run build checks, and present the finished project in your workspace.
          </p>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Environmental Limitations</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Requires Node.js v18 or newer.</li>
            <li>Free Gemini API limits: 1,500 requests/day. If exceeded, AI-Dost cascades automatically to Groq or local Ollama.</li>
            <li>Docker container preview requires Docker Desktop running if using isolated sandboxes.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Mistakes to Avoid</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li><strong>Port Mismatch:</strong> Changing backend port from 5000 without updating Next.js API rewrite rules in <code>frontend/next.config.mjs</code>.</li>
            <li><strong>Missing API Key:</strong> Starting the server without <code>GEMINI_API_KEY</code> and without a running local Ollama instance will cause inference failures.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
