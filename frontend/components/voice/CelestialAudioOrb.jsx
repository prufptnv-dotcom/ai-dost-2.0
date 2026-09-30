import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mic, Volume2, Zap } from 'lucide-react';

/**
 * CelestialAudioOrb - Enterprise Voice Visualizer
 * Inspired by ChatGPT Advanced Voice & Gemini Live.
 * 
 * Props:
 *  - frequencies: number[] (48 bar heights from Web Audio Analyser)
 *  - rmsVolume: number (0 - 100 root-mean-square audio energy)
 *  - state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'
 *  - thoughtSnippet: string (optional reasoning preview from Pillar 1)
 */
export default function CelestialAudioOrb({
  frequencies = [],
  rmsVolume = 0,
  state = 'idle',
  thoughtSnippet = '',
}) {
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isInterrupted = state === 'interrupted';

  // Dynamic scale factor derived from real audio energy
  const orbScale = useMemo(() => {
    const boost = Math.min(1.4, 1 + rmsVolume * 0.008);
    return boost;
  }, [rmsVolume]);

  // Dynamic theme colors per state
  const theme = useMemo(() => {
    if (isInterrupted) {
      return {
        label: 'Interrupted — Listening to you...',
        badgeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
        barGradient: 'linear-gradient(to top, #f59e0b, #fbbf24)',
        barGlow: 'rgba(245, 158, 11, 0.6)',
        orbBg: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, rgba(217,119,6,0.1) 60%, transparent 80%)',
        ringBorder: 'border-amber-400/50',
      };
    }
    if (isSpeaking) {
      return {
        label: 'AI-Dost Speaking (Speak anytime to interrupt)',
        badgeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        barGradient: 'linear-gradient(to top, #10b981, #2dd4bf)',
        barGlow: 'rgba(16, 185, 129, 0.6)',
        orbBg: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(20,184,166,0.15) 55%, transparent 75%)',
        ringBorder: 'border-emerald-400/50',
      };
    }
    if (isThinking) {
      return {
        label: 'Deep Reasoning & Thinking...',
        badgeColor: 'text-purple-400 bg-purple-500/15 border-purple-500/40',
        barGradient: 'linear-gradient(to top, #8b5cf6, #c084fc)',
        barGlow: 'rgba(139, 92, 246, 0.6)',
        orbBg: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(168,85,247,0.15) 55%, transparent 75%)',
        ringBorder: 'border-purple-400/50',
      };
    }
    if (isListening) {
      return {
        label: 'Listening to your voice...',
        badgeColor: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/40',
        barGradient: 'linear-gradient(to top, #06b6d4, #6366f1)',
        barGlow: 'rgba(6, 182, 212, 0.6)',
        orbBg: 'radial-gradient(circle, rgba(6,182,212,0.35) 0%, rgba(99,102,241,0.15) 55%, transparent 75%)',
        ringBorder: 'border-cyan-400/50',
      };
    }
    return {
      label: 'Microphone Idle',
      badgeColor: 'text-ink-muted bg-canvas-elevated border-border-subtle',
      barGradient: 'linear-gradient(to top, rgba(255,255,255,0.2), rgba(255,255,255,0.4))',
      barGlow: 'rgba(255, 255, 255, 0.1)',
      orbBg: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
      ringBorder: 'border-border-subtle',
    };
  }, [isInterrupted, isSpeaking, isThinking, isListening]);

  return (
    <div className="flex flex-col items-center justify-center space-y-6 w-full py-4 select-none">
      {/* ── Status Pill ── */}
      <motion.div
        layout
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium transition-colors shadow-xs ${theme.badgeColor}`}
      >
        {isInterrupted ? (
          <Zap className="w-3.5 h-3.5 animate-bounce text-amber-400" />
        ) : isSpeaking ? (
          <Volume2 className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
        ) : isThinking ? (
          <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" style={{ animationDuration: '3s' }} />
        ) : isListening ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
          </span>
        ) : (
          <Mic className="w-3.5 h-3.5 text-ink-muted" />
        )}
        <span>{theme.label}</span>
      </motion.div>

      {/* ── Central Celestial Fluid Orb ── */}
      <div className="relative flex items-center justify-center w-56 h-56 my-2">
        {/* Ambient Outer Halo */}
        <motion.div
          animate={{ scale: isListening || isSpeaking ? [orbScale, orbScale * 1.15, orbScale] : [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
          style={{ background: theme.orbBg }}
        />

        {/* Rotating Celestial Rings */}
        <div
          className={`absolute inset-2 rounded-full border border-dashed transition-all duration-700 ${theme.ringBorder} ${
            isThinking ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '14s' }}
        />
        <div
          className={`absolute inset-8 rounded-full border border-dotted opacity-60 transition-all duration-700 ${theme.ringBorder} ${
            isThinking ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '8s', animationDirection: 'reverse' }}
        />

        {/* Core Glowing Orb */}
        <motion.div
          animate={{
            scale: orbScale,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="relative flex items-center justify-center w-28 h-28 rounded-full shadow-2xl backdrop-blur-xl border border-white/20 overflow-hidden"
          style={{
            background: isSpeaking
              ? 'radial-gradient(circle at 35% 35%, #10b981 0%, #047857 50%, #064e3b 100%)'
              : isThinking
              ? 'radial-gradient(circle at 35% 35%, #a855f7 0%, #7c3aed 50%, #4c1d95 100%)'
              : isListening
              ? 'radial-gradient(circle at 35% 35%, #06b6d4 0%, #3b82f6 50%, #1e1b4b 100%)'
              : 'radial-gradient(circle at 35% 35%, #6366f1 0%, #312e81 60%, #090a0f 100%)',
            boxShadow: `0 0 ${20 + rmsVolume * 0.5}px ${theme.barGlow}`,
          }}
        >
          {/* Inner Light Reflection Shimmer */}
          <div className="absolute top-2 left-3 w-8 h-4 rounded-full bg-white/30 blur-xs rotate-[-25deg]" />

          {/* Central Animated Symbol */}
          {isThinking ? (
            <Sparkles className="w-8 h-8 text-white/90 animate-pulse" />
          ) : isSpeaking ? (
            <Volume2 className="w-8 h-8 text-white/90 animate-pulse" />
          ) : (
            <Mic className="w-8 h-8 text-white/90" />
          )}
        </motion.div>
      </div>

      {/* ── 48-Bar Stereo Audio Frequency Waveform ── */}
      <div
        className="flex items-end justify-center gap-1.5 h-16 w-full max-w-lg px-4 py-2 rounded-2xl bg-canvas-base/60 border border-border-subtle/80 backdrop-blur-md shadow-inner"
        role="img"
        aria-label="Real-time voice frequency spectrum"
      >
        {frequencies.map((height, idx) => (
          <motion.div
            key={idx}
            animate={{ height: `${Math.max(4, Math.min(56, height))}px` }}
            transition={{ duration: 0.05, ease: 'easeOut' }}
            className="w-1.5 rounded-full transition-colors duration-100"
            style={{
              background: theme.barGradient,
              boxShadow: height > 24 ? `0 0 8px ${theme.barGlow}` : 'none',
            }}
          />
        ))}
      </div>

      {/* ── Pillar 1 Reasoning Preview (if AI is thinking) ── */}
      {isThinking && thoughtSnippet && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md px-4 py-2 rounded-xl bg-purple-950/20 border border-purple-500/30 text-[11px] font-mono text-purple-300 text-center truncate shadow-xs"
        >
          <span className="text-purple-400 font-semibold mr-1.5">Thinking:</span>
          <span>{thoughtSnippet}</span>
        </motion.div>
      )}
    </div>
  );
}
