import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { Wrench, AlertTriangle, Terminal, RefreshCw } from 'lucide-react';

export default function TroubleshootingDoc() {
  return (
    <DocsLayout
      title="Troubleshooting & Runbooks"
      category="Security & Operations"
      description="Step-by-step operational runbooks for diagnosing and fixing common local setup and runtime issues."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is the Troubleshooting Guide?</h2>
          <p>
            A curated reference of common error signatures encountered when booting or running AI-Dost locally, with exact remediation commands to restore healthy operation.
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why Runbooks Matter</h2>
          <p>
            Local development environments differ across operating systems, Node versions, and installed C++ toolchains. Having structured runbooks ensures quick resolution without modifying core application code.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When to Consult this Guide</h2>
          <p>
            Consult this guide if the backend fails to start, the frontend shows API proxy errors, third-party model quotas are exhausted, or an autonomous task stalls.
          </p>
        </section>

        {/* 4. How */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. Common Runbooks</h2>

          {/* Runbook 1 */}
          <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-2">
            <h3 className="text-xs font-bold font-mono text-paper-100 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-signal-warning" /> Runbook A: Port 5000 or 3000 In Use
            </h3>
            <p className="text-[11px] text-ink-muted">
              If another process occupies port 5000 or 3000, find the PID and terminate it:
            </p>
            <div className="p-3 rounded-xs bg-canvas-base font-mono text-[11px] text-paper-100 space-y-1">
              <div className="text-ink-muted"># Windows PowerShell:</div>
              <div>Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process</div>
            </div>
          </div>

          {/* Runbook 2 */}
          <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-2">
            <h3 className="text-xs font-bold font-mono text-paper-100 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-accent-primary" /> Runbook B: Gemini Rate Limit (429) Handling
            </h3>
            <p className="text-[11px] text-ink-muted">
              AI-Dost automatically cascades to Groq and OpenRouter when Gemini returns a 429 quota exhaustion. If all cloud providers are exhausted, ensure local Ollama is running:
            </p>
            <div className="p-3 rounded-xs bg-canvas-base font-mono text-[11px] text-paper-100 space-y-1">
              <div>ollama serve</div>
              <div>ollama pull qwen2.5-coder:7b</div>
            </div>
          </div>

          {/* Runbook 3 */}
          <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-2">
            <h3 className="text-xs font-bold font-mono text-paper-100 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-accent-primary" /> Runbook C: SQLite Native Addon Build Blocker
            </h3>
            <p className="text-[11px] text-ink-muted">
              On Windows, <code>better-sqlite3</code> requires Visual Studio Build Tools with Desktop C++ workload (<code>cl.exe</code>, <code>MSBuild</code>). If building from source fails, do not replace the driver in <code>package.json</code>; install the required C++ build tools via the Visual Studio installer.
            </p>
          </div>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Health Check Command</h2>
          <p>To verify that the backend API is healthy and reachable:</p>
          <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-accent-primary">
            curl http://localhost:5000/api/health
          </div>
          <p className="text-[11px] text-ink-muted">
            Expected response: <code>{`{"status":"ok","timestamp":"..."}`}</code>
          </p>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Environmental Scope</h2>
          <p className="text-ink-muted">
            Local Ollama 7B parameter models require at least 16GB of system RAM for smooth inference. If running on machines with 8GB RAM, utilize free cloud API tiers (Gemini Flash or Groq).
          </p>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Mistakes</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Modifying package dependencies when a build failure is purely an environment C++ toolchain absence.</li>
            <li>Forgetting to restart the server after changing values in the <code>.env</code> file.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
