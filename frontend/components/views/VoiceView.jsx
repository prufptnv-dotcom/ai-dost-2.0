import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, VolumeX, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/Button';
import { classifyUniversalIntent } from '../chat/universalIntent';
import { getThreeJsSolarSystemHtml } from '../../lib/threeJsTemplates';
import { useRealtimeAudio } from '../../hooks/useRealtimeAudio';
import CelestialAudioOrb from '../voice/CelestialAudioOrb';

async function readChatStream(response, onEvent) {
  if (!response?.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const parsed = JSON.parse(data);
      onEvent?.(parsed);
      if (parsed.chunk) accumulated += parsed.chunk;
    } catch (_) {}
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consume);
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  return accumulated.trim();
}

export default function VoiceView({ onClose, onTranscript, onToast, onNavigate }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [thoughtSnippet, setThoughtSnippet] = useState('');
  const [conversation, setConversation] = useState([]);
  const [manualInput, setManualInput] = useState('');

  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const currentAudioRef = useRef(null);
  const isMountedRef = useRef(true);
  // P2 #94: live speaking flag — rec.onresult captured `speaking` (and a
  // `speaking`-dependent handleInterruption) from when startListening ran,
  // so barge-in used stale state if AI started speaking after the mic.
  const speakingRef = useRef(false);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stop active AI speech immediately (Barge-In / Cancellation)
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
    if (isMountedRef.current) {
      setSpeaking(false);
    }
  }, []);

  // Barge-In Interruption Callback triggered by real-time voice energy or speech result
  const handleInterruption = useCallback(() => {
    if (speakingRef.current) {
      haltAiSpeech();
      setInterrupted(true);
      setTimeout(() => setInterrupted(false), 1200);
    }
  }, [haltAiSpeech]);

  // Real-Time Web Audio API Frequency Analysis & VAD Interruption Hook
  const {
    frequencies,
    rmsVolume,
    startMic,
    stopMic,
    bindTtsAudio,
    setAiSpeaking,
  } = useRealtimeAudio({
    numBars: 48,
    interruptionThreshold: 26,
    onInterrupted: handleInterruption,
  });

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    stopMic();
    setListening(false);
  }, [stopMic]);

  useEffect(() => {
    return () => {
      stopListening();
      haltAiSpeech();
    };
  }, [stopListening, haltAiSpeech]);

  const speak = useCallback(async (text) => {
    if (!text?.trim()) return;
    haltAiSpeech();
    setSpeaking(true);
    setAiSpeaking(true);

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

        // Pipe audio into real-time Web Audio analyser so visualizer reacts to voice
        bindTtsAudio(audio);

        audio.onended = () => {
          setSpeaking(false);
          setAiSpeaking(false);
          currentAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeaking(false);
          setAiSpeaking(false);
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
        setSpeaking(true);
        setAiSpeaking(true);
      };
      utter.onend = () => {
        setSpeaking(false);
        setAiSpeaking(false);
      };
      utter.onerror = () => {
        setSpeaking(false);
        setAiSpeaking(false);
      };
      window.speechSynthesis?.speak(utter);
    } catch (_) {
      setSpeaking(false);
      setAiSpeaking(false);
    }
  }, [haltAiSpeech, setAiSpeaking, bindTtsAudio]);

  const processQuery = useCallback(async (query) => {
    const text = query.trim();
    if (!text || thinking) return;
    setManualInput('');
    setConversation((prev) => [...prev, { role: 'user', content: text }]);
    if (typeof onTranscript === 'function') onTranscript(text);

    const intent = classifyUniversalIntent(text);

    // 1. 3D Simulation & Canvas Intent
    if (intent.kind === 'canvas' && intent.action === '3d-simulation') {
      const commandReply = 'Opening 2030 Ultra-HD Solar System Simulation in split-screen Canvas.';
      setConversation((prev) => [...prev, { role: 'assistant', content: commandReply }]);
      await speak(commandReply);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_open_artifact', {
          detail: {
            id: 'threejs-solar-voiceview',
            title: '2030 Ultra-HD Solar System Simulation',
            code: getThreeJsSolarSystemHtml(),
            language: 'html',
          }
        }));
      }
      onNavigate?.('chat');
      return;
    }

    // 2. Theme Intent
    if (intent.kind === 'theme') {
      let commandReply = 'Theme toggled.';
      if (typeof window !== 'undefined') {
        const curr = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = intent.action === 'light' ? 'light' : intent.action === 'dark' ? 'dark' : (curr === 'dark' ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', nextTheme);
        document.body.classList.remove('light-theme', 'dark-theme');
        if (nextTheme === 'light') document.body.classList.add('light-theme');
        try { localStorage.setItem('ai_dost_theme', nextTheme); } catch (_) {}
        commandReply = nextTheme === 'light' ? 'Switched to Light Theme.' : 'Switched to Dark Theme.';
      }
      setConversation((prev) => [...prev, { role: 'assistant', content: commandReply }]);
      await speak(commandReply);
      return;
    }

    // 3. Navigation & Command Intent
    if (intent.kind === 'command' && intent.confidence >= 0.85) {
      if (intent.action === 'new-chat') {
        const commandReply = 'Started a new conversation.';
        setConversation((prev) => [...prev, { role: 'assistant', content: commandReply }]);
        await speak(commandReply);
        onNavigate?.('chat');
        return;
      }

      const targetView = intent.view || intent.action;
      const commandReply = `Opening ${targetView}.`;
      setConversation((prev) => [...prev, { role: 'assistant', content: commandReply }]);
      await speak(commandReply);
      if (onNavigate && targetView) {
        onNavigate(targetView);
      }
      return;
    }

    setThinking(true);
    setThoughtSnippet('');
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: 'auto', section: 'chat', history: [], mode: 'chat', persona: 'auto' }),
      });
      if (!response.ok) throw new Error(`Voice stream failed: ${response.status}`);

      const answer = await readChatStream(response, (event) => {
        if (event.type === 'thought_chunk' && event.thought) {
          setThoughtSnippet((prev) => (prev + event.thought).slice(-90));
        }
        if (event.type === 'web_search_start') {
          setConversation((prev) => [...prev.slice(-9), { role: 'assistant', content: event.intent === 'URL_FETCH' ? 'Reading webpage…' : 'Searching the web…' }]);
        }
        if (event.type === 'assessment_creating') {
          setConversation((prev) => [...prev.slice(-9), { role: 'assistant', content: event.status || 'Preparing assessment…' }]);
        }
      });

      const finalReply = answer || 'Kuch response nahi mila.';
      if (isMountedRef.current) {
        setConversation((prev) => [...prev, { role: 'assistant', content: finalReply }]);
      }
      await speak(finalReply);
    } catch (e) {
      const err = `Inference failed: ${e.message || 'Network error'}`;
      if (isMountedRef.current) {
        setConversation((prev) => [...prev, { role: 'assistant', content: err }]);
      }
    } finally {
      if (isMountedRef.current) {
        setThinking(false);
        setThoughtSnippet('');
      }
    }
  }, [thinking, onTranscript, onNavigate, speak]);

  const startListening = async () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onToast?.('Speech recognition not supported in this browser', 'warning');
      return;
    }

    haltAiSpeech();
    const micStarted = await startMic();

    try {
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      transcriptRef.current = '';
      rec.lang = 'hi-IN';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setListening(true);
      };

      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0].transcript).join('').trim();
        transcriptRef.current = text;
        // Natural Interruption: If user starts speaking while AI is talking, immediately halt speech
        if (speakingRef.current || currentAudioRef.current) {
          handleInterruption();
        }
      };

      rec.onend = () => {
        setListening(false);
        const finalText = transcriptRef.current.trim();
        transcriptRef.current = '';
        if (finalText) {
          processQuery(finalText);
        } else if (micStarted) {
          stopMic();
        }
      };

      rec.onerror = () => {
        transcriptRef.current = '';
        setListening(false);
        stopMic();
      };

      rec.start();
    } catch (_) {
      setListening(false);
      stopMic();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processQuery(manualInput.trim());
  };

  const currentVisualState = interrupted
    ? 'interrupted'
    : speaking
    ? 'speaking'
    : thinking
    ? 'thinking'
    : listening
    ? 'listening'
    : 'idle';

  return (
    <div className="h-full flex flex-col bg-canvas-base select-none">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-canvas-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-paper-100 font-display flex items-center gap-2">
              <span>Voice Assistant</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-normal">
                Full-Duplex
              </span>
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Hands-free real-time conversation with natural interruption and live waveform audio telemetry.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice assistant"
            className="p-2 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Main Voice Canvas ── */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full flex flex-col justify-between space-y-6">
        {/* Celestial Audio Orb Visualizer Card */}
        <div className="p-8 rounded-3xl bg-canvas-surface/80 backdrop-blur-xl border border-border flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
          <CelestialAudioOrb
            frequencies={frequencies}
            rmsVolume={rmsVolume}
            state={currentVisualState}
            thoughtSnippet={thoughtSnippet}
          />

          {/* Main Action Push-to-Talk / Mute Toggle Button */}
          <div className="flex items-center gap-4 mt-4">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Stop voice listening' : 'Start voice conversation'}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xl active:scale-95 ${
                listening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_25px_rgba(244,63,94,0.6)] animate-pulse'
                  : 'bg-accent hover:bg-accent-hover text-white shadow-[0_0_25px_rgba(99,102,241,0.5)]'
              }`}
            >
              {listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>

            {speaking && (
              <button
                type="button"
                onClick={haltAiSpeech}
                className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
                title="Interrupt speech"
              >
                <VolumeX className="w-4 h-4" />
                <span>Interrupt</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Conversation History Transcript ── */}
        <div
          className="flex-1 p-5 rounded-2xl bg-canvas-surface/80 backdrop-blur-xl border border-border space-y-3 font-sans text-xs overflow-y-auto max-h-56 shadow-md"
          aria-live="polite"
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold flex items-center justify-between">
            <span>Live Transcript Stream</span>
            {conversation.length > 0 && <span>{conversation.length} exchanges</span>}
          </div>
          {conversation.length === 0 ? (
            <div className="text-ink-muted py-6 text-center text-xs">
              Say “open projects”, “theme switch karo”, “3D solar system banao”, or speak any topic in Hindi/English.
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl leading-relaxed border ${
                  msg.role === 'user'
                    ? 'bg-canvas-elevated/70 border-accent/30 text-paper-100 ml-4'
                    : 'bg-canvas-base/80 border-border text-paper-200 mr-4'
                }`}
              >
                <div className="text-[10px] font-mono text-accent uppercase mb-1 font-semibold">
                  {msg.role === 'user' ? 'You' : 'AI-Dost'}
                </div>
                <div className="text-xs leading-relaxed select-text">{msg.content}</div>
              </div>
            ))
          )}
        </div>

        {/* ── Manual Text Input Fallback ── */}
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type your message if microphone is unavailable..."
            aria-label="Voice assistant message"
            className="flex-1 px-4 py-2.5 rounded-xl bg-canvas-surface border border-border text-paper-100 text-xs font-sans placeholder:text-ink-muted focus:outline-none focus:border-accent shadow-xs"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!manualInput.trim() || thinking}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
