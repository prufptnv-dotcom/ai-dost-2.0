import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { Terminal, FileCode, FileSpreadsheet, Image } from 'lucide-react';

export default function ToolsDoc() {
  return (
    <DocsLayout
      title="Tool Registry & Scaffolding"
      category="Autonomous Engine"
      description="Available autonomous tools: file operations, terminal execution, fullstack scaffolding, and document compilation."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is the Tool Registry?</h2>
          <p>
            The Tool Registry is the catalog of capabilities exposed to authorized sub-agents during Stage 4 (Execute). Tools allow agents to interact with files, run terminal commands, compile Office files, and capture browser screenshots.
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why Managed Tools?</h2>
          <p>
            Rather than giving an LLM raw terminal access, tools act as typed, validated interfaces. Every tool argument is schema-validated, and paths are checked against normalized workspace perimeters before execution.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. Supported Tool Categories</h2>
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-paper-100 font-mono text-xs">Filesystem Tools</span>
              <p className="text-[11px] text-ink-muted">
                <code>read_file</code>, <code>write_file</code>, <code>edit_file</code>, <code>list_directory</code>. Strictly bounded to workspace paths.
              </p>
            </div>
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-paper-100 font-mono text-xs">Scaffolding Engine</span>
              <p className="text-[11px] text-ink-muted">
                <code>generate_project_from_prompt</code>. Creates full-stack React+Vite+Express applications with standard configurations in a single pass.
              </p>
            </div>
            <div className="p-4 rounded-xs bg-canvas-surface border border-border space-y-1">
              <span className="font-bold text-paper-100 font-mono text-xs">Document Engine</span>
              <p className="text-[11px] text-ink-muted">
                <code>generate_document</code>. Compiles native <code>.docx</code>, <code>.pptx</code>, <code>.xlsx</code>, <code>.csv</code>, and <code>.pdf</code> files saved directly to <code>public/downloads/</code>.
              </p>
            </div>
          </div>
        </section>

        {/* 4. How */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How Tools are Invoked</h2>
          <p>
            When a Coder sub-agent requires file modifications, it outputs structured JSON tool calls:
          </p>
          <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-paper-100">
            {`{ "tool": "write_file", "params": { "filePath": "src/App.jsx", "content": "..." } }`}
          </div>
          <p className="text-ink-muted text-[11px]">
            The capability policy checks the path, writes the file, and returns a confirmation JSON response to the agent.
          </p>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Document Generation Example</h2>
          <p>Natural language command:</p>
          <div className="p-3.5 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-accent-primary">
            &ldquo;Create a 4-slide presentation on DevOps best practices in PPTX&rdquo;
          </div>
          <p className="text-ink-muted text-[11px]">
            AI-Dost builds structured slide schemas and compiles the file via <code>pptxgenjs v4</code> into <code>/downloads/devops-best-practices.pptx</code>.
          </p>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Tool Limitations</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>File size ceiling: 2MB per read/write operation to prevent memory exhaustion.</li>
            <li>Docker container sandbox tools require local Docker runtime to be active.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Mistakes</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Passing relative paths with leading <code>../</code> which triggers an immediate <code>400 Invalid Path</code> exception.</li>
            <li>Attempting to execute blocking interactive commands (e.g. <code>vim</code> or <code>nano</code>) inside non-interactive terminal tool executions.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
