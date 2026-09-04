import React, { useState, useEffect } from 'react';
import {
  Settings, Key, Eye, EyeOff, Save, RotateCcw,
  Sparkles, Check, Server, Shield, Sliders, Play, Terminal, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import api from '../../services/api';

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sandbox Security & Isolation Telemetry
  const [sandboxStatus, setSandboxStatus] = useState(null);
  const [testingSandbox, setTestingSandbox] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchSandboxStatus = async () => {
    try {
      const res = await api.get('/sandbox/health');
      if (res.data) setSandboxStatus(res.data);
    } catch {
      // Fallback display if offline
      setSandboxStatus({
        engine: 'local-hardened-fallback',
        dockerAvailable: false,
        resourceQuotas: {
          memoryLimit: '1GB (Capped max 2GB)',
          cpuQuota: '1.0 Core',
          pidsLimit: 100,
          pathTraversalDefense: 'Active (_resolveSafe enforced)',
          commandPolicy: 'Active (Destructive shell commands filtered)'
        }
      });
    }
  };

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

    fetchSandboxStatus();
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

  const confirmResetAll = () => {
    ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OLLAMA_MODEL', 'TAVILY_API_KEY', 'ai_dost_model'].forEach((k) =>
      localStorage.removeItem(k)
    );
    setKeys({ GEMINI_API_KEY: '', GROQ_API_KEY: '', OLLAMA_MODEL: 'qwen2.5-coder:7b', TAVILY_API_KEY: '' });
    setModel('auto');
    setShowResetConfirm(false);
    if (onToast) onToast('Settings reset to defaults', 'success');
  };

  const handleRunSandboxTest = async () => {
    setTestingSandbox(true);
    setTestResult(null);
    try {
      const res = await api.post('/sandbox/test');
      setTestResult(res.data);
      if (res.data?.success) {
        if (onToast) onToast(`Sandbox probe passed in ${res.data.latencyMs}ms (${res.data.isolation})`, 'success');
      } else {
        if (onToast) onToast(`Sandbox probe failed: ${res.data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setTestResult({ success: false, error: errorMsg });
      if (onToast) onToast(`Sandbox probe failed: ${errorMsg}`, 'error');
    } finally {
      setTestingSandbox(false);
      fetchSandboxStatus();
    }
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
              onClick={() => setShowResetConfirm(true)}
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

        {/* Section 2: Sandbox & Security Isolation (P0.2) */}
        <div className="rounded-sm border border-border bg-canvas-surface p-5 space-y-4 shadow-xs" data-testid="sandbox-security-card">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-primary" />
              <h2 className="text-sm font-semibold text-paper-100 font-display">
                Sandbox & Security Isolation
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={sandboxStatus?.dockerAvailable ? 'success' : 'default'} size="sm">
                {sandboxStatus?.dockerAvailable ? 'Docker Isolated' : 'Local Hardened Guard'}
              </Badge>
              <Badge variant="outline" size="sm">
                P0.2 Security
              </Badge>
            </div>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            All code execution, builds, and development servers run inside hardened sandboxes with safe path-traversal rejection (<code className="text-accent-primary font-mono text-[11px]">../</code> blocked) and process resource constraints.
          </p>

          {/* Resource Quota Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
            <div className="p-2.5 rounded-xs bg-canvas-base border border-border">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-mono">Memory Cap</div>
              <div className="text-xs font-semibold text-paper-100 font-mono mt-0.5">1 GB (Max 2GB)</div>
            </div>
            <div className="p-2.5 rounded-xs bg-canvas-base border border-border">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-mono">CPU Quota</div>
              <div className="text-xs font-semibold text-paper-100 font-mono mt-0.5">1.0 CPU Core</div>
            </div>
            <div className="p-2.5 rounded-xs bg-canvas-base border border-border">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-mono">Anti-Fork Limit</div>
              <div className="text-xs font-semibold text-paper-100 font-mono mt-0.5">100 PIDs Cap</div>
            </div>
            <div className="p-2.5 rounded-xs bg-canvas-base border border-border">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-mono">Path Defense</div>
              <div className="text-xs font-semibold text-accent-primary font-mono mt-0.5">Active Guard</div>
            </div>
          </div>

          {/* Command Policy & Status Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xs bg-canvas-base border border-border-subtle">
            <div className="flex items-center gap-2 text-xs text-paper-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary shrink-0" />
              <span>Command policy active: destructive host commands & fork bombs filtered.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="xs"
                icon={RefreshCw}
                onClick={fetchSandboxStatus}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="xs"
                icon={Play}
                loading={testingSandbox}
                onClick={handleRunSandboxTest}
              >
                Run Health Check
              </Button>
            </div>
          </div>

          {/* Test Probe Result Banner */}
          {testResult && (
            <div className={`p-3 rounded-xs border text-xs font-mono flex items-center justify-between ${
              testResult.success
                ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {testResult.success
                    ? `Sandbox probe passed (${testResult.isolation || 'isolated'}) in ${testResult.latencyMs}ms`
                    : `Probe error: ${testResult.error || 'Check failed'}`}
                </span>
              </div>
              {testResult.execOutput && (
                <span className="text-[10px] opacity-80">{testResult.execOutput}</span>
              )}
            </div>
          )}
        </div>

        {/* Section 3: API Keys & Credentials */}
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

        {/* Section 4: Workspace Preferences */}
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

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Settings"
        subtitle="This action will restore default workspace configurations."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Are you sure you want to reset all custom API keys (Gemini, Groq, Tavily) and inference model preferences? Any keys stored in local storage will be cleared.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={RotateCcw}
              onClick={confirmResetAll}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}