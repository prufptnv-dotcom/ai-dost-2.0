import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  React.useEffect(() => {
    const handleGlobalToast = (e) => {
      showToast(e.detail);
    };
    window.addEventListener('ai_dost_toast', handleGlobalToast);
    return () => window.removeEventListener('ai_dost_toast', handleGlobalToast);
  }, []);

  const showToast = ({ type, message }) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
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
