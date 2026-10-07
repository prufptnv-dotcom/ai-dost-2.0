import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '../ui/AppIcon';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'factual_error', label: 'Galat Info / Factual Error' },
  { id: 'code_bug', label: 'Code Bug / Error' },
  { id: 'incomplete', label: 'Adhura Jawab' },
  { id: 'language_tone', label: 'Bhasha / Tone Issue' },
  { id: 'hallucination', label: 'Incorrect Assumption' },
  { id: 'other', label: 'Kuch Aur' }
];

const PRESET_CORRECTIONS = [
  'Code complete aur directly working hona chahiye',
  'Answer seedha point-to-point do',
  'Hindi/Hinglish me asaan shabdon me samjhao',
  '3D Anime.js animation canvas me dikhao',
  'Real latest data use karo'
];

export default function FeedbackModal({
  isOpen,
  onClose,
  initialType = 'negative',
  messageContent = '',
  onSuccess
}) {
  const [feedbackType, setFeedbackType] = useState(initialType);
  const [category, setCategory] = useState('factual_error');
  const [correction, setCorrection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await api.post('/learning/feedback', {
        type: feedbackType,
        category,
        message: messageContent ? messageContent.slice(0, 500) : '',
        correction: correction.trim(),
        projectId: 'default'
      });

      setSubmitted(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', {
          detail: {
            type: 'success',
            message: 'Feedback recorded! AI-Dost Personal Brain has learned this correction.'
          }
        }));
      }

      setTimeout(() => {
        if (onSuccess) onSuccess({ type: feedbackType, category, correction });
        onClose();
        setSubmitted(false);
        setCorrection('');
      }, 1000);
    } catch (err) {
      console.error('Feedback submit error:', err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', {
          detail: {
            type: 'error',
            message: 'Feedback save nahi ho paya. Dobara try karein.'
          }
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-border bg-canvas-elevated shadow-2xl p-5 text-paper-100 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <AppIcon name="message" size={16} />
              </div>
              <div>
                <h3 id="feedback-title" className="text-sm font-semibold text-paper-100">
                  Feedback & Teach AI
                </h3>
                <p className="text-[11px] text-ink-muted">
                  Aapka feedback AI-Dost ki accuracy 100% banata hai
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-colors cursor-pointer"
              aria-label="Close"
            >
              <AppIcon name="close" size={16} />
            </button>
          </div>

          {submitted ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                <AppIcon name="check" size={22} />
              </div>
              <h4 className="text-sm font-semibold text-paper-100">Dhanyawad! Feedback Saved</h4>
              <p className="text-xs text-ink-muted">
                AI-Dost ne aapka rule Personal Brain memory mein update kar liya hai.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="flex items-center gap-1 bg-canvas-surface p-1 rounded-xl border border-border-subtle">
                <button
                  type="button"
                  onClick={() => setFeedbackType('positive')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    feedbackType === 'positive'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'text-ink-muted hover:text-paper-100'
                  }`}
                >
                  <AppIcon name="thumbsUp" size={13} /> Sahi Tha (Accurate)
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('negative')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    feedbackType === 'negative'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                      : 'text-ink-muted hover:text-paper-100'
                  }`}
                >
                  <AppIcon name="thumbsDown" size={13} /> Sudhar Chahiye (Incorrect)
                </button>
              </div>

              <div>
                <label className="text-[11px] font-medium text-ink-muted mb-1.5 block">
                  Category chunein:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        category === cat.id
                          ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                          : 'bg-canvas-surface border-border text-paper-200 hover:bg-canvas-elevated'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-ink-muted mb-1.5 flex items-center justify-between">
                  <span>Sahi answer ya rule kya hona chahiye?</span>
                  <span className="text-[10px] text-accent flex items-center gap-1">
                    <AppIcon name="sparkles" size={10} /> 100% Accuracy Engine
                  </span>
                </label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="Jaise: 'Isko pure 3D Anime.js canvas me likhna tha' ya 'Bihar ki GDP sahi likho'..."
                  rows={3}
                  className="w-full text-xs rounded-xl bg-canvas-surface border border-border p-3 text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-accent/40 resize-none transition-colors"
                />
              </div>

              <div>
                <span className="text-[10px] text-ink-muted block mb-1.5">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_CORRECTIONS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCorrection(preset)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-canvas-surface text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated border border-border-subtle transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-all shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    'Saving...'
                  ) : (
                    <>
                      <AppIcon name="send" size={12} /> Submit & Teach AI
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
