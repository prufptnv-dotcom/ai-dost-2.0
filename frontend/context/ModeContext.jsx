import { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState('project'); // 'project' | 'chat'

  useEffect(() => {
    const savedMode = localStorage.getItem('ai_dost_layout_mode');
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);

  const changeMode = (newMode) => {
    setMode(newMode);
    localStorage.setItem('ai_dost_layout_mode', newMode);
  };

  return (
    <ModeContext.Provider value={{ mode, setMode: changeMode }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
