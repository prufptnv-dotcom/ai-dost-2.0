import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { Shield, Database, Lock, EyeOff, CheckCircle2 } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <PublicLayout
      title="Privacy Policy — AI-Dost Autonomous AI Workspace"
      description="Transparent, developer-first privacy policy: local data residency, zero third-party telemetry, credential safety, and local SQLite data control."
    >
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <Shield className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Data Transparency</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            Privacy by <span className="gemini-gradient-text">Architecture</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            AI-Dost is built on a simple premise: your code, your prompts, and your workspace files belong exclusively to you. Here is how your data is treated.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 font-sans text-xs text-paper-200 leading-relaxed">
          {/* Section 1 */}
          <div className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-[#4893fc]" /> 1. Information Storage & Residency
            </h2>
            <p>
              AI-Dost operates primarily as a local application running on your workstation. All multi-turn conversation logs, project files, agent execution traces, and generated artifacts are stored locally in an embedded SQLite database (<code>backend/data/aidost.db</code>) on your local filesystem.
            </p>
            <p className="text-ink-muted">
              AI-Dost does not operate central user tracking databases, behavioral analytics beacons, or advertising telemetry.
            </p>
          </div>

          {/* Section 2 */}
          <div className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#9b72cb]" /> 2. API Keys and Credentials
            </h2>
            <p>
              When you supply third-party API credentials (such as Google Gemini, Groq, or Tavily keys), these keys are stored either in your machine&apos;s local <code>.env</code> file or in your browser&apos;s <code>localStorage</code>.
            </p>
            <p>
              These credentials are never sent to AI-Dost maintainers or third-party analytical services. They are transmitted solely to the respective official model endpoints (e.g. <code>generativelanguage.googleapis.com</code> or <code>api.groq.com</code>) to fulfill inference requests requested by you.
            </p>
          </div>

          {/* Section 3 */}
          <div className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[#d96570]" /> 3. Third-Party Model Providers
            </h2>
            <p>
              When you submit prompts using cloud-hosted inference models, your input text and relevant workspace context are processed by that model&apos;s provider under their designated API terms:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-ink-muted">
              <li><strong>Google Gemini:</strong> Processed per Google Generative AI terms. Commercial API tier does not use inputs to train models.</li>
              <li><strong>Groq:</strong> Processed through high-speed LPU inference per GroqCloud privacy terms.</li>
              <li><strong>Local Ollama:</strong> 100% offline. Zero bytes leave your physical computer.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="space-y-3 pb-8 border-b border-border-subtle">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-primary" /> 4. Data Retention & Deletion
            </h2>
            <p>
              Because your data is stored locally, you maintain complete, immediate control over retention and deletion:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-ink-muted">
              <li>You can clear all recorded chat sessions at any time via the History view.</li>
              <li>You can delete individual project workspaces and files directly from the Projects view.</li>
              <li>Deleting the local <code>backend/data/aidost.db</code> file permanently erases all stored records.</li>
            </ul>
          </div>

          {/* Section 5 */}
          <div className="space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100">5. Questions & Updates</h2>
            <p className="text-ink-muted">
              As AI-Dost is an open-source autonomous project, this privacy policy is updated when new architectural capabilities (such as optional multi-tenant cloud profiles) are added. If you have questions regarding data handling, please refer to the project documentation or open an issue on the repository.
            </p>
            <p className="text-[11px] font-mono text-ink-muted">
              Last updated: September 2026 • Legal status: Open-Source Project Policy Scaffolding
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
