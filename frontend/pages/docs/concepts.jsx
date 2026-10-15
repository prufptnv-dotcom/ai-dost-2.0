import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { Layers, Cpu, Database, CheckCircle2 } from 'lucide-react';

export default function ConceptsDoc() {
  return (
    <DocsLayout
      title="Core Architecture & Concepts"
      category="Start Here"
      description="Foundational design patterns: Simple Outside / Autonomous Inside, 5-layer engine stack, and runtime execution profiles."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is the Core Architecture?</h2>
          <p>
            AI-Dost is designed around a single guiding philosophy: <strong>&ldquo;Simple Chat Outside, Autonomous System Inside.&rdquo;</strong> The user interacts through a frictionless natural language conversation, while behind the scenes, an autonomous supervisor executes a multi-step engineering pipeline (planning, tool execution, output observation, verification, and repair).
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why this Architecture?</h2>
          <p>
            Traditional AI coding tools force developers into a complex maze of buttons, inspectors, and modal menus. AI-Dost decouples the interface from internal complexity, allowing the user to focus on their intent while the system autonomously manages dependencies, file structures, and verification passes.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When to Choose Different Runtime Profiles</h2>
          <p>
            AI-Dost defines 3 explicit runtime execution profiles to adapt to different hardware and team environments:
          </p>
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-accent-primary font-mono text-xs">LIGHT Profile</span>
              <p className="text-[11px] text-ink-muted">
                Mobile & PWA clients. Connects to a remote server for heavy LLM inference and file execution. Zero local Python/Node dependencies required on the client device.
              </p>
            </div>
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-accent-primary font-mono text-xs">STANDARD Profile (Default)</span>
              <p className="text-[11px] text-ink-muted">
                Developer workstation. Local SQLite database, local Docker sandbox, local Monaco IDE, and multi-model cascade (Gemini, Groq, Ollama). Ideal for individual software developers.
              </p>
            </div>
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-accent-primary font-mono text-xs">SCALE Profile (Future Roadmap)</span>
              <p className="text-[11px] text-ink-muted">
                Multi-user cloud deployment. Migrates SQLite to PostgreSQL, uses S3-compatible object storage for artifacts, and dispatches tasks to distributed worker queues.
              </p>
            </div>
          </div>
        </section>

        {/* 4. How */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How Data Flows Internally</h2>
          <p>
            When a user enters a prompt, it enters the <strong>Autonomous Supervisor</strong>. The supervisor reads workspace metadata from local SQLite, invokes an LLM to generate a task DAG, delegates execution to sub-roles (Researcher, Coder, Verifier), captures tool outputs, runs test suites, and commits results to the local workspace git tree.
          </p>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Architectural Layer Example</h2>
          <div className="p-4 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-ink-muted space-y-1">
            <div className="text-paper-100 font-bold">[User Chat Prompt] &ldquo;Create a weather app&rdquo;</div>
            <div>↳ Layer 1: Prompt Router detects scaffolding intent</div>
            <div>↳ Layer 2: Supervisor decomposes into 3-step DAG</div>
            <div>↳ Layer 3: Coder role writes App.jsx, api.js, styles.css</div>
            <div>↳ Layer 4: Verifier role tests imports and executes build</div>
            <div>↳ Layer 5: State committed to SQLite and local .git repository</div>
          </div>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Current Profile Limitations</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Standard profile is single-tenant; multi-user authentication is part of the future Scale profile roadmap.</li>
            <li>Database migrations in SQLite run synchronously via better-sqlite3.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Architectural Mistakes</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Attempting to run multi-tenant user authentication on the single-workstation Standard profile without a reverse proxy.</li>
            <li>Directly editing <code>aidost.db</code> while the server process is active.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
