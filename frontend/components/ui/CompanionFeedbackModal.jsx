import { ThumbsDown } from 'lucide-react';

export function CompanionFeedbackModal({
  showFeedbackModal, setShowFeedbackModal, feedbackCategory, setFeedbackCategory, correctionText, setCorrectionText, handleSubmitFeedback
}) {
  if (!showFeedbackModal) return null;
  return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-text">
          <div className="w-full max-w-md bg-bg-card border border-warning/40 rounded-2xl p-6 shadow-2xl space-y-4 relative noise-overlay">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-warning font-bold text-sm">
                <ThumbsDown className="w-4 h-4" />
                <span>Teach & Correct Personal Brain Model</span>
              </div>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Aapke iss feedback se **Personal AI-Dost Model** apni galti samjhega aur learning memory me save karke Future responses ko sudharega!
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">What needs improvement?</label>
              <select
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
                className="w-full bg-bg-hover text-text-primary border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="typo">Spelling or Grammar Typo</option>
                <option value="code_error">Code Failed to Run or Had Bugs</option>
                <option value="inaccurate">Inaccurate / Hallucinated Information</option>
                <option value="custom">Other Custom Issue</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Enter your correction/instruction:</label>
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="Example: Always write clean python code without typos and use proper exception handling..."
                className="w-full h-24 p-3 bg-bg-hover text-text-primary border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary font-sans resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 bg-bg-hover border border-border text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="gradient-btn px-5 py-2 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                🧠 Submit & Self-Correct
              </button>
            </div>
          </div>
        </div>
  );
}