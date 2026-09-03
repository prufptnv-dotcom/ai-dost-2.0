import React from 'react';
import { DocsLayout } from '../../components/public/DocsLayout';
import { FolderGit2, Database, GitBranch } from 'lucide-react';

export default function ProjectsDoc() {
  return (
    <DocsLayout
      title="Workspaces & Persistence"
      category="Autonomous Engine"
      description="How AI-Dost manages isolated project filetrees, SQLite persistence, and offline git checkpoint rollbacks."
    >
      <div className="space-y-8">
        {/* 1. What */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">1. What is an AI-Dost Workspace?</h2>
          <p>
            An AI-Dost workspace is an isolated directory on your local filesystem paired with a record in the local SQLite database. It serves as the physical boundary inside which the autonomous agent creates files, runs commands, and installs dependencies.
          </p>
        </section>

        {/* 2. Why */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">2. Why Workspace Isolation?</h2>
          <p>
            Workspace isolation guarantees safety and reproducibility. The agent cannot accidentally overwrite operating system files or touch other repositories on your machine. Furthermore, each workspace has its own local <code>.git</code> repository for granular checkpoint rollbacks.
          </p>
        </section>

        {/* 3. When */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">3. When are Workspaces Created?</h2>
          <p>
            A workspace is created when you:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Instruct the chat agent to build a new application from scratch.</li>
            <li>Click &ldquo;New Project&rdquo; in the Projects view dashboard.</li>
            <li>Clone an existing local repository into the AI-Dost workspace directory.</li>
          </ul>
        </section>

        {/* 4. How */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">4. How Git Checkpoints Work</h2>
          <p>
            Every time the autonomous agent completes an execution pass or fixes a defect, it creates a local git commit with a descriptive message (e.g. <code>fix: resolve auth middleware error</code>).
          </p>
          <p className="text-ink-muted">
            You can view this commit timeline in the IDE Git panel and rollback to any previous version with a single click—no remote GitHub connection required.
          </p>
        </section>

        {/* 5. Example */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">5. Workspace Directory Layout</h2>
          <div className="p-4 rounded-xs bg-canvas-surface border border-border font-mono text-[11px] text-ink-muted space-y-1">
            <div className="text-paper-100 font-bold">workspaces/my-portfolio-app/</div>
            <div>├── .git/                 # 100% offline git repository</div>
            <div>├── package.json          # Node dependencies</div>
            <div>├── src/                  # React components & styles</div>
            <div>├── public/               # Static assets & icons</div>
            <div>└── vite.config.js        # Bundler configuration</div>
          </div>
        </section>

        {/* 6. Limitations */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">6. Workspace Limitations</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Workspaces reside on your local machine; sharing workspaces across devices requires manual git push to a remote repository.</li>
            <li>Deleting a project removes its workspace files and database entry permanently after confirmation.</li>
          </ul>
        </section>

        {/* 7. Common Mistakes */}
        <section className="space-y-2">
          <h2 className="text-sm font-bold font-display text-paper-100 uppercase tracking-wider">7. Common Mistakes</h2>
          <ul className="list-disc pl-5 space-y-1 text-ink-muted">
            <li>Moving the workspace folder manually on disk while the server is active without updating the database path.</li>
            <li>Attempting to commit files larger than 50MB into the local git repository.</li>
          </ul>
        </section>
      </div>
    </DocsLayout>
  );
}
