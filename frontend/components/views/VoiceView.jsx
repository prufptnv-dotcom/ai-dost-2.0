import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, X,
  History as HistoryIcon, Send, Loader2, MessageSquare, CornerDownLeft
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export default function VoiceView({ onClose, onTranscript, onToast }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [thinking, setThinking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [waveHeights, setWaveHeights] = useState([12, 24, 36, 18, 28, 40, 22, 32, 14, 26]);

  const recognitionRef = useRef(null);
  const animRef = useRef(null);
  const speakRef = useRef(false);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    setListening(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    };
  }, [stopListening]);

  const animateWave = useCallback((isListeningNow) => {
    const tick = () => {
      if (isListeningNow) {
        const base = 8 + Math.random() * 20;
        setWaveHeights(Array.from({ length: 12 }, () => base + Math.random() * 28));
        animRef.current = requestAnimationFrame(tick);
      } else {
        setWaveHeights((prev) => prev.map((h) => h + (10 - h) * 0.1));
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const speak = (text) => {
    try {
      window.speechSynthesis?.cancel();
      const utter = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
      utter.lang = 'hi-IN';
      utter.rate = 1;
      utter.onstart = () => { setSpeaking(true); speakRef.current = true; };
      utter.onend = () => { setSpeaking(false); speakRef.current = false; };
      utter.onerror = () => { setSpeaking(false); speakRef.current = false; };
      window.speechSynthesis?.speak(utter);
    } catch (_) {}
  };

  const processQuery = useCallback(async (query) => {
    const text = query.trim();
    if (!text || thinking) return;
    setTranscript(text);
    setManualInput('');
    setConversation((prev) => [...prev, { role: 'user', content: text }]);
    setThinking(true);
    setReply('');
    if (typeof onTranscript === 'function') onTranscript(text);

    try {
      const res = await api.post('/chat', { message: text, model: 'gemini' });
      const answer = res.data?.reply || res.data?.message || 'Done';
      setReply(answer);
      setConversation((prev) => [...prev, { role: 'assistant', content: answer }]);
      speak(answer);
    } catch (e) {
      const err = 'Inference failed: ' + (e.message || 'Network error');
      setReply(err);
      setConversation((prev) => [...prev, { role: 'assistant', content: err }]);
    } finally {
      setThinking(false);
    }
  }, [thinking, onTranscript]);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onToast) onToast('Speech recognition not supported in this browser', 'warning');
      return;
    }

    try {
      window.speechSynthesis?.cancel();
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.lang = 'hi-IN';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setListening(true);
        animateWave(true);
      };

      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0].transcript).join('');
        setTranscript(text);
      };

      rec.onend = () => {
        setListening(false);
        animateWave(false);
        if (transcript.trim()) processQuery(transcript);
      };

      rec.onerror = () => {
        setListening(false);
        animateWave(false);
      };

      rec.start();
    } catch (_) {
      setListening(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processQuery(manualInput.trim());
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base select-none">
      {/* Header Strip */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-canvas-subtle flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-paper-100 font-display">
            Voice Assistant
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Hands-free voice recognition with edge speech synthesis.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full flex flex-col justify-between space-y-6">
        {/* Flat Technical Waveform Display */}
        <div className="p-8 rounded-sm bg-canvas-surface border border-border flex flex-col items-center justify-center space-y-6 shadow-xs">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                listening
                  ? 'bg-signal-warning animate-ping'
                  : thinking
                  ? 'bg-accent-primary animate-pulse'
                  : speaking
                  ? 'bg-signal-success animate-pulse'
                  : 'bg-ink-muted'
              }`}
            />
            <span className="text-xs font-mono uppercase tracking-wider text-paper-200">
              {listening
                ? 'Listening to voice...'
                : thinking
                ? 'Synthesizing response...'
                : speaking
                ? 'Speaking...'
                : 'Microphone Idle'}
            </span>
          </div>

          {/* Hairline Waveform Bars */}
          <div className="flex items-center gap-1.5 h-16 px-4">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-xs transition-all duration-75"
                style={{
                  height: `${Math.max(4, h)}px`,
                  backgroundColor: listening ? '#d45b3f' : speaking ? '#5c8b6b' : '#3a3632',
                }}
              />
            ))}
          </div>

          {/* Trigger Button */}
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`w-14 h-14 rounded-sm flex items-center justify-center transition-fast cursor-pointer shadow-md focus-ring ${
              listening
                ? 'bg-signal-error hover:bg-signal-error/90 text-white'
                : 'bg-accent-primary hover:bg-accent-primary-strong text-paper-100'
            }`}
          >
            {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        </div>

        {/* Live Transcript Stream */}
        <div className="flex-1 p-4 rounded-sm bg-canvas-surface border border-border space-y-3 font-sans text-xs overflow-y-auto max-h-64">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">
            Live Stream
          </div>
          {conversation.length === 0 ? (
            <div className="text-ink-muted py-4 text-center">
              Click the microphone or type below to speak with AI-Dost.
            </div>
          ) : (
            conversation.map((msg, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-xs leading-relaxed border ${
                  msg.role === 'user'
                    ? 'bg-canvas-base border-border text-paper-100'
                    : 'bg-canvas-subtle border-border-subtle text-paper-200'
                }`}
              >
                <div className="text-[10px] font-mono text-accent-primary uppercase mb-1 font-semibold">
                  {msg.role === 'user' ? 'You' : 'AI-Dost'}
                </div>
                <div>{msg.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Manual Query Input */}
        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Type your message if microphone is unavailable..."
            className="flex-1 px-3 py-2 rounded-xs bg-canvas-surface border border-border text-paper-100 text-xs font-sans placeholder:text-ink-muted focus:outline-none focus:border-accent-primary"
          />
          <Button type="submit" variant="primary" size="sm" icon={CornerDownLeft} disabled={!manualInput.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}