import React, { useState, useEffect } from 'react';
import {
  Settings, Key, Eye, EyeOff, Save, RotateCcw,
  Sparkles, Check, Server, Shield, Sliders
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto Multi-Model Cascade (Gemini → Groq → OpenRouter)' },
  { value: 'gemini', label: 'Google Gemini 1.5 Flash (Free Tier)' },
  { value: 'groq', label: 'Groq Llama 3.3 70B (Fast Inference)' },
  { value: 'deepseek', label: 'DeepSeek R1 / V3' },
  { value: 'nvidia', label: 'NVIDIA Nemotron' },
  { value: 'openrouter', label: 'OpenRouter Free Tier' },
  { value: 'local:qwen2.5-coder:7b', label: 'Local Ollama (qwen2.5-coder:7b)' },
];

export default function SettingsView({ onToast, onModelChange }) {
  const [keys, setKeys] = useState({
    GEMINI_API_KEY: '',
    GROQ_API_KEY: '',
    OLLAMA_MODEL: 'qwen2.5-coder:7b',
    TAVILY_API_KEY: '',
  });
  const [showKeys, setShowKeys] = useState(false);
  const [model, setModel] = useState('auto');
  const [autosave, setAutosave] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setKeys({
      GEMINI_API_KEY: localStorage.getItem('GEMINI_API_KEY') || '',
      GROQ_API_KEY: localStorage.getItem('GROQ_API_KEY') || '',
      OLLAMA_MODEL: localStorage.getItem('OLLAMA_MODEL') || 'qwen2.5-coder:7b',
      TAVILY_API_KEY: localStorage.getItem('TAVILY_API_KEY') || '',
    });
    setModel(localStorage.getItem('ai_dost_model') || 'auto');
    setAutosave(localStorage.getItem('ai_dost_autosave') !== 'false');
  }, []);

  const saveSettings = () => {
    if (typeof window === 'undefined') return;
    Object.entries(keys).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v.trim());
      else localStorage.removeItem(k);
    });
    localStorage.setItem('ai_dost_model', model);
    localStorage.setItem('ai_dost_autosave', String(autosave));

    if (onModelChange) onModelChange(model);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (onToast) onToast('Settings saved locally', 'success');
  };

  const resetAll = () => {
    if (!window.confirm('Reset all custom API keys and model preferences?')) return;
    ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OLLAMA_MODEL', 'TAVILY_API_KEY', 'ai_dost_model'].forEach((k) =>
      localStorage.removeItem(k)
    );
    setKeys({ GEMINI_API_KEY: '', GROQ_API_KEY: '', OLLAMA_MODEL: 'qwen2.5-coder:7b', TAVILY_API_KEY: '' });
    setModel('auto');
    if (onToast) onToast('Settings reset to defaults', 'success');
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-paper-100 font-display">
              Workspace Settings
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Configure multi-model AI inference cascade, API keys, and workspace behaviors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              onClick={resetAll}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={savedSuccess ? Check : Save}
              onClick={saveSettings}
            >
              {savedSuccess ? 'Saved' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Section 1: AI Model Configuration */}
        <div className="rounded-sm border border-border bg-canvas-surface p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Server className="w-4 h-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-paper-100 font-display">
              AI Model Cascade
            </h2>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-paper-200">
              Primary Model Selection
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-sans focus:outline-none focus:border-accent-primary"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-muted">
              Auto cascade attempts Groq → Gemini Flash → OpenRouter → Ollama for resilient free-tier uptime.
            </p>
          </div>
        </div>

        {/* Section 2: API Keys & Credentials */}
        <div className="rounded-sm border border-border bg-canvas-surface p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-accent-primary" />
              <h2 className="text-sm font-semibold text-paper-100 font-display">
                API Keys & Providers
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowKeys(!showKeys)}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-paper-100 cursor-pointer"
            >
              {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showKeys ? 'Mask Keys' : 'Show Keys'}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-paper-200 mb-1">
                Google Gemini API Key
              </label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={keys.GEMINI_API_KEY}
                onChange={(e) => setKeys({ ...keys, GEMINI_API_KEY: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-paper-200 mb-1">
                Groq API Key
              </label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={keys.GROQ_API_KEY}
                onChange={(e) => setKeys({ ...keys, GROQ_API_KEY: e.target.value })}
                placeholder="gsk_..."
                className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-paper-200 mb-1">
                Tavily Web Search API Key
              </label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={keys.TAVILY_API_KEY}
                onChange={(e) => setKeys({ ...keys, TAVILY_API_KEY: e.target.value })}
                placeholder="tvly-..."
                className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Workspace Preferences */}
        <div className="rounded-sm border border-border bg-canvas-surface p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Sliders className="w-4 h-4 text-accent-primary" />
            <h2 className="text-sm font-semibold text-paper-100 font-display">
              Preferences
            </h2>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs font-medium text-paper-100">Auto-Save File Changes</div>
              <div className="text-[11px] text-ink-muted">Automatically save modified files in Copilot IDE</div>
            </div>
            <input
              type="checkbox"
              checked={autosave}
              onChange={(e) => setAutosave(e.target.checked)}
              className="w-4 h-4 rounded-xs border-border text-accent-primary focus:ring-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}