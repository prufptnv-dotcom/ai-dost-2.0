import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, X, Check, Sparkles, Send, MessageSquareQuote, ShieldAlert } from 'lucide-react';
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
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d111c]/95 shadow-2xl p-5 text-paper-100 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <MessageSquareQuote size={18} />
              </div>
              <div>
                <h3 id="feedback-title" className="text-sm font-semibold text-white">
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
              className="p-1 rounded-lg text-ink-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          {submitted ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
                <Check size={24} />
              </div>
              <h4 className="text-sm font-semibold text-white">Dhanyawad! Feedback Saved</h4>
              <p className="text-xs text-ink-muted">
                AI-Dost ne aapka rule Personal Brain memory mein update kar liya hai.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setFeedbackType('positive')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    feedbackType === 'positive'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-ink-muted hover:text-white'
                  }`}
                >
                  <ThumbsUp size={14} /> Sahi Tha (Accurate)
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackType('negative')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    feedbackType === 'negative'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'text-ink-muted hover:text-white'
                  }`}
                >
                  <ThumbsDown size={14} /> Sudhar Chahiye (Incorrect)
                </button>
              </div>

              {/* Category Chips */}
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
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                        category === cat.id
                          ? 'bg-accent/20 border-accent/40 text-accent font-medium'
                          : 'bg-white/5 border-white/10 text-paper-200 hover:bg-white/10'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Correction / Instruction input */}
              <div>
                <label className="text-[11px] font-medium text-ink-muted mb-1.5 flex items-center justify-between">
                  <span>Sahi answer ya rule kya hona chahiye?</span>
                  <span className="text-[10px] text-accent flex items-center gap-1">
                    <Sparkles size={11} /> 100% Accuracy Engine
                  </span>
                </label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="Jaise: 'Isko pure 3D Anime.js canvas me likhna tha' ya 'Bihar ki GDP sahi likho'..."
                  rows={3}
                  className="w-full text-xs rounded-xl bg-black/40 border border-white/15 p-3 text-white placeholder-white/30 focus:outline-none focus:border-accent resize-none transition-colors"
                />
              </div>

              {/* Preset quick suggestions */}
              <div>
                <span className="text-[10px] text-ink-muted block mb-1">Quick Suggestions:</span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_CORRECTIONS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCorrection(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-ink-muted hover:text-white hover:bg-white/10 border border-white/5 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs text-ink-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-black hover:opacity-90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {submitting ? (
                    'Saving...'
                  ) : (
                    <>
                      <Send size={13} /> Submit & Teach AI
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
