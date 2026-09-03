import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Mic, Moon, Sun, ChevronDown, Check,
  Bot, ShieldCheck
} from 'lucide-react';
import ProjectSwitcher from './ui/ProjectSwitcher';
import { StatusIndicator } from './ui/Badge';
import { IconButton } from './ui/Button';

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Auto (Smart Cascade)' },
  { value: 'gemini', label: 'Gemini 2.5 Flash' },
  { value: 'groq', label: 'Groq Llama 3.3' },
  { value: 'deepseek', label: 'DeepSeek V3' },
  { value: 'nvidia', label: 'NVIDIA GLM' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'local:qwen2.5-coder:7b', label: 'Ollama (Local Offline)' },
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
  projects = [],
  activeProjectId,
  onSelectProject,
  onNewProject,
  runtimeStatus = null, // { status: 'working|verifying|idle', label: '...' }
}) {
  const [isLight, setIsLight] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef(null);

  useEffect(() => {
    const light = localStorage.getItem('ai_dost_theme') === 'light' || localStorage.getItem('theme') === 'light' || localStorage.getItem('ai_dost_light_theme') === '1';
    setIsLight(light);
    document.body.classList.toggle('light-theme', light);
    document.documentElement.classList.toggle('light-theme', light);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
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
    localStorage.setItem('ai_dost_theme', next ? 'light' : 'dark');
    localStorage.setItem('theme', next ? 'light' : 'dark');
    localStorage.setItem('ai_dost_light_theme', next ? '1' : '0');
    document.body.classList.toggle('light-theme', next);
    document.documentElement.classList.toggle('light-theme', next);
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
  };

  const currentModel = MODEL_OPTIONS.find((m) => m.value === model) || MODEL_OPTIONS[0];

  return (
    <header
      className="fixed top-0 right-0 z-40 h-14 flex items-center justify-between gap-4 px-4 md:px-6 bg-canvas-base border-b border-border transition-[padding] duration-200"
      style={{ left: sidebarPadding }}
      role="banner"
    >
      {/* Left: View Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="font-display font-semibold text-txt-primary text-sm md:text-base tracking-tight truncate leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-txt-muted truncate mt-1 hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center: Project Switcher & Runtime Status */}
      <div className="hidden md:flex items-center gap-3">
        {projects && projects.length > 0 && (
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={onSelectProject}
            onNewProject={onNewProject}
          />
        )}

        {runtimeStatus && runtimeStatus.status && (
          <StatusIndicator
            status={runtimeStatus.status}
            label={runtimeStatus.label || 'Agent Active'}
            className="px-2.5 py-1 rounded-full bg-canvas-surface border border-border"
          />
        )}
      </div>

      {/* Right: Actions (Search, Model Switcher, Theme, Voice) */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-border-strong text-txt-muted hover:text-txt-secondary text-xs transition-fast cursor-pointer focus-ring"
            title="Command Palette (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search or command...</span>
            <kbd className="ml-1 px-1.5 py-0.2 rounded-xs bg-canvas-base border border-border text-[10px] font-mono text-txt-muted">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Model Selector Dropdown */}
        <div ref={modelMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setModelMenuOpen(!modelMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-border-strong text-txt-secondary hover:text-txt-primary text-xs transition-fast cursor-pointer focus-ring"
            aria-label="Select AI Model"
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
          >
            <Bot className="w-3.5 h-3.5 text-accent" />
            <span className="max-w-[110px] truncate hidden sm:inline">{currentModel.label}</span>
            <ChevronDown className="w-3 h-3 text-txt-muted" />
          </button>

          {modelMenuOpen && (
            <div
              role="listbox"
              className="absolute right-0 mt-1.5 w-52 bg-canvas-surface border border-border-strong rounded-lg shadow-popover z-50 overflow-hidden py-1"
            >
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-txt-muted border-b border-border-subtle">
                Inference Cascade
              </div>
              {MODEL_OPTIONS.map((m) => {
                const isSelected = m.value === model;
                return (
                  <button
                    key={m.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onModelChange && onModelChange(m.value);
                      setModelMenuOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left transition-fast cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Voice Trigger */}
        {onOpenVoice && (
          <IconButton
            icon={Mic}
            size="sm"
            variant="secondary"
            onClick={onOpenVoice}
            title="Voice Assistant (Ctrl+Shift+V)"
          />
        )}

        {/* Theme Toggle Button */}
        <IconButton
          icon={isLight ? Moon : Sun}
          size="sm"
          variant="secondary"
          onClick={toggleTheme}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        />
      </div>
    </header>
  );
}
