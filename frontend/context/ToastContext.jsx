import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback(({ type, message }) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setToast({ type, message });
    timerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  useEffect(() => {
    const handleGlobalToast = (e) => {
      showToast(e.detail);
    };
    window.addEventListener('ai_dost_toast', handleGlobalToast);
    return () => {
      window.removeEventListener('ai_dost_toast', handleGlobalToast);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [showToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg text-sm transition-all duration-300 ${
          toast.type === 'error' 
            ? 'bg-warning text-text-primary' 
            : 'bg-primary text-bg-default font-bold'
        }`}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
