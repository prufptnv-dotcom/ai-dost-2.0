import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, X } from 'lucide-react';

/**
 * LiveMultimodalExperience.jsx
 * 
 * Implements GPT-4o style Real-time Voice & Vision using the Gemini Live API.
 * Captures microphone and webcam, sends PCM audio + JPEG frames to Gemini,
 * and streams back the AI's natural voice response in real-time.
 */

const LiveMultimodalExperience = ({ onClose }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [micEnabled, setMicEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [error, setError] = useState('');

    const sessionRef = useRef(null);
    const audioContextRef = useRef(null);
    const workletNodeRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const videoLoopRef = useRef(null);
    
    // Playback state
    const playbackContextRef = useRef(null);
    let nextPlayTime = 0;

    useEffect(() => {
        return () => {
            disconnectLive();
        };
    }, []);

    const disconnectLive = () => {
        setIsConnected(false);
        setIsConnecting(false);
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (playbackContextRef.current) {
            playbackContextRef.current.close();
            playbackContextRef.current = null;
        }
        if (videoLoopRef.current) {
            clearInterval(videoLoopRef.current);
            videoLoopRef.current = null;
        }
    };

    // Initialize Audio context and start mic
    const startAudio = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled });
            mediaStreamRef.current = stream;

            if (videoEnabled && videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Web Audio API context at 16kHz for Gemini
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');

            const source = audioContextRef.current.createMediaStreamSource(stream);
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');

            // Receive PCM from worklet
            workletNodeRef.current.port.onmessage = (event) => {
                if (!isConnected || !sessionRef.current || !micEnabled) return;
                
                const pcmData = event.data; // Int16Array
                // Convert to base64
                const bytes = new Uint8Array(pcmData.buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Audio = window.btoa(binary);

                sessionRef.current.sendRealtimeInput([{
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Audio
                }]);
            };

            source.connect(workletNodeRef.current);
            
            // Start video loop if enabled
            if (videoEnabled) {
                videoLoopRef.current = setInterval(sendVideoFrame, 1500); // 1.5s per frame
            }

        } catch (err) {
            setError('Could not access microphone/camera. ' + err.message);
            console.error(err);
        }
    };

    const sendVideoFrame = () => {
        if (!isConnected || !sessionRef.current || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get base64 JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Compress to 50%
        const base64Data = dataUrl.split(',')[1];
        
        sessionRef.current.sendRealtimeInput([{
            mimeType: 'image/jpeg',
            data: base64Data
        }]);
    };

    // Playback audio chunks from Gemini
    const playAudioChunk = (base64Audio) => {
        if (!playbackContextRef.current) {
            // Output sample rate is 24kHz for Gemini Live
            playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            nextPlayTime = playbackContextRef.current.currentTime + 0.1;
        }

        const binaryString = window.atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Convert Int16 bytes to Float32
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        const buffer = playbackContextRef.current.createBuffer(1, float32Array.length, 24000);
        buffer.copyToChannel(float32Array, 0);

        const source = playbackContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(playbackContextRef.current.destination);

        const startTime = Math.max(nextPlayTime, playbackContextRef.current.currentTime);
        source.start(startTime);
        nextPlayTime = startTime + buffer.duration;
    };

    const connectLive = async () => {
        setIsConnecting(true);
        setError('');

        try {
            // 1. Get ephemeral token (backend now returns raw `key` for the SDK)
            const res = await fetch('/api/gemini-live-token');
            const data = await res.json();
            const apiKey = data.key || data.token;
            if (!apiKey) throw new Error("Failed to get API token");

            // 2. Init SDK with actual API key (was passing base64 token — wrong format)
            const ai = new GoogleGenAI({ apiKey });
            
            // 3. Connect to Live API
            const session = await ai.live.connect({
                model: 'gemini-3.1-flash-live-preview',
                config: {
                    responseModalities: ['AUDIO'],
                    systemInstruction: { parts: [{ text: "You are AI-Dost, a very helpful and natural AI companion. Keep your answers concise, natural and friendly, suitable for voice." }] }
                },
                callbacks: {
                    onopen: () => {
                        console.log("Connected to Gemini Live");
                        setIsConnected(true);
                        setIsConnecting(false);
                        startAudio();
                    },
                    onmessage: (response) => {
                        const content = response.serverContent;
                        
                        // Handle interruption (VAD)
                        if (content?.interrupted) {
                            nextPlayTime = 0; // Clear playback queue
                            if (playbackContextRef.current) {
                                playbackContextRef.current.close();
                                playbackContextRef.current = null;
                            }
                            return;
                        }

                        // Play audio
                        if (content?.modelTurn?.parts) {
                            for (const part of content.modelTurn.parts) {
                                if (part.inlineData) {
                                    playAudioChunk(part.inlineData.data);
                                }
                            }
                        }
                    },
                    onerror: (err) => {
                        console.error("Gemini Live Error:", err);
                        setError("Connection Error");
                        disconnectLive();
                    },
                    onclose: () => {
                        console.log("Gemini Live Closed");
                        disconnectLive();
                    }
                }
            });

            sessionRef.current = session;

        } catch (err) {
            console.error(err);
            setError(err.message);
            setIsConnecting(false);
        }
    };

    const toggleMic = () => setMicEnabled(!micEnabled);
    const toggleVideo = () => {
        const nextState = !videoEnabled;
        setVideoEnabled(nextState);
        if (isConnected) {
            disconnectLive();
            connectLive(); // Re-establish with new streams
        }
    };

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            
            <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={32} />
            </button>

            <h2 style={{ marginBottom: '20px' }}>AI-Dost Live Voice & Vision</h2>

            {/* Video Preview */}
            <div style={{ position: 'relative', width: '320px', height: '240px', backgroundColor: '#222', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', display: videoEnabled ? 'block' : 'none' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />
            </div>

            {/* Status / Waveform Placeholder */}
            <div style={{ margin: '20px', padding: '20px', background: '#333', borderRadius: '50%', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isConnecting ? "Connecting..." : isConnected ? "Listening..." : "Idle"}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                {!isConnected && !isConnecting && (
                    <button onClick={connectLive} style={{ padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer' }}>
                        Start Session
                    </button>
                )}
                
                {isConnected && (
                    <>
                        <button onClick={toggleMic} style={{ padding: '10px', background: micEnabled ? '#3b82f6' : '#ef4444', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer' }}>
                            {micEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                        </button>
                        <button onClick={toggleVideo} style={{ padding: '10px', background: videoEnabled ? '#3b82f6' : '#4b5563', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer' }}>
                            {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                        </button>
                        <button onClick={disconnectLive} style={{ padding: '10px 20px', background: '#ef4444', border: 'none', borderRadius: '8px', color: 'white', fontSize: '16px', cursor: 'pointer' }}>
                            End Call
                        </button>
                    </>
                )}
            </div>

            {error && <div style={{ color: '#ef4444', marginTop: '20px' }}>{error}</div>}
        </div>
    );
};

export default LiveMultimodalExperience;
