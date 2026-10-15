import React from 'react';
import { Play, Clock, HelpCircle, AlertCircle, Award, CheckCircle2 } from 'lucide-react';

export function AssessmentCard({ assessment, onStart }) {
  if (!assessment) return null;

  const modeColors = {
    practice: 'bg-accent/15 text-accent border-accent/30',
    mock: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    interview: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    adaptive: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  };

  const difficultyColors = {
    beginner: 'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced: 'text-rose-400',
    mixed: 'text-cyan-400'
  };

  const timeDisplay = assessment.timeLimit > 0
    ? `${Math.round(assessment.timeLimit / 60)} Mins`
    : 'Untimed';

  return (
    <div className="mt-3 p-4 rounded-xl bg-canvas-elevated border border-border shadow-md max-w-lg transition-all hover:border-accent/40">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${modeColors[assessment.mode] || modeColors.practice}`}>
              {assessment.mode}
            </span>
            <span className={`text-xs font-medium capitalize ${difficultyColors[assessment.difficulty] || 'text-ink-muted'}`}>
              {assessment.difficulty}
            </span>
          </div>
          <h4 className="text-sm font-bold text-paper-100 tracking-tight">
            {assessment.title}
          </h4>
          <p className="text-xs text-ink-muted mt-0.5">
            Subject: <span className="text-paper-200">{assessment.subject}</span> • Topic: <span className="text-paper-200">{assessment.topic}</span>
          </p>
        </div>
        <div className="p-2 rounded-lg bg-canvas-overlay border border-border shrink-0">
          <Award className="w-5 h-5 text-accent" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-2 my-2 border-y border-border-subtle text-[11px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-accent" />
          <span>{assessment.questionCount || assessment.questions?.length || 0} Questions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{timeDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>{assessment.negativeMarks > 0 ? `-${assessment.negativeMarks} Negative` : 'No Negative'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-ink-muted flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Interactive Assessment Ready
        </span>
        <button
          onClick={() => onStart && onStart(assessment)}
          className="px-3.5 py-1.5 rounded-lg bg-accent text-white font-medium text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Launch Assessment
        </button>
      </div>
    </div>
  );
}

export default AssessmentCard;
