// frontend/components/VisualHealer.jsx
import React, { useEffect } from 'react';
import { initVisualHealer, getPendingSuggestions } from '../utils/visualHealer';
import { useToast } from '../context/ToastContext';

/**
 * VisualHealer component – boots the zero‑cost visual healing engine and
 * surfaces any heuristic suggestions as toast notifications.
 */
export default function VisualHealer() {
  const { showToast } = useToast();

  // Initialise the visual healer once.
  useEffect(() => {
    const cleanup = initVisualHealer();
    return cleanup;
  }, []);

  // Poll for pending suggestions and display them via toast.
  useEffect(() => {
    const interval = setInterval(() => {
      const suggestions = getPendingSuggestions();
      suggestions.forEach(s => {
        const msg = typeof s === 'string' ? s : s.description || JSON.stringify(s);
        showToast({ type: 'info', message: msg });
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [showToast]);

  // No UI – all work is side‑effectful.
  return null;
}
