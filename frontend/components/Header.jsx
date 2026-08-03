import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Sun, Moon, Settings, User, LogOut, Menu, X, Bot, ChevronDown, Save, Sparkles, Key, Brain, GitBranch } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import PersonalBrainModal from './PersonalBrainModal';
import GitControlModal from './GitControlModal';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mode, setMode } = useMode();
  const { showToast } = useToast();
  const router = useRouter();
  const [isLightTheme, setIsLightTheme] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('theme') === 'light';
  });
  
  // Custom workspace settings states
  const [showSettings, setShowSettings] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('autoSave') || '10' : '10';
  });
  const [autocompleteOn, setAutocompleteOn] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('autocomplete') !== 'false' : true;
  });
  const [customGeminiKey, setCustomGeminiKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('customGeminiKey') || '' : '';
  });
  const [customGroqKey, setCustomGroqKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('customGroqKey') || '' : '';
  });
  const [customDeepSeekKey, setCustomDeepSeekKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('customDeepSeekKey') || '' : '';
  });
  const [customNvidiaKey, setCustomNvidiaKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('customNvidiaKey') || '' : '';
  });
  const [customOpenRouterKey, setCustomOpenRouterKey] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('customOpenRouterKey') || '' : '';
  });

  // 7-Tap Secret Personal Brain State (Android Developer Mode Style)
  const [settingsClicks, setSettingsClicks] = useState(0);
  const [showSecretBrainModal, setShowSecretBrainModal] = useState(false);
  const clickTimerRef = useRef(null);

  // Local Git Modal State
  const [showGitModal, setShowGitModal] = useState(false);

  const handleSettingsClick = () => {
    const newCount = settingsClicks + 1;
    setSettingsClicks(newCount);

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    if (newCount >= 7) {
      setSettingsClicks(0);
      setShowSettings(false);
      setShowSecretBrainModal(true);
      if (showToast) {
        showToast({ type: 'success', message: '🔓 Secret Developer Brain Mode Unlocked!' });
      }
    } else {
      if (newCount >= 3 && showToast) {
        showToast({ type: 'info', message: `Tap ${7 - newCount} more times to unlock Secret Developer Brain Mode...` });
      }
      
      // Delay opening normal Settings modal by 350ms to detect continuous rapid taps
      clickTimerRef.current = setTimeout(() => {
        setSettingsClicks(0);
        setShowSettings(true);
      }, 350);
    }
  };

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

  const saveSettings = () => {
    localStorage.setItem('autoSave', autoSaveInterval);
    localStorage.setItem('autocomplete', autocompleteOn ? 'true' : 'false');
    localStorage.setItem('customGeminiKey', customGeminiKey);
    localStorage.setItem('customGroqKey', customGroqKey);
    localStorage.setItem('customDeepSeekKey', customDeepSeekKey);
    localStorage.setItem('customNvidiaKey', customNvidiaKey);
    localStorage.setItem('customOpenRouterKey', customOpenRouterKey);
    setShowSettings(false);
  };
  
  return (
    <header 
      suppressHydrationWarning
      className="fixed w-full z-50 backdrop-blur-xl bg-[var(--color-bg-glass)]"
      style={{ borderBottom: '1px solid transparent', borderImage: 'var(--gradient-primary) 1' }}
    >
      <div className="container mx-auto px-5 h-14 flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="Go to Dashboard"
          >
            <Image
              src="/logo.jpg"
              alt="AI-Dost Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg object-cover border border-primary/30 shadow-[0_0_12px_var(--color-primary-glow)] transition-transform duration-300 group-hover:scale-105 shrink-0"
            />
            <span className="text-base font-extrabold text-text-primary tracking-tight group-hover:gradient-text transition-all duration-300">Ai-Dost</span>
          </div>

          {/* Mode toggle pill */}
          <div className="flex items-center bg-[var(--color-bg-glass)] backdrop-blur-md border border-border-subtle rounded-lg p-0.5 shadow-sm">
            <button
              suppressHydrationWarning
              onClick={() => setMode('chat')}
              className={`flex items-center justify-center px-3 h-7 rounded-md text-xs font-medium transition-all duration-300 cursor-pointer ${
                mode === 'chat'
                  ? 'text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              style={mode === 'chat' ? { background: 'var(--gradient-primary)' } : {}}
            >
              {mode === 'chat' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5" />}
              Chat
            </button>
            <button
              suppressHydrationWarning
              onClick={() => setMode('project')}
              className={`flex items-center justify-center px-3 h-7 rounded-md text-xs font-medium transition-all duration-300 cursor-pointer ${
                mode === 'project'
                  ? 'text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              style={mode === 'project' ? { background: 'var(--gradient-primary)' } : {}}
            >
              {mode === 'project' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5" />}
              Project
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Local Git Control Button */}
          <button 
            suppressHydrationWarning
            onClick={() => setShowGitModal(true)}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-success hover:shadow-[0_0_12px_rgba(34,197,94,0.3)] transition-all duration-300 cursor-pointer flex items-center gap-1.5"
            title="Local Git Control & Timeline Checkpoints"
          >
            <GitBranch className="w-4 h-4 text-success" />
            <span className="hidden sm:inline text-xs font-bold text-success">Git</span>
          </button>

          <button 
            suppressHydrationWarning
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-primary hover:shadow-[0_0_12px_var(--color-primary-glow)] transition-all duration-300 cursor-pointer"
            title={isLightTheme ? "Dark mode" : "Light mode"}
          >
            {isLightTheme ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button 
            suppressHydrationWarning
            onClick={handleSettingsClick}
            className={`p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-primary hover:shadow-[0_0_12px_var(--color-primary-glow)] transition-all duration-300 cursor-pointer ${settingsClicks > 0 ? 'text-primary animate-pulse border border-primary/40' : ''}`}
            title={settingsClicks > 0 ? `Secret Tap ${settingsClicks}/7 to unlock Personal Brain` : "Settings (Tap 7x for Secret Console)"}
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button 
            suppressHydrationWarning
            onClick={() => router.push('/about-me')}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-primary hover:shadow-[0_0_12px_var(--color-primary-glow)] transition-all duration-300 cursor-pointer"
            title="Profile"
          >
            <User className="w-4 h-4" />
          </button>
          
          <button 
            suppressHydrationWarning
            onClick={() => {
              if (confirm('Return to login?')) router.push('/');
            }}
            className="hidden md:block p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-primary hover:shadow-[0_0_12px_var(--color-primary-glow)] transition-all duration-300 cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
          
          <button
            suppressHydrationWarning
            aria-label={menuOpen ? "Close Menu" : "Open Menu"}
            className="md:hidden p-2 rounded-lg hover:bg-[var(--color-bg-glass)] text-text-muted hover:text-primary hover:shadow-[0_0_12px_var(--color-primary-glow)] transition-all duration-300 cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {menuOpen && (
        <div className="md:hidden bg-[var(--color-bg-glass)] backdrop-blur-xl border-b border-border-subtle p-4 absolute top-14 left-0 w-full z-40 animate-fadeIn shadow-lg">
          <div className="flex flex-col space-y-4">
            <button 
              onClick={() => { router.push('/about-me'); setMenuOpen(false); }}
              className="text-left font-medium text-text-primary hover:text-primary transition-colors text-sm cursor-pointer flex items-center gap-2"
            >
              <User className="w-4 h-4" /> Profile
            </button>
            <button 
              onClick={() => { setShowSettings(true); setMenuOpen(false); }}
              className="text-left font-medium text-text-primary hover:text-primary transition-colors text-sm cursor-pointer flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button 
              onClick={() => { router.push('/'); setMenuOpen(false); }}
              className="text-left font-medium text-text-primary hover:text-primary transition-colors text-sm cursor-pointer flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Login / Exit
            </button>
          </div>
        </div>
      )}

      {/* Glassmorphic Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fadeIn select-text">
          <div className="glass-card backdrop-blur-xl rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-scaleIn border border-border-subtle max-h-[85vh] overflow-y-auto my-auto custom-scrollbar">
            <h2 className="text-lg font-bold gradient-text mb-5 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Workspace Settings
            </h2>
            
            <div className="space-y-5 text-sm text-text-primary">
              {/* Auto Save */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-text-primary flex items-center gap-2">
                  <Save className="w-4 h-4 text-primary" /> Auto-Save Code Interval
                </label>
                <select
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(e.target.value)}
                  className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-shadow hover:shadow-[0_0_8px_var(--color-primary-glow)]"
                >
                  <option value="5">Every 5 Seconds</option>
                  <option value="10">Every 10 Seconds</option>
                  <option value="30">Every 30 Seconds</option>
                  <option value="manual">Manual Save Only</option>
                </select>
              </div>

              {/* Autocomplete */}
              <div className="flex items-center justify-between py-3 border-b border-border-subtle">
                <div>
                  <div className="font-semibold text-text-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> AI Code Autocomplete
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">Suggest inline code suggestions in Monaco</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autocompleteOn}
                    onChange={(e) => setAutocompleteOn(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-bg-card border border-border-subtle rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                </label>
              </div>

              {/* Custom API Keys */}
              <div className="flex flex-col gap-3 pt-2">
                <div className="text-xs font-bold gradient-text uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Custom API Keys (Optional)
                </div>
                
                <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-text-secondary">Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AI-Dost default key will be used if empty"
                      value={customGeminiKey}
                      onChange={(e) => setCustomGeminiKey(e.target.value)}
                      className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs transition-shadow focus:shadow-[0_0_8px_var(--color-primary-glow)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-text-secondary">Groq API Key</label>
                    <input
                      type="password"
                      placeholder="AI-Dost default key will be used if empty"
                      value={customGroqKey}
                      onChange={(e) => setCustomGroqKey(e.target.value)}
                      className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs transition-shadow focus:shadow-[0_0_8px_var(--color-primary-glow)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-text-secondary">DeepSeek API Key</label>
                    <input
                      type="password"
                      placeholder="AI-Dost default key will be used if empty"
                      value={customDeepSeekKey}
                      onChange={(e) => setCustomDeepSeekKey(e.target.value)}
                      className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs transition-shadow focus:shadow-[0_0_8px_var(--color-primary-glow)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-text-secondary">NVIDIA API Key</label>
                    <input
                      type="password"
                      placeholder="AI-Dost default key will be used if empty"
                      value={customNvidiaKey}
                      onChange={(e) => setCustomNvidiaKey(e.target.value)}
                      className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs transition-shadow focus:shadow-[0_0_8px_var(--color-primary-glow)]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-text-secondary">OpenRouter API Key</label>
                    <input
                      type="password"
                      placeholder="AI-Dost default key will be used if empty"
                      value={customOpenRouterKey}
                      onChange={(e) => setCustomOpenRouterKey(e.target.value)}
                      className="bg-[var(--color-bg-glass)] text-text-primary border border-border-subtle rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs transition-shadow focus:shadow-[0_0_8px_var(--color-primary-glow)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-[var(--color-bg-glass)] border border-border-subtle hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-bold transition-all cursor-pointer hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="gradient-btn px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret 7-Tap Personal Brain Console Modal */}
      <PersonalBrainModal 
        isOpen={showSecretBrainModal} 
        onClose={() => setShowSecretBrainModal(false)} 
      />

      {/* Local Git Version Control Modal */}
      <GitControlModal 
        isOpen={showGitModal} 
        onClose={() => setShowGitModal(false)} 
      />
    </header>
  );
};

export default Header;
