import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Terminal, CheckCircle2, Play, ArrowRight,
  Code2, Bug, FileSpreadsheet, Cpu, RefreshCw
} from 'lucide-react';

const DEMO_PRESETS = [
  {
    id: 'fullstack',
    category: 'Full-Stack App',
    icon: Code2,
    prompt: 'Build a full-stack real-time collaboration board with React, Tailwind, and Express.',
    outcome: 'React 19 + Express App',
    steps: [
      'Extracting workspace intent & target stack: React + Vite + Express',
      'Formulating 5-phase execution DAG & dependency graphs',
      'Scaffolding 17 components, state stores, and backend endpoints',
      'Running automated Jest test suites & Playwright vision inspection',
      'All 24 test assertions passed. Dev server ready on :3000',
    ],
  },
  {
    id: 'debug',
    category: 'Self-Healing Repair',
    icon: Bug,
    prompt: 'Fix the memory leak and race condition in the WebSocket terminal stream.',
    outcome: 'Root Cause Isolated & Repaired',
    steps: [
      'Analyzing terminal process tree and unhandled event listeners',
      'Isolated leak: WebSocket heartbeat interval unref() missing',
      'Applying surgical diff to backend/sandbox/wsServer.js',
      'Executing unit & integration suites in isolated test runner',
      'Verified: 0 handle leaks detected. Auto-rollback guard released',
    ],
  },
  {
    id: 'docs',
    category: 'Document Synthesis',
    icon: FileSpreadsheet,
    prompt: 'Generate an executive Q3 product strategy presentation in PowerPoint and Excel.',
    outcome: 'Native PPTX & XLSX Delivered',
    steps: [
      'Parsing corporate roadmap metrics and growth projections',
      'Synthesizing multi-slide executive deck using pptxgenjs engine',
      'Generating styled multi-column financial sheets via openpyxl',
      'Exporting verified artifacts to frontend/public/downloads/',
      'Downloads generated: Q3_Strategy.pptx & Financial_Model.xlsx',
    ],
  },
  {
    id: 'agent',
    category: 'Autonomous Multi-Step',
    icon: Cpu,
    prompt: 'Audit all 22 frontend view components and harmonize design tokens.',
    outcome: 'Multi-File Token Harmonization',
    steps: [
      'Scanning AST across 45 frontend component files',
      'Identifying hardcoded color values and non-standard spacing',
      'Refactoring styles to semantic CSS design system tokens',
      'Running automated test suite (116/116 tests passing)',
      'Autonomous changeset validated with zero visual regressions',
    ],
  },
];

export function GeminiInteractivePromptDemo() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [completedSteps, setCompletedSteps] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  const activePreset = DEMO_PRESETS[activeIdx];
  const typingTimerRef = useRef(null);
  const stepTimerRef = useRef(null);

  useEffect(() => {
    // Reset state for new preset
    setTypedText('');
    setCompletedSteps(0);
    setIsTyping(true);

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);

    const fullPrompt = activePreset.prompt;
    let charIdx = 0;

    // Simulate character typing
    typingTimerRef.current = setInterval(() => {
      if (charIdx < fullPrompt.length) {
        setTypedText(fullPrompt.slice(0, charIdx + 1));
        charIdx++;
      } else {
        clearInterval(typingTimerRef.current);
        setIsTyping(false);

        // Start revealing agent steps
        let step = 0;
        stepTimerRef.current = setInterval(() => {
          step++;
          setCompletedSteps(step);
          if (step >= activePreset.steps.length) {
            clearInterval(stepTimerRef.current);
          }
        }, 650);
      }
    }, 28);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [activeIdx, activePreset.prompt, activePreset.steps.length]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Category Pills Slider */}
      <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
        {DEMO_PRESETS.map((preset, idx) => {
          const Icon = preset.icon;
          const isActive = idx === activeIdx;
          return (
            <button
              key={preset.id}
              onClick={() => setActiveIdx(idx)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-[#4285f4]/20 via-[#9b72cb]/20 to-[#d96570]/20 text-paper-100 font-semibold border border-[#4893fc]/50 shadow-[0_0_20px_rgba(66,133,244,0.3)] scale-[1.02]'
                  : 'bg-canvas-surface text-ink-muted border border-border hover:border-border-strong hover:text-paper-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#4893fc]' : 'text-ink-muted'}`} />
              <span>{preset.category}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Terminal Demo Card */}
      <div className="gemini-glow-card border border-border p-6 sm:p-8 space-y-6">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            </div>
            <span className="text-[11px] font-mono text-ink-muted pl-2">ai-dost autonomous agent simulator</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-[#4893fc]/10 text-[#4893fc] border border-[#4893fc]/30 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 gemini-sparkle-icon" />
              <span>Live Engine</span>
            </span>
          </div>
        </div>

        {/* User Prompt Input Simulator */}
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
            <span className="text-[#4893fc] font-bold">User Input</span>
            <span>(Natural Language Prompt)</span>
          </div>
          <div className="p-4 rounded-xl bg-canvas-base border border-border font-mono text-xs sm:text-sm text-paper-100 min-h-[52px] flex items-center">
            <span className="text-[#4893fc] mr-2">❯</span>
            <span>{typedText}</span>
            {isTyping && <span className="gemini-cursor-blink" />}
          </div>
        </div>

        {/* Autonomous Execution Stream */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
            <span className="uppercase tracking-wider text-[#9b72cb] font-bold">Autonomous Execution Pipeline</span>
            <span>Outcome: <strong className="text-paper-100 font-sans">{activePreset.outcome}</strong></span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {activePreset.steps.map((step, idx) => {
              const isRevealed = idx < completedSteps;
              const isCurrent = idx === completedSteps && !isTyping;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all duration-300 ${
                    isRevealed
                      ? 'bg-white/[0.02] border-white/10 text-paper-100 opacity-100 translate-x-0'
                      : isCurrent
                      ? 'bg-[#4893fc]/5 border-[#4893fc]/30 text-[#4893fc] opacity-100'
                      : 'opacity-0 -translate-y-2 pointer-events-none'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isRevealed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00b95c]" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-3.5 h-3.5 text-[#4893fc] animate-spin" />
                    ) : (
                      <span className="w-3.5 h-3.5 block rounded-full border border-white/20" />
                    )}
                  </div>
                  <span className="leading-relaxed">
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeminiInteractivePromptDemo;
