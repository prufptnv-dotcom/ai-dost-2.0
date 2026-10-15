import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { Cpu, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';

export default function AgentDoc() {
  return (
    <DocsLayout
      title="8-Stage Execution Pipeline"
      category="Autonomous Engine"
      description="The deterministic engineering contract governing autonomous planning, execution, verification, and self-healing repair."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is the 8-Stage Pipeline?</h2>
          <p>
            The autonomous execution pipeline is the deterministic state machine that guides AI-Dost from an initial natural language prompt to a verified software deliverable. The 8 stages are:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-ink-muted">
            <li><strong>Intent:</strong> Parse user intent and identify target outcomes.</li>
            <li><strong>Context:</strong> Read relevant workspace files, manifests, and memory.</li>
            <li><strong>Plan:</strong> Construct a directed task DAG with role assignments.</li>
            <li><strong>Execute:</strong> Run authorized tools (file edits, scaffolding, terminal).</li>
            <li><strong>Observe:</strong> Capture stdout, exit codes, and compile logs.</li>
            <li><strong>Verify:</strong> Execute unit tests, linters, and visual render checks.</li>
            <li><strong>Repair:</strong> Formulate targeted diffs if errors occur (up to 3 cycles).</li>
            <li><strong>Deliver:</strong> Commit verified artifacts and present outcomes to the user.</li>
          </ol>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why a Structured Lifecycle?</h2>
          <p>
            One-shot LLM code generation fails frequently on complex projects due to hallucinated imports, missed syntax errors, and missing dependencies. By breaking execution into distinct observation and verification stages, AI-Dost guarantees that code is tested before it is marked complete.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When does the Pipeline Activate?</h2>
          <p>
            The pipeline activates automatically whenever the user submits a prompt requiring multi-step work: project generation, file refactoring, bug fixes, or structured document creation. Simple questions that only require an explanatory answer bypass the execution stages for immediate response.
          </p>
        </section>

        {/* 4. How */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How the Self-Healing Loop Works</h2>
          <p>
            During Stage 6 (Verify), if the test runner or compiler outputs an error:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>The supervisor captures the exact stack trace and line numbers.</li>
            <li>It identifies the root cause and generates a surgical unified diff.</li>
            <li>It applies the diff to the target file and re-executes the test suite.</li>
            <li>This cycle repeats up to 3 times before either succeeding or requesting human clarification.</li>
          </ul>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Self-Healing Trace Example</h2>
          <div className="p-4 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-ink-muted space-y-1">
            <div className="text-signal-error">[Test Failure] TypeError: Cannot read property &apos;id&apos; of undefined in auth.js:42</div>
            <div className="text-accent-primary">[Repair Cycle 1/3] Applying targeted null-check diff to auth.js</div>
            <div className="text-paper-100">[Re-Verify] Running npm test...</div>
            <div className="text-emerald-400">[Test Success] 4 tests passed. Step marked verified.</div>
          </div>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Execution Boundaries & Safeguards</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Hard ceiling of 50 execution steps per task to prevent infinite loops.</li>
            <li>Individual tool invocations timeout after 30 seconds (60s for local Ollama).</li>
            <li>Maximum 3 self-healing repair iterations per detected defect.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Prompting Mistakes</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Asking the agent to perform 10 unrelated tasks in a single prompt rather than letting it decompose a clear high-level objective.</li>
            <li>Manually editing files in the workspace while the autonomous repair loop is actively running.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
