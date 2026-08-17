import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Volume2, VolumeX, Sparkles, X,
  History as HistoryIcon, Send, Loader2, MessageSquare
} from 'lucide-react';
import api from '../../services/api';

const HISTORY_KEY = 'ai_dost_voice_history';

export default function VoiceView({ onClose, onTranscript }) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0.2);
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [waveHeights, setWaveHeights] = useState([10, 20, 30, 15, 25, 35, 18, 28, 12, 22]);
  const recognitionRef = useRef(null);
  const animRef = useRef(null);
  const speakRef = useRef(false);

  // Load history
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) { /* noop */ }
  }, []);

  const saveHistory = (entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 10);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
    }
    setListening(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  // Stop speech on unmount
  useEffect(() => {
    return () => {
      stopListening();
      try { window.speechSynthesis?.cancel(); } catch (e) { /* noop */ }
    };
  }, [stopListening]);

  const animateWave = useCallback((isListeningNow) => {
    const tick = () => {
      if (isListeningNow) {
        const base = 8 + Math.random() * 26;
        setWaveHeights(Array.from({ length: 10 }, () => base + Math.random() * 24));
        animRef.current = requestAnimationFrame(tick);
      } else {
        setWaveHeights(prev => prev.map(h => h + (14 - h) * 0.08));
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const speak = (text) => {
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
      utter.lang = 'hi-IN';
      utter.rate = 1;
      utter.onstart = () => { setSpeaking(true); speakRef.current = true; };
      utter.onend = () => { setSpeaking(false); speakRef.current = false; };
      utter.onerror = () => { setSpeaking(false); speakRef.current = false; };
      window.speechSynthesis.speak(utter);
    } catch (e) { /* noop */ }
  };

  const processQuery = useCallback(async (query) => {
    const text = query.trim();
    if (!text || thinking) return;
    setTranscript(text);
    setManualInput('');
    saveHistory({ text, time: new Date().toLocaleTimeString() });
    setConversation((prev) => [...prev, { role: 'user', content: text }]);
    setThinking(true);
    setReply('');
    if (typeof onTranscript === 'function') onTranscript(text);

    // ── Image intent: "image banao" → seedha generate karo ──
    if (/(image|photo|picture|logo|wallpaper|cartoon|anime|poster|sketch|painting)\b.*\b(banao|bana|banake|make|create|generate)\b|\b(banao|bana|banake|make|create|generate)\b.*\b(image|photo|picture|logo|wallpaper|cartoon|anime|poster)\b/i.test(text)) {
      try {
        const res = await api.post('/image/generate', { prompt: text });
        const url = res.data?.imageUrl;
        if (url) {
          const imageReply = `Image ban gayi! 🎨\n${url}`;
          setReply(imageReply);
          setConversation((prev) => [...prev, { role: 'assistant', content: imageReply }]);
          speak('Image ban gayi! Link conversation me hai.');
          setThinking(false);
          return;
        }
      } catch (e) { /* fall through to chat */ }
    }

    try {
      const res = await api.post('/chat/', {
        message: text,
        model: 'auto',
        section: 'voice',
        history: [],
        mode: 'chat',
      });
      const answer = res.data?.reply || res.data?.message || 'Samajh nahi aaya, dobara bolo.';
      setReply(answer);
      setConversation((prev) => [...prev, { role: 'assistant', content: answer }]);
      speak(answer);
    } catch (e) {
      const err = 'Network error — backend check karo.';
      setReply(err);
      setConversation((prev) => [...prev, { role: 'assistant', content: err }]);
    } finally {
      setThinking(false);
    }
  }, [thinking]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTranscript('Browser voice support nahi hai — Chrome/Edge use karo.');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setTranscript(text);
      };
      rec.onend = () => {
        setListening(false);
        if (animRef.current) cancelAnimationFrame(animRef.current);
      };
      rec.onerror = () => setListening(false);
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
      setLevel(0.5);
      animateWave(true);
    } catch (e) {
      setTranscript('Mic start nahi ho paya — permission check karo.');
    }
  };

  const handleFinalTranscript = () => {
    if (transcript.trim()) {
      processQuery(transcript);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,6,10,0.85)', backdropFilter: 'blur(16px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[92vh] rounded-3xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--color-bg-default)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(161,66,244,0.15)', border: '1px solid rgba(161,66,244,0.3)' }}>
              <Mic className="w-4 h-4 text-[var(--color-secondary)]" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white">Voice Assistant</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Perplexity-style — bolke kuch bhi pucho</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main orb + waveform */}
        <div className="flex flex-col items-center py-8 px-6">
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mb-6 ${listening ? 'breathe-glow' : ''}`} style={{ background: listening ? 'var(--gradient-orb)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}>
            {listening ? (
              <Mic className="w-9 h-9 text-white" />
            ) : speaking ? (
              <Volume2 className="w-9 h-9 text-white" />
            ) : (
              <Sparkles className="w-9 h-9" style={{ color: 'var(--color-primary)' }} />
            )}
            {listening && (
              <>
                <div className="orb-ring" style={{ position: 'absolute', inset: -12 }} />
                <div className="orb-ring" style={{ position: 'absolute', inset: -12, animationDelay: '0.5s' }} />
              </>
            )}
          </div>

          {/* Waveform */}
          <div className="waveform mb-4" style={{ height: 36 }}>
            {waveHeights.map((h, i) => (
              <span key={i} style={{ height: `${h}px`, animationDelay: `${i * 0.07}s`, animationPlayState: listening || speaking ? 'running' : 'paused', opacity: listening ? 1 : 0.4 }} />
            ))}
          </div>

          {/* Status text */}
          <p className="text-sm font-medium text-white mb-1">
            {thinking ? 'Deep analysing...' : listening ? 'Listening... bolo!' : speaking ? 'Speaking...' : 'Mic dabao aur bolo'}
          </p>
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Hinglish me bolo — &quot;resume bana do&quot;, &quot;code explain karo&quot;, &quot;poem likho&quot;
          </p>

          {/* Transcript / Reply */}
          <div className="w-full mt-5 space-y-3 max-h-48 overflow-y-auto">
            <AnimatePresence>
              {conversation.slice(-4).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto' : ''}`}
                  style={{
                    maxWidth: '85%',
                    background: m.role === 'user' ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.04)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--color-border)',
                    color: m.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                    marginLeft: m.role === 'user' ? 'auto' : 0,
                  }}
                >
                  {m.content}
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI-Dost soch raha hai...
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-5 space-y-3">
          {/* Manual input */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
            <MessageSquare className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') processQuery(manualInput); }}
              placeholder="Ya yahan type karke bhejo..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <button
              onClick={() => processQuery(manualInput)}
              className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--gradient-primary)', color: '#fff' }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mic / speak buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={listening ? handleFinalTranscript : startListening}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${listening ? 'breathe-glow' : 'hover:scale-105'}`}
              style={{ background: listening ? 'var(--gradient-orb)' : 'var(--gradient-primary)', boxShadow: '0 8px 30px var(--color-primary-glow)' }}
              title={listening ? 'Stop & Send' : 'Start Listening'}
            >
              {listening ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={() => (speaking ? (window.speechSynthesis?.cancel(), setSpeaking(false)) : reply && speak(reply))}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)' }}
              title={speaking ? 'Mute' : 'Read reply aloud'}
            >
              {speaking ? <VolumeX className="w-5 h-5 text-[var(--color-secondary)]" /> : <Volume2 className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                <HistoryIcon className="w-3 h-3" /> Recent commands
              </p>
              <div className="flex flex-wrap gap-2">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => processQuery(h.text)}
                    className="px-3 py-1.5 rounded-full text-[11px] transition-all cursor-pointer hover:scale-[1.03]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    {h.text.length > 40 ? h.text.slice(0, 40) + '...' : h.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}