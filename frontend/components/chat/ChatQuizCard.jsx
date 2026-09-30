import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

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
      return <div className="text-red-400 text-xs my-2 bg-red-500/10 p-2 rounded border border-red-500/20">Error rendering quiz format.</div>;
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
      // While streaming, JSON might be incomplete
      return null;
    }
  }, [content]);

  if (!quizData || !quizData.question || !Array.isArray(quizData.options)) {
    return <div className="text-[#94a3b8] text-xs my-2 animate-pulse">Generating quiz...</div>;
  }

  return (
    <div className="my-3 bg-white/[0.02] border border-cyan-500/20 rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-bold uppercase mb-3">
        <span>🧠</span> Quick Quiz
      </div>
      <div className="text-[#f8fafc] text-sm font-medium mb-4 leading-relaxed">{quizData.question}</div>
      <div className="space-y-2.5">
        {quizData.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === quizData.answer;
          const showResult = selected !== null;
          
          let btnClass = "border-white/[0.08] hover:bg-white/[0.05] text-[#cbd5e1]";
          if (showResult) {
            if (isCorrect) btnClass = "bg-green-500/10 border-green-500/40 text-green-400";
            else if (isSelected && !isCorrect) btnClass = "bg-red-500/10 border-red-500/40 text-red-400";
            else btnClass = "opacity-40 border-white/[0.05] text-[#94a3b8]";
          }
          
          return (
            <button
              key={i}
              disabled={showResult}
              onClick={() => setSelected(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-300 cursor-pointer ${btnClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <div className={`mt-4 text-xs font-bold ${selected === quizData.answer ? 'text-green-400' : 'text-red-400'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          {selected === quizData.answer ? '🎉 Correct!' : '❌ Incorrect. Try asking me for an explanation!'}
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
