import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Layers, CheckCircle2, ChevronRight, ChevronLeft,
  X, Plus, Trash2, Rocket, Globe, Palette, Cpu, Target,
  Check, ArrowRight, Loader2, RefreshCw, Sliders
} from 'lucide-react';

const STACK_OPTIONS = {
  frontend: [
    { id: 'React + Vite', label: 'React + Vite', badge: 'Recommended', desc: 'Blazing fast SPA with instant HMR' },
    { id: 'Next.js', label: 'Next.js App Router', badge: 'Full-stack', desc: 'React with SSR, SEO & API routes' },
    { id: 'HTML5 + Tailwind', label: 'Pure HTML5 / JS', badge: 'Lightweight', desc: 'No build step, instant static run' }
  ],
  styling: [
    { id: 'Tailwind CSS', label: 'Tailwind CSS', badge: 'Popular', desc: 'Modern utility-first styling system' },
    { id: 'Dark Glassmorphism CSS', label: 'Dark Glassmorphism', badge: 'Premium', desc: 'Zinc frosted glass & glowing accents' },
    { id: 'Modern Clean CSS', label: 'Clean SaaS CSS', badge: 'Minimal', desc: 'Stripe/Linear inspired minimal UI' }
  ],
  backend: [
    { id: 'Client-Only (localStorage)', label: 'Client-Only (Local)', badge: 'Fastest', desc: 'No backend server required, browser storage' },
    { id: 'Node.js + Express', label: 'Node.js + Express', badge: 'REST API', desc: 'Standard backend server with JSON endpoints' },
    { id: 'Python FastAPI', label: 'Python FastAPI', badge: 'AI/Data', desc: 'High-performance async Python backend' }
  ]
};

const THEME_OPTIONS = [
  { id: 'Dark Zinc / Obsidian', label: 'Dark Obsidian', colors: ['#09090b', '#27272a', '#3b82f6'], desc: 'Deep zinc slate with vibrant blue accents' },
  { id: 'Clean SaaS Minimal', label: 'Clean SaaS Light', colors: ['#ffffff', '#f1f5f9', '#6366f1'], desc: 'Crisp white & slate with indigo highlights' },
  { id: 'Cyberpunk Neon', label: 'Cyberpunk Neon', colors: ['#0a0a14', '#1e1b4b', '#ec4899'], desc: 'Dark synthwave with neon pink & cyan glow' },
  { id: 'Emerald Terminal', label: 'Emerald Hacker', colors: ['#051c14', '#064e3b', '#10b981'], desc: 'Matrix green terminal developer aesthetic' }
];

const AUDIENCE_SUGGESTIONS = ['End Consumers', 'Developers', 'Enterprise Teams', 'Students', 'Creators', 'Small Businesses'];

export default function ProjectWizardModal({ isOpen, initialPrompt = '', onClose, onBuildProject }) {
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Web App');
  const [targetAudience, setTargetAudience] = useState(['End Users']);
  const [newAudienceInput, setNewAudienceInput] = useState('');

  const [features, setFeatures] = useState([]);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [newFeatureDesc, setNewFeatureDesc] = useState('');
  const [showAddFeature, setShowAddFeature] = useState(false);

  const [stack, setStack] = useState({
    frontend: 'React + Vite',
    styling: 'Tailwind CSS',
    backend: 'Client-Only (localStorage)'
  });

  const [theme, setTheme] = useState('Dark Zinc / Obsidian');
  const [customNotes, setCustomNotes] = useState('');

  // Fetch initial smart AI analysis when modal opens with prompt
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);

    if (!initialPrompt.trim()) {
      // Default initial state if prompt is blank
      setProjectName('my-web-app');
      setProjectTitle('Modern Web Application');
      setDescription('An interactive, responsive modern web application.');
      setFeatures([
        { id: 'f1', name: 'Core Application Workflow', desc: 'Main interactive business logic and state management', enabled: true },
        { id: 'f2', name: 'Responsive Layout', desc: 'Mobile and desktop optimized modern viewports', enabled: true },
        { id: 'f3', name: 'Local Persistence', desc: 'Auto-save user state to localStorage', enabled: true },
        { id: 'f4', name: 'Theme & Polish', desc: 'Dark mode styling with smooth micro-interactions', enabled: true }
      ]);
      return;
    }

    let isMounted = true;
    setIsAnalyzing(true);

    fetch('/api/agent/wizard-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt: initialPrompt })
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.success && data.wizardSpec) {
          const s = data.wizardSpec;
          setProjectName(s.projectName || 'custom-app');
          setProjectTitle(s.projectTitle || 'Custom Web Application');
          setDescription(s.description || initialPrompt);
          setCategory(s.category || 'Web App');
          if (Array.isArray(s.targetAudience) && s.targetAudience.length > 0) {
            setTargetAudience(s.targetAudience);
          }
          if (Array.isArray(s.suggestedFeatures) && s.suggestedFeatures.length > 0) {
            setFeatures(s.suggestedFeatures);
          }
          if (s.suggestedStack) {
            setStack(prev => ({
              frontend: s.suggestedStack.frontend || prev.frontend,
              styling: s.suggestedStack.styling || prev.styling,
              backend: s.suggestedStack.backend || prev.backend
            }));
          }
          if (s.suggestedTheme) {
            setTheme(s.suggestedTheme);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsAnalyzing(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const toggleFeature = (id) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const removeFeature = (id) => {
    setFeatures(prev => prev.filter(f => f.id !== id));
  };

  const addCustomFeature = () => {
    if (!newFeatureName.trim()) return;
    setFeatures(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: newFeatureName.trim(),
        desc: newFeatureDesc.trim() || 'Custom user defined requirement',
        enabled: true
      }
    ]);
    setNewFeatureName('');
    setNewFeatureDesc('');
    setShowAddFeature(false);
  };

  const toggleAudience = (aud) => {
    if (targetAudience.includes(aud)) {
      setTargetAudience(prev => prev.filter(a => a !== aud));
    } else {
      setTargetAudience(prev => [...prev, aud]);
    }
  };

  const addCustomAudience = () => {
    if (!newAudienceInput.trim()) return;
    if (!targetAudience.includes(newAudienceInput.trim())) {
      setTargetAudience(prev => [...prev, newAudienceInput.trim()]);
    }
    setNewAudienceInput('');
  };

  const handleStartBuild = () => {
    const pTitle = projectTitle || initialPrompt || 'Modern Web Application';
    const pName = projectName || pTitle.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30) || 'modern-app';
    const config = {
      projectName: pName,
      projectTitle: pTitle,
      description: description || `Responsive modern application for ${pTitle}`,
      category: category || 'Web Application',
      targetAudience: targetAudience.length ? targetAudience : ['Developers', 'Consumers'],
      features: (features.length ? features : [
        { id: 'f1', name: 'Interactive Core Workspace', enabled: true },
        { id: 'f2', name: 'Navigation & Responsive Header', enabled: true },
        { id: 'f3', name: 'Theme & Local State Persistence', enabled: true }
      ]).filter(f => f.enabled !== false),
      stack: stack || { frontend: 'React + Vite', styling: 'Tailwind CSS', backend: 'Client-Only' },
      theme: theme || 'Dark Zinc Obsidian',
      customNotes
    };
    onBuildProject(config);
    onClose();
  };

  const stepsList = [
    { num: 1, label: 'Identity', icon: Target },
    { num: 2, label: 'Features', icon: Layers },
    { num: 3, label: 'Tech Stack', icon: Cpu },
    { num: 4, label: 'Design', icon: Palette },
    { num: 5, label: 'Blueprint', icon: Rocket }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(24, 24, 27, 0.98) 0%, rgba(15, 15, 18, 0.99) 100%)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(59, 130, 246, 0.15)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  Interactive Project Architect
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                    AI Co-Builder
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Clarify requirements & features step-by-step for zero hallucination
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto w-full">
              {stepsList.map((s, idx) => {
                const Icon = s.icon;
                const isActive = step === s.num;
                const isCompleted = step > s.num;
                return (
                  <button
                    key={s.num}
                    onClick={() => setStep(s.num)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : isCompleted
                        ? 'text-emerald-400 hover:bg-white/5'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCompleted ? 'bg-emerald-500 text-black' : isActive ? 'bg-blue-500 text-white' : 'bg-white/10 text-zinc-400'
                    }`}>
                      {isCompleted ? '✓' : s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {isAnalyzing && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>AI is analyzing your prompt and formulating the optimal architectural spec...</span>
              </div>
            )}

            {/* STEP 1: IDENTITY & AUDIENCE */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-1">
                    Step 1: Project Identity & Goals
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Define what this application is and who will be using it.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Project Display Title</label>
                    <input
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="e.g. QuickStore E-Commerce"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-300">Folder / Package Name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                      placeholder="e.g. quickstore-app"
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Core Purpose & Value Proposition</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly explain what the app does..."
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
                  />
                </div>

                {/* Target Audience Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Target Audience</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AUDIENCE_SUGGESTIONS.map((aud) => {
                      const isSelected = targetAudience.includes(aud);
                      return (
                        <button
                          key={aud}
                          type="button"
                          onClick={() => toggleAudience(aud)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white/[0.04] text-zinc-400 border border-white/10 hover:bg-white/[0.08]'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{aud}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: FEATURE SCOPE */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-1">
                      Step 2: Core Features Scope
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Toggle, customize, or add specific features you want built into the project.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddFeature(!showAddFeature)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Feature
                  </button>
                </div>

                {/* Add Feature Inline Form */}
                {showAddFeature && (
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newFeatureName}
                        onChange={(e) => setNewFeatureName(e.target.value)}
                        placeholder="Feature name (e.g. Real-time Search)"
                        className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={newFeatureDesc}
                        onChange={(e) => setNewFeatureDesc(e.target.value)}
                        placeholder="Description (e.g. Instant filter with fuzzy matching)"
                        className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowAddFeature(false)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addCustomFeature}
                        className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500"
                      >
                        Save Feature
                      </button>
                    </div>
                  </div>
                )}

                {/* Features List */}
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {features.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => toggleFeature(f.id)}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        f.enabled
                          ? 'bg-white/[0.04] border-blue-500/30 hover:border-blue-500/50'
                          : 'bg-white/[0.01] border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors ${
                          f.enabled ? 'bg-blue-600 text-white' : 'border border-white/20 text-transparent'
                        }`}>
                          ✓
                        </div>
                        <div>
                          <p className={`text-xs font-medium ${f.enabled ? 'text-white' : 'text-zinc-400'}`}>
                            {f.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFeature(f.id); }}
                        className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                        title="Delete feature"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: TECH STACK */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-1">
                    Step 3: Tech Stack & Architecture
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Choose the framework, styling system, and data layer.
                  </p>
                </div>

                {/* Frontend Framework */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Frontend Framework</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {STACK_OPTIONS.frontend.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStack(s => ({ ...s, frontend: opt.id }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          stack.frontend === opt.id
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                            : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{opt.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Styling System */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Styling & UI Library</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {STACK_OPTIONS.styling.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStack(s => ({ ...s, styling: opt.id }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          stack.styling === opt.id
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                            : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{opt.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Backend / Data Layer */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300">Backend & Persistence Layer</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {STACK_OPTIONS.backend.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStack(s => ({ ...s, backend: opt.id }))}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          stack.backend === opt.id
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                            : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white">{opt.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-mono">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: DESIGN & THEME */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider mb-1">
                    Step 4: Design Theme & Visual Aesthetic
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Select the color palette and UI personality for the generated interface.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        theme === t.id
                          ? 'bg-blue-600/15 border-blue-500 text-white ring-1 ring-blue-500/50'
                          : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-white">{t.label}</span>
                        <div className="flex items-center gap-1.5">
                          {t.colors.map((c, i) => (
                            <span
                              key={i}
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400">{t.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-medium text-zinc-300">Custom Design / Extra Instructions (Optional)</label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. Include a modern hero banner with glowing neon stats cards and floating emojis..."
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            )}

            {/* STEP 5: BLUEPRINT REVIEW */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Step 5: Final Architecture Blueprint
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Review your tailored blueprint before autonomous scaffolding begins.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-zinc-400">Project:</span>
                    <span className="text-white font-bold">{projectTitle} ({projectName})</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-zinc-400">Tech Stack:</span>
                    <span className="text-blue-400">{stack.frontend} + {stack.styling} + {stack.backend}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="text-zinc-400">Theme:</span>
                    <span className="text-purple-400">{theme}</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-zinc-400 block font-sans text-[11px] font-semibold uppercase">
                      Features to be implemented ({features.filter(f => f.enabled).length}):
                    </span>
                    <ul className="list-disc list-inside text-zinc-300 text-[11px] space-y-0.5 font-sans">
                      {features.filter(f => f.enabled).map(f => (
                        <li key={f.id}>{f.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02] shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button
                onClick={handleStartBuild}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all cursor-pointer"
                title="Skip wizard and use AI pre-filled recommendations"
              >
                <Sparkles className="w-3.5 h-3.5" /> Instant Build (AI Defaults)
              </button>
            )}

            <div className="flex items-center gap-2">
              {step < 5 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleStartBuild}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Rocket className="w-4 h-4" /> Start Building Project
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
