import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { CgProfile } from 'react-icons/cg';
import { AiOutlineSetting } from 'react-icons/ai';
import { HiLogin } from 'react-icons/hi';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useMode } from '../context/ModeContext';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { mode, setMode } = useMode();
  const router = useRouter();
  const [isLightTheme, setIsLightTheme] = useState(false);
  
  // Custom workspace settings states
  const [showSettings, setShowSettings] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState('10');
  const [autocompleteOn, setAutocompleteOn] = useState(true);
  const [customGeminiKey, setCustomGeminiKey] = useState('');
  const [customGroqKey, setCustomGroqKey] = useState('');
  const [customDeepSeekKey, setCustomDeepSeekKey] = useState('');
  const [customNvidiaKey, setCustomNvidiaKey] = useState('');
  const [customOpenRouterKey, setCustomOpenRouterKey] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      setIsLightTheme(true);
    }
    
    // Load config states from localStorage
    const savedAutoSave = localStorage.getItem('autoSave') || '10';
    const savedAutocomplete = localStorage.getItem('autocomplete') !== 'false';
    const savedGeminiKey = localStorage.getItem('customGeminiKey') || '';
    const savedGroqKey = localStorage.getItem('customGroqKey') || '';
    const savedDeepSeekKey = localStorage.getItem('customDeepSeekKey') || '';
    const savedNvidiaKey = localStorage.getItem('customNvidiaKey') || '';
    const savedOpenRouterKey = localStorage.getItem('customOpenRouterKey') || '';
    
    setAutoSaveInterval(savedAutoSave);
    setAutocompleteOn(savedAutocomplete);
    setCustomGeminiKey(savedGeminiKey);
    setCustomGroqKey(savedGroqKey);
    setCustomDeepSeekKey(savedDeepSeekKey);
    setCustomNvidiaKey(savedNvidiaKey);
    setCustomOpenRouterKey(savedOpenRouterKey);
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
    <header className="fixed w-full z-50 bg-bg-default border-b border-secondary/10">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div 
            onClick={() => router.push('/dashboard')}
            className="text-xl font-bold text-primary flex items-center cursor-pointer select-none"
            title="Go to Dashboard"
          >
            🤖 Ai-Dost
          </div>
          <input
            type="text"
            placeholder="Search projects, code, or memory..."
            className="w-80 p-2 rounded-lg bg-bg-hover text-text-primary border border-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <div className="flex items-center bg-bg-hover p-1 rounded-full border border-secondary/15 ml-4">
            <button
              onClick={() => setMode('chat')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition duration-300 cursor-pointer flex items-center gap-1.5 ${
                mode === 'chat'
                  ? 'bg-primary text-bg-default shadow-md shadow-primary/25'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              💬 Chat Mode
            </button>
            <button
              onClick={() => setMode('project')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition duration-300 cursor-pointer flex items-center gap-1.5 ${
                mode === 'project'
                  ? 'bg-primary text-bg-default shadow-md shadow-primary/25'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              📂 Project Mode
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-secondary/10 text-primary transition cursor-pointer"
            title={isLightTheme ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {isLightTheme ? <FiMoon className="text-xl" /> : <FiSun className="text-xl" />}
          </button>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full hover:bg-secondary/10 text-primary transition cursor-pointer"
            title="Settings"
          >
            <AiOutlineSetting className="text-xl" />
          </button>
          
          <button 
            onClick={() => router.push('/about-me')}
            className="p-2 rounded-full hover:bg-secondary/10 text-primary transition cursor-pointer"
            title="Profile / About Me"
          >
            <CgProfile className="text-xl" />
          </button>
          
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to exit and return to login?')) {
                router.push('/');
              }
            }}
            className="hidden md:block p-2 rounded-full hover:bg-secondary/10 text-primary transition cursor-pointer"
            title="Exit / Logout"
          >
            <HiLogin className="text-xl" />
          </button>
          
          <button
            className="md:hidden p-2 rounded-full hover:bg-secondary/10 text-primary cursor-pointer"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <span className="text-primary font-bold">✖</span>
            ) : (
              <span className="text-primary font-bold">☰</span>
            )}
          </button>
        </div>
      </div>
      
      {menuOpen && (
        <div className="md:hidden bg-bg-default border-b border-secondary/10 p-4 absolute top-16 left-0 w-full z-40">
          <div className="flex flex-col space-y-4">
            <button 
              onClick={() => { router.push('/about-me'); setMenuOpen(false); }}
              className="text-left text-primary hover:text-primary/80 transition text-sm cursor-pointer"
            >
              Profile
            </button>
            <button 
              onClick={() => { setShowSettings(true); setMenuOpen(false); }}
              className="text-left text-primary hover:text-primary/80 transition text-sm cursor-pointer"
            >
              Settings
            </button>
            <button 
              onClick={() => { router.push('/'); setMenuOpen(false); }}
              className="text-left text-primary hover:text-primary/80 transition text-sm cursor-pointer"
            >
              Login / Exit
            </button>
          </div>
        </div>
      )}

      {/* Glassmorphic Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-default border border-secondary/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              ⚙️ AI-Dost Workspace Settings
            </h2>
            
            <div className="space-y-4 text-sm text-text-primary">
              {/* Auto Save */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-text-primary">💾 Auto-Save Code Interval</label>
                <select
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(e.target.value)}
                  className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="5">Every 5 Seconds</option>
                  <option value="10">Every 10 Seconds</option>
                  <option value="30">Every 30 Seconds</option>
                  <option value="manual">Manual Save Only</option>
                </select>
              </div>

              {/* Autocomplete */}
              <div className="flex items-center justify-between py-2 border-b border-secondary/10">
                <div>
                  <div className="font-semibold text-text-primary">✨ AI Code Autocomplete</div>
                  <div className="text-[10px] text-text-secondary">Suggest inline code suggestions in Monaco</div>
                </div>
                <input
                  type="checkbox"
                  checked={autocompleteOn}
                  onChange={(e) => setAutocompleteOn(e.target.checked)}
                  className="w-4 h-4 text-primary bg-bg-hover rounded border-secondary/30 focus:ring-primary focus:ring-opacity-20 accent-primary cursor-pointer"
                />
              </div>

              {/* Custom API Keys */}
              <div className="flex flex-col gap-2.5 pt-2 border-t border-secondary/10">
                <div className="text-xs font-bold text-primary uppercase tracking-wider">🔑 Custom API Keys (Optional)</div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-text-secondary">Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AI-Dost default key will be used if empty"
                    value={customGeminiKey}
                    onChange={(e) => setCustomGeminiKey(e.target.value)}
                    className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-text-secondary">Groq API Key</label>
                  <input
                    type="password"
                    placeholder="AI-Dost default key will be used if empty"
                    value={customGroqKey}
                    onChange={(e) => setCustomGroqKey(e.target.value)}
                    className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-text-secondary">DeepSeek API Key</label>
                  <input
                    type="password"
                    placeholder="AI-Dost default key will be used if empty"
                    value={customDeepSeekKey}
                    onChange={(e) => setCustomDeepSeekKey(e.target.value)}
                    className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-text-secondary">NVIDIA API Key</label>
                  <input
                    type="password"
                    placeholder="AI-Dost default key will be used if empty"
                    value={customNvidiaKey}
                    onChange={(e) => setCustomNvidiaKey(e.target.value)}
                    className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-text-secondary">OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="AI-Dost default key will be used if empty"
                    value={customOpenRouterKey}
                    onChange={(e) => setCustomOpenRouterKey(e.target.value)}
                    className="bg-bg-hover text-text-primary border border-secondary/30 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 border border-secondary/20 hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 bg-primary text-bg-default hover:bg-primary/80 rounded-lg text-xs font-bold transition cursor-pointer shadow-md shadow-primary/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
