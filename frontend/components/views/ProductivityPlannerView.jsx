import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Award, Target, Compass, CheckSquare, 
  Sparkles, Copy, Check, BookOpen, Layers, Zap, ArrowRight, Shield
} from 'lucide-react';
import axios from 'axios';

const DOMAINS = [
  { id: 'daily-timetable', name: 'Daily Timetable', icon: '⏰', desc: 'Hour-by-hour circadian focus blocks' },
  { id: 'weekly-timetable', name: 'Weekly Timetable', icon: '📅', desc: '7-day theme-based distribution' },
  { id: 'semester-plan', name: 'Semester Study Plan', icon: '🎓', desc: '16-week academic syllabus & labs' },
  { id: 'exam-prep-plan', name: 'Exam Prep Plan', icon: '🎯', desc: 'Pareto 80/20 & mock test schedule' },
  { id: 'dsa-roadmap', name: 'DSA Roadmap', icon: '⚡', desc: 'Zero to FAANG algorithm patterns' },
  { id: 'career-roadmap', name: 'Career Roadmap', icon: '🚀', desc: 'Junior to Staff engineer trajectory' },
  { id: 'project-roadmap', name: 'Project Roadmap', icon: '🛠️', desc: 'Milestone sprints from setup to launch' },
  { id: 'habit-tracker', name: 'Habit Tracker', icon: '🏆', desc: 'Atomic habit loops & streak tracking' },
  { id: 'revision-schedule', name: 'Revision Schedule', icon: '🧠', desc: 'Spaced repetition (1, 3, 7, 21, 60 days)' },
  { id: 'skill-gap-analysis', name: 'Skill-Gap Analysis', icon: '🔍', desc: 'Current vs Target role bridge matrix' },
  { id: 'interview-prep', name: 'Interview Prep', icon: '💼', desc: 'DSA, System Design & STAR stories' },
  { id: 'long-term-strategy', name: '3-5 Year Strategy', icon: '🗺️', desc: 'Compounding T-shaped knowledge' },
];

export default function ProductivityPlannerView({ onToast }) {
  const [selectedDomain, setSelectedDomain] = useState('daily-timetable');
  const [goal, setGoal] = useState('');
  const [availableHours, setAvailableHours] = useState(6);
  const [currentLevel, setCurrentLevel] = useState('Intermediate');
  const [targetDate, setTargetDate] = useState('');
  const [constraints, setConstraints] = useState('');
  const [language, setLanguage] = useState('en'); // 'en' | 'hi' | 'hinglish'

  const [loading, setLoading] = useState(false);
  const [planOutput, setPlanOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGeneratePlan = async (e) => {
    e?.preventDefault();
    if (!goal.trim()) {
      onToast?.('Please provide your primary goal or subject', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/planning/generate', {
        domain: selectedDomain,
        goal,
        availableHours: Number(availableHours),
        currentLevel,
        targetDate,
        constraints,
        language
      });

      if (res.data?.success) {
        setPlanOutput(res.data.plan);
        onToast?.('Strategic plan constructed successfully!', 'success');
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickHabitTracker = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/planning/habit-tracker', {
        habits: [
          'Deep Work Execution (2-3 hrs)',
          'DSA / Problem Solving (1 hr)',
          'Technical Reading / Notes (30m)',
          'Health / Workout / Walk (30m)'
        ]
      });
      if (res.data?.success) {
        setPlanOutput(res.data.trackerMarkdown);
        onToast?.('Atomic Habit Tracker created!', 'success');
      }
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!planOutput) return;
    navigator.clipboard.writeText(planOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onToast?.('Plan copied to clipboard!', 'success');
  };

  const currentDomainObj = DOMAINS.find(d => d.id === selectedDomain);

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas-default overflow-y-auto p-4 md:p-6 space-y-6 select-text">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-[0_0_15px_var(--color-primary-glow)]">
            <div className="w-full h-full bg-canvas-surface rounded-[10px] flex items-center justify-center">
              <Compass className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
              Life Architecture & Productivity Planner 🧭
            </h1>
            <p className="text-xs text-text-muted">
              12 Planning Frameworks &bull; Circadian Timetables &bull; Spaced Repetition &bull; Atomic Habits
            </p>
          </div>
        </div>

        <button
          onClick={handleQuickHabitTracker}
          disabled={loading}
          className="px-3.5 py-2 bg-canvas-surface hover:bg-canvas-hover border border-border rounded-xl text-xs font-semibold flex items-center gap-2 text-primary transition cursor-pointer self-start md:self-auto"
        >
          <CheckSquare className="w-4 h-4" />
          <span>Quick Habit Grid</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
        
        {/* Left Form: 5 Cols */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-canvas-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
            
            {/* Domain Picker */}
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Select Planning Blueprint</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-48 overflow-y-auto pr-1">
                {DOMAINS.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDomain(d.id)}
                    className={`px-2.5 py-2 rounded-lg border text-left text-[11px] font-medium flex items-center gap-2 transition truncate cursor-pointer ${
                      selectedDomain === d.id
                        ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                        : 'bg-canvas-default border-border text-text-secondary hover:border-text-muted'
                    }`}
                  >
                    <span>{d.icon}</span>
                    <span className="truncate">{d.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <form onSubmit={handleGeneratePlan} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Primary Objective / Subject / Role</label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Master DSA in Python or Gate CS 2027 or Frontend Staff Engineer"
                  className="w-full mt-1 h-10 px-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Daily Commitment: <span className="text-primary">{availableHours} hrs</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={availableHours}
                    onChange={(e) => setAvailableHours(e.target.value)}
                    className="w-full mt-2 accent-primary cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Current Level</label>
                  <select
                    value={currentLevel}
                    onChange={(e) => setCurrentLevel(e.target.value)}
                    className="w-full mt-1 h-9 px-2.5 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Beginner (Zero / Starting out)">Beginner (Zero)</option>
                    <option value="Intermediate (Some fundamentals)">Intermediate</option>
                    <option value="Advanced (Targeting top 1%)">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Deadline / Horizon</label>
                  <input
                    type="text"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    placeholder="e.g. 6 Months or Dec 2026"
                    className="w-full mt-1 h-9 px-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full mt-1 h-9 px-2.5 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="en">English</option>
                    <option value="hinglish">Hinglish</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Constraints / Work Hours (Optional)</label>
                <input
                  type="text"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder="e.g. College 9 AM - 4 PM on weekdays, Free on weekends"
                  className="w-full mt-1 h-9 px-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer gradient-btn disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Constructing High-Yield Architecture...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate {currentDomainObj?.name || 'Plan'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output: 7 Cols */}
        <div className="lg:col-span-7 flex flex-col bg-canvas-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Target className="w-4 h-4 text-primary" /> Calibrated Schedule & Strategy
              </span>
            </div>

            {planOutput && (
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 bg-canvas-default hover:bg-canvas-hover border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 text-text-primary transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Plan'}</span>
              </button>
            )}
          </div>

          <div className="flex-1 bg-canvas-default border border-border rounded-xl p-4 overflow-y-auto font-sans text-xs text-text-primary leading-relaxed whitespace-pre-wrap min-h-[380px]">
            {planOutput ? (
              planOutput
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-24 text-text-muted space-y-2">
                <Clock className="w-8 h-8 text-primary/40 mb-2 stroke-[1.5]" />
                <p className="font-semibold text-xs text-text-secondary">Your Scientific Roadmap Appears Here</p>
                <p className="text-[11px] max-w-sm">
                  Configured with circadian energy blocks, 15-20% buffer protection, and Pareto 80/20 active recall.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
