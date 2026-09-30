import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ModeContext = createContext({
  mode: 'project',
  setMode: () => {},
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
});

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState('project');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('ai_dost_layout_mode');
      if (savedMode) {
        setMode(savedMode);
      }
      const savedPrivacy = localStorage.getItem('ai_dost_privacy_mode');
      if (savedPrivacy) {
        setIsPrivacyMode(savedPrivacy === 'true');
      }
    } catch (_) { /* localStorage unavailable (private mode etc.) */ }
  }, []);

  const changeMode = useCallback((newMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('ai_dost_layout_mode', newMode); } catch (_) {}
    }
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('ai_dost_privacy_mode', String(next)); } catch (_) {}
        
        // Dispatch a custom event so other components (like api.js) can react if needed
        window.dispatchEvent(new CustomEvent('ai_dost_privacy_toggled', { detail: next }));
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, setMode: changeMode, isPrivacyMode, togglePrivacyMode }),
    [mode, changeMode, isPrivacyMode, togglePrivacyMode]
  );

  return (
    <ModeContext.Provider value={value}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
