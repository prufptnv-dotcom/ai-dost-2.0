import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, ShieldCheck, AlertTriangle, Undo2, ChevronDown,
  ChevronUp, Check, X, Sparkles, Loader2
} from 'lucide-react';

/**
 * SelfHealingDiagnosticsBanner - Autonomous Self-Healing Diagnostic HUD
 * Shows real-time error diagnosis, confidence rating, surgical diffs, and 1-click rollback.
 */
export default function SelfHealingDiagnosticsBanner({
  state = 'idle', // 'idle' | 'diagnosing' | 'healed' | 'manual_review'
  error = '',
  explanation = '',
  confidence = 0.95,
  diff = null,
  onApplyFix = () => {},
  onUndo = () => {},
  onDismiss = () => {},
}) {
  const [showDiff, setShowDiff] = useState(false);

  if (state === 'idle') return null;

  const confidencePct = Math.round((confidence || 0.9) * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="shrink-0 overflow-hidden border-b z-20"
        style={{
          backgroundColor:
            state === 'healed'
              ? 'rgba(6, 78, 59, 0.4)' // Emerald
              : state === 'diagnosing'
              ? 'rgba(76, 29, 149, 0.4)' // Purple
              : 'rgba(120, 53, 15, 0.4)', // Amber
          borderColor:
            state === 'healed'
              ? 'rgba(16, 185, 129, 0.3)'
              : state === 'diagnosing'
              ? 'rgba(168, 85, 247, 0.3)'
              : 'rgba(245, 158, 11, 0.3)',
        }}
      >
        <div className="px-3 sm:px-4 py-2 flex flex-col gap-2">
          {/* Main Top Status Row */}
          <div className="flex items-center justify-between gap-3 text-xs">
            {/* Status Icon & Label */}
            <div className="flex items-center gap-2 min-w-0">
              {state === 'diagnosing' && (
                <div className="flex items-center gap-1.5 text-purple-300 font-medium">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                  <span className="truncate">
                    ⚡ Self-Healing Active: Diagnosing runtime error…
                  </span>
                </div>
              )}

              {state === 'healed' && (
                <div className="flex items-center gap-2 text-emerald-300 font-medium min-w-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    ✅ Autonomous Self-Healing Complete:{' '}
                    <span className="text-emerald-100 font-normal">
                      {explanation || 'Repaired runtime exception'}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    {confidencePct}% Confidence
                  </span>
                </div>
              )}

              {state === 'manual_review' && (
                <div className="flex items-center gap-2 text-amber-300 font-medium min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">
                    ⚠️ Fix Suggested ({confidencePct}%):{' '}
                    <span className="text-amber-100 font-normal">{explanation}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {diff && (
                <button
                  onClick={() => setShowDiff((prev) => !prev)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-canvas-elevated hover:bg-canvas-overlay border border-border text-paper-200 hover:text-white transition-colors cursor-pointer"
                >
                  <span>Diff</span>
                  {showDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              {state === 'manual_review' && (
                <button
                  onClick={onApplyFix}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply Fix</span>
                </button>
              )}

              {state === 'healed' && (
                <button
                  onClick={onUndo}
                  title="Roll back to code before self-healing"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-canvas-elevated hover:bg-canvas-overlay border border-border text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}

              <button
                onClick={onDismiss}
                title="Dismiss banner"
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 text-ink-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Optional Expanded Surgical Diff View */}
          {showDiff && diff && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-2 rounded-xl bg-canvas-base/80 border border-border text-[11px] font-mono overflow-x-auto space-y-1.5 select-text"
            >
              {diff.search && (
                <div className="p-1.5 rounded-lg bg-red-950/30 border border-red-500/20 text-red-300">
                  <div className="text-[9px] text-red-400 font-bold mb-0.5">REPLACED:</div>
                  <pre className="whitespace-pre-wrap">{diff.search}</pre>
                </div>
              )}
              {diff.replace && (
                <div className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300">
                  <div className="text-[9px] text-emerald-400 font-bold mb-0.5">SURGICAL PATCH:</div>
                  <pre className="whitespace-pre-wrap">{diff.replace}</pre>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
