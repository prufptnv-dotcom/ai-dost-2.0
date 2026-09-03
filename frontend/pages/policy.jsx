import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { ShieldAlert, CheckCircle2, AlertOctagon, HeartHandshake } from 'lucide-react';

export default function PolicyPage() {
  return (
    <PublicLayout
      title="Responsible AI & Platform Policy — AI-Dost"
      description="Guidelines for ethical, safe, and lawful usage of the AI-Dost autonomous developer workspace."
    >
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <ShieldAlert className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Safety & Governance</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            Responsible <span className="gemini-gradient-text">AI Policy</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            AI-Dost equips developers with powerful autonomous planning and execution tools. We require all users to adhere to fundamental safety principles.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 font-sans text-xs text-paper-200 leading-relaxed">
          <div className="space-y-3 pb-6 border-b border-border-subtle">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-accent-primary" /> 1. Guiding Safety Principles
            </h2>
            <p>
              AI-Dost is designed to amplify human creativity, accelerate software development, and make programming accessible. We reject the use of autonomous agents to harm individuals, compromise digital infrastructure, or mislead users.
            </p>
          </div>

          <div className="space-y-3 pb-6 border-b border-border-subtle">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-signal-error" /> 2. Prohibited Exploitation & Abuse
            </h2>
            <p>The autonomous agent must never be instructed or configured to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-ink-muted">
              <li><strong>Cyberattacks:</strong> Author, obfuscate, or deploy malicious software, viruses, rootkits, credential harvesters, or keyloggers.</li>
              <li><strong>Unauthorized Intrusion:</strong> Conduct automated port scanning, penetration testing, or exploit delivery against systems without explicit written consent from the target system owner.</li>
              <li><strong>Deception & Fraud:</strong> Generate deceptive impersonation material, phishing emails, financial scams, or fabricated evidence intended to mislead legal or financial authorities.</li>
              <li><strong>Harassment & Disinformation:</strong> Automate coordinated harassment campaigns, hate speech dissemination, or mass fake account manipulation.</li>
            </ul>
          </div>

          <div className="space-y-3 pb-6 border-b border-border-subtle">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent-primary" /> 3. Built-In Guardrails
            </h2>
            <p>
              AI-Dost enforces technical guardrails directly within its autonomous supervisor:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-ink-muted">
              <li>File edits outside normalized project boundaries are blocked with path traversal exceptions.</li>
              <li>Root shell escalations and raw destructive filesystem wipes are rejected.</li>
              <li>Underlying model cascades inherit safety filters from Gemini, Groq, and upstream providers.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100">4. Reporting Violations</h2>
            <p className="text-ink-muted">
              If you witness misuse of the AI-Dost platform or identify a safety bypass, please file a report via our <Link href="/support" className="text-accent-primary hover:underline">Support Hub</Link> or open a private issue on our official GitHub repository.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
