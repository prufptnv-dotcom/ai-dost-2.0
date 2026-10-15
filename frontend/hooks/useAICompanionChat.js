import { CompanionLibraryOverlay } from '../components/ui/CompanionLibraryOverlay';
import { CompanionHistoryOverlay } from '../components/ui/CompanionHistoryOverlay';
import { CompanionFeedbackModal } from '../components/ui/CompanionFeedbackModal';
import { CompanionMessageList } from '../components/ui/CompanionMessageList';
import { CompanionInputArea } from '../components/ui/CompanionInputArea';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import api, { API_HOST } from '../services/api';
import { Mic, MicOff, Volume2, VolumeX, Bot, Phone, Paperclip, Send, Library, Zap, CheckCircle, ImageIcon, FileText, X, ChevronLeft, Loader2, Play, Square, History, Trash2, MessageSquare, Sparkles, Image as ImageIconLucide, Plus, Copy, ThumbsUp, ThumbsDown, Maximize2, Minimize2, MoveHorizontal } from 'lucide-react';
import { ChatClassicMessageBubble as MessageBubble } from '../components/chat/ChatClassicMessageBubble';

import AIPageView from "../components/views/AIPageView";
import AIAssistantModal from "../components/ui/AIAssistantModal";

export function useAICompanionChat({ onWriteCode, currentCode, currentFile }) {
  const { mode } = useMode();
  const { showToast } = useToast();
  const storageKey = mode === 'chat' ? 'ai_dost_messages_chat' : 'ai_dost_messages_project';

  const defaultWelcomeMessage = {
    id: 'welcome',
    sender: 'ai',
    text: mode === 'chat' 
      ? `Namaste! Main Ai-Dost hoon — General Chat Mode mein.\n\nKuch bhi poochna ho — coding, research, writing, translation — yahan type karein!`
      : `Namaste! Main Ai-Dost hoon — Project Workspace Mode mein.\n\nAapke current project file par madad karne ke liye tayyar hoon. Code blocks ke liye 'Apply Code' button use karein.`
  };

  const [messages, setMessages] = useState([defaultWelcomeMessage]);
  const [mounted, setMounted] = useState(false);

  const [chatHistoryList, setChatHistoryList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load mode-specific messages after component mounts on client
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      if (typeof window !== 'undefined') {
        let saved = null;
        try { saved = localStorage.getItem(storageKey); } catch (_) {}
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          } catch (e) {
            setMessages([defaultWelcomeMessage]);
          }
        } else {
          setMessages([defaultWelcomeMessage]);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Persist messages to mode-specific localStorage key
  useEffect(() => {
    if (mounted && typeof window !== 'undefined' && messages.length > 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch (_) {}
    }
  }, [messages, storageKey, mounted]);

  const [input, setInput] = useState('');
  const [copilotMode, setCopilotMode] = useState('chat'); // 'chat' | 'agent' | 'plan'
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef(null);
  const [assistantTab, setAssistantTab] = useState(null);
  
  // Perplexity-style Advanced Search & Document states
  const [selectedModel, setSelectedModel] = useState('auto');
  const [localModels, setLocalModels] = useState([]);
  const [focusMode, setFocusMode] = useState('all');
  const [isProSearch, setIsProSearch] = useState(false);
  const [proSearchStages, setProSearchStages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Feedback & Self-Correction Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackData, setFeedbackData] = useState({ message: '', aiReply: '' });
  const [feedbackCategory, setFeedbackCategory] = useState('typo');
  const [correctionText, setCorrectionText] = useState('');
  // Last message the user actually sent — `input` is already cleared by then
  const lastSentMessageRef = useRef('');

  const handleFeedbackSignal = async (type, aiReply) => {
    if (type === 'up') {
      showToast({ type: 'success', message: '👍 Thanks! AI-Dost learned from this response.' });
      try {
        await api.post('/learning/feedback', { type: 'up', aiReply });
      } catch(e) {}
    } else {
      setFeedbackData({ message: lastSentMessageRef.current, aiReply });
      setShowFeedbackModal(true);
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      await api.post('/learning/feedback', {
        type: 'down',
        category: feedbackCategory,
        aiReply: feedbackData.aiReply,
        correction: correctionText
      });
      showToast({ type: 'success', message: '🧠 Feedback recorded! Personal Brain has self-corrected.' });
      setShowFeedbackModal(false);
      setCorrectionText('');
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to submit feedback' });
    }
  };

  // Clipboard Paste Image / File Handler
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            setAttachedFile({
              name: `pasted-image-${Date.now()}.png`,
              content: evt.target.result,
              type: 'image',
              size: (file.size / 1024).toFixed(1) + ' KB',
              timestamp: new Date().toLocaleTimeString()
            });
            showToast({ type: 'success', message: 'Image pasted from clipboard!' });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Dual-Side Mouse Drag Resizer (Activated ONLY on Double-Click ↔)
  const [customPixelWidth, setCustomPixelWidth] = useState(null); // numeric px e.g. 1000
  const [isDragActive, setIsDragActive] = useState(false);
  const isDraggingRef = useRef(false);
  const dragSideRef = useRef(null); // 'left' | 'right'
  const startXRef = useRef(0);
  const startWidthRef = useRef(1000);
  const containerRef = useRef(null);
  // Stable listener refs so move/end handlers can always be removed,
  // even after re-renders recreate inline closures (unmount leak fix).
  const dragMoveListenerRef = useRef(null);
  const dragEndListenerRef = useRef(null);
  const dragMountedRef = useRef(true);

  const handleMouseDragMove = useCallback((e) => {
    if (!dragMountedRef.current || !isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    let newWidth = startWidthRef.current;

    if (dragSideRef.current === 'right') {
      newWidth = startWidthRef.current + deltaX * 2;
    } else if (dragSideRef.current === 'left') {
      newWidth = startWidthRef.current - deltaX * 2;
    }

    const minW = 480;
    const maxW = typeof window !== 'undefined' ? window.innerWidth - 32 : 1800;
    const clampedW = Math.max(minW, Math.min(maxW, newWidth));
    setCustomPixelWidth(clampedW);
  }, []);

  const handleMouseDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    dragSideRef.current = null;
    if (dragMountedRef.current) setIsDragActive(false);
    if (dragMoveListenerRef.current) document.removeEventListener('mousemove', dragMoveListenerRef.current);
    if (dragEndListenerRef.current) document.removeEventListener('mouseup', dragEndListenerRef.current);
    dragMoveListenerRef.current = null;
    dragEndListenerRef.current = null;
  }, []);

  // Remove any dangling drag listeners on unmount
  useEffect(() => {
    dragMountedRef.current = true;
    return () => {
      dragMountedRef.current = false;
      if (dragMoveListenerRef.current) document.removeEventListener('mousemove', dragMoveListenerRef.current);
      if (dragEndListenerRef.current) document.removeEventListener('mouseup', dragEndListenerRef.current);
      dragMoveListenerRef.current = null;
      dragEndListenerRef.current = null;
    };
  }, []);

  const handleHandleDoubleClick = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
    isDraggingRef.current = true;
    dragSideRef.current = side;
    startXRef.current = e.clientX;
    
    const currentW = containerRef.current ? containerRef.current.offsetWidth : 1000;
    startWidthRef.current = currentW;

    if (showToast) {
      showToast({ type: 'info', message: '↔️ Double-Click Activated! Move mouse left/right to resize width.' });
    }

    dragMoveListenerRef.current = handleMouseDragMove;
    dragEndListenerRef.current = handleMouseDragEnd;
    document.addEventListener('mousemove', handleMouseDragMove);
    document.addEventListener('mouseup', handleMouseDragEnd);
  };

  useEffect(() => {
    if (isDragActive) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      return () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragActive]);

  // Resizable Chat Width States
  const [widthMode, setWidthMode] = useState('wide'); // 'normal' | 'wide' | 'full'

  const cycleWidthMode = () => {
    setCustomPixelWidth(null);
    if (widthMode === 'normal') {
      setWidthMode('wide');
      if (showToast) showToast({ type: 'info', message: 'Chat width expanded to Wide (↔)' });
    } else if (widthMode === 'wide') {
      setWidthMode('full');
      if (showToast) showToast({ type: 'info', message: 'Chat expanded to Full Screen (⤢)' });
    } else {
      setWidthMode('normal');
      if (showToast) showToast({ type: 'info', message: 'Chat width set to Compact' });
    }
  };
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Clear current mode history
  const handleClearCurrentHistory = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    setMessages([defaultWelcomeMessage]);
    showToast({ type: 'info', message: `${mode === 'chat' ? 'General Chat' : 'Project Chat'} history cleared.` });
  };

  // Voice Call States
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [voiceCallStatus, setVoiceCallStatus] = useState('Connecting...');
  const [voiceCallText, setVoiceCallText] = useState('');
  const isVoiceCallActiveRef = useRef(false);
  const callRecognitionRef = useRef(null);

  // Speech Recognition & Synthesis states
  const [isListening, setIsListening] = useState(false);
  const [speakOutput, setSpeakOutput] = useState(false); // Default to muted, togglable by user
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'hi-IN'; // Works great for Hinglish, Hindi, and English
        
        rec.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };
        
        rec.onend = () => {
          isListeningRef.current = false;
          setIsListening(false);
        };
        
        rec.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
        };
        
        rec.onerror = (e) => {
          console.error('Speech recognition error:', e);
          isListeningRef.current = false;
          setIsListening(false);
        };
        
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    const fetchLocalModels = async () => {
      try {
        // P2 #108: probe through the Next /api rewrite when the API base is
        // relative (or unset) — stripping NEXT_PUBLIC_API_URL used to fall
        // back to http://localhost:5000 and died off-local. Absolute env
        // bases still go direct to their origin.
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const baseUrl = /^https?:\/\//.test(apiBase)
          ? apiBase.replace(/\/api\/v1\/?$/, '')
          : '';
        const res = await fetch(`${baseUrl}/api/chat/local-models`);
        const data = await res.json();
        if (data.success && data.models) {
          setLocalModels(data.models);
        }
      } catch (err) {
        console.error('Failed to fetch local models:', err);
      }
    };
    fetchLocalModels();
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast({ type: 'warning', message: 'Speech Recognition not supported in this browser.' });
      return;
    }

    if (isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Failed to stop speech recognition:', err);
      }
    } else {
      try {
        // Prevent calling start if already in active starting phase
        isListeningRef.current = true; 
        recognitionRef.current.start();
      } catch (err) {
        isListeningRef.current = false;
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const [playingMessageId, setPlayingMessageId] = useState(null);

  const speakText = (text, messageId = null, onFinishedCallback = null) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // If clicking the currently playing message audio, stop it
      if (playingMessageId === messageId && messageId !== null) {
        window.speechSynthesis.cancel();
        setPlayingMessageId(null);
        return;
      }

      window.speechSynthesis.cancel(); // Mute any ongoing audio

      // Strip markup tags for voice read readability
      const cleanReadText = text
        .replace(/```[\s\S]*?```/g, '[Coding block displayed on screen]')
        .replace(/\[GENERATE_PDF:[\s\S]*?\[\/GENERATE_PDF\]/g, '')
        .replace(/[*#_~]/g, '');

      const utterance = new SpeechSynthesisUtterance(cleanReadText);
      
      // Robust Language & Accent Detection (Hindi, Hinglish, English)
      const hasDevanagari = /[\u0900-\u097F]/.test(cleanReadText);
      const hinglishWords = ['aap', 'main', 'karo', 'kya', 'kaise', 'hai', 'hoon', 'karne', 'bhi', 'kuch', 'raha', 'rahi', 'suno', 'batao', 'dost', 'shukriya', 'namaste', 'sabse', 'pehle', 'lekin', 'kyunki'];
      const textLower = cleanReadText.toLowerCase();
      const isHinglish = hinglishWords.some(w => textLower.includes(w));

      const isHindiOrHinglish = hasDevanagari || isHinglish;
      utterance.lang = isHindiOrHinglish ? 'hi-IN' : 'en-US';

      const voices = window.speechSynthesis.getVoices();
      if (isHindiOrHinglish) {
        // Find Indian Hindi narrator voice first, fallback to Indian English or default
        const indianVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
        if (indianVoice) utterance.voice = indianVoice;
      } else {
        // Find English narrator voice
        const englishVoice = voices.find(v => v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }

      if (messageId !== null) {
        setPlayingMessageId(messageId);
        utterance.onend = () => {
          setPlayingMessageId(null);
          if (onFinishedCallback) onFinishedCallback();
        };
        utterance.onerror = () => {
          setPlayingMessageId(null);
        };
      } else if (onFinishedCallback) {
        utterance.onend = () => {
          if (onFinishedCallback) onFinishedCallback();
        };
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const startListeningForCall = () => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast({ type: 'error', message: 'Speech recognition is not supported in this browser.' });
      return;
    }

    setVoiceCallStatus("Listening...");

    const callRec = new SpeechRecognition();
    callRec.continuous = false;
    callRec.interimResults = false;
    callRec.lang = 'hi-IN';

    callRec.onstart = () => {
      logger.log('Voice Call Mic active');
    };

    callRec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      logger.log('Spoken:', text);
      triggerVoiceCallTurn(text);
    };

    callRec.onerror = (e) => {
      logger.error('Call mic error:', e);
      if (isVoiceCallActiveRef.current) {
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) startListeningForCall();
        }, 1200);
      }
    };

    callRec.onend = () => {
      logger.log('Call mic end');
    };

    callRec.start();
    callRecognitionRef.current = callRec;
  };

  const triggerVoiceCallTurn = async (spokenText) => {
    if (!spokenText.trim()) return;
    setVoiceCallStatus("Thinking...");
    setVoiceCallText(`You: "${spokenText}"`);

    try {
      const historyPayload = messages.map(msg => ({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text || ''
      }));

      const customKeys = {
        gemini: localStorage.getItem('customGeminiKey') || '',
        groq: localStorage.getItem('customGroqKey') || '',
        deepseek: localStorage.getItem('customDeepSeekKey') || '',
        nvidia: localStorage.getItem('customNvidiaKey') || '',
        openrouter: localStorage.getItem('customOpenRouterKey') || ''
      };

      const payload = {
        message: spokenText,
        mode: mode,
        history: historyPayload,
        customKeys: customKeys,
        uploadedDocs: uploadedDocs.map(d => ({ name: d.name, content: d.content }))
      };

      if (selectedModel !== 'auto') {
        payload.model = selectedModel;
      }

      if (mode === 'project' && currentCode) {
        payload.fileContent = currentCode;
        payload.section = 'coding';
      }

      const res = await fetch(`${API_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.reply) {
        setMessages(prev => [
          ...prev, 
          { sender: 'user', text: spokenText, timestamp: new Date().toLocaleTimeString() },
          { sender: 'ai', text: data.reply, timestamp: new Date().toLocaleTimeString() }
        ]);

        setVoiceCallText(data.reply);
        setVoiceCallStatus("Speaking...");
        
        speakText(data.reply, null, () => {
          if (isVoiceCallActiveRef.current) {
            startListeningForCall();
          }
        });
      } else {
        setVoiceCallText("Server returned an error. Please try again.");
        setVoiceCallStatus("Error");
        setTimeout(() => {
          if (isVoiceCallActiveRef.current) startListeningForCall();
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      setVoiceCallText("Network connection failed.");
      setVoiceCallStatus("Error");
      setTimeout(() => {
        if (isVoiceCallActiveRef.current) startListeningForCall();
      }, 3000);
    }
  };

  const handleToggleVoiceCall = () => {
    if (isVoiceCallActive) {
      isVoiceCallActiveRef.current = false;
      setIsVoiceCallActive(false);
      if (callRecognitionRef.current) {
        callRecognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      showToast({ type: 'info', message: 'Voice call ended.' });
    } else {
      isVoiceCallActiveRef.current = true;
      setIsVoiceCallActive(true);
      setVoiceCallText("Connecting to AI-Dost voice server...");
      setVoiceCallStatus("Connecting...");
      
      speakText("Haan dost, mai sun raha hoon. Aap bolna shuru kijiye.", null, () => {
        if (isVoiceCallActiveRef.current) {
          startListeningForCall();
        }
      });
    }
  };

  const handleQuickAction = (templateText) => {
    setInput(templateText);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const isImage = file.type.startsWith('image/');
    
    reader.onload = (event) => {
      const fileData = {
        name: file.name,
        content: event.target.result,
        type: isImage ? 'image' : 'text',
        size: (file.size / 1024).toFixed(1) + ' KB',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setAttachedFile(fileData);
      setUploadedDocs(prev => {
        if (prev.some(d => d.name === file.name)) return prev;
        return [...prev, fileData];
      });
      showToast({ type: 'success', message: `Attached and added to Document Library: ${file.name}` });
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  
  const handleResumeAutonomous = async (threadId, approved, mcp_cmd, mcp_args) => {
    setIsTyping(true);
    setIsThinking(true);
    try {
      setMessages(prev => {
        const newMsg = [...prev];
        const lastMsg = newMsg[newMsg.length - 1];
        if (lastMsg.sender === 'ai' && lastMsg.requiresApproval) {
            lastMsg.requiresApproval = false;
            lastMsg.text += approved ? "\n✅ **Approved!** Resuming..." : "\n❌ **Denied!** Canceling task...";
        }
        return newMsg;
      });

      const response = await fetch(`${API_HOST}/api/agent/autonomous/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            thread_id: threadId,
            approved: approved,
            mcp_command: mcp_cmd,
            mcp_args: mcp_args
        })
      });
      const data = await response.json();
      
      if (data.status === 'requires_approval') {
        const toolCall = data.tool_call || {};
        const toolName = toolCall.name || 'unknown_tool';
        const toolArgs = toolCall.args || toolCall.arguments || {};
        
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: `**Thought Stream:** The agent wants to execute \`${toolName}\`.`,
          requiresApproval: true,
          threadId: threadId,
          toolName: toolName,
          toolArgs: typeof toolArgs === 'object' ? JSON.stringify(toolArgs, null, 2) : String(toolArgs),
          mcpCmd: mcp_cmd,
          mcpArgs: mcp_args
        }]);
      } else {
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: data.result || 'Task completed via autonomous agent.',
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Error in autonomous resume: ' + err.message }]);
    }
    setIsTyping(false);
    setIsThinking(false);
  };

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;

    const textInput = input.trim();
    let displayPrompt = textInput;
    let apiPrompt = textInput;

    if (attachedFile) {
      const getContextLimit = (model) => {
        switch (model) {
          case 'groq':
          case 'deepseek':
            return 25000;
          case 'gemini':
            return 300000;
          default:
            return 25000;
        }
      };

      const limit = getContextLimit(selectedModel);
      let fileContent = attachedFile.content || '';
      
      if (fileContent.length > limit) {
        fileContent = fileContent.substring(0, limit) + `\n\n...[Content truncated for model context window limits. Total original length: ${fileContent.length.toLocaleString()} characters]...`;
        showToast({
          type: 'warning',
          message: `File content truncated to ${limit.toLocaleString()} characters to fit AI context window.`
        });
      }

      displayPrompt = `📎 [Attached: ${attachedFile.name}]\n${textInput}`;
      apiPrompt = `[Uploaded ${attachedFile.type} file: ${attachedFile.name}]\nContent:\n${fileContent}\n\nUser request: ${textInput}`;
    }

    lastSentMessageRef.current = displayPrompt || textInput;
    setMessages(prev => [...prev, { text: displayPrompt, sender: 'user', query: textInput || 'General Search' }]);
    setInput('');
    setAttachedFile(null); // Clear uploader

    // ---- /image command ----
    if (textInput.toLowerCase().startsWith('/image ')) {
      const imagePrompt = textInput.substring(7).trim();
      setIsGeneratingImage(true);
      setIsTyping(true);

      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=768&height=512&nologo=true`;

      setMessages(prev => [...prev, {
        sender: 'ai',
        text: `🎨 "${imagePrompt}"`,
        images: [pollinationsUrl],
        query: textInput
      }]);

      setIsTyping(false);
      setIsGeneratingImage(false);
      return;
    }

    // ---- Normal chat ----
    setIsTyping(true);
    setIsThinking(true);
    
    // ---- Pro Search Multi-Step Simulator ----
    if (isProSearch) {
      setProSearchStages(['🔍 Breaking down search queries...']);
      await new Promise(resolve => setTimeout(resolve, 800));
      setProSearchStages(prev => [...prev, `🌐 Searching ${focusMode} indices & web catalogs...`]);
      await new Promise(resolve => setTimeout(resolve, 800));
      setProSearchStages(prev => [...prev, '⚖️ Verifying 4 source publications & structural citations...']);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      // Only send the last 6 messages to prevent LLM context window overflow (HTTP 413)
      const historyPayload = messages.slice(-6).map(msg => ({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text || ''
      }));

      const customKeys = {
        gemini: localStorage.getItem('customGeminiKey') || '',
        groq: localStorage.getItem('customGroqKey') || '',
        deepseek: localStorage.getItem('customDeepSeekKey') || '',
        nvidia: localStorage.getItem('customNvidiaKey') || '',
        openrouter: localStorage.getItem('customOpenRouterKey') || ''
      };

      // Copilot Mode Prompt Enhancer
      let modePromptPrefix = "";
      if (mode === 'project') {
        if (copilotMode === 'agent') {
          modePromptPrefix = "[COPILOT AGENT MODE]: You are an autonomous Full Stack AI Agent. Write full, production-ready code blocks and complete files. If creating or modifying multiple files, clearly specify file paths in code headers so the developer can click Apply Code.\n\n";
        } else if (copilotMode === 'plan') {
          modePromptPrefix = "[COPILOT PLAN MODE]: You are a Software Architect. Before writing code, create a step-by-step architectural breakdown plan with file structure, logic flowchart, and key implementation steps.\n\n";
        } else {
          modePromptPrefix = "[COPILOT CHAT MODE]: Provide quick, helpful coding advice, debugging hints, and direct answers.\n\n";
        }
      }

      // Smart Intent Pre-processor (Detects Image, PDF, Email, Code requests)
      const userTextLower = (textInput || '').toLowerCase();
      const isImageRequest = /\b(image|photo|picture|draw|painting|illustration|diagram|pic)\b/i.test(userTextLower);
      const isPdfRequest = /\b(pdf|document|report|resume|paper)\b/i.test(userTextLower);
      
      let intentSuffix = "";
      if (isImageRequest) {
        intentSuffix += "\n\n[USER INTENT: IMAGE REQUEST - Include tag `[GENERATE_IMAGE: detailed english prompt]` in your response.]";
      } else if (isPdfRequest) {
        intentSuffix += "\n\n[USER INTENT: PDF DOCUMENT REQUEST - Wrap document in `[GENERATE_PDF: Title] content [/GENERATE_PDF]`.]";
      }

      const requestPayload = {
        message: modePromptPrefix + apiPrompt + intentSuffix,
        mode: mode,
        copilotMode: copilotMode,
        history: historyPayload,
        customKeys: customKeys,
        uploadedDocs: uploadedDocs.map(d => ({ name: d.name, content: d.content }))
      };
      
      if (selectedModel !== 'auto') {
        requestPayload.model = selectedModel;
      }
      
      // Inject current active file content for code editing context ONLY in project mode
      if (mode === 'project' && currentCode) {
        requestPayload.fileContent = currentCode;
        requestPayload.section = 'coding';
      }

      
      
      // ---- Swarm Agent Mode Intercept ----
      if (copilotMode === 'swarm') {
         const threadId = 'thread_' + Date.now();
         try {
            const res = await fetch(`${API_HOST}/api/agent/autonomous/swarm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: apiPrompt,
                    thread_id: threadId,
                    mcp_command: "python", 
                    mcp_args: []
                })
            });
            const data = await res.json();
            
            if (data.status === 'requires_approval') {
                const toolCall = data.tool_call || {};
                const toolName = toolCall.name || 'unknown_tool';
                const toolArgs = toolCall.args || toolCall.arguments || {};
                
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: `**Swarm Activity:** A Swarm agent wants to execute \`${toolName}\`.`,
                    requiresApproval: true,
                    threadId: threadId,
                    toolName: toolName,
                    toolArgs: typeof toolArgs === 'object' ? JSON.stringify(toolArgs, null, 2) : String(toolArgs),
                    mcpCmd: "python",
                    mcpArgs: []
                }]);
            } else {
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: data.result || 'Swarm task complete.'
                }]);
            }
         } catch(err) {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Swarm Run Error: ' + err.message }]);
         }
         setIsTyping(false);
         setIsThinking(false);
         return;
      }
      // ---- End Swarm ----

      // ---- Autonomous Agent Mode Intercept ----
      if (copilotMode === 'autonomous') {
         const threadId = 'thread_' + Date.now();
         try {
            const res = await fetch(`${API_HOST}/api/agent/autonomous/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: apiPrompt,
                    thread_id: threadId,
                    mcp_command: "python", // default or can be dynamic
                    mcp_args: []
                })
            });
            const data = await res.json();
            
            if (data.status === 'requires_approval') {
                const toolCall = data.tool_call || {};
                const toolName = toolCall.name || 'unknown_tool';
                const toolArgs = toolCall.args || toolCall.arguments || {};
                
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: `**Thought Stream:** The agent wants to execute \`${toolName}\`.`,
                    requiresApproval: true,
                    threadId: threadId,
                    toolName: toolName,
                    toolArgs: typeof toolArgs === 'object' ? JSON.stringify(toolArgs, null, 2) : String(toolArgs),
                    mcpCmd: "python",
                    mcpArgs: []
                }]);
            } else {
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: data.result || 'Autonomous task complete.'
                }]);
            }
         } catch(err) {
            setMessages(prev => [...prev, { sender: 'ai', text: 'Autonomous Run Error: ' + err.message }]);
         }
         setIsTyping(false);
         setIsThinking(false);
         return;
      }
      // ---- End Autonomous ----

      const response = await fetch(`${API_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json();
      const replyText = data.reply || 'AI response here...';

      // Parse custom [GENERATE_PDF: Title] content [/GENERATE_PDF] tags
      const pdfRegex = /\[GENERATE_PDF:\s*(.*?)\]([\s\S]*?)\[\/GENERATE_PDF\]/i;
      const pdfMatch = replyText.match(pdfRegex);
      
      let finalReplyText = replyText;
      let pdfUrl = null;
      let pdfName = '';
      
      if (pdfMatch) {
        const pdfTitle = pdfMatch[1].trim();
        const innerContent = pdfMatch[2].trim();
        const cleanChatText = replyText.replace(pdfRegex, '').trim();
        
        // Strip tag block from message bubbles
        finalReplyText = replyText.replace(pdfRegex, `📄 Compiled PDF report: "${pdfTitle}"`).trim();
        
        // Fallback to full detailed text if tags content is summarized/shorter
        const pdfContent = innerContent.length > (cleanChatText.length * 0.7) ? innerContent : cleanChatText;
        
        try {
          const pdfRes = await fetch(`${API_HOST}/api/pdf/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: pdfTitle, content: pdfContent })
          });
          const pdfData = await pdfRes.json();
          if (pdfData.success && pdfData.downloadUrl) {
            pdfUrl = pdfData.downloadUrl;
            pdfName = pdfTitle;
          }
        } catch (err) {
          console.error('PDF route compilation failed:', err);
        }
      }

      // Parse custom [GENERATE_IMAGE: descriptive prompt] tags
      const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
      const imageMatch = finalReplyText.match(imageTagRegex);
      
      let generatedImages = [];
      if (imageMatch) {
        const imagePromptText = imageMatch[1].trim();
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        generatedImages.push(pollinationsUrl);
        // Replace tag in the chat message
        finalReplyText = finalReplyText.replace(imageTagRegex, `🎨 Generated Image for: "${imagePromptText}"`).trim();
      } else if (isImageRequest) {
        // Fallback: If user asked for an image and AI model didn't return tag, auto-generate image from user's query!
        const imagePromptText = textInput.replace(/\b(image|photo|picture|draw|painting|illustration|diagram|pic|me|of|a|an)\b/gi, '').trim() || textInput;
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        generatedImages.push(pollinationsUrl);
      }

      // Generate mock clickable citations based on the query and focus mode
      let sources = [];
      if (isProSearch || focusMode !== 'all') {
        if (focusMode === 'academic') {
          sources = [
            { title: 'Semantic Scholar publication archive', domain: 'semanticscholar.org', url: `https://www.semanticscholar.org/search?q=${encodeURIComponent(textInput)}` },
            { title: 'arXiv Database of scientific preprints', domain: 'arxiv.org', url: `https://arxiv.org/search/?query=${encodeURIComponent(textInput)}&searchtype=all` }
          ];
        } else if (focusMode === 'reddit') {
          sources = [
            { title: 'Community discussions thread', domain: 'reddit.com', url: `https://www.reddit.com/search/?q=${encodeURIComponent(textInput)}` },
            { title: 'Subreddit forum answers', domain: 'reddit.com', url: `https://www.reddit.com/search/?q=${encodeURIComponent(textInput)}` }
          ];
        } else {
          sources = [
            { title: 'Wikipedia citation archives', domain: 'wikipedia.org', url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(textInput)}` },
            { title: 'Britannica global topic index', domain: 'britannica.com', url: `https://www.britannica.com/search?query=${encodeURIComponent(textInput)}&searchtype=all` }
          ];
        }
      }

      // In Agent Mode, automatically apply multi-file code edits directly to workspace files & run terminal/preview
      if (mode === 'project' && copilotMode === 'agent' && onWriteCode) {
        // Match code blocks with optional filename header e.g. ```html file="index.html" or // File: app.js
        const codeBlockRegex = /```(?:[a-zA-Z0-9_\-+]+)?(?:\s+(?:file|filename|path)=["']?([a-zA-Z0-9_\-\.\/]+)["']?)?\s*\n([\s\S]*?)```/gi;
        let match;
        let fileEdits = [];
        
        while ((match = codeBlockRegex.exec(finalReplyText)) !== null) {
          const explicitFilename = match[1];
          const codeContent = match[2] ? match[2].trim() : '';
          
          if (codeContent) {
            // Check inside code header if explicitFilename wasn't in backticks
            const innerHeaderMatch = codeContent.match(/^(?:#|\/\/|\/\*|<!--)\s*(?:File|filename|Path):\s*([a-zA-Z0-9_\-\.\/]+)/i);
            const targetFilename = explicitFilename || (innerHeaderMatch ? innerHeaderMatch[1].trim() : null);
            
            fileEdits.push({
              code: codeContent,
              filename: targetFilename
            });
          }
        }
        
        if (fileEdits.length > 0) {
          fileEdits.forEach((edit, idx) => {
            setTimeout(() => {
              onWriteCode(edit.code, edit.filename);
            }, idx * 400);
          });
        }
      }

      setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        sender: 'ai',
        text: finalReplyText,
        images: generatedImages.length > 0 ? generatedImages : undefined,
        pdfUrl: pdfUrl,
        pdfName: pdfName,
        sources: sources,
        query: textInput
      }]);
      // Note: Auto-narration removed so narrator only speaks when Play button is clicked by user
    } catch {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Sorry, kuch connection issue hai.',
      }]);
    } finally {
      setIsTyping(false);
      setIsThinking(false);
      setProSearchStages([]);
    }
  };


  return {
    storageKey,
    defaultWelcomeMessage,
    bottomRef,
    fileInputRef,
    lastSentMessageRef,
    handleFeedbackSignal,
    handleSubmitFeedback,
    handlePaste,
    isDraggingRef,
    dragSideRef,
    startXRef,
    startWidthRef,
    containerRef,
    dragMoveListenerRef,
    dragEndListenerRef,
    dragMountedRef,
    handleMouseDragMove,
    handleMouseDragEnd,
    handleHandleDoubleClick,
    cycleWidthMode,
    handleClearCurrentHistory,
    isVoiceCallActiveRef,
    callRecognitionRef,
    recognitionRef,
    isListeningRef,
    toggleListening,
    speakText,
    startListeningForCall,
    triggerVoiceCallTurn,
    handleToggleVoiceCall,
    handleQuickAction,
    handleFileChange,
    handleResumeAutonomous,
    handleSend,
    messages,
    setMessages,
    mounted,
    setMounted,
    chatHistoryList,
    setChatHistoryList,
    showHistory,
    setShowHistory,
    input,
    setInput,
    copilotMode,
    setCopilotMode,
    isTyping,
    setIsTyping,
    isGeneratingImage,
    setIsGeneratingImage,
    isThinking,
    setIsThinking,
    assistantTab,
    setAssistantTab,
    selectedModel,
    setSelectedModel,
    localModels,
    setLocalModels,
    focusMode,
    setFocusMode,
    isProSearch,
    setIsProSearch,
    proSearchStages,
    setProSearchStages,
    activePage,
    setActivePage,
    attachedFile,
    setAttachedFile,
    showFeedbackModal,
    setShowFeedbackModal,
    feedbackData,
    setFeedbackData,
    feedbackCategory,
    setFeedbackCategory,
    correctionText,
    setCorrectionText,
    customPixelWidth,
    setCustomPixelWidth,
    isDragActive,
    setIsDragActive,
    widthMode,
    setWidthMode,
    uploadedDocs,
    setUploadedDocs,
    showLibrary,
    setShowLibrary,
    viewingDoc,
    setViewingDoc,
    isVoiceCallActive,
    setIsVoiceCallActive,
    voiceCallStatus,
    setVoiceCallStatus,
    voiceCallText,
    setVoiceCallText,
    isListening,
    setIsListening,
    speakOutput,
    setSpeakOutput,
    playingMessageId,
    setPlayingMessageId,
    mode
  };
}
