import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  Sun, Moon, Settings, User, LogOut, Menu, X,
  Sparkles, Key, Brain, GitBranch, Save, ChevronDown,
  Zap, MessageSquare, FolderOpen, Bot
} from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import PersonalBrainModal from './PersonalBrainModal';
import GitControlModal from './GitControlModal';

/* ─── Tooltip ─── */
function Tooltip({ children, label }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover/tip:opacity-100 translate-y-1 group-hover/tip:translate-y-0 transition-all duration-200"
        style={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[rgba(10,10,20,0.95)]" />
      </div>
    </div>
  );
}

/* ─── Icon Button ─── */
function IconBtn({ onClick, icon: Icon, label, active, color, suppressHydrationWarning, pulse }) {
  return (
    <Tooltip label={label}>
      <button
        suppressHydrationWarning={suppressHydrationWarning}
        onClick={onClick}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer group/btn
          ${active
            ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            : 'text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/6 border border-transparent'
          }
          ${pulse ? 'animate-pulse border-cyan-400/40' : ''}
        `}
        style={active && color ? { color, background: `${color}18`, borderColor: `${color}40`, boxShadow: `0 0 12px ${color}25` } : {}}
      >
        <Icon className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mode, setMode } = useMode();
  const { showToast } = useToast();
  const router = useRouter();

  const [isLightTheme, setIsLightTheme] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Settings state
  const [autoSaveInterval, setAutoSaveInterval] = useState('10');
  const [autocompleteOn, setAutocompleteOn] = useState(true);
  const [customGeminiKey, setCustomGeminiKey] = useState('');
  const [customGroqKey, setCustomGroqKey] = useState('');
  const [customDeepSeekKey, setCustomDeepSeekKey] = useState('');
  const [customNvidiaKey, setCustomNvidiaKey] = useState('');
  const [customOpenRouterKey, setCustomOpenRouterKey] = useState('');

  // Load client-only localStorage settings after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('theme') === 'light') setIsLightTheme(true);
    if (localStorage.getItem('autoSave')) setAutoSaveInterval(localStorage.getItem('autoSave'));
    if (localStorage.getItem('autocomplete') === 'false') setAutocompleteOn(false);
    if (localStorage.getItem('customGeminiKey')) setCustomGeminiKey(localStorage.getItem('customGeminiKey'));
    if (localStorage.getItem('customGroqKey')) setCustomGroqKey(localStorage.getItem('customGroqKey'));
    if (localStorage.getItem('customDeepSeekKey')) setCustomDeepSeekKey(localStorage.getItem('customDeepSeekKey'));
    if (localStorage.getItem('customNvidiaKey')) setCustomNvidiaKey(localStorage.getItem('customNvidiaKey'));
  }, []);

  // Secret 7-tap brain
  const [settingsClicks, setSettingsClicks] = useState(0);
  const [showSecretBrainModal, setShowSecretBrainModal] = useState(false);
  const clickTimerRef = useRef(null);
  const [showGitModal, setShowGitModal] = useState(false);

  // Scroll detection for navbar style change
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme') === 'light') {
      document.body.classList.add('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    if (isLightTheme) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setIsLightTheme(false);
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      setIsLightTheme(true);
    }
  };

  const handleSettingsClick = () => {
    const newCount = settingsClicks + 1;
    setSettingsClicks(newCount);
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (newCount >= 7) {
      setSettingsClicks(0);
      setShowSettings(false);
      setShowSecretBrainModal(true);
      showToast?.({ type: 'success', message: '🔓 Secret Developer Brain Mode Unlocked!' });
    } else {
      if (newCount >= 3) showToast?.({ type: 'info', message: `Tap ${7 - newCount} more times to unlock Secret Developer Brain Mode...` });
      clickTimerRef.current = setTimeout(() => { setSettingsClicks(0); setShowSettings(true); }, 350);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('autoSave', autoSaveInterval);
    localStorage.setItem('autocomplete', autocompleteOn ? 'true' : 'false');
    localStorage.setItem('customGeminiKey', customGeminiKey);
    localStorage.setItem('customGroqKey', customGroqKey);
    localStorage.setItem('customDeepSeekKey', customDeepSeekKey);
    localStorage.setItem('customNvidiaKey', customNvidiaKey);
    localStorage.setItem('customOpenRouterKey', customOpenRouterKey);
    setShowSettings(false);
    showToast?.({ type: 'success', message: '✅ Settings saved!' });
  };

  const modeConfig = {
    chat: { icon: MessageSquare, label: 'Chat', color: '#06b6d4' },
    project: { icon: FolderOpen, label: 'Project', color: '#8b5cf6' },
  };

  return (
    <>
      <header
        suppressHydrationWarning
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(5,6,10,0.92)'
            : 'rgba(5,6,10,0.7)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: scrolled ? '0 4px 32px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-4">

          {/* ─── Left: Logo + Mode Toggle ─── */}
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 cursor-pointer select-none group/logo"
              title="Go to Dashboard"
            >
              <div className="relative">
                <Image
                  src="/logo.jpg"
                  alt="AI-Dost Logo"
                  width={30}
                  height={30}
                  className="w-[30px] h-[30px] rounded-lg object-cover border border-cyan-500/30 transition-transform duration-300 group-hover/logo:scale-105"
                  style={{ boxShadow: '0 0 14px rgba(6,182,212,0.25)' }}
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#05060a]" />
              </div>
              <span className="font-extrabold text-base tracking-tight gradient-text hidden sm:block">Ai-Dost</span>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-white/8" />

            {/* Mode Toggle */}
            <div
              className="flex items-center p-0.5 rounded-xl gap-0.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {Object.entries(modeConfig).map(([key, cfg]) => {
                const isActive = mode === key;
                return (
                  <button
                    key={key}
                    suppressHydrationWarning
                    onClick={() => setMode(key)}
                    className={`flex items-center gap-1.5 px-3 h-7 rounded-[9px] text-xs font-semibold transition-all duration-200 cursor-pointer select-none`}
                    style={isActive
                      ? { background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}35`, boxShadow: `0 0 10px ${cfg.color}20` }
                      : { color: '#64748b', border: '1px solid transparent' }
                    }
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />}
                    <cfg.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Right: Action Buttons ─── */}
          <div className="flex items-center gap-1">
            {/* Git Button */}
            <Tooltip label="Local Git Control">
              <button
                suppressHydrationWarning
                onClick={() => setShowGitModal(true)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                style={{
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: '#22c55e',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; e.currentTarget.style.boxShadow = '0 0 14px rgba(34,197,94,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Git</span>
              </button>
            </Tooltip>

            <div className="w-px h-5 bg-white/8 mx-1" />

            <IconBtn
              onClick={toggleTheme}
              icon={isLightTheme ? Moon : Sun}
              label={isLightTheme ? 'Dark mode' : 'Light mode'}
              suppressHydrationWarning
            />
            <IconBtn
              onClick={handleSettingsClick}
              icon={Settings}
              label={settingsClicks > 0 ? `Secret Tap ${settingsClicks}/7` : 'Settings (Tap 7× for Brain Mode)'}
              active={settingsClicks > 0}
              pulse={settingsClicks > 0}
              suppressHydrationWarning
            />
            <IconBtn
              onClick={() => router.push('/about-me')}
              icon={User}
              label="Profile"
            />
            <IconBtn
              onClick={() => { if (confirm('Return to login?')) router.push('/'); }}
              icon={LogOut}
              label="Logout"
            />

            {/* Mobile hamburger */}
            <button
              suppressHydrationWarning
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/6 border border-transparent transition-all duration-200 ml-1 cursor-pointer"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ─── Mobile Menu ─── */}
        {menuOpen && (
          <div
            className="md:hidden absolute top-14 left-0 right-0 animate-fadeIn"
            style={{
              background: 'rgba(8,9,14,0.97)',
              backdropFilter: 'blur(24px)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="max-w-screen-2xl mx-auto px-5 py-4 flex flex-col gap-1">
              {[
                { icon: User, label: 'Profile', action: () => { router.push('/about-me'); setMenuOpen(false); } },
                { icon: GitBranch, label: 'Git Control', action: () => { setShowGitModal(true); setMenuOpen(false); } },
                { icon: Settings, label: 'Settings', action: () => { setShowSettings(true); setMenuOpen(false); } },
                { icon: LogOut, label: 'Logout', action: () => { if (confirm('Return to login?')) router.push('/'); } },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-white/5 transition-all cursor-pointer text-left"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fadeIn"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scaleIn relative overflow-hidden max-h-[88vh] overflow-y-auto"
            style={{
              background: 'rgba(10,11,18,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 0 1px rgba(6,182,212,0.08), 0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'var(--gradient-primary)' }} />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 gradient-text">
                <Settings className="w-5 h-5 text-cyan-400" />
                Workspace Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5 text-sm">
              {/* Auto Save */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-xs uppercase tracking-wider">
                  <Save className="w-3.5 h-3.5 text-cyan-400" /> Auto-Save Interval
                </label>
                <select
                  value={autoSaveInterval}
                  onChange={e => setAutoSaveInterval(e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-sm text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <option value="5">Every 5 Seconds</option>
                  <option value="10">Every 10 Seconds</option>
                  <option value="30">Every 30 Seconds</option>
                  <option value="manual">Manual Save Only</option>
                </select>
              </div>

              {/* Autocomplete Toggle */}
              <div className="flex items-center justify-between py-3 rounded-xl px-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-violet-400" /> AI Autocomplete
                  </div>
                  <div className="text-[11px] text-[#64748b] mt-0.5">Inline code suggestions in Monaco</div>
                </div>
                <button
                  onClick={() => setAutocompleteOn(v => !v)}
                  className={`relative w-10 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0`}
                  style={{ background: autocompleteOn ? '#06b6d4' : 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
                    style={{ left: autocompleteOn ? '22px' : '4px' }}
                  />
                </button>
              </div>

              {/* API Keys */}
              <div>
                <div className="text-[11px] font-bold gradient-text uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <Key className="w-3 h-3" /> Custom API Keys (Optional)
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Gemini', val: customGeminiKey, set: setCustomGeminiKey, color: '#4285f4' },
                    { label: 'Groq', val: customGroqKey, set: setCustomGroqKey, color: '#f7971e' },
                    { label: 'DeepSeek', val: customDeepSeekKey, set: setCustomDeepSeekKey, color: '#06b6d4' },
                    { label: 'NVIDIA', val: customNvidiaKey, set: setCustomNvidiaKey, color: '#76b900' },
                    { label: 'OpenRouter', val: customOpenRouterKey, set: setCustomOpenRouterKey, color: '#8b5cf6' },
                  ].map(({ label, val, set, color }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium" style={{ color }}>
                        {label} API Key
                      </label>
                      <input
                        type="password"
                        placeholder="Leave empty to use AI-Dost default key"
                        value={val}
                        onChange={e => set(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}20` }}
                        onFocus={e => { e.target.style.borderColor = `${color}50`; e.target.style.boxShadow = `0 0 8px ${color}15`; }}
                        onBlur={e => { e.target.style.borderColor = `${color}20`; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#64748b] hover:text-[#e2e8f0] transition-all cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="flex-1 gradient-btn py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Secret 7-Tap Brain Modal ─── */}
      <PersonalBrainModal isOpen={showSecretBrainModal} onClose={() => setShowSecretBrainModal(false)} />

      {/* ─── Git Control Modal ─── */}
      <GitControlModal isOpen={showGitModal} onClose={() => setShowGitModal(false)} />
    </>
  );
};

export default Header;
