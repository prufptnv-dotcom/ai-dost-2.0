import { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState('project');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('ai_dost_layout_mode');
    if (savedMode) {
      setMode(savedMode);
    }
    const savedPrivacy = localStorage.getItem('ai_dost_privacy_mode');
    if (savedPrivacy) {
      setIsPrivacyMode(savedPrivacy === 'true');
    }
  }, []);

  const changeMode = (newMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_dost_layout_mode', newMode);
    }
  };

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai_dost_privacy_mode', String(next));
        
        // Dispatch a custom event so other components (like api.js) can react if needed
        window.dispatchEvent(new CustomEvent('ai_dost_privacy_toggled', { detail: next }));
      }
      return next;
    });
  };

  return (
    <ModeContext.Provider value={{ mode, setMode: changeMode, isPrivacyMode, togglePrivacyMode }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
