import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/Button';
import { classifyUniversalIntent } from '../chat/universalIntent';

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

export default function VoiceView({ onClose, onTranscript, onToast }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [waveHeights, setWaveHeights] = useState([12, 24, 36, 18, 28, 40, 22, 32, 14, 26]);

  const recognitionRef = useRef(null);
  const animRef = useRef(null);
  const transcriptRef = useRef('');

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

  const speak = async (text) => {
    if (!text?.trim()) return;
    try {
      window.speechSynthesis?.cancel();
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
        audio.onplay = () => setSpeaking(true);
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch (_) {}
    try {
      const utter = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
      utter.lang = 'hi-IN';
      utter.rate = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis?.speak(utter);
    } catch (_) { setSpeaking(false); }
  };

  const processQuery = useCallback(async (query) => {
    const text = query.trim();
    if (!text || thinking) return;
    setManualInput('');
    setConversation((prev) => [...prev, { role: 'user', content: text }]);
    if (typeof onTranscript === 'function') onTranscript(text);

    const intent = classifyUniversalIntent(text);
    if (intent.kind === 'command' && intent.confidence >= 0.9) {
      const commandReply = intent.action === 'new-chat'
        ? 'New conversation open kar raha hoon.'
        : intent.action === 'delete-chat'
          ? 'Current conversation reset kar raha hoon.'
          : `${intent.action} open kar raha hoon.`;
      setConversation((prev) => [...prev, { role: 'assistant', content: commandReply }]);
      await speak(commandReply);
      return;
    }

    setThinking(true);
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: 'auto', section: 'chat', history: [], mode: 'chat', persona: 'auto' }),
      });
      if (!response.ok) throw new Error(`Voice stream failed: ${response.status}`);

      const answer = await readChatStream(response, (event) => {
        if (event.type === 'web_search_start') {
          setConversation((prev) => [...prev.slice(-9), { role: 'assistant', content: event.intent === 'URL_FETCH' ? 'Reading webpage…' : 'Searching the web…' }]);
        }
        if (event.type === 'assessment_creating') {
          setConversation((prev) => [...prev.slice(-9), { role: 'assistant', content: event.status || 'Preparing assessment…' }]);
        }
      });

      const finalReply = answer || 'Kuch response nahi mila.';
      setConversation((prev) => [...prev, { role: 'assistant', content: finalReply }]);
      await speak(finalReply);
    } catch (e) {
      const err = `Inference failed: ${e.message || 'Network error'}`;
      setConversation((prev) => [...prev, { role: 'assistant', content: err }]);
    } finally {
      setThinking(false);
    }
  }, [thinking, onTranscript]);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onToast?.('Speech recognition not supported in this browser', 'warning');
      return;
    }

    try {
      window.speechSynthesis?.cancel();
      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      transcriptRef.current = '';
      rec.lang = 'hi-IN';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setListening(true);
        animateWave(true);
      };

      rec.onresult = (e) => {
        transcriptRef.current = Array.from(e.results).map((r) => r[0].transcript).join('').trim();
      };

      rec.onend = () => {
        setListening(false);
        animateWave(false);
        const finalText = transcriptRef.current.trim();
        transcriptRef.current = '';
        if (finalText) processQuery(finalText);
      };

      rec.onerror = () => {
        transcriptRef.current = '';
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-canvas-subtle flex-shrink-0">
        <div>
          <h1 className="text-base font-semibold text-paper-100 font-display">Voice Assistant</h1>
          <p className="text-xs text-ink-muted mt-0.5">Hands-free voice recognition with the same AI-Dost command and chat pipeline.</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close voice assistant" className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full flex flex-col justify-between space-y-6">
        <div className="p-8 rounded-sm bg-canvas-surface border border-border flex flex-col items-center justify-center space-y-6 shadow-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${listening ? 'bg-signal-warning animate-ping' : thinking ? 'bg-accent-primary animate-pulse' : speaking ? 'bg-signal-success animate-pulse' : 'bg-ink-muted'}`} />
            <span className="text-xs font-mono uppercase tracking-wider text-paper-200">
              {listening ? 'Listening to voice...' : thinking ? 'Processing with AI-Dost...' : speaking ? 'Speaking...' : 'Microphone Idle'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 h-16 px-4" aria-label="Voice activity waveform">
            {waveHeights.map((h, i) => (
              <div key={i} className="w-1.5 rounded-xs transition-all duration-75" style={{ height: `${Math.max(4, h)}px` }} />
            ))}
          </div>

          <button type="button" onClick={listening ? stopListening : startListening} aria-label={listening ? 'Stop voice input' : 'Start voice input'} className={`w-14 h-14 rounded-sm flex items-center justify-center transition-fast cursor-pointer shadow-md focus-ring ${listening ? 'bg-signal-error hover:bg-signal-error/90 text-white' : 'bg-accent-primary hover:bg-accent-primary-strong text-paper-100'}`}>
            {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex-1 p-4 rounded-sm bg-canvas-surface border border-border space-y-3 font-sans text-xs overflow-y-auto max-h-64" aria-live="polite">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">Live Stream</div>
          {conversation.length === 0 ? (
            <div className="text-ink-muted py-4 text-center">Say “open projects”, “new chat”, “build this…”, or ask any question.</div>
          ) : (
            conversation.map((msg, i) => (
              <div key={i} className={`p-2.5 rounded-xs leading-relaxed border ${msg.role === 'user' ? 'bg-canvas-base border-border text-paper-100' : 'bg-canvas-subtle border-border-subtle text-paper-200'}`}>
                <div className="text-[10px] font-mono text-accent-primary uppercase mb-1 font-semibold">{msg.role === 'user' ? 'You' : 'AI-Dost'}</div>
                <div>{msg.content}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
          <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} placeholder="Type your message if microphone is unavailable..." aria-label="Voice assistant message" className="flex-1 px-3 py-2 rounded-xs bg-canvas-surface border border-border text-paper-100 text-xs font-sans placeholder:text-ink-muted focus:outline-none focus:border-accent-primary" />
          <Button type="submit" variant="primary" size="sm" disabled={!manualInput.trim() || thinking}>Send</Button>
        </form>
      </div>
    </div>
  );
}
