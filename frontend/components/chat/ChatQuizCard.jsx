import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import AppIcon from '../ui/AppIcon';

class QuizErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ChatQuizCard Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-red-400 text-xs my-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">Error rendering quiz format.</div>;
    }
    return this.props.children;
  }
}

function ChatQuizCardInner({ content }) {
  const [selected, setSelected] = useState(null);

  const quizData = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }, [content]);

  if (!quizData || !quizData.question || !Array.isArray(quizData.options)) {
    return <div className="text-ink-muted text-xs my-2 animate-pulse flex items-center gap-2"><AppIcon name="loader" size={12} /> Generating quiz...</div>;
  }

  return (
    <div className="my-3 bg-canvas-elevated border border-cyan-500/15 rounded-xl p-4 shadow-xs">
      <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-bold uppercase mb-3 tracking-wider">
        <AppIcon name="brain" size={13} /> Quick Quiz
      </div>
      <div className="text-paper-100 text-sm font-medium mb-4 leading-relaxed">{quizData.question}</div>
      <div className="space-y-2">
        {quizData.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === quizData.answer;
          const showResult = selected !== null;

          let btnClass = "border-border hover:bg-canvas-surface text-paper-200";
          if (showResult) {
            if (isCorrect) btnClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
            else if (isSelected && !isCorrect) btnClass = "bg-red-500/10 border-red-500/30 text-red-400";
            else btnClass = "opacity-40 border-border-subtle text-ink-muted";
          }

          return (
            <button
              key={i}
              disabled={showResult}
              onClick={() => setSelected(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 cursor-pointer ${btnClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className={`mt-4 text-xs font-semibold ${selected === quizData.answer ? 'text-emerald-400' : 'text-red-400'}`}>
          {selected === quizData.answer ? 'Correct! Well done.' : 'Incorrect. Try asking me for an explanation!'}
        </div>
      )}
    </div>
  );
}

ChatQuizCardInner.propTypes = {
  content: PropTypes.string.isRequired,
};

export function ChatQuizCard(props) {
  return (
    <QuizErrorBoundary>
      <ChatQuizCardInner {...props} />
    </QuizErrorBoundary>
  );
}

ChatQuizCard.propTypes = {
  content: PropTypes.string.isRequired,
};
