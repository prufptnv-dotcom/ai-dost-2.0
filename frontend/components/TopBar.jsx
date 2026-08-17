import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Mic, Moon, Sun, Command, Bot,
  ChevronDown, Sparkles, Settings, User, LogOut
} from 'lucide-react';

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (Smart Pick)' },
  { value: 'gemini', label: 'Gemini Flash' },
  { value: 'groq', label: 'Groq Llama' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'nvidia', label: 'NVIDIA GLM' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'local:qwen2.5-coder:7b', label: 'Local (Ollama)' },
];

export default function TopBar({
  sidebarPadding = 0,
  title = '',
  subtitle = '',
  model = 'auto',
  onModelChange,
  onOpenVoice,
  onOpenSettings,
  onOpenCommandPalette,
  isThinking = false,
}) {
  const [isLight, setIsLight] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const modelMenuRef = useRef(null);

  useEffect(() => {
    const light = localStorage.getItem('ai_dost_light_theme') === '1';
    setIsLight(light);
    document.body.classList.toggle('light-theme', light);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleTheme = () => {
    const next = !isLight;
    setIsLight(next);
    localStorage.setItem('ai_dost_light_theme', next ? '1' : '0');
    document.body.classList.toggle('light-theme', next);
  };

  const currentModel = MODEL_OPTIONS.find(m => m.value === model) || MODEL_OPTIONS[0];

  return (
    <header
      className="fixed top-0 right-0 z-40 h-16 flex items-center gap-3 px-4 md:px-6 backdrop-blur-xl transition-[padding] duration-300"
      style={{
        left: sidebarPadding,
        background: 'rgba(15,17,23,0.72)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-bold text-white text-base md:text-lg truncate leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[var(--color-text-muted)] truncate hidden sm:block">
            {subtitle}
          </p>
        )}
      </div>

      {/* Command Palette Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
        title="Command Palette (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Ask anything...</span>
        <span
          className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-mono"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)' }}
        >
          Ctrl K
        </span>
      </button>

      {/* Model Selector */}
      <div className="relative" ref={modelMenuRef}>
        <button
          onClick={() => setModelMenuOpen(!modelMenuOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
          style={{
            background: 'rgba(75,139,252,0.08)',
            border: '1px solid rgba(75,139,252,0.25)',
            color: 'var(--color-primary)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{currentModel.label}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <AnimatePresence>
          {modelMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 rounded-xl py-2 z-50"
              style={{
                background: 'rgba(23,26,34,0.98)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                AI Model
              </p>
              {MODEL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => {
                    onModelChange(m.value);
                    setModelMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer"
                  style={{
                    color: model === m.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    background: model === m.value ? 'rgba(75,139,252,0.1)' : 'transparent',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice */}
      <button
        onClick={onOpenVoice}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
        style={{
          background: 'rgba(161,66,244,0.08)',
          border: '1px solid rgba(161,66,244,0.25)',
          color: 'var(--color-secondary)',
        }}
        title="Voice Assistant"
      >
        <Mic className="w-4 h-4" />
        <span className="hidden lg:inline">Voice</span>
      </button>

      {/* Thinking indicator */}
      {isThinking && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(75,139,252,0.08)', border: '1px solid rgba(75,139,252,0.2)' }}>
          <div className="typing-dots">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* Theme */}
      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        title="Toggle theme"
      >
        {isLight ? <Moon className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} /> : <Sun className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />}
      </button>

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
        title="Settings"
      >
        <Settings className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
      </button>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer"
        style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 14px var(--color-primary-glow)' }}
        title="AI-Dost"
      >
        A
      </div>
    </header>
  );
}
