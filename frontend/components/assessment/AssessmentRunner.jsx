import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Clock, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
  CheckCircle, XCircle, AlertCircle, Award, RotateCcw,
  Sparkles, Check, HelpCircle, FileText, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

export function AssessmentRunner({ assessment, onClose, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [secondsRemaining, setSecondsRemaining] = useState(assessment?.timeLimit || 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attemptId, setAttemptId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [result, setResult] = useState(null);
  const [revealedPracticeAnswers, setRevealedPracticeAnswers] = useState({});
  const [showHint, setShowHint] = useState({});
  const [shortAnswerFeedback, setShortAnswerFeedback] = useState({});
  const [evaluatingShortAnswer, setEvaluatingShortAnswer] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState({});

  const isPractice = assessment?.mode === 'practice';
  const isMock = assessment?.mode === 'mock';
  const questions = assessment?.questions || [];
  const currentQ = questions[currentIndex] || {};

  // Initialize or restore session
  useEffect(() => {
    if (!assessment?.id) return;
    const storageKey = `ai_dost_assessment_${assessment.id}`;

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.marked) setMarkedForReview(new Set(parsed.marked));
        if (parsed.currentIndex !== undefined) setCurrentIndex(parsed.currentIndex);
        if (parsed.secondsRemaining !== undefined && assessment.timeLimit > 0) {
          setSecondsRemaining(parsed.secondsRemaining);
        }
        if (parsed.attemptId) setAttemptId(parsed.attemptId);
      } catch (_) {}
    }

    // Call start endpoint if no attemptId
    fetch(`/api/assessment/${assessment.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: assessment.mode })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.attemptId) {
          setAttemptId(data.attemptId);
        }
      })
      .catch(() => {});
  }, [assessment?.id, assessment?.mode, assessment?.timeLimit]);

  // Persist session to localStorage
  useEffect(() => {
    if (!assessment?.id || result) return;
    const storageKey = `ai_dost_assessment_${assessment.id}`;
    const payload = {
      answers,
      marked: Array.from(markedForReview),
      currentIndex,
      secondsRemaining,
      attemptId
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {}
  }, [assessment?.id, answers, markedForReview, currentIndex, secondsRemaining, attemptId, result]);

  // Submit test handler
  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (isSubmitting || result) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const res = await fetch(`/api/assessment/${assessment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers,
          timeSpentSeconds: elapsedSeconds,
          isAutoSubmit
        })
      });

      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
        if (onComplete) onComplete(data.result);
        try {
          localStorage.removeItem(`ai_dost_assessment_${assessment.id}`);
        } catch (_) {}
      } else {
        alert('Failed to evaluate assessment: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error submitting assessment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, result, assessment?.id, attemptId, answers, elapsedSeconds, onComplete]);

  // Active Timer Loop
  useEffect(() => {
    if (result || isSubmitting) return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);

      if (assessment.timeLimit > 0) {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmit(true); // Auto-submit on expiry
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [assessment?.timeLimit, result, isSubmitting, handleSubmit]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (result || isSubmitting) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'n') {
        if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
      } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        const keyMap = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 };
        const optIdx = keyMap[e.key.toLowerCase()];
        if (currentQ.type === 'mcq' || currentQ.type === 'true-false') {
          if (optIdx < (currentQ.options?.length || 0)) {
            handleSelectOption(currentQ.id, optIdx);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length, currentQ, result, isSubmitting]);

  // Option selection
  const handleSelectOption = (qId, optIdx) => {
    if (currentQ.type === 'multiple-select') {
      const existing = Array.isArray(answers[qId]) ? [...answers[qId]] : [];
      const pos = existing.indexOf(optIdx);
      if (pos === -1) existing.push(optIdx);
      else existing.splice(pos, 1);
      setAnswers(prev => ({ ...prev, [qId]: existing }));
    } else {
      setAnswers(prev => ({ ...prev, [qId]: optIdx }));
    }
  };

  const handleShortAnswerChange = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const toggleMarkReview = (qId) => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const clearCurrentSelection = (qId) => {
    setAnswers(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  // Immediate check in Practice mode
  const handlePracticeCheck = async (q) => {
    setRevealedPracticeAnswers(prev => ({ ...prev, [q.id]: true }));
    if (q.type === 'short-answer') {
      setEvaluatingShortAnswer(true);
      try {
        const res = await fetch('/api/assessment/evaluate-short-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, userAnswer: answers[q.id] || '' })
        });
        const data = await res.json();
        if (data.success) {
          setShortAnswerFeedback(prev => ({ ...prev, [q.id]: data.evaluation }));
        }
      } catch (_) {}
      setEvaluatingShortAnswer(false);
    }
  };

  // Format timer display
  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = assessment.timeLimit > 0 && secondsRemaining < 120;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="w-full max-w-5xl h-[92vh] flex flex-col rounded-2xl bg-canvas-surface border border-border shadow-2xl overflow-hidden animate-fade-in">
        
        {/* Header Bar */}
        <header className="px-5 py-3.5 border-b border-border bg-canvas-elevated flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 truncate">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 shrink-0">
              {assessment.mode} Mode
            </span>
            <div className="truncate">
              <h3 className="text-sm font-bold text-paper-100 truncate">{assessment.title}</h3>
              <p className="text-[11px] text-ink-muted truncate">Topic: {assessment.topic} • {questions.length} Questions</p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Countdown / Stopwatch */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold ${
              isTimeCritical ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-canvas-overlay border-border text-paper-200'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{assessment.timeLimit > 0 ? formatTimer(secondsRemaining) : formatTimer(elapsedSeconds)}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-canvas-overlay text-ink-muted hover:text-paper-100 transition-colors"
              title="Close Assessment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        {!result ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left/Main Column: Question Area */}
            <div className="flex-1 flex flex-col overflow-y-auto p-5 sm:p-6">
              
              {/* Question Meta Bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-accent">Question {currentIndex + 1} of {questions.length}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-canvas-overlay border border-border text-ink-muted uppercase">
                    {currentQ.type}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    +{currentQ.marks || 1} {currentQ.negativeMarks > 0 ? `(-${currentQ.negativeMarks})` : ''} marks
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {currentQ.sourceReferences && (
                    <span className="flex items-center gap-1 text-[11px] text-ink-muted bg-canvas-overlay border border-border px-2 py-0.5 rounded" title={currentQ.sourceReferences.excerpt || ''}>
                      <FileText className="w-3 h-3 text-accent" />
                      {currentQ.sourceReferences.source || 'Verified Source'}
                    </span>
                  )}
                  <button
                    onClick={() => toggleMarkReview(currentQ.id)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                      markedForReview.has(currentQ.id)
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-medium'
                        : 'bg-canvas-overlay border-border text-ink-muted hover:text-paper-100'
                    }`}
                  >
                    {markedForReview.has(currentQ.id) ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    <span>{markedForReview.has(currentQ.id) ? 'Review Marked' : 'Mark Review'}</span>
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-sm sm:text-base font-medium text-paper-100 mb-6 leading-relaxed select-text">
                {currentQ.prompt}
              </div>

              {/* Options or Input Form */}
              <div className="space-y-2.5 mb-6 flex-1">
                {currentQ.type !== 'short-answer' ? (
                  currentQ.options?.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = currentQ.type === 'multiple-select'
                      ? Array.isArray(answers[currentQ.id]) && answers[currentQ.id].includes(optIdx)
                      : answers[currentQ.id] === optIdx;

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(currentQ.id, optIdx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-accent/10 border-accent text-paper-100 shadow-sm ring-1 ring-accent/30'
                            : 'bg-canvas-elevated border-border text-paper-200 hover:border-accent/40 hover:bg-canvas-overlay'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 border transition-all ${
                          isSelected ? 'bg-accent text-white border-accent' : 'bg-canvas-overlay border-border text-ink-muted'
                        }`}>
                          {letter}
                        </span>
                        <span className="text-xs sm:text-sm pt-0.5 leading-snug">{opt}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleShortAnswerChange(currentQ.id, e.target.value)}
                      placeholder="Type your structured answer here (Rubric-based AI evaluation)..."
                      className="w-full h-36 p-3.5 text-xs sm:text-sm rounded-xl bg-canvas-elevated border border-border text-paper-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    />
                    <div className="text-[11px] text-ink-muted flex justify-between">
                      <span>Be concise and mention key principles or keywords.</span>
                      <span>{(answers[currentQ.id] || '').length} characters</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Practice Mode: Hint & Instant Feedback */}
              {isPractice && (
                <div className="mb-4 pt-3 border-t border-border-subtle flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {currentQ.hint && (
                      <button
                        onClick={() => setShowHint(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                        className="text-xs text-amber-400 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {showHint[currentQ.id] ? 'Hide Hint' : 'Show Hint'}
                      </button>
                    )}
                    {currentQ.explanation && (
                      <button
                        onClick={() => handlePracticeCheck(currentQ)}
                        disabled={evaluatingShortAnswer}
                        className="text-xs text-accent flex items-center gap-1 hover:underline cursor-pointer ml-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {revealedPracticeAnswers[currentQ.id] ? 'Refresh Explanation' : 'Check Answer & Explanation'}
                      </button>
                    )}
                  </div>

                  {showHint[currentQ.id] && currentQ.hint && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      💡 <strong>Hint:</strong> {currentQ.hint}
                    </div>
                  )}

                  {revealedPracticeAnswers[currentQ.id] && currentQ.explanation && (
                    <div className="p-3.5 rounded-xl bg-canvas-elevated border border-accent/30 text-xs space-y-2 animate-fade-in">
                      <div className="font-bold text-accent flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Detailed Explanation:
                      </div>
                      <p className="text-paper-200 leading-relaxed">{currentQ.explanation}</p>
                      {shortAnswerFeedback[currentQ.id] && (
                        <div className="pt-2 border-t border-border-subtle text-[11px] text-paper-200">
                          <strong>AI Evaluation Score:</strong> {shortAnswerFeedback[currentQ.id].score} / {shortAnswerFeedback[currentQ.id].maxScore}
                          <p className="text-ink-muted mt-1">{shortAnswerFeedback[currentQ.id].reasoning}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Action Controls */}
              <div className="pt-4 border-t border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-paper-200 hover:bg-canvas-overlay disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <button
                    onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentIndex === questions.length - 1}
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-paper-200 hover:bg-canvas-overlay disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {answers[currentQ.id] !== undefined && (
                    <button
                      onClick={() => clearCurrentSelection(currentQ.id)}
                      className="text-xs text-ink-muted hover:text-rose-400 px-2.5 py-1.5 transition-colors cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-4 py-1.5 rounded-lg bg-accent hover:opacity-90 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    Submit Test
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Question Palette Navigation */}
            <aside className="w-full md:w-64 border-t md:border-t-0 md:border-l border-border bg-canvas-elevated p-4 flex flex-col shrink-0">
              <h4 className="text-xs font-bold text-paper-100 uppercase tracking-wider mb-3">Question Palette</h4>
              
              <div className="grid grid-cols-5 gap-2 mb-4 overflow-y-auto flex-1 max-h-48 md:max-h-full">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined && (typeof answers[q.id] === 'number' || answers[q.id]?.length > 0);
                  const isMarked = markedForReview.has(q.id);
                  const isActive = currentIndex === idx;

                  let colorClass = 'bg-canvas-overlay border-border text-ink-muted';
                  if (isAnswered && isMarked) {
                    colorClass = 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold';
                  } else if (isMarked) {
                    colorClass = 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold';
                  } else if (isAnswered) {
                    colorClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-lg text-xs font-mono font-semibold border flex items-center justify-center transition-all cursor-pointer relative ${colorClass} ${
                        isActive ? 'ring-2 ring-accent ring-offset-1 ring-offset-canvas-surface scale-105' : 'hover:opacity-80'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Palette Legend */}
              <div className="pt-3 border-t border-border-subtle space-y-1.5 text-[11px] text-ink-muted">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
                  <span>Marked for Review ({markedForReview.size})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-canvas-overlay border border-border" />
                  <span>Unanswered ({questions.length - answeredCount})</span>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* Result & Scorecard View */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Top Score Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-accent/20 via-canvas-elevated to-purple-500/20 border border-border flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg">
              <div className="text-center sm:text-left">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                  {result.grade}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-paper-100 mt-2">
                  Score: {result.netScore} / {result.totalMarks}
                </h2>
                <p className="text-xs text-ink-muted mt-1">
                  Accuracy: {result.accuracy}% • Percentage: {result.percentage}% • Time Spent: {formatTimer(result.timeSpentSeconds || elapsedSeconds)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="p-4 rounded-xl bg-canvas-elevated border border-border text-center">
                  <div className="text-xl font-bold text-emerald-400">{result.correctCount}</div>
                  <div className="text-[10px] text-ink-muted uppercase">Correct</div>
                </div>
                <div className="p-4 rounded-xl bg-canvas-elevated border border-border text-center">
                  <div className="text-xl font-bold text-rose-400">{result.incorrectCount}</div>
                  <div className="text-[10px] text-ink-muted uppercase">Incorrect</div>
                </div>
                <div className="p-4 rounded-xl bg-canvas-elevated border border-border text-center">
                  <div className="text-xl font-bold text-ink-muted">{result.unattemptedCount}</div>
                  <div className="text-[10px] text-ink-muted uppercase">Unattempted</div>
                </div>
              </div>
            </div>

            {/* Topic-Wise Breakdown */}
            {result.topicAnalysis && Object.keys(result.topicAnalysis).length > 0 && (
              <div className="p-5 rounded-xl bg-canvas-elevated border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-paper-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" /> Topic-Wise Mastery
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(result.topicAnalysis).map(([topicName, tStat]) => (
                    <div key={topicName} className="p-3 rounded-lg bg-canvas-overlay border border-border-subtle space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-paper-100 truncate">{topicName}</span>
                        <span className={tStat.percentage >= 70 ? 'text-emerald-400 font-bold' : tStat.percentage >= 45 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                          {tStat.percentage}% ({tStat.correct}/{tStat.totalQuestions})
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-canvas-elevated overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            tStat.percentage >= 70 ? 'bg-emerald-400' : tStat.percentage >= 45 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                          style={{ width: `${tStat.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question-by-Question Review */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-paper-100">
                Detailed Solutions & Review ({result.review?.length || 0})
              </h4>

              <div className="space-y-2.5">
                {result.review?.map((rev, revIdx) => {
                  const isExp = reviewExpanded[rev.id];
                  const statusColors = {
                    CORRECT: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
                    INCORRECT: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
                    PARTIAL: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
                    UNATTEMPTED: 'bg-canvas-overlay border-border text-ink-muted'
                  };

                  return (
                    <div key={rev.id} className="rounded-xl border border-border bg-canvas-elevated overflow-hidden">
                      <div
                        onClick={() => setReviewExpanded(prev => ({ ...prev, [rev.id]: !prev[rev.id] }))}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-canvas-overlay transition-colors"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColors[rev.status] || statusColors.UNATTEMPTED}`}>
                            {rev.status}
                          </span>
                          <span className="text-xs font-semibold text-paper-100 truncate">
                            Q{revIdx + 1}: {rev.prompt}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-mono font-medium text-ink-muted">
                            +{rev.score} / {rev.maxScore}
                          </span>
                          {isExp ? <ChevronUp className="w-4 h-4 text-ink-muted" /> : <ChevronDown className="w-4 h-4 text-ink-muted" />}
                        </div>
                      </div>

                      {isExp && (
                        <div className="px-4 pb-4 pt-2 border-t border-border-subtle space-y-2.5 text-xs">
                          <div className="text-paper-100 font-medium select-text">{rev.prompt}</div>

                          {rev.options && rev.options.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              {rev.options.map((opt, oIdx) => {
                                const isUserAns = Array.isArray(rev.userAnswer)
                                  ? rev.userAnswer.includes(oIdx)
                                  : rev.userAnswer === oIdx;
                                const isCorrectAns = Array.isArray(rev.correctAnswer)
                                  ? rev.correctAnswer.includes(oIdx)
                                  : rev.correctAnswer === oIdx;

                                let optBorder = 'border-border bg-canvas-overlay text-paper-200';
                                if (isCorrectAns) {
                                  optBorder = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-medium';
                                } else if (isUserAns && !isCorrectAns) {
                                  optBorder = 'border-rose-500/50 bg-rose-500/10 text-rose-300';
                                }

                                return (
                                  <div key={oIdx} className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${optBorder}`}>
                                    <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                                    {isCorrectAns && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Correct Answer</span>}
                                    {isUserAns && !isCorrectAns && <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Your Answer</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {rev.type === 'short-answer' && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-canvas-overlay border border-border">
                              <div><strong>Your Answer:</strong> {rev.userAnswer || 'Left Blank'}</div>
                              <div><strong>Model Answer:</strong> {rev.correctAnswer}</div>
                            </div>
                          )}

                          {rev.explanation && (
                            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-paper-200 leading-relaxed text-xs">
                              <strong className="text-accent">Explanation:</strong> {rev.explanation}
                            </div>
                          )}

                          {rev.sourceReferences && (
                            <div className="text-[11px] text-ink-muted">
                              <strong>Source:</strong> {rev.sourceReferences.source || 'Document'} {rev.sourceReferences.excerpt ? `— "${rev.sourceReferences.excerpt}"` : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-paper-200 hover:bg-canvas-overlay cursor-pointer"
              >
                Close & Return to Chat
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setCurrentIndex(0);
                  setAnswers({});
                  setMarkedForReview(new Set());
                  setSecondsRemaining(assessment.timeLimit || 0);
                  setElapsedSeconds(0);
                }}
                className="px-4 py-2 rounded-lg bg-accent text-white font-bold text-xs flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retake Test
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Modal before submission */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md p-5 rounded-xl bg-canvas-surface border border-border shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" /> Submit Assessment?
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
                {markedForReview.size > 0 && <span> You still have <strong>{markedForReview.size}</strong> question(s) marked for review.</span>}
                <br /><br />
                Are you sure you want to submit? Once submitted, answers will be evaluated.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-paper-200 hover:bg-canvas-overlay cursor-pointer"
                >
                  Continue Test
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Evaluating...' : 'Confirm Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AssessmentRunner;
