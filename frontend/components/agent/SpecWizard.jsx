'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Pen,
  Trash2,
  RotateCcw,
  Save,
  ArrowUpRight,
  MessageSquare,
  Layout,
  Zap,
  Palette,
  Shield,
  Settings,
  X,
  Check,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

const FIELD_TYPES = {
  text: 'text',
  textarea: 'textarea',
  select: 'select',
  multiselect: 'multiselect',
  boolean: 'boolean',
};

function Field({ field, value, onChange, suggestions, disabled }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue) => {
    setLocalValue(newValue);
    onChange(field.key, newValue);
  };

  if (field.type === FIELD_TYPES.boolean) {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={localValue || false}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-2"
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{field.label}</span>
      </label>
    );
  }

  if (field.type === FIELD_TYPES.select) {
    return (
      <div className="relative">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{field.label}</label>
        <select
          value={localValue || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-xl bg-transparent border focus:outline-none focus:ring-2 transition-all text-sm appearance-none pr-10"
          style={{
            borderColor: 'var(--color-border)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="" disabled>Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
      </div>
    );
  }

  if (field.type === FIELD_TYPES.multiselect) {
    const selected = Array.isArray(localValue) ? localValue : [];
    const allOptions = [...new Set([...(field.options || []), ...selected])];

    return (
      <div className="relative">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          {field.label} <span className="font-normal opacity-60">({selected.length})</span>
        </label>
        <div
          className="flex flex-wrap gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border transition-all"
          style={{
            borderColor: 'var(--color-border)',
            background: 'rgba(255,255,255,0.03)',
          }}
          onClick={() => inputRef.current?.focus()}
        >
          {selected.map((item) => (
            <span key={item} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
              {item}
              <button type="button" onClick={(e) => { e.stopPropagation(); handleChange(selected.filter(s => s !== item)); }} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/20">×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            placeholder={selected.length ? '' : field.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                handleChange([...selected, e.target.value.trim()]);
                e.target.value = '';
              }
              if (e.key === 'Backspace' && !e.target.value && selected.length) {
                handleChange(selected.slice(0, -1));
              }
            }}
            onChange={(e) => {}}
            disabled={disabled}
            className="flex-1 min-w-[120px] bg-transparent border-0 focus:outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>
        {allOptions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {allOptions.filter(opt => !selected.includes(opt)).slice(0, 12).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleChange([...selected, opt])}
                disabled={disabled}
                className="px-2 py-1 rounded-lg text-xs transition-all cursor-pointer border"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                + {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === FIELD_TYPES.textarea) {
    return (
      <div className="relative">
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{field.label}</label>
        <textarea
          value={localValue || ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-transparent border focus:outline-none focus:ring-2 transition-all text-sm resize-none"
          style={{
            borderColor: 'var(--color-border)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{field.label}</label>
      <input
        type="text"
        value={localValue || ''}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
        disabled={disabled}
        placeholder={field.placeholder}
        className="w-full px-3 py-2 rounded-xl bg-transparent border focus:outline-none focus:ring-2 transition-all text-sm"
        style={{
          borderColor: 'var(--color-border)',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--color-text-primary)',
        }}
      />
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-xl border shadow-lg" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { handleChange(s); setShowSuggestions(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepProgress({ currentStep, totalSteps, stepTitles }) {
  return (
    <div className="flex items-center justify-between mb-6">
      {stepTitles.map((title, idx) => (
        <React.Fragment key={idx}>
          <div className="flex flex-col items-center">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs transition-all"
              style={{
                background: idx < currentStep ? 'var(--gradient-primary)' : idx === currentStep ? 'var(--color-primary)' : 'var(--color-border)',
                color: idx <= currentStep ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </div>
            <span className="text-[10px] mt-1 text-center max-w-[70px] leading-tight" style={{ color: idx <= currentStep ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
              {title}
            </span>
          </div>
          {idx < totalSteps - 1 && (
            <div className="flex-1 h-1.5 mx-1 rounded transition-all" style={{ background: idx < currentStep ? 'var(--gradient-primary)' : 'var(--color-border)' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function SpecWizard({ BACKEND, onToast, onSpecComplete, initialIntent, initialAnswers }) {
  const [phase, setPhase] = useState('loading');
  const [specId, setSpecId] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepData] = useState({});
  const [stepInfo, setStepInfo] = useState(null);
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const scrollRef = useRef(null);

  const stepTitles = ['Overview', 'Features', 'Tech', 'Design', 'Constraints'];

  const startWizard = useCallback(async (intent) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/agent/spec/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, previousAnswers: initialAnswers || {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start spec');
      setSpecId(data.specId);
      setSpec(data.spec);
      setStepInfo(data.step || null);
      setCurrentStepIndex(data.step?.stepNumber ? data.step.stepNumber - 1 : 0);
      setStepData(data.step?.fields?.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {}) || {});
      setPhase('wizard');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    } finally {
      setLoading(false);
    }
  }, [BACKEND, initialAnswers]);

  useEffect(() => {
    if (phase === 'loading') {
      startWizard(initialIntent || 'Modern Full-Stack Web Application');
    }
  }, [initialIntent, phase, startWizard]);

  const handleFieldChange = useCallback((key, value) => {
    setStepData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleNext = async () => {
    if (!specId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/agent/spec/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId, stepIndex: currentStepIndex, answers: stepData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit step');

      setAnswers(prev => ({ ...prev, ...stepData }));

      if (data.done) {
        setSpec(data.spec);
        setPhase('review');
      } else {
        if (data.step) setStepInfo(data.step);
        setCurrentStepIndex(data.step?.stepNumber ? data.step.stepNumber - 1 : currentStepIndex + 1);
        setStepData(data.step?.fields ? data.step.fields.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {}) : {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleApprove = async () => {
    if (!specId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/agent/spec/${specId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve spec');
      onSpecComplete?.(data.spec, data.plan);
      onToast?.('Spec approved! Starting build...', 'success');
    } catch (e) {
      setError(e.message);
      onToast?.(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (stepId) => {
    const guidance = prompt(`What changes would you like for ${stepId}? (e.g. "simpler", "more features", "dark theme")`);
    if (!guidance) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/agent/spec/${specId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, guidance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate');
      if (data.suggestions?.fields) {
        setStepData(prev => ({ ...prev, ...data.suggestions.fields }));
        onToast?.('Suggestions updated!', 'success');
      }
    } catch (e) {
      onToast?.(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!specId) return;
    try {
      const allData = {};
      SPEC_STEPS.forEach(step => {
        if (spec.steps[step.id]) allData[step.id] = spec.steps[step.id].data;
      });
      localStorage.setItem(`spec_draft_${specId}`, JSON.stringify(allData));
      onToast?.('Draft saved locally', 'success');
    } catch (e) {
      onToast?.('Failed to save draft', 'error');
    }
  };

  const loadDraft = () => {
    if (!specId) return;
    try {
      const draft = localStorage.getItem(`spec_draft_${specId}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        setAnswers(parsed);
        onToast?.('Draft loaded', 'success');
      }
    } catch (e) {
      onToast?.('Failed to load draft', 'error');
    }
  };

  if (phase === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Analyzing your idea...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-12 h-12" style={{ color: 'var(--color-error)' }} />
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Something went wrong</h3>
        <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <button onClick={() => { setPhase('loading'); startWizard(initialIntent); }} className="px-4 py-2 rounded-xl" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>Retry</button>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="h-full flex flex-col" ref={scrollRef}>
        <div className="flex-1 overflow-y-auto max-w-3xl mx-auto px-6 py-6 space-y-5 w-full">
          <div className="rounded-2xl p-4" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>All steps complete! Review your spec below.</span>
            </div>
          </div>

          <div className="space-y-4">
            {SPEC_STEPS.map((stepDef) => {
              const step = spec.steps[stepDef.id];
              if (!step) return null;
              return (
                <div key={stepDef.id} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{step.title}</h4>
                    <button onClick={() => handleRegenerate(step.id)} className="px-2 py-1 rounded-lg text-xs transition-all cursor-pointer" style={{ background: 'rgba(75,139,252,0.1)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                      <RotateCcw className="w-3 h-3 inline mr-1" /> Regenerate
                    </button>
                  </div>
                  <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {Object.entries(step.data).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium w-32 shrink-0">{key}:</span>
                        <span className="break-all">{Array.isArray(value) ? value.join(', ') : value || '<em>Not set</em>'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={() => setPhase('wizard')} className="flex-1 px-4 py-2.5 rounded-xl border cursor-pointer transition-all" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)' }}>
              <ChevronLeft className="w-4 h-4 inline mr-1" /> Back to Edit
            </button>
            <button onClick={handleApprove} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl font-bold cursor-pointer transition-all flex items-center justify-center gap-2" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
              <Zap className="w-4 h-4" /> {loading ? 'Building...' : 'Build Now'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStepDef = SPEC_STEPS[currentStepIndex];
  const currentStep = spec?.steps?.[currentStepDef?.id];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <StepProgress currentStep={currentStepIndex} totalSteps={SPEC_STEPS.length} stepTitles={stepTitles} />
      </div>

      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto px-6 py-6 space-y-5 w-full" ref={scrollRef}>
        {(stepInfo || currentStepDef) && (
          <div className="space-y-5">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(75,139,252,0.06)', border: '1px solid rgba(75,139,252,0.25)' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>Step {currentStepIndex + 1} of {SPEC_STEPS.length}: {stepInfo?.title || currentStepDef?.title}</span>
              </div>
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {(stepInfo?.id || currentStepDef?.id) === 'overview' && 'Tell us about your project — AI will suggest smart defaults.'}
                {(stepInfo?.id || currentStepDef?.id) === 'features' && 'Pick the features you need. AI suggests based on your project type.'}
                {(stepInfo?.id || currentStepDef?.id) === 'tech' && 'Choose your stack. AI recommends based on features.'}
                {(stepInfo?.id || currentStepDef?.id) === 'design' && 'Define the look & feel. AI suggests colors/pages for your category.'}
                {(stepInfo?.id || currentStepDef?.id) === 'constraints' && 'Optional: budget, timeline, team — helps AI optimize.'}
              </p>
            </div>

            <div className="space-y-4">
              {(stepInfo?.fields || currentStepDef?.fields || []).map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={stepData[field.key] ?? field.default ?? ''}
                  onChange={handleFieldChange}
                  suggestions={Array.isArray(field.suggestions) ? field.suggestions : field.suggestions ? [field.suggestions] : []}
                  disabled={loading}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={handleBack} disabled={currentStepIndex === 0 || loading} className="flex-1 px-4 py-2.5 rounded-xl border cursor-pointer transition-all" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)', opacity: currentStepIndex === 0 ? 0.5 : 1 }}>
                <ChevronLeft className="w-4 h-4 inline mr-1" /> Back
              </button>
              <button onClick={handleNext} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl font-bold cursor-pointer transition-all flex items-center justify-center gap-2" style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
                {currentStepIndex === SPEC_STEPS.length - 1 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Review & Build
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              <button onClick={handleSaveDraft} className="flex items-center gap-1 cursor-pointer hover:underline" disabled={loading}>
                <Save className="w-3 h-3" /> Save Draft
              </button>
              <button onClick={loadDraft} className="flex items-center gap-1 cursor-pointer hover:underline">
                <RotateCcw className="w-3 h-3" /> Load Draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SPEC_STEPS = [
  { id: 'overview', title: 'Project Overview' },
  { id: 'features', title: 'Features' },
  { id: 'tech', title: 'Tech Stack' },
  { id: 'design', title: 'Design' },
  { id: 'constraints', title: 'Constraints' },
];

export default SpecWizard;