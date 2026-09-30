import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, X, Sparkles, Command, RotateCcw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { classifyUniversalIntent } from './chat/universalIntent';
import { getThreeJsSolarSystemHtml } from '../lib/threeJsTemplates';
import { useRealtimeAudio } from '../hooks/useRealtimeAudio';
import CelestialAudioOrb from './voice/CelestialAudioOrb';

export default function VoiceAssistant({
  isOpen,
  onClose,
  onTranscript = () => {},
  onSpeak = () => {},
  onNavigate,
  onToggleTheme,
  onNewChat,
  onOpenPalette,
  theme,
  geminiApiKey,
}) {
  const { showToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('idle'); // idle, listening, thinking, speaking, interrupted, error
  const [error, setError] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);
  const transcriptRef = useRef('');

  // P3 #117: route every fire-and-forget timer through schedule() so unmount
  // clears them (post-unmount setState from interruption/close timers).
  const timersRef = useRef([]);
  const schedule = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      timersRef.current = timersRef.current.filter((x) => x !== t);
      fn();
    }, ms);
    timersRef.current.push(t);
    return t;
  }, []);
  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // Stop active AI speech immediately (Natural Interruption / Barge-in)
  const haltAiSpeech = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
      } catch (_) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    setIsSpeaking(false);
    setStatus((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  // Barge-In Interruption Callback triggered by microphone energy (VAD) or voice onset
  const handleInterruption = useCallback(() => {
    if (isSpeaking || currentAudioRef.current) {
      haltAiSpeech();
      setIsInterrupted(true);
      setStatus('interrupted');
      schedule(() => {
        setIsInterrupted(false);
        setStatus('listening');
      }, 1000);
    }
  }, [isSpeaking, haltAiSpeech, schedule]);

  // Real-Time Web Audio API Frequency Analysis & VAD Interruption Hook
  const {
    frequencies,
    rmsVolume,
    startMic,
    stopMic,
    bindTtsAudio,
    setAiSpeaking,
  } = useRealtimeAudio({
    numBars: 36,
    interruptionThreshold: 26,
    onInterrupted: handleInterruption,
  });

  // Stop listening helper
  const stopListening = useCallback(() => {
    setIsListening(false);
    setStatus('idle');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    stopMic();
  }, [stopMic]);

  // Handle playing AI TTS with Web Audio analyser connection
  const handleSpeak = useCallback(async (text) => {
    if (!text?.trim()) return;
    haltAiSpeech();
    setIsSpeaking(true);
    setAiSpeaking(true);
    setStatus('speaking');

    try {
      const cleanText = text.replace(/[*#`>\[\]]/g, '').slice(0, 1500);
      const ttsRes = await fetch(`${api.defaults.baseURL || '/api'}/agent/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'hi-IN-SwaraNeural' }),
      });

      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;

        // Pipe audio into real-time Web Audio analyser
        bindTtsAudio(audio);

        audio.onended = () => {
          setIsSpeaking(false);
          setAiSpeaking(false);
          setStatus('idle');
          currentAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setAiSpeaking(false);
          setStatus('idle');
          currentAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        await audio.play();
        return;
      }
    } catch (_) {}

    // Fallback to browser Web Speech API
    try {
      const utter = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
      utter.lang = 'hi-IN';
      utter.rate = 1.05;
      utter.onstart = () => {
        setIsSpeaking(true);
        setAiSpeaking(true);
        setStatus('speaking');
      };
      utter.onend = () => {
        setIsSpeaking(false);
        setAiSpeaking(false);
        setStatus('idle');
      };
      utter.onerror = () => {
        setIsSpeaking(false);
        setAiSpeaking(false);
        setStatus('idle');
      };
      window.speechSynthesis?.speak(utter);
    } catch (e) {
      setIsSpeaking(false);
      setAiSpeaking(false);
      setStatus('idle');
      onSpeak?.(text);
    }
  }, [haltAiSpeech, setAiSpeaking, bindTtsAudio, onSpeak]);

  // Voice command handler with Universal Intent routing
  const handleVoiceCommand = useCallback(async (command) => {
    const text = command?.trim();
    if (!text) return null;

    setStatus('thinking');
    setIsThinking(true);
    setTranscript(text);

    const intent = classifyUniversalIntent(text);

    // 1. 3D Interactive Simulation & Dynamic Canvas Intent
    if (intent.kind === 'canvas' && intent.action === '3d-simulation') {
      const reply = 'Opening 2030 Ultra-HD Solar System Simulation in split-screen Canvas.';
      onTranscript?.(reply);
      setIsThinking(false);
      await handleSpeak(reply);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_open_artifact', {
          detail: {
            id: 'threejs-solar-voice',
            title: '2030 Ultra-HD Solar System Simulation',
            code: getThreeJsSolarSystemHtml(),
            language: 'html',
          }
        }));
      }
      onNavigate?.('chat');
      schedule(() => onClose?.(), 1000);
      setStatus('idle');
      return 'canvas';
    }

    // 2. Theme Intent (Toggle / Light / Dark)
    if (intent.kind === 'theme') {
      let reply = 'Theme toggled.';
      if (intent.action === 'dark') {
        if (theme !== 'dark') onToggleTheme?.();
        reply = 'Switched to Dark Mode.';
      } else if (intent.action === 'light') {
        if (theme !== 'light') onToggleTheme?.();
        reply = 'Switched to Light Mode.';
      } else {
        onToggleTheme?.();
      }
      onTranscript?.(reply);
      setIsThinking(false);
      await handleSpeak(reply);
      setStatus('idle');
      return 'theme';
    }

    // 3. Command Palette Intent
    if (intent.kind === 'palette') {
      const reply = 'Opening Command Palette.';
      onTranscript?.(reply);
      setIsThinking(false);
      await handleSpeak(reply);
      onClose?.();
      onOpenPalette?.();
      setStatus('idle');
      return 'palette';
    }

    // 4. New Chat Intent
    if (intent.kind === 'command' && intent.action === 'new-chat') {
      const reply = 'Started a new conversation.';
      onTranscript?.(reply);
      setIsThinking(false);
      await handleSpeak(reply);
      onNewChat?.();
      onNavigate?.('chat');
      schedule(() => onClose?.(), 1000);
      setStatus('idle');
      return 'new-chat';
    }

    // 5. Direct View Navigation Intent (All Studios)
    if (intent.kind === 'command' && intent.view) {
      const viewLabels = {
        copilot: 'Copilot IDE',
        agent: 'Autonomous Agent Workbench',
        projects: 'Projects',
        bharat: 'Bharat Open APIs Hub',
        security: 'Security Hub',
        writing: 'Writing Studio',
        travel: 'Travel Assistant',
        decision: 'Decision Support Matrix',
        language: 'Language Hub',
        capabilities: 'Master Capabilities Catalog',
        analytics: 'Data Analytics',
        settings: 'Settings',
        resume: 'Resume Builder',
        history: 'Chat History',
        chat: 'Chat Workspace',
      };
      const label = viewLabels[intent.view] || intent.view;
      const reply = `Opening ${label}.`;
      onTranscript?.(reply);
      setIsThinking(false);
      await handleSpeak(reply);
      onNavigate?.(intent.view);
      schedule(() => onClose?.(), 1000);
      setStatus('idle');
      return 'navigate';
    }

    // 6. Regular Chat AI Query
    try {
      const res = await api.post('/chat', { message: text, model: 'auto' });
      const answer = res.data?.reply || res.data?.message || 'Done';
      onTranscript?.(answer);
      setIsThinking(false);
      await handleSpeak(answer);
      return 'ai_chat';
    } catch (e) {
      const err = 'Inference failed: ' + (e.message || 'Network error');
      setError(err);
      setIsThinking(false);
      await handleSpeak(err);
      return null;
    } finally {
      setIsThinking(false);
    }
  }, [handleSpeak, onTranscript, onNavigate, onToggleTheme, onNewChat, onOpenPalette, theme, onClose, schedule]);

  // Start speech recognition
  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    haltAiSpeech();

    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      setStatus('error');
      return;
    }

    await startMic();

    try {
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      transcriptRef.current = '';
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'hi-IN';

      rec.onstart = () => {
        setIsListening(true);
        setStatus('listening');
      };

      rec.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += item;
          } else {
            interim += item;
          }
        }

        // Full-duplex barge-in check on recognition result
        if (isSpeaking || currentAudioRef.current) {
          handleInterruption();
        }

        const combined = (final || interim).trim();
        if (combined) {
          transcriptRef.current = combined;
          setTranscript(combined);
        }

        if (final.trim()) {
          const uttered = final.trim();
          stopListening();
          handleVoiceCommand(uttered);
        }
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Speech recognition error:', e.error);
          setError(`Recognition error: ${e.error}`);
          setStatus('error');
          stopListening();
        }
      };

      rec.onend = () => {
        if (transcriptRef.current && !isSpeaking) {
          const textToProcess = transcriptRef.current;
          transcriptRef.current = '';
          handleVoiceCommand(textToProcess);
        }
      };

      rec.start();
    } catch (err) {
      console.error('[Voice] Mic start error:', err);
      setError('Microphone access denied or error starting recognition');
      setStatus('error');
      stopListening();
    }
  }, [haltAiSpeech, startMic, isSpeaking, handleInterruption, stopListening, handleVoiceCommand]);

  // Global keyboard shortcuts (Mod+Shift+C / Escape)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.shiftKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (event.key === 'Escape') {
        haltAiSpeech();
        stopListening();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [haltAiSpeech, stopListening, onClose]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
      haltAiSpeech();
    };
  }, [stopListening, haltAiSpeech]);

  // Compute active state for CelestialAudioOrb
  const orbState = isInterrupted
    ? 'interrupted'
    : isSpeaking
    ? 'speaking'
    : isThinking
    ? 'thinking'
    : isListening
    ? 'listening'
    : 'idle';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="fixed bottom-6 right-6 z-50 w-full max-w-[420px] sm:w-[420px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-assistant-title"
      >
        <div
          className="relative rounded-3xl overflow-hidden backdrop-blur-2xl transition-all duration-300"
          style={{
            background: 'rgba(10, 11, 20, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(6, 182, 212, 0.15)',
          }}
        >
          {/* Top cosmic glowing bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: isSpeaking
                ? 'linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6)'
                : isInterrupted
                ? 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)'
                : 'linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)',
            }}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 id="voice-assistant-title" className="font-semibold text-white text-sm tracking-wide">
                  AI-Dost Live Voice
                </h2>
                <p className="text-[11px] text-ink-muted font-mono capitalize">
                  {isInterrupted ? 'Barge-In Active' : status}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowCommandPalette((prev) => !prev)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-ink-muted hover:text-white transition-colors"
                title="Command Palette (Ctrl+Shift+C)"
              >
                <Command className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  haltAiSpeech();
                  stopListening();
                  onClose?.();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 text-ink-muted hover:text-white transition-colors"
                aria-label="Close voice assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Celestial Audio Visualizer */}
          <div className="px-5 pt-3 pb-2 flex flex-col items-center">
            <CelestialAudioOrb
              frequencies={frequencies}
              rmsVolume={rmsVolume}
              state={orbState}
              thoughtSnippet={isThinking ? 'Processing intent & knowledge graph...' : ''}
            />

            {/* Live Transcript / Speech Feedback */}
            <div className="w-full text-center mt-2 min-h-[3rem] px-2 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {transcript ? (
                  <motion.p
                    key="transcript"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-white/90 text-sm font-medium leading-relaxed"
                  >
                    &ldquo;{transcript}&rdquo;
                  </motion.p>
                ) : (
                  <p className="text-ink-muted text-xs font-mono">
                    {isSpeaking
                      ? 'AI speaking — speak or tap to interrupt'
                      : isListening
                      ? 'Listening to your voice…'
                      : 'Tap microphone to talk'}
                  </p>
                )}
              </AnimatePresence>

              {error && (
                <p className="text-rose-400 text-xs mt-1 font-mono">{error}</p>
              )}
            </div>

            {/* Controls Bar */}
            <div className="mt-4 mb-3 flex items-center justify-center gap-4 w-full">
              {/* Primary Mic Trigger */}
              <motion.button
                onClick={isListening ? stopListening : startListening}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all"
                style={{
                  background: isListening
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  boxShadow: isListening
                    ? '0 0 25px rgba(239, 68, 68, 0.5)'
                    : '0 0 25px rgba(6, 182, 212, 0.4)',
                }}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </motion.button>

              {/* Mute / Interrupt AI Audio Button */}
              {isSpeaking && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={haltAiSpeech}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center transition-all"
                  title="Interrupt AI Speech"
                >
                  <VolumeX className="w-5 h-5" />
                </motion.button>
              )}
            </div>

            {/* Keyboard & Barge-In hint */}
            <div className="text-[10px] text-ink-muted/80 font-mono text-center pb-2 flex items-center justify-center gap-1.5">
              <span>⚡ Full-duplex barge-in</span>
              <span>•</span>
              <span>Press Esc to close</span>
            </div>
          </div>

          {/* Embedded Command Palette Overlay */}
          <AnimatePresence>
            {showCommandPalette && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="p-4 bg-canvas-base border-t border-border-subtle"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Quick Voice Commands</span>
                  <span className="text-[10px] text-ink-muted font-mono">Mod+Shift+C</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {[
                    { label: '"3D solar system simulation"', desc: 'Opens 3D canvas' },
                    { label: '"Switch to dark / light theme"', desc: 'Toggles system theme' },
                    { label: '"Open Copilot / Research / Studio"', desc: 'Instant navigation' },
                    { label: '"Start new conversation"', desc: 'Clears current chat' },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setShowCommandPalette(false);
                        handleVoiceCommand(item.label.replace(/"/g, ''));
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/5 flex items-center justify-between text-ink-muted hover:text-white transition-colors"
                    >
                      <span className="text-cyan-400 font-mono text-[11px]">{item.label}</span>
                      <span className="text-[10px] text-ink-faint">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}