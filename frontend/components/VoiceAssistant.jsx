import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, X, Loader2, Sparkles, Waves, Activity, RotateCcw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const Waveform = ({ waveformData, isSpeaking }) => (
  <div className="flex items-end justify-center gap-1 h-32" role="img" aria-label="Audio waveform visualization">
    {waveformData.map((height, i) => (
      <motion.div
        key={i}
        animate={{ height: `${height}px` }}
        transition={{ duration: 0.05, ease: 'easeOut' }}
        className="rounded-full w-1 transition-colors duration-100"
        style={{
          background: `linear-gradient(to top, 
            ${isSpeaking ? '#f59e0b' : '#06b6d4'} 0%, 
            ${isSpeaking ? '#fbbf24' : '#67e8f9'} 100%)`,
          boxShadow: `0 0 ${height > 25 ? 12 : 0}px ${isSpeaking ? 'rgba(245,158,11,0.8)' : 'rgba(6,182,212,0.8)'}`,
        }}
      />
    ))}
  </div>
);

const WAVEFORM_BARS = 48;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 70;
const WAVEFORM_SMOOTHING = 0.8;
const WAVEFORM_DECAY = 0.95;
const WAVEFORM_INTERVAL = 50; // ms between updates
const COMMAND_PALLETE_SHORTCUT = 'Mod+c';

export default function VoiceAssistant({
  isOpen,
  onClose,
  onTranscript,
  onSpeak,
  geminiApiKey,
}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [waveformData, setWaveformData] = useState(
    Array(WAVEFORM_BARS).fill(BAR_MIN_HEIGHT)
  );
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, listening, processing, speaking, error
  const [useGeminiLive, setUseGeminiLive] = useState(false);
  const [error, setError] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const geminiWsRef = useRef(null);
  const geminiAudioQueueRef = useRef([]);

  // Initialize Web Speech API fallback
  const stopListening = useCallback(() => {
    setIsListening(false);
    setStatus('idle');

    if (geminiWsRef.current) {
      geminiWsRef.current.close();
      geminiWsRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.suspend();
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setStatus('listening');
        };

        recognitionRef.current.onresult = (event) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }
          setTranscript(final + interim);
          if (final) {
            onTranscript(final.trim());
            setTranscript('');
          }
        };

        recognitionRef.current.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('Speech recognition error:', e.error);
            setError(`Recognition error: ${e.error}`);
            setStatus('error');
            stopListening();
          }
        };

        recognitionRef.current.onend = () => {
          if (isListening) {
            // Auto-restart if still supposed to be listening
            try {
              recognitionRef.current.start();
            } catch (_) {
              setIsListening(false);
              setStatus('idle');
            }
          }
        };
      }
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [isListening, onTranscript]);

  // Initialize audio context for waveform visualization
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  // Start waveform animation
  const startWaveform = useCallback(() => {
    const updateWaveform = () => {
      if (!analyserRef.current || (!isListening && !isSpeaking)) {
        // Decay to minimum with smoothing
        setWaveformData(prev => prev.map(h => Math.max(BAR_MIN_HEIGHT, h * WAVEFORM_DECAY)));
        if (isListening || isSpeaking) {
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
        return;
      }

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Map frequency data to bars with smoothing
      const bars = Array(WAVEFORM_BARS).fill(BAR_MIN_HEIGHT);
      const step = Math.floor(dataArray.length / WAVEFORM_BARS);
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        const idx = Math.min(i * step, dataArray.length - 1);
        const value = dataArray[idx] / 255; // 0-1
        // Apply smoothing to prevent jitter
        bars[i] = BAR_MIN_HEIGHT + value * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
      }
      setWaveformData(bars);
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    };
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, [isListening, isSpeaking, WAVEFORM_DECAY]);

  useEffect(() => {
    if (isListening || isSpeaking) {
      initAudioContext().then(startWaveform);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, initAudioContext, startWaveform]);

  const fallbackToWebSpeech = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (_) {}
    }
  }, [isListening]);

  const playGeminiAudio = useCallback(async (audioBuffer) => {
    if (!audioContextRef.current) await initAudioContext();
    try {
      const decoded = await audioContextRef.current.decodeAudioData(audioBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = decoded;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);
    } catch (e) {
      console.error('[Voice] Audio playback error:', e);
    }
  }, [initAudioContext]);

  // Gemini Live API WebSocket connection
  const connectGeminiLive = useCallback(async () => {
    if (!geminiApiKey) return false;

    setStatus('connecting');
    try {
      // Get ephemeral token from backend
      const tokenRes = await fetch('/api/gemini-live-token');
      if (!tokenRes.ok) throw new Error('Failed to get Gemini Live token');
      const { token } = await tokenRes.json();

      const wsUrl = `wss://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-live-preview:stream?key=${geminiApiKey}`;
      const ws = new WebSocket(wsUrl);
      geminiWsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[Voice] Gemini Live connected');
        setUseGeminiLive(true);
        setStatus('listening');
        setIsListening(true);
        setError(null);

        // Send initial config
        ws.send(JSON.stringify({
          setup: {
            model: 'models/gemini-3.1-flash-live-preview',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Puck' }
                }
              }
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Audio response from Gemini - play it
          playGeminiAudio(event.data);
        } else if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.text) {
                onTranscript(part.text);
              }
              if (part.inlineData?.data) {
                // Audio data in base64
                const audioBytes = Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0));
                playGeminiAudio(audioBytes.buffer);
              }
            }
          }
          if (msg.serverContent?.turnComplete) {
            setIsSpeaking(false);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[Voice] Gemini Live error:', err);
        setError('Gemini Live connection failed, falling back to Web Speech');
        setUseGeminiLive(false);
        fallbackToWebSpeech();
      };

      ws.onclose = () => {
        console.log('[Voice] Gemini Live disconnected');
        setUseGeminiLive(false);
        if (isListening) fallbackToWebSpeech();
      };

      return true;
    } catch (err) {
      console.error('[Voice] Gemini Live connection error:', err);
      setError(err.message);
      fallbackToWebSpeech();
      return false;
    }
  }, [geminiApiKey, onTranscript, fallbackToWebSpeech]);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');

    if (geminiApiKey && !useGeminiLive) {
      const connected = await connectGeminiLive();
      if (!connected) return;
    } else if (recognitionRef.current) {
      try {
        await initAudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        recognitionRef.current.start();
      } catch (e) {
        setError('Microphone access denied');
        setStatus('error');
      }
    }
  }, [geminiApiKey, useGeminiLive, connectGeminiLive, initAudioContext]);

  const handleSpeak = useCallback((text) => {
    if (!text) return;
    if (useGeminiLive && geminiWsRef.current?.readyState === WebSocket.OPEN) {
      // Send text to Gemini Live for TTS
      geminiWsRef.current.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true
        }
      }));
      setIsSpeaking(true);
    } else {
      // Fallback to browser speechSynthesis
      onSpeak(text);
    }
  }, [useGeminiLive, onSpeak]);

  // Voice command handler
  const handleVoiceCommand = useCallback((command) => {
    const lowerCmd = command.toLowerCase().trim();
    
    // Resume generation command
    if (lowerCmd.includes('resume') && lowerCmd.includes('generate')) {
      const resumeText = lowerCmd.replace(/resume.*generate/i, '').trim() || 'Generate a professional resume';
      onSpeak(`Generating resume: ${resumeText}`);
      // Trigger resume generation - would need callback from parent
      showToast({ type: 'info', message: 'Resume generation triggered via voice' });
      return 'resume_generate';
    }
    
    // Code editor commands
    if (lowerCmd.includes('new project') || lowerCmd.includes('create project')) {
      showToast({ type: 'info', message: 'Project creation via voice - use the Agent mode' });
      return 'create_project';
    }
    
    // General AI chat command
    if (lowerCmd.includes('ask ai') || lowerCmd['ask ai']) {
      showToast({ type: 'info', message: 'AI chat activated via voice' });
      return 'ai_chat';
    }
    
    showToast({ type: 'warning', message: `Command not recognized: "${command}"` });
    return null;
  }, []);

  // Voice command listener
  useEffect(() => {
    let commandQueue = [];
    let isProcessing = false;
    
    const processCommands = async () => {
      if (isProcessing || commandQueue.length === 0) return;
      isProcessing = true;
      
      const command = commandQueue.shift();
      await handleVoiceCommand(command);
      isProcessing = false;
      
      // Process next command after a brief delay
      setTimeout(processCommands, 500);
    };
    
    // Listen for voice commands (this would integrate with the recognition)
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        
        if (finalTranscript.trim()) {
          processCommands();
        }
      };
    }
    
    return () => {
      if (recognition) {
        recognition.onresult = null;
      }
    };
  }, [handleVoiceCommand]);

  // Command palette keyboard shortcut (Mod+c / Ctrl+c)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === 'c' && !event.shiftKey) {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCommandPalette]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopListening]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="fixed bottom-6 right-6 z-50 w-full max-w-[384px] sm:w-96"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-assistant-title"
      >
        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10,11,18,0.97)',
            border: '1px solid rgba(6,182,212,0.15)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.06)',
          }}
        >
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #f59e0b)' }} />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: isListening || isSpeaking ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: isListening
                    ? 'rgba(6,182,212,0.2)'
                    : isSpeaking
                      ? 'rgba(245,158,11,0.2)'
                      : 'rgba(139,92,246,0.15)',
                  border: `1px solid ${isListening
                    ? 'rgba(6,182,212,0.3)'
                    : isSpeaking
                      ? 'rgba(245,158,11,0.3)'
                      : 'rgba(139,92,246,0.2)'}`,
                }}
              >
                {isListening ? (
                  <Waves className="w-5 h-5 text-cyan-400" />
                ) : isSpeaking ? (
                  <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
                ) : (
                  <Mic className="w-5 h-5 text-purple-400" />
                )}
              </motion.div>
              <div>
                <h2 id="voice-assistant-title" className="font-bold text-white text-sm">Voice Assistant</h2>
                <p className="text-[11px] text-[#64748b] capitalize">{status}</p>
                {useGeminiLive && (
                  <span className="ml-2 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Live
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {useGeminiLive && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Live
                </motion.span>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                aria-label="Close voice assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="p-6 flex flex-col items-center">
            <Waveform waveformData={waveformData} isSpeaking={isSpeaking} />

            {/* Status & Transcript */}
            <div className="mt-6 w-full text-center">
              <AnimatePresence mode="wait">
                {transcript && (
                  <motion.p
                    key="transcript"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-white/80 text-sm mb-2 px-4 min-h-[2.5rem]"
                  >
                    {`"${transcript}"`}
                  </motion.p>
                )}
              </AnimatePresence>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-xs mb-2 px-4"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {/* Control Buttons */}
            <div className="mt-6 flex items-center justify-center gap-4">
              {/* Mic Button */}
              <motion.button
                onClick={isListening ? stopListening : startListening}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 flex-shrink-0"
                style={{
                  background: isListening
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  boxShadow: `0 0 ${isListening ? 30 : 0}px ${isListening ? 'rgba(239,68,68,0.5)' : 'rgba(6,182,212,0.4)'}`,
                  border: isListening ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(6,182,212,0.3)',
                }}
                aria-label={isListening ? 'Stop listening' : 'Start listening'}
                aria-pressed={isListening}
              >
                {isListening ? (
                  <MicOff className="w-7 h-7 text-white" />
                ) : (
                  <Mic className="w-7 h-7 text-white" />
                )}
              </motion.button>

              {/* Mute/Unmute Output */}
              <motion.button
                onClick={() => setIsSpeaking(!isSpeaking)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!isSpeaking && !useGeminiLive}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0"
                style={{
                  background: isSpeaking
                    ? 'rgba(245,158,11,0.2)'
                    : 'rgba(255,255,255,0.04)',
                  border: isSpeaking
                    ? '1px solid rgba(245,158,11,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: isSpeaking ? '#f59e0b' : '#64748b',
                }}
                aria-label={isSpeaking ? 'Mute output' : 'Unmute output'}
                aria-pressed={isSpeaking}
              >
                {isSpeaking ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </motion.button>
            </div>

            {/* Tips */}
            <div className="mt-6 px-4">
              <p className="text-[11px] text-[#475569] text-center leading-relaxed">
                {useGeminiLive
                  ? '💫 Gemini Live active — natural conversation with interruptions'
                  : '🎙️ Using browser speech — click mic to start'}
              </p>
            </div>
          </div>
        </div>

        {/* Floating pulse indicator when minimized */}
        <AnimatePresence>
          {(!isListening && !isSpeaking) && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, boxShadow: ['0 0 12px currentColor', '0 0 24px currentColor', '0 0 12px currentColor'] }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute bottom-2 right-2 w-3 h-3 rounded-full"
              style={{
                background: useGeminiLive ? '#10b981' : '#8b5cf6',
                boxShadow: '0 0 12px currentColor',
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
  
  // Command Palette Renderer
  const CommandPalette = () => {
    const commands = [
      { key: 'resume generate', label: 'Generate Resume', description: 'Generate resume from prompt' },
      { key: 'new project', label: 'Create Project', description: 'Create a new project' },
      { key: 'ask ai', label: 'AI Chat', description: 'Ask AI a question' },
    ];
    
    if (!showCommandPalette) return null;
    
    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-bg-card border border-border rounded-2xl p-6 shadow-2xl z-50 select-text">
        <h2 className="text-xl font-bold text-primary mb-4">Command Palette</h2>
        <p className="text-text-secondary mb-6">Press Mod+C to close</p>
        <div className="space-y-3">
          {commands.map((cmd) => (
            <div
              key={cmd.key}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-bg-default hover:bg-bg-hover cursor-pointer transition-all duration-150"
              onClick={() => {
                setShowCommandPalette(false);
                // Execute command based on selection
                const lowerCmd = cmd.key.toLowerCase();
                if (lowerCmd.includes('resume')) {
                  showToast({ type: 'info', message: 'Resume generation triggered via voice' });
                } else if (lowerCmd.includes('project')) {
                  showToast({ type: 'info', message: 'Project creation via voice - use the Agent mode' });
                } else if (lowerCmd.includes('ai')) {
                  showToast({ type: 'info', message: 'AI chat activated via voice' });
                }
              }}
            >
              <span className="w-8 h-8 rounded-bg-primary/10 flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5 text-primary" />
              </span>
              <div>
                <p className="font-medium text-primary">{cmd.label}</p>
                <p className="text-[10px] text-text-secondary">{cmd.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render CommandPalette if active
  {showCommandPalette && <CommandPalette />}
}