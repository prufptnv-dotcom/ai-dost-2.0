import { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_dost_layout_mode') || 'project';
    }
    return 'project';
  });

  const changeMode = (newMode) => {
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_dost_layout_mode', newMode);
    }
  };

  return (
    <ModeContext.Provider value={{ mode, setMode: changeMode }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
