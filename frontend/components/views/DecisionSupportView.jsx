import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Sparkles, Copy, Check, CheckCircle2, AlertTriangle,
  ArrowRight, RotateCcw, Loader2, Layers, Cpu, Cloud, Database,
  GraduationCap, Briefcase, BookOpen, DollarSign, Target, Code2
} from 'lucide-react';
import axios from 'axios';

const DOMAINS = [
  { id: 'laptop-selection', name: 'Laptop Selection', icon: Cpu, category: 'Hardware', desc: 'Hardware specs, thermals, battery & budget' },
  { id: 'course-selection', name: 'Course Selection', icon: GraduationCap, category: 'Education', desc: 'Real career ROI, syllabus depth & projects' },
  { id: 'tech-stack', name: 'Project Tech Stack', icon: Layers, category: 'Engineering', desc: 'Velocity, ecosystem, hiring & scaling limits' },
  { id: 'cloud-provider', name: 'Cloud Provider', icon: Cloud, category: 'Infrastructure', desc: 'AWS vs GCP vs Azure vs Cloudflare vs Hetzner' },
  { id: 'database-selection', name: 'Database Architecture', icon: Database, category: 'Data', desc: 'PostgreSQL vs Mongo vs Redis vs ClickHouse' },
  { id: 'framework-selection', name: 'Framework Selection', icon: Code2, category: 'Software', desc: 'React/Vite vs Next.js vs Astro vs SvelteKit' },
  { id: 'career-options', name: 'Career Path Options', icon: Briefcase, category: 'Career', desc: 'AI Engineer vs Full-Stack vs Data Science' },
  { id: 'study-priorities', name: 'Study Priorities', icon: BookOpen, category: 'Academics', desc: 'High-yield topics & Eisenhower urgency' },
  { id: 'budget-planning', name: 'Budget Allocation', icon: DollarSign, category: 'Finance', desc: 'Capex vs Opex, payback period & ROI' },
  { id: 'feature-prioritization', name: 'Feature Prioritization', icon: Target, category: 'Product', desc: 'RICE scoring & MoSCoW roadmap matrix' }
];

const PRESET_DECISIONS = [
  { domain: 'laptop-selection', options: 'MacBook Air M3 (16GB) vs ThinkPad E14 Gen 5 vs Asus Vivobook 16X', goal: 'Software engineering, Docker & web dev', budget: '₹85,000 - ₹1,10,000' },
  { domain: 'tech-stack', options: 'Next.js + PostgreSQL + Tailwind vs Vite/React + Express + Mongo', goal: 'SaaS MVP launch in 4 weeks', budget: 'Zero cost on free tiers' },
  { domain: 'cloud-provider', options: 'AWS (ECS/RDS) vs Hetzner Bare Metal vs DigitalOcean Droplets', goal: 'Backend hosting with predictable costs', budget: '$50/month' },
  { domain: 'database-selection', options: 'PostgreSQL (with pgvector) vs MongoDB Atlas vs Supabase', goal: 'Multi-tenant AI web application', budget: 'Production scale' },
  { domain: 'framework-selection', options: 'Next.js 15 (App Router) vs Vite + TanStack Router vs Astro 4', goal: 'High-SEO content & dashboard platform', budget: 'Solo developer' },
  { domain: 'career-options', options: 'Generative AI / LLM Engineer vs Full-Stack Cloud Engineer', goal: 'Maximum 5-year career longevity & compensation', budget: '3 years dev experience' }
];

export default function DecisionSupportView({ onToast }) {
  const [selectedDomain, setSelectedDomain] = useState('tech-stack');
  const [optionsInput, setOptionsInput] = useState('Next.js + PostgreSQL vs Vite/React + Express + MongoDB');
  const [primaryGoal, setPrimaryGoal] = useState('Fastest MVP launch with long-term scaling');
  const [budgetConstraints, setBudgetConstraints] = useState('Free-tier friendly, minimal DevOps overhead');
  const [userContext, setUserContext] = useState('Solo founder / Indie hacker building a SaaS');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [copied, setCopied] = useState(false);

  // RICE Calculator state
  const [riceOpen, setRiceOpen] = useState(false);
  const [riceFeatures, setRiceFeatures] = useState([
    { name: 'AI Chat Streaming', reach: 500, impact: 3, confidence: 90, effort: 1 },
    { name: 'Dark Mode Switcher', reach: 1000, impact: 1, confidence: 95, effort: 0.5 },
    { name: 'Native PDF Export', reach: 300, impact: 2, confidence: 80, effort: 2 },
    { name: 'OAuth Multi-provider', reach: 400, impact: 2, confidence: 85, effort: 1.5 }
  ]);
  const [rankedRice, setRankedRice] = useState(null);

  const activeDomainConfig = DOMAINS.find(d => d.id === selectedDomain) || DOMAINS[0];

  const handleAnalyze = async (e) => {
    e?.preventDefault();
    if (!optionsInput.trim()) {
      onToast?.('Please enter candidate options to compare', 'warning');
      return;
    }

    setLoading(true);
    try {
      const optionsArr = optionsInput.split(/vs|,|\//i).map(s => s.trim()).filter(Boolean);
      const res = await axios.post('/api/decision/analyze', {
        domain: selectedDomain,
        options: optionsArr,
        primaryGoal,
        budget: budgetConstraints,
        constraints: budgetConstraints,
        userContext
      });

      if (res.data?.success) {
        setAnalysisResult(res.data.analysis);
        onToast?.(`${activeDomainConfig.name} decision matrix generated!`, 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateRice = async () => {
    try {
      const res = await axios.post('/api/decision/rice', { features: riceFeatures });
      if (res.data?.success) {
        setRankedRice(res.data.rankedFeatures);
        onToast?.('RICE Prioritization calculated!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    onToast?.('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset) => {
    setSelectedDomain(preset.domain);
    setOptionsInput(preset.options);
    setPrimaryGoal(preset.goal);
    setBudgetConstraints(preset.budget);
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base text-text-primary overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-paper-100">Problem Solving & Decision Support</h1>
              <p className="text-xs md:text-sm text-ink-muted">
                Structured Multi-Criteria Decision Analysis (MCDA), trade-off evaluation & RICE scoring
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRiceOpen(!riceOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              riceOpen
                ? 'bg-teal-500/20 border-teal-500 text-teal-700 dark:text-teal-300'
                : 'bg-canvas-subtle border-border-subtle text-paper-200 hover:text-paper-100'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>RICE Calculator</span>
          </button>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            Category 16 • Decision Matrix
          </span>
        </div>
      </div>

      {/* Domain Grid (10 Domains) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {DOMAINS.map((d) => {
          const Icon = d.icon;
          const active = selectedDomain === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDomain(d.id)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                active
                  ? 'bg-teal-600/15 border-teal-500 text-teal-300 shadow-sm shadow-teal-500/10'
                  : 'bg-canvas-subtle/50 border-border-subtle hover:border-border-default text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className={`w-4 h-4 ${active ? 'text-teal-400' : 'text-text-tertiary'}`} />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-base border border-border-subtle font-mono text-text-tertiary">
                  {d.category}
                </span>
              </div>
              <span className="text-xs font-semibold mb-0.5">{d.name}</span>
              <span className="text-[10px] text-text-tertiary line-clamp-1">{d.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-text-tertiary whitespace-nowrap flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" /> Presets:
        </span>
        {PRESET_DECISIONS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => applyPreset(p)}
            className="px-2.5 py-1 rounded-full bg-canvas-subtle border border-border-subtle hover:border-teal-500/40 text-text-secondary hover:text-teal-300 transition-colors whitespace-nowrap"
          >
            {p.options.slice(0, 30)}...
          </button>
        ))}
      </div>

      {/* Optional RICE Calculator Panel */}
      <AnimatePresence>
        {riceOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-canvas-subtle/80 backdrop-blur-md rounded-2xl border border-teal-500/30 p-5 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                  <Target className="w-4 h-4" /> RICE Feature Prioritization Matrix
                </h3>
                <p className="text-[11px] text-text-secondary">
                  Score = (Reach × Impact × Confidence%) ÷ Effort (Person-weeks)
                </p>
              </div>
              <button
                onClick={handleCalculateRice}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition-colors"
              >
                Calculate Rankings
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-secondary">Input Features:</span>
                {riceFeatures.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-canvas-base p-2 rounded-lg border border-border-subtle">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => {
                        const copy = [...riceFeatures];
                        copy[idx].name = e.target.value;
                        setRiceFeatures(copy);
                      }}
                      className="flex-1 bg-transparent border-0 focus:outline-none font-medium"
                    />
                    <span className="text-[10px] text-text-tertiary">Reach: {f.reach}</span>
                    <span className="text-[10px] text-text-tertiary">Effort: {f.effort}w</span>
                  </div>
                ))}
              </div>

              <div>
                <span className="text-xs font-semibold text-text-secondary mb-2 block">Prioritized Ranking:</span>
                {rankedRice ? (
                  <div className="space-y-1.5">
                    {rankedRice.map((rf, i) => (
                      <div key={rf.id} className="flex items-center justify-between p-2 rounded-lg bg-canvas-base border border-border-subtle text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-[10px]">
                            #{i + 1}
                          </span>
                          <span className="font-semibold">{rf.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-canvas-subtle border border-border-subtle font-bold text-teal-400">
                            Score: {rf.riceScore}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            rf.moscow === 'Must Have' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-canvas-subtle text-text-tertiary'
                          }`}>
                            {rf.moscow}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-text-tertiary bg-canvas-base/50 rounded-lg border border-dashed border-border-subtle">
                    Click &quot;Calculate Rankings&quot; to evaluate features
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Form & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Column: Criteria Form */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col space-y-4 flex-1">
            <div className="border-b border-border-subtle pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  {activeDomainConfig.name}
                </span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  {activeDomainConfig.category}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1">{activeDomainConfig.description}</p>
            </div>

            {/* Candidates Input */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Candidate Options to Compare:
              </label>
              <textarea
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
                placeholder="Option A vs Option B vs Option C (e.g. Next.js vs Vite, M3 Air vs ThinkPad...)"
                rows={2}
                className="w-full bg-canvas-base border border-border-subtle rounded-xl p-2.5 text-xs focus:outline-none focus:border-teal-500/60 font-sans"
              />
            </div>

            {/* Primary Goal */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Primary Goal / Outcome:
              </label>
              <input
                type="text"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                placeholder="e.g. Fastest speed, longest battery life, minimal cost..."
                className="w-full bg-canvas-base border border-border-subtle rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500/60"
              />
            </div>

            {/* Budget & Constraints */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Budget / Hard Constraints:
              </label>
              <input
                type="text"
                value={budgetConstraints}
                onChange={(e) => setBudgetConstraints(e.target.value)}
                placeholder="e.g. Under ₹90,000, 100ms max latency, Solo team..."
                className="w-full bg-canvas-base border border-border-subtle rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500/60"
              />
            </div>

            {/* User Context */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Your Context / Background:
              </label>
              <input
                type="text"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="e.g. Student, Senior Architect, Freelancer, Early-stage startup..."
                className="w-full bg-canvas-base border border-border-subtle rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500/60"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !optionsInput.trim()}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all cursor-pointer mt-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Decision Matrix & Trade-offs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Scientific Decision Matrix</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output & Verdict */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-canvas-subtle/60 backdrop-blur-md rounded-2xl border border-border-subtle p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  MCDA Evaluation & Recommendation
                </h3>
              </div>

              {analysisResult && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-canvas-base border border-border-subtle hover:border-teal-500/50 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {/* Output Body */}
            <div className="flex-1 bg-canvas-base rounded-xl border border-border-subtle p-4 overflow-y-auto max-h-[540px]">
              {loading ? (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-text-tertiary space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
                  <p className="text-xs">Computing weighted scores across 5 criteria & gotchas...</p>
                </div>
              ) : analysisResult ? (
                <div className="prose prose-invert prose-xs max-w-none text-text-primary leading-relaxed text-xs">
                  <pre className="whitespace-pre-wrap font-sans bg-transparent border-0 p-0 text-text-primary">
                    {analysisResult}
                  </pre>
                </div>
              ) : (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-text-tertiary text-center p-6 space-y-2">
                  <Scale className="w-8 h-8 text-text-tertiary/40" />
                  <p className="text-xs font-medium text-text-secondary">Ready for Multi-Criteria Analysis</p>
                  <p className="text-[11px] max-w-sm text-text-tertiary">
                    Select a domain above (e.g. Laptop, Tech Stack, Cloud, Database), enter candidates, and generate a weighted score matrix with reversible vs irreversible gotchas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
