import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useRealtimeAudio - Enterprise-Grade Web Audio API Analyser & Full-Duplex Interruption Engine
 * 
 * Features:
 *  - Real microphone FFT frequency analysis via AnalyserNode (64 bins)
 *  - AI TTS audio playback FFT frequency analysis via MediaElementAudioSourceNode
 *  - Real-time Voice Activity Detection (VAD) for instant hands-free barge-in / interruption
 *  - 60fps smooth frequency interpolation for ChatGPT/Gemini Live visualizer
 */
export function useRealtimeAudio({
  numBars = 48,
  interruptionThreshold = 35, // RMS threshold (0-100) to trigger barge-in while AI is speaking
  onInterrupted = () => {},
}) {
  const [frequencies, setFrequencies] = useState(() => Array(numBars).fill(4));
  const [rmsVolume, setRmsVolume] = useState(0);
  const [isMicActive, setIsMicActive] = useState(false);

  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const micAnalyserRef = useRef(null);

  const ttsAudioRef = useRef(null);
  const ttsSourceRef = useRef(null);
  const ttsAnalyserRef = useRef(null);

  const animFrameRef = useRef(null);
  const isAiSpeakingRef = useRef(false);
  const onInterruptedRef = useRef(onInterrupted);
  const lastRmsRef = useRef(0);
  const lastBarsRef = useRef(null);

  useEffect(() => {
    onInterruptedRef.current = onInterrupted;
  }, [onInterrupted]);

  // Initialize or get AudioContext
  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // Start real microphone capture
  const startMic = useCallback(async () => {
    if (typeof window === 'undefined') return false;
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;

      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        micAnalyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        micSourceRef.current = source;
      }

      setIsMicActive(true);
      return true;
    } catch (err) {
      console.warn('Real microphone capture failed, falling back to gentle synth wave:', err.message);
      setIsMicActive(false);
      return false;
    }
  }, [getAudioContext]);

  // Stop real microphone capture
  const stopMic = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect(); } catch (_) {}
      micSourceRef.current = null;
    }
    setIsMicActive(false);
  }, []);

  // Bind TTS HTMLAudioElement to Analyser for live frequency visualization of AI voice
  const bindTtsAudio = useCallback((audioElement) => {
    if (!audioElement || typeof window === 'undefined') return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      ttsAudioRef.current = audioElement;

      if (!ttsAnalyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.85;
        ttsAnalyserRef.current = analyser;
      }

      if (!ttsSourceRef.current) {
        const source = ctx.createMediaElementSource(audioElement);
        source.connect(ttsAnalyserRef.current);
        ttsAnalyserRef.current.connect(ctx.destination);
        ttsSourceRef.current = source;
      }
    } catch (err) {
      // Audio element might already be connected
    }
  }, [getAudioContext]);

  // Main 60fps audio visualizer tick loop
  useEffect(() => {
    let phase = 0;

    const renderFrame = () => {
      phase += 0.05;
      let activeAnalyser = null;

      // When AI is speaking and TTS analyser has signal, visualize AI speech
      if (isAiSpeakingRef.current && ttsAnalyserRef.current) {
        activeAnalyser = ttsAnalyserRef.current;
      } else if (micAnalyserRef.current && isMicActive) {
        activeAnalyser = micAnalyserRef.current;
      }

      if (activeAnalyser) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(dataArray);

        // Compute RMS volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        // Only re-render when RMS actually moved (avoids 60fps setState churn)
        if (Math.abs(rms - lastRmsRef.current) > 0.5) {
          lastRmsRef.current = rms;
          setRmsVolume(rms);
        }

        // FULL-DUPLEX BARGE-IN INTERRUPTION CHECK:
        // If AI is speaking AND user speaks into microphone with volume > threshold
        if (isAiSpeakingRef.current && micAnalyserRef.current) {
          const micData = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
          micAnalyserRef.current.getByteFrequencyData(micData);
          let micSum = 0;
          for (let i = 0; i < micData.length; i++) micSum += micData[i] * micData[i];
          const micRms = Math.sqrt(micSum / micData.length);

          if (micRms > interruptionThreshold) {
            // User interrupted the AI! Trigger barge-in
            if (typeof onInterruptedRef.current === 'function') {
              onInterruptedRef.current(micRms);
            }
          }
        }

        // Map frequency bins to bar heights
        const step = Math.max(1, Math.floor(bufferLength / numBars));
        const bars = [];
        for (let i = 0; i < numBars; i++) {
          const idx = Math.min(bufferLength - 1, i * step);
          const val = dataArray[idx] || 0;
          // Scale 0-255 to min 4px - max 68px
          const scaled = 4 + (val / 255) * 64;
          bars.push(scaled);
        }
        // Only re-render when bar heights actually changed
        const prev = lastBarsRef.current;
        const changed = !prev || bars.some((v, i) => Math.abs(v - prev[i]) > 0.5);
        if (changed) {
          lastBarsRef.current = bars;
          setFrequencies(bars);
        }
      } else {
        // Idle gentle breathing sine wave
        if (lastRmsRef.current !== 0) {
          lastRmsRef.current = 0;
          setRmsVolume(0);
        }
        const bars = [];
        for (let i = 0; i < numBars; i++) {
          const wave = Math.sin(phase + (i * Math.PI) / (numBars / 2)) * 6;
          bars.push(Math.max(4, 8 + wave));
        }
        const prev = lastBarsRef.current;
        const changed = !prev || bars.some((v, i) => Math.abs(v - prev[i]) > 0.5);
        if (changed) {
          lastBarsRef.current = bars;
          setFrequencies(bars);
        }
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [numBars, isMicActive, interruptionThreshold]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMic();
      if (ttsSourceRef.current) {
        try { ttsSourceRef.current.disconnect(); } catch (_) {}
      }
      if (ttsAnalyserRef.current) {
        try { ttsAnalyserRef.current.disconnect(); } catch (_) {}
      }
    };
  }, [stopMic]);

  const setAiSpeaking = useCallback((speaking) => {
    isAiSpeakingRef.current = speaking;
  }, []);

  return {
    frequencies,
    rmsVolume,
    isMicActive,
    startMic,
    stopMic,
    bindTtsAudio,
    setAiSpeaking,
    getAudioContext,
  };
}
