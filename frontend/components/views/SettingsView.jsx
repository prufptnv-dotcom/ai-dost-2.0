import { useState, useEffect } from 'react';
import { Settings, Key, Volume2, Sparkles, Palette, Eye, EyeOff, Save, RotateCcw, Info } from 'lucide-react';

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (cascade)' },
  { value: 'gemini', label: 'Gemini Flash (free)' },
  { value: 'groq', label: 'Groq Llama 3' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'nvidia', label: 'NVIDIA Nemotron' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'local:qwen2.5-coder:7b', label: 'Ollama local (qwen2.5-coder:7b)' },
];

function KeyRow({ label, k, placeholder, hint, showKeys, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>{label}</label>
      <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
        <Key className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type={showKeys ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange(k, e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-2.5 text-xs focus:outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
      </div>
      {hint && <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</div>
        {desc && <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="rounded-full relative transition-colors cursor-pointer"
        style={{
          width: 40, height: 22,
          background: checked ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <span
          className="absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all"
          style={{ left: checked ? 20 : 2, background: '#fff' }}
        />
      </button>
    </div>
  );
}

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
  const [hinglish, setHinglish] = useState(true);

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
    setHinglish(localStorage.getItem('ai_dost_hinglish') !== 'false');
  }, []);

  const saveKeys = () => {
    if (typeof window === 'undefined') return;
    Object.entries(keys).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v.trim());
    });
    if (onToast) onToast('Settings saved locally', 'success');
    else if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Settings saved locally' } }));
  };

  const setModelPref = (m) => {
    setModel(m);
    if (typeof window !== 'undefined') localStorage.setItem('ai_dost_model', m);
    if (onModelChange) onModelChange(m);
  };

  const resetKeys = () => {
    if (!window.confirm('Saari saved settings reset karein?')) return;
    ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OLLAMA_MODEL', 'TAVILY_API_KEY', 'ai_dost_model'].forEach(k => localStorage.removeItem(k));
    setKeys({ GEMINI_API_KEY: '', GROQ_API_KEY: '', OLLAMA_MODEL: 'qwen2.5-coder:7b', TAVILY_API_KEY: '' });
    setModel('auto');
    setAutosave(true);
    setHinglish(true);
  };

  const setKey = (k, v) => setKeys(prev => ({ ...prev, [k]: v }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Settings</h1>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sab kuch local browser me save — koi server data nahi</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5 pb-20">
          {/* Model */}
          <section className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <h2 className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> AI Model
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModelPref(m.value)}
                  className="text-left px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer"
                  style={{
                    background: model === m.value ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid ' + (model === m.value ? 'transparent' : 'var(--color-border)'),
                    color: model === m.value ? '#fff' : 'var(--color-text-secondary)',
                    boxShadow: model === m.value ? '0 4px 16px rgba(75,139,252,0.35)' : 'none',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
              Auto = Groq → Gemini → NVIDIA → DeepSeek → Mistral → Ollama cascade. Ek fail to agla try.
            </p>
          </section>

          {/* API Keys */}
          <section className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                <Key className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} /> API Keys
              </h2>
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
              >
                {showKeys ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showKeys ? 'Hide' : 'Show'}
              </button>
            </div>
            <KeyRow label="Gemini API Key" k="GEMINI_API_KEY" placeholder="AIza..." hint="Free: makersuite.google.com/app" showKeys={showKeys} value={keys.GEMINI_API_KEY} onChange={setKey} />
            <KeyRow label="Groq API Key" k="GROQ_API_KEY" placeholder="gsk_..." hint="Free: console.groq.com" showKeys={showKeys} value={keys.GROQ_API_KEY} onChange={setKey} />
            <KeyRow label="Ollama Model" k="OLLAMA_MODEL" placeholder="qwen2.5-coder:7b" hint="Local model (16GB+ RAM)" showKeys={showKeys} value={keys.OLLAMA_MODEL} onChange={setKey} />
            <KeyRow label="Tavily Search Key" k="TAVILY_API_KEY" placeholder="tvly-..." hint="Agent research ke liye (optional)" showKeys={showKeys} value={keys.TAVILY_API_KEY} onChange={setKey} />
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveKeys}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer"
                style={{ background: 'var(--gradient-primary)', color: '#fff' }}
              >
                <Save className="w-3.5 h-3.5" /> Save Keys
              </button>
              <button
                onClick={resetKeys}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold cursor-pointer"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </section>

          {/* Preferences */}
          <section className="rounded-2xl p-5 divide-y" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderBottom: 'none' }}>
            <h2 className="flex items-center gap-2 text-sm font-bold pb-3" style={{ color: 'var(--color-text-primary)' }}>
              <Palette className="w-4 h-4" style={{ color: '#18c2a8' }} /> Preferences
            </h2>
            <Toggle label="Hinglish responses" desc="AI Hinglish/Hindi me jawab de" checked={hinglish} onChange={(v) => { setHinglish(v); localStorage.setItem('ai_dost_hinglish', String(v)); }} />
            <Toggle label="Autosave files" desc="Editor files automatically save" checked={autosave} onChange={(v) => { setAutosave(v); localStorage.setItem('ai_dost_autosave', String(v)); }} />          </section>

          {/* Info */}
          <section className="rounded-2xl p-5" style={{ background: 'rgba(75,139,252,0.05)', border: '1px solid rgba(75,139,252,0.2)' }}>
            <h2 className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              <Info className="w-4 h-4" style={{ color: 'var(--color-primary)' }} /> AI-Dost v3.0
            </h2>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              100% free AI assistant — Gemini cascade + local Ollama fallback. Gemini: 1500 req/day free. Agla step:
              OpenAI/Claude API keys yahan add karne se aur bhi models chalenge.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}