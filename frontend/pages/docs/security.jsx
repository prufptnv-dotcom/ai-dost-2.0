import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { ShieldCheck, Lock, Eye } from 'lucide-react';

export default function SecurityDoc() {
  return (
    <DocsLayout
      title="Capability Policies & Guards"
      category="Security & Operations"
      description="Detailed technical breakdown of role-based capability boundaries, path traversal guards, and safe credential handling."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What are Capability Policies?</h2>
          <p>
            Capability policies are non-bypassable programmatic rules enforced by the AI-Dost backend on every tool call executed by an agent. They define precisely which tools, files, and commands an agent can access based on its active operational role (Supervisor, Researcher, Coder, Verifier).
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why are Policies Necessary?</h2>
          <p>
            Autonomous LLMs can make unexpected mistakes, hallucinate external file paths, or attempt dangerous system commands. Capability policies ensure that even if an LLM generates a malicious or malformed tool call, the backend immediately blocks execution and returns an error response.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When are Policies Checked?</h2>
          <p>
            Policies are checked synchronously prior to every single tool execution. The agent cannot bypass or disable these checks through prompt injection.
          </p>
        </section>

        {/* 4. How */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How Path Traversal Defense Works</h2>
          <p>
            All file paths supplied to tools are normalized against the current project&apos;s workspace root:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Any path containing null bytes (<code>\0</code>) is rejected.</li>
            <li>Paths containing directory escape patterns (<code>../</code>) that resolve outside the workspace root throw an immediate <code>400 Invalid Path</code> error.</li>
            <li>Absolute paths targeting system directories (<code>/etc</code>, <code>C:\Windows</code>) are strictly denied.</li>
          </ul>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Capability Policy Matrix</h2>
          <div className="rounded-xs border border-border overflow-hidden bg-canvas-surface font-mono text-[11px]">
            <div className="grid grid-cols-4 p-2.5 bg-canvas-base font-bold text-paper-100 border-b border-border">
              <div>Role</div>
              <div>File Read</div>
              <div>File Write</div>
              <div>Terminal Exec</div>
            </div>
            <div className="divide-y divide-border-subtle">
              <div className="grid grid-cols-4 p-2.5 text-ink-muted">
                <div className="text-accent-primary font-bold">SUPERVISOR</div>
                <div>Read-Only</div>
                <div>DENIED</div>
                <div>DENIED</div>
              </div>
              <div className="grid grid-cols-4 p-2.5 text-ink-muted">
                <div className="text-paper-100 font-bold">RESEARCHER</div>
                <div>Workspace Only</div>
                <div>DENIED</div>
                <div>DENIED</div>
              </div>
              <div className="grid grid-cols-4 p-2.5 text-ink-muted">
                <div className="text-paper-100 font-bold">CODER</div>
                <div>Workspace Only</div>
                <div>Workspace Only</div>
                <div>Bounded Only</div>
              </div>
              <div className="grid grid-cols-4 p-2.5 text-ink-muted">
                <div className="text-paper-100 font-bold">VERIFIER</div>
                <div>Workspace Only</div>
                <div>DENIED</div>
                <div>Test Scripts Only</div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Scope of Current Defenses</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Designed for local single-user developer workstations.</li>
            <li>Multi-tenant row-level database authorization is planned for future enterprise scale profiles.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Security Misconfigurations</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Committing unencrypted API keys or production database passwords into workspace files.</li>
            <li>Running the backend with elevated Administrator/root privileges.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
