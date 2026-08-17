import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Key, Save, ChevronDown, Mic, Music, Bot, Folder, LayoutDashboard, MessageSquare, Image as ImageIcon, Zap, Trash2, Eye, EyeOff, Sun, Moon, Palette, Lifejacket, ArrowLeftArrowRight, Lock, Shield, Volume2, VolumeX, MicOff, Bot as BotIcon, Paperclip, Send, Library, ThumbsUp, ThumbsDown, Maximize2, Minimize2, MoveHorizontal, Search, Play, FolderOpen, GitBranch, Terminal, Code, CheckCircle, Loader2, Plus, XCircle, Info, Sparkles, FileText } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';

export default function SettingsModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('chat');
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState('10');
  const [autocompleteOn, setAutocompleteOn] = useState(true);
  const [customGeminiKey, setCustomGeminiKey] = useState('');
  const [customGroqKey, setCustomGroqKey] = useState('');
  const [customDeepSeekKey, setCustomDeepSeekKey] = useState('');
  const [customNvidiaKey, setCustomNvidiaKey] = useState('');
  const [customOpenRouterKey, setCustomOpenRouterKey] = useState('');
  
  // Voice Assistant config
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [voiceVoice, setVoiceVoice] = useState('Puck');
  const [voiceAutoStart, setVoiceAutoStart] = useState(false);
  
  // Resume Builder config
  const [resumeTemplate, setResumeTemplate] = useState('professional');
  const [resumeAutoDownload, setResumeAutoDownload] = useState(true);
  
  // Copilot Workspace config
  const [copilotTheme, setCopilotTheme] = useState('vs-dark');
  const [copilotFontSize, setCopilotFontSize] = useState(14);
  const [copilotAutoSave, setCopilotAutoSave] = useState(true);
  
  const { showToast } = useToast();

  // Load client-only localStorage settings after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      document.body.classList.toggle('light-theme', storedTheme === 'light');
      setIsLightTheme(storedTheme === 'light');
    }
    
    if (localStorage.getItem('autoSave')) setAutoSaveInterval(localStorage.getItem('autoSave'));
    if (localStorage.getItem('autocomplete') === 'false') setAutocompleteOn(false);
    if (localStorage.getItem('customGeminiKey')) setCustomGeminiKey(localStorage.getItem('customGeminiKey'));
    if (localStorage.getItem('customGroqKey')) setCustomGroqKey(localStorage.getItem('customGroqKey'));
    if (localStorage.getItem('customDeepSeekKey')) setCustomDeepSeekKey(localStorage.getItem('customDeepSeekKey'));
    if (localStorage.getItem('customNvidiaKey')) setCustomNvidiaKey(localStorage.getItem('customNvidiaKey'));
    if (localStorage.getItem('customOpenRouterKey')) setCustomOpenRouterKey(localStorage.getItem('customOpenRouterKey'));
    if (localStorage.getItem('voiceLanguage')) setVoiceLanguage(localStorage.getItem('voiceLanguage'));
    if (localStorage.getItem('voiceVoice')) setVoiceVoice(localStorage.getItem('voiceVoice'));
    if (localStorage.getItem('voiceAutoStart') === 'true') setVoiceAutoStart(true);
    if (localStorage.getItem('resumeTemplate')) setResumeTemplate(localStorage.getItem('resumeTemplate'));
    if (localStorage.getItem('resumeAutoDownload') === 'true') setResumeAutoDownload(true);
    if (localStorage.getItem('copilotTheme')) setCopilotTheme(localStorage.getItem('copilotTheme'));
    if (localStorage.getItem('copilotFontSize')) setCopilotFontSize(parseInt(localStorage.getItem('copilotFontSize'), 10));
    if (localStorage.getItem('copilotAutoSave') === 'false') setCopilotAutoSave(false);
  }, []);

  const saveSettings = () => {
    localStorage.setItem('autoSave', autoSaveInterval);
    localStorage.setItem('autocomplete', autocompleteOn ? 'true' : 'false');
    localStorage.setItem('customGeminiKey', customGeminiKey);
    localStorage.setItem('customGroqKey', customGroqKey);
    localStorage.setItem('customDeepSeekKey', customDeepSeekKey);
    localStorage.setItem('customNvidiaKey', customNvidiaKey);
    localStorage.setItem('customOpenRouterKey', customOpenRouterKey);
    localStorage.setItem('voiceLanguage', voiceLanguage);
    localStorage.setItem('voiceVoice', voiceVoice);
    localStorage.setItem('voiceAutoStart', voiceAutoStart.toString());
    localStorage.setItem('resumeTemplate', resumeTemplate);
    localStorage.setItem('resumeAutoDownload', resumeAutoDownload.toString());
    localStorage.setItem('copilotTheme', copilotTheme);
    localStorage.setItem('copilotFontSize', copilotFontSize.toString());
    localStorage.setItem('copilotAutoSave', copilotAutoSave.toString());
    setIsLightTheme(false); // reset to check below
    if (typeof window !== 'undefined') {
      if (isLightTheme) {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        setIsLightTheme(true);
      } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    }
    showToast?.({ type: 'success', message: '✅ Settings saved!' });
    onClose();
  };

  const toggleTheme = () => {
    setIsLightTheme(!isLightTheme);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={e => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,11,18,0.97)',
              border: '1px solid rgba(6,182,212,0.15)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.06)',
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <LayoutDashboard className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 id="settings-title" className="font-bold text-white text-lg">Settings</h2>
                  <p className="text-[11px] text-[#64748b]">Personalize your Waaw experience</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Theme Toggle */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-wider mb-2">Theme</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleTheme}
                    className={"w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 " + (isLightTheme ? 'bg-white/10 text-white' : 'bg-white/5')}
                    style={{ border: isLightTheme ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                  >
                    {isLightTheme ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-cyan-400" />}
                  </button>
                  <span className={`text-sm font-medium text-white ${isLightTheme ? 'dark:text-black' : ''}`}>
                    {isLightTheme ? 'Light' : 'Dark'}
                  </span>
                </div>
              </div>

              {/* Autocomplete Toggle */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" /> AI Autocomplete
                </label>
                <div className="flex items-center justify-between py-3 rounded-xl px-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-sm">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" /> AI Autocomplete
                    </div>
                    <div className="text-[11px] text-[#64748b]">Inline code suggestions in Monaco editor</div>
                  </div>
                  <button
                    onClick={() => setAutocompleteOn(v => !v)}
                    className="relative w-10 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0"
                    style={{ background: autocompleteOn ? '#06b6d4' : 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
                      style={{ left: autocompleteOn ? '22px' : '4px' }}
                    />
                  </button>
                </div>
              </div>

              {/* API Keys Section */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <Key className="w-3 h-3" /> Custom API Keys (Optional)
                </label>
                <div className="space-y-3">
                  {[
                    { label: 'Gemini', val: customGeminiKey, set: setCustomGeminiKey, color: '#4285f4', placeholder: 'Leave empty to use Waaw default' },
                    { label: 'Groq', val: customGroqKey, set: setCustomGroqKey, color: '#f7971e', placeholder: 'Leave empty to use Waaw default' },
                    { label: 'DeepSeek', val: customDeepSeekKey, set: setCustomDeepSeekKey, color: '#06b6d4', placeholder: 'Leave empty to use Waaw default' },
                    { label: 'NVIDIA', val: customNvidiaKey, set: setCustomNvidiaKey, color: '#76b900', placeholder: 'Leave empty to use Waaw default' },
                    { label: 'OpenRouter', val: customOpenRouterKey, set: setCustomOpenRouterKey, color: '#8b5cf6', placeholder: 'Leave empty to use Waaw default' },
                  ].map(({ label, val, set, color, placeholder }) => (
                    <div key={label} className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium" style={{ color }}>
                        {label} API Key
                      </label>
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder={placeholder}
                        value={val}
                        onChange={e => set(e.target.value)}
                        className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] placeholder-[#334155] focus:outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + color + '20' }}
                        onFocus={e => { e.target.style.borderColor = '' + color + '50'; e.target.style.boxShadow = '' + color + '15'; }}
                        onBlur={e => { e.target.style.borderColor = '' + color + '20'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice Assistant Config */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <Mic className="w-3 h-3" /> Voice Assistant
                </label>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium" style={{ color: '#06b6d4' }}>
                      Language
                    </label>
                    <select
                      value={voiceLanguage}
                      onChange={e => setVoiceLanguage(e.target.value)}
                      className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(6,182,212,0.2)' }}
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                      <option value="ja-JP">Japanese</option>
                      <option value="ko-KR">Korean</option>
                      <option value="zh-CN">Chinese</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium" style={{ color: '#06b6d4' }}>
                      Voice
                    </label>
                    <select
                      value={voiceVoice}
                      onChange={e => setVoiceVoice(e.target.value)}
                      className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(6,182,212,0.2)' }}
                    >
                      <option value="Puck">Puck (Upbeat)</option>
                      <option value="Charon">Charon (Informative)</option>
                      <option value="Kore">Kore (Firm)</option>
                      <option value="Fenrir">Fenrir (Excitable)</option>
                      <option value="Aoede">Aoede (Breezy)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-3 rounded-xl px-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-sm">
                        <Mic className="w-3.5 h-3.5 text-cyan-400" /> Auto-start voice on open
                      </div>
                      <div className="text-[11px] text-[#64748b]">Automatically start listening when Voice Assistant opens</div>
                    </div>
                    <button
                      onClick={() => setVoiceAutoStart(v => !v)}
                      className="relative w-10 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0"
                      style={{ background: voiceAutoStart ? '#06b6d4' : 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
                        style={{ left: voiceAutoStart ? '22px' : '4px' }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Resume Builder Config */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <FileText className="w-3 h-3" /> Resume Builder
                </label>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium" style={{ color: '#10b981' }}>
                      Default Template
                    </label>
                    <select
                      value={resumeTemplate}
                      onChange={e => setResumeTemplate(e.target.value)}
                      className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(16,185,129,0.2)' }}
                    >
                      <option value="professional">Professional</option>
                      <option value="creative">Creative</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-3 rounded-xl px-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-sm">
                        <FileText className="w-3.5 h-3.5 text-green-400" /> Auto-download resume
                      </div>
                      <div className="text-[11px] text-[#64748b]">Automatically download HTML resume after generation</div>
                    </div>
                    <button
                      onClick={() => setResumeAutoDownload(v => !v)}
                      className="relative w-10 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0"
                      style={{ background: resumeAutoDownload ? '#10b981' : 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
                        style={{ left: resumeAutoDownload ? '22px' : '4px' }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Copilot Workspace Config */}
              <div>
                <label className="font-semibold text-[#e2e8f0] text-xs uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <Bot className="w-3 h-3" /> Copilot Workspace
                </label>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium" style={{ color: '#8b5cf6' }}>
                      Editor Theme
                    </label>
                    <select
                      value={copilotTheme}
                      onChange={e => setCopilotTheme(e.target.value)}
                      className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}
                    >
                      <option value="vs-dark">Dark (Default)</option>
                      <option value="vs-light">Light</option>
                      <option value="hc-black">High Contrast Dark</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-medium" style={{ color: '#8b5cf6' }}>
                      Font Size
                    </label>
                    <select
                      value={copilotFontSize}
                      onChange={e => setCopilotFontSize(parseInt(e.target.value, 10))}
                      className="rounded-xl px-3 py-2 text-xs text-[#e2e8f0] cursor-pointer focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}
                    >
                      <option value="12">12px</option>
                      <option value="13">13px</option>
                      <option value="14">14px (Default)</option>
                      <option value="15">15px</option>
                      <option value="16">16px</option>
                      <option value="18">18px</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between py-3 rounded-xl px-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="font-semibold text-[#e2e8f0] flex items-center gap-2 text-sm">
                        <Bot className="w-3.5 h-3.5 text-purple-400" /> Auto-save files
                      </div>
                      <div className="text-[11px] text-[#64748b]">Automatically save file changes to backend</div>
                    </div>
                    <button
                      onClick={() => setCopilotAutoSave(v => !v)}
                      className="relative w-10 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0"
                      style={{ background: copilotAutoSave ? '#8b5cf6' : 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300"
                        style={{ left: copilotAutoSave ? '22px' : '4px' }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={onClose}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}