/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, RefreshCw, Mic, Paperclip,
  Globe, Pencil, ExternalLink, ArrowRight,
  Eye, LayoutTemplate, Square, ArrowDown,
} from 'lucide-react';
import api from '../../services/api';
import { ImageLightbox } from './ImageLightbox';
import ChatArtifactsCanvas from '../chat/ChatArtifactsCanvas';
import { AiDostMark } from '../brand/AiDostMark';
import SmartChatHeader from '../chat/SmartChatHeader';
import ChatMessageBubble from '../chat/ChatMessageBubble';
import ThinkingDot from '../chat/ThinkingDot';
import { extractArtifact, stripInternalTags } from '../../utils/chatContent';
import { AssessmentRunner } from '../assessment/AssessmentRunner';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';
const getMsgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);

const IMAGE_CREATE_INTENT =
  /\b(create|generate|make|draw|design)\b.*\b(image|photo|picture|logo|wallpaper|cartoon|anime|illustration|poster|meme|sketch|painting|drawing|art)\b|\b(image|photo|picture|logo|wallpaper|cartoon|anime|illustration|poster|meme|sketch|painting|drawing|art)\b.*\b(banao|bana|banake|make|create|generate|draw|design)\b/i;

const PROJECT_INTENT =
  /\b(fullstack|project|app|website|web ?site|portfolio|mern|crud|clone|todo|blog|e-?commerce|chatbot|dashboard|landing page)\b.*\b(banao|bana|banake|make|create|build|generate)\b|\b(banao|bana|banake|make|create|build|generate)\b.*\b(project|app|website|web ?site|fullstack)\b/i;

const DOC_KEYWORDS = [
  { type: 'pdf', re: /pdf/i },
  { type: 'pptx', re: /ppt[a-z]*|powerpoint|presentation|slides?/i },
  { type: 'xlsx', re: /xlsx|excel\b/i },
  { type: 'csv', re: /csv|spreadsheet|sheet/i },
  { type: 'docx', re: /\bdocx?\b|\bdoct\b|word ?file|word ?document|document|report/i },
];

const NAV_INTENTS = [
  { re: /\b(projects?|meri projects?|my projects?)\b.*\b(kholo|dikhao|dikha|open|show|list)\b/i, view: 'projects', label: 'Projects' },
  { re: /\b(history|purani baatein|chat history|old chats?)\b.*\b(kholo|dikhao|dikha|open|show|load|dekh)\b/i, view: 'history', label: 'Chat History' },
  { re: /\b(copilot|ide|code editor|editor)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'copilot', label: 'Copilot IDE' },
  { re: /\b(agent mode|autonomous mode|agent)\b.*\b(kholo|dikhao|dikha|open|show|run|chal)\b/i, view: 'agent', label: 'Autonomous Agent' },
  { re: /\b(settings|setting)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'settings', label: 'Settings' },
  { re: /\b(image generator|images? view|gallery)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'images', label: 'Image Generator' },
  { re: /\b(voice assistant|voice view|voice)\b.*\b(kholo|open|start|use)\b/i, view: 'voice', label: 'Voice Assistant' },
];

const SEARCH_INTENT =
  /\b(research|deep research)\b|\b(search|google|pata karo|dhundho)\b.*\b(karo|kar|karke|do)\b|\b(latest|current|today'?s|aaj ki)\b.*\b(news|update|price|weather|score|status)\b|\b(news|weather|stock price|cricket score|football score|match result|trending)\b.*\b(batao|bata|dikhao|kya hai|do|kar)\b/i;

const MODEL_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'groq', label: 'Groq' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'nvidia', label: 'NVIDIA' },
  { id: 'together', label: 'Together' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'ollama', label: 'Ollama (Local)' },
];

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: 'Namaste! Main AI-Dost hoon. Aap kya karna chahte hain aaj?',
  timestamp: new Date().toISOString(),
};

// ─── ChatView ────────────────────────────────────────────────────────────────

export default function ChatView({
  model = 'auto',
  thinking: thinkingProp,
  setIsThinking: setIsThinkingProp,
  onOpenResumeWithData,
  onOpenVoice,
  onNewChatSignal,
  onNavigate,
  onModelChange,
}) {
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('ai_dost_session_id') || 'default';
      } catch (_) {}
    }
    return 'default';
  });

  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const sid = localStorage.getItem('ai_dost_session_id') || 'default';
        const saved = localStorage.getItem(getMsgKey(sid));
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return [WELCOME];
  });

  const [input, setInput] = useState('');
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [localThinking, setLocalThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Thinking…');
  const [backendHistory, setBackendHistory] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [persona, setPersona] = useState('auto');
  const [variants, setVariants] = useState(null);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const userSentMessageRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const inputRef = useRef(null);
  const newChatCount = useRef(0);
  const fileInputRef = useRef(null);

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('ai_dost_model') || model || 'auto';
      } catch (_) {}
    }
    return model || 'auto';
  });

  useEffect(() => {
    if (model && model !== selectedModel) {
      setSelectedModel(model);
    }
  }, [model, selectedModel]);

  const handleModelChange = (e) => {
    const nextModel = e.target.value;
    setSelectedModel(nextModel);
    try {
      localStorage.setItem('ai_dost_model', nextModel);
    } catch (_) {}
    if (typeof onModelChange === 'function') {
      onModelChange(nextModel);
    }
  };

  const thinking = thinkingProp !== undefined ? thinkingProp : localThinking;
  const setThinking = typeof setIsThinkingProp === 'function' ? setIsThinkingProp : setLocalThinking;

  // Thinking elapsed timer
  useEffect(() => {
    let interval = null;
    if (thinking) {
      setThinkingElapsed(0);
      interval = setInterval(() => setThinkingElapsed((prev) => prev + 1), 1000);
    } else {
      setThinkingElapsed(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [thinking]);

  // Load persisted chat metadata
  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSONA_KEY);
      if (p && p !== 'hinglish') setPersona(p);
      else setPersona('auto');
      const s = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
      if (Array.isArray(s) && s.length > 0) setSessions(s);
    } catch (_) {}
  }, []);

  // Load backend history on session change (and auto-restore if current messages are empty/welcome)
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/chat/history?session_id=${sessionId}`)
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.messages || res.data?.history || []);
        if (rows.length > 0) {
          setBackendHistory(rows);
          setMessages((current) => {
            const isEmptyOrWelcome = !current || current.length === 0 || (current.length === 1 && current[0].id === 'welcome');
            if (isEmptyOrWelcome) {
              const restored = [];
              for (const row of rows) {
                const userMsg = row.user_message || row.prompt || (row.role === 'user' ? row.content : null);
                const reply = row.response || (row.role === 'assistant' ? row.content : null);
                if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg, timestamp: row.timestamp || row.created_at });
                else if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply, timestamp: row.timestamp || row.created_at });
                else if (row.role && row.content) restored.push({ id: Date.now() + restored.length, role: row.role, content: row.content, timestamp: row.timestamp || row.created_at });
              }
              if (restored.length > 0) return restored;
            }
            return current;
          });
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const loadBackendHistory = () => {
    if (!backendHistory || backendHistory.length === 0) return;
    const restored = [];
    for (const row of backendHistory) {
      const userMsg = row.user_message || row.prompt || (row.role === 'user' ? row.content : null);
      const reply = row.response || (row.role === 'assistant' ? row.content : null);
      if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg, timestamp: row.timestamp || row.created_at });
      else if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply, timestamp: row.timestamp || row.created_at });
      else if (row.role && row.content) restored.push({ id: Date.now() + restored.length, role: row.role, content: row.content, timestamp: row.timestamp || row.created_at });
    }
    if (restored.length > 0) {
      setMessages(restored);
      setBackendHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: `History loaded (${restored.length} messages)` } }));
      }
    }
  };

  // Persist messages (never overwrite existing stored session if current is only [WELCOME])
  useEffect(() => {
    if (messages.length > 0) {
      const isOnlyWelcome = messages.length === 1 && messages[0].id === 'welcome';
      if (!isOnlyWelcome) {
        try { localStorage.setItem(getMsgKey(sessionId), JSON.stringify(messages)); } catch (_) {}
      }
    }
  }, [messages, sessionId]);

  // Save to backend
  useEffect(() => {
    if (messages.length > 1) {
      api.post('/chat/save', { session_id: sessionId, messages: messages.slice(-20) }).catch(() => {});
    }
  }, [messages, sessionId]);

  // New chat from sidebar signal
  useEffect(() => {
    if (newChatCount.current > 0) {
      setMessages([WELCOME]);
      setShowFollowUps(false);
      setActiveArtifact(null);
    }
  }, [onNewChatSignal]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior,
        });
      }
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom >= 120;
    setShowJumpToBottom(distFromBottom > 160);
  }, []);

  // Auto-scroll on new messages or variants: only if user sent message or user is reading near bottom (< 120px)
  useEffect(() => {
    const el = scrollRef.current;
    const distFromBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight : 0;
    if (userSentMessageRef.current || distFromBottom < 120) {
      userSentMessageRef.current = false;
      scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
    }
  }, [messages, variants, scrollToBottom]);

  // Artifact → Copilot IDE bridge
  const handleOpenArtifactInCopilot = (art) => {
    try {
      localStorage.setItem('ai_dost_copilot_import', JSON.stringify({
        title: art.title || 'chat-artifact',
        code: art.code || '',
        language: art.language || 'html',
        timestamp: Date.now(),
      }));
    } catch (_) {}
    if (onNavigate) onNavigate('copilot');
  };

  // ─── sendMessage ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || thinking) return;
    setInput('');
    setShowFollowUps(false);

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments: attachment ? [attachment.name] : undefined,
      imageAttachment: attachment?.type === 'image' ? attachment.base64 : undefined,
      imageMime: attachment?.type === 'image' ? (attachment.mime || 'image/png') : undefined,
    };
    userSentMessageRef.current = true;
    userScrolledUpRef.current = false;
    setMessages((prev) => [...prev, userMsg]);

    // Auto-title session if untitled or new
    setSessions((prev) => {
      const titleSnippet = content.length > 32 ? content.slice(0, 32) + '…' : content;
      const exists = prev.some((s) => s.id === sessionId);
      let updated;
      if (!exists) {
        updated = [{ id: sessionId, title: titleSnippet, name: titleSnippet, updatedAt: Date.now() }, ...prev];
      } else {
        updated = prev.map((s) => {
          if (s.id === sessionId && (!s.title || s.title === 'New conversation' || s.title === 'default' || !s.name)) {
            return { ...s, title: titleSnippet, name: titleSnippet, updatedAt: Date.now() };
          }
          return s;
        });
      }
      try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated.slice(0, 30)));
      } catch (_) {}
      return updated;
    });

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
      }, 0);
    }

    setThinking(true);
    setThinkingLabel('Thinking…');
    setTimeout(() => scrollToBottom('smooth'), 20);

    // ── File / image / PDF analysis ──
    if (attachment) {
      try {
        const payload = { message: content || 'Is file ka analysis do.' };
        if (attachment.type === 'image') { payload.imageBase64 = attachment.base64; payload.imageMime = attachment.mime; }
        else if (attachment.type === 'pdf') { payload.pdfBase64 = attachment.base64; }
        else if (attachment.type === 'text') { payload.text = attachment.text; }
        const res = await api.post('/chat/analyze', payload);
        const reply = res.data?.reply || 'File padh nahi paya — dobara try karo.';
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
        setLastReply(reply);
        const art = extractArtifact(reply);
        if (art) setActiveArtifact(art);
        setShowFollowUps(true);
        setAttachment(null);
        setThinking(false);
        return;
      } catch (_) { setAttachment(null); }
    }

    // ── Image generation ──
    if (IMAGE_CREATE_INTENT.test(content)) {
      setThinkingLabel('Generating image…');
      try {
        const r1 = await api.post('/image/generate', { prompt: content });
        const urls = [r1.data?.imageUrl].filter(Boolean);
        if (urls.length > 0) {
          const imageReply = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `Ho gayi image! 🎨\n\n![Image](${urls[0]})\n\n[⬇️ Download](${urls[0]})\n\nKuch aur change chahiye to batao.`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, imageReply]);
          setLastReply(imageReply.content);
          setShowFollowUps(true);
          setThinking(false);
          return;
        }
      } catch (_) { /* fall through */ }
    }

    // DOC_CREATE_INTENT: match file creation requests across Hindi/Hinglish/English
    const DOC_CREATE_INTENT = /\b(banao|bana\s*do|bana\s*de|chahiye|taiyar\s*karo|likhdo|draft|export|nikalo|bana\s*kar\s*do)\b|\b(create|generate|make|build|write|draft)\b.*?\b(pdf|docx?|pptx?|csv|xlsx|file|doc|report|document|presentation|slides?)\b/i;

    const specificDoc = DOC_CREATE_INTENT.test(content)
      ? DOC_KEYWORDS
          .filter((k) => k.type !== 'docx')
          .map((k) => ({ type: k.type, pos: content.search(k.re) }))
          .filter((m) => m.pos >= 0)
          .sort((a, b) => a.pos - b.pos)[0]
      : null;
    const docxKeyword = DOC_KEYWORDS.find((k) => k.type === 'docx');
    const docIntent = specificDoc || (DOC_CREATE_INTENT.test(content) && content.search(docxKeyword.re) >= 0 ? docxKeyword : null);

    if (docIntent) {
      setThinkingLabel('Creating document…');
      try {
        const rawTopic = content.replace(docIntent.re, '').trim() || content;
        const topic = rawTopic.replace(/^(?:write|create|generate|make|build|draft|please|kripya)\s+(?:a|an|the|ek)?\s*(?:report|document|presentation|slides?|doc|pdf|csv|sheet|xlsx)?\s*(?:on|about|ke liye|pe)?\s*/i, '').trim() || rawTopic;
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[docIntent.type] || docIntent.type;
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: `⏳ ${typeLabel} file ban rahi hai…`, timestamp: new Date().toISOString() }]);
        const r = await api.post('/document/generate', { type: docIntent.type, topic, title: topic.slice(0, 80) });
        if (r.data?.success && r.data.downloadUrl) {
          const readyMsg = {
            id: Date.now() + 2,
            role: 'assistant',
            content: `✅ **${typeLabel} ready!**\n\n📄 ${r.data.filename}\n\n[⬇️ Download](${r.data.downloadUrl})\n\nKoi aur badlaav chahiye to batao.`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, readyMsg]);
          setLastReply(readyMsg.content);
          setShowFollowUps(true);
        } else {
          setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: `⚠️ File nahi bani: ${r.data?.error || 'unknown error'}`, timestamp: new Date().toISOString() }]);
        }
        setThinking(false);
        return;
      } catch (e) {
        setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: `⚠️ File banane mein dikkat aayi — dobara try karo.`, timestamp: new Date().toISOString() }]);
        setThinking(false);
        return;
      }
    }

    // ── Resume (sirf tab generate karo jab user clearly CV/resume document BANANA chahta ho) ──
    const RESUME_DOC_CREATE =
      /\b(resume|cv|bio.?data)\b(?!\s*k?ar)[\s\S]{0,40}?\b(banao|bana\s*do|bana\s*de|chahiye|taiyar|likhdo|draft|create|generate\s+(?:my|mera|meri|ek)|make|write)\b|\b(banao|bana\s*do|bana\s*de|chahiye|taiyar\s*karo|likhdo|draft\s*karo|create|generate\s+(?:my|mera|meri|ek)|make\s+(?:my|me\s+a)|write)\b[\s\S]{0,60}?\b(resume|cv|bio.?data)\b/i;

    if (RESUME_DOC_CREATE.test(content)) {
      try {
        const data = await api.post('/resume/generate', { prompt: content });
        if (data.data && !data.data.error) {
          const resumeMsg = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `📄 **Resume ready!**\n\n**${data.data.fullName || 'Developer'}** — ${data.data.summary || ''}\n\nSide preview mein dikh raha hai.`,
            timestamp: new Date().toISOString(),
            navView: 'resume',
            navLabel: 'Open Resume Builder',
          };
          setMessages((prev) => [...prev, resumeMsg]);
          if (onOpenResumeWithData) onOpenResumeWithData(data.data);
          setThinking(false);
          return;
        }
      } catch (_) { /* fall through */ }
    }

    // ── Navigation intent ──
    const nav = NAV_INTENTS.find((n) => n.re.test(content));
    if (nav) {
      const navReply = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `${nav.label} mein le ja raha hoon…`,
        timestamp: new Date().toISOString(),
        navView: nav.view,
        navLabel: nav.label,
      };
      setMessages((prev) => [...prev, navReply]);
      setLastReply(navReply.content);
      if (onNavigate) onNavigate(nav.view);
      setThinking(false);
      return;
    }

    // ── Web search ──
    if (SEARCH_INTENT.test(content)) {
      setThinkingLabel('Searching…');
      try {
        const res = await api.post('/chat/search', { message: content });
        const reply = res.data?.reply || 'Search se kuch nahi mila.';
        const sources = res.data?.sources || [];
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply, sources, timestamp: new Date().toISOString() }]);
        setLastReply(reply);
        setShowFollowUps(true);
        setThinking(false);
        return;
      } catch (_) { /* fall through */ }
    }

    // ── SSE Streaming ──
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2500) }));

    const aiMsgId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true }]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, model: selectedModel === 'auto' ? 'auto' : selectedModel, section: 'chat', history, mode: 'chat', persona }),
      });

      if (!response.ok) throw new Error(`Streaming failed: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'language_lock') {
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, detectedResponseLanguage: parsed.detectedResponseLanguage, languageName: parsed.languageName } : m)
              );
            }
            if (parsed.type === 'web_search_start') {
              setThinking(true);
              setThinkingLabel(parsed.intent === 'URL_FETCH' ? 'Reading webpage…' : 'Searching the web…');
            }
            if (parsed.type === 'web_search_sources' && parsed.sources) {
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, sources: parsed.sources } : m)
              );
            }
            if (parsed.type === 'web_search_done') {
              setThinking(false);
            }
            if (parsed.type === 'assessment_creating') {
              setThinking(true);
              setThinkingLabel(parsed.status || 'Preparing assessment...');
            }
            if (parsed.type === 'assessment_created' && parsed.assessment) {
              setThinking(false);
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, assessment: parsed.assessment } : m)
              );
            }
            if (parsed.done && parsed.assessment) {
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, assessment: parsed.assessment } : m)
              );
            }
            if (parsed.done && parsed.sources && parsed.sources.length > 0) {
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, sources: parsed.sources } : m)
              );
            }
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, content: stripInternalTags(accumulated), isStreaming: true } : m)
              );
            }
          } catch (_) {}
        }
      }

      // Handle [GENERATE_IMAGE:] tag in response
      let finalReply = accumulated;
      const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
      const imageMatch = finalReply.match(imageTagRegex);
      if (imageMatch) {
        const imagePromptText = imageMatch[1].trim();
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        finalReply = finalReply.replace(imageTagRegex, '').trim();
        finalReply += `\n\n![Generated: ${imagePromptText}](${pollinationsUrl})`;
      }

      finalReply = stripInternalTags(finalReply);

      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId ? { ...m, content: finalReply || 'Kuch response nahi mila.', isStreaming: false } : m)
      );
      setLastReply(finalReply);

      // Auto-open artifact canvas if HTML detected
      const artifact = extractArtifact(finalReply);
      if (artifact) setActiveArtifact(artifact);

      // IDE bridge suggestion for project intent
      if (PROJECT_INTENT.test(content)) {
        const bridgeMsg = {
          id: Date.now() + 2,
          role: 'assistant',
          content: 'Isko workspace mein open karke full project bana sakte hain.',
          timestamp: new Date().toISOString(),
          navView: 'copilot',
          navLabel: 'Open in Workspace',
        };
        setMessages((prev) => [...prev, bridgeMsg]);
      }

      setShowFollowUps(true);
    } catch (err) {
      // REST fallback
      console.warn('Stream failed, falling back to REST:', err.message);
      try {
        const res = await api.post('/chat/', { message: content, model: selectedModel === 'auto' ? 'auto' : selectedModel, section: 'chat', history, mode: 'chat', persona });
        const reply0 = stripInternalTags(res.data?.reply || res.data?.message || 'Response nahi mila.');
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? {
            ...m,
            content: reply0,
            detectedResponseLanguage: res.data?.detectedResponseLanguage,
            languageName: res.data?.languageName,
            isStreaming: false
          } : m)
        );
        setLastReply(reply0);
        const artifact = extractArtifact(reply0);
        if (artifact) setActiveArtifact(artifact);
        setShowFollowUps(true);
      } catch (e2) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: 'Main abhi respond nahi kar paya. Please thoda wait karke dobara try karo.', isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setThinking(false);
      setThinkingLabel('Thinking…');
    }
  }, [input, thinking, messages, selectedModel, setThinking, onOpenResumeWithData, onNavigate, attachment, persona, scrollToBottom, sessionId]);

  const handleRegenerate = () => {
    if (thinking) return;
    const lastIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastIdx === -1) return;
    const lastUserContent = messages[lastIdx].content;
    setMessages((prev) => prev.slice(0, lastIdx + 1));
    setShowFollowUps(false);
    sendMessage(lastUserContent);
  };

  const handleEditMessage = (msg) => {
    const idx = messages.indexOf(msg);
    if (idx === -1) return;
    setMessages((prev) => prev.slice(0, idx));
    setInput(msg.content);
    setShowFollowUps(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  const persistSessions = (list) => {
    setSessions(list);
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
      }
    } catch (_) {}
  };

  const saveCurrentToStorage = useCallback(() => {
    try { if (messages.length > 0) localStorage.setItem(getMsgKey(sessionId), JSON.stringify(messages)); } catch (_) {}
  }, [messages, sessionId]);

  const createSession = () => {
    saveCurrentToStorage();
    const id = Date.now().toString(36);
    const list = [{ id, title: 'New conversation', updatedAt: Date.now() }, ...sessions];
    persistSessions(list.slice(0, 20));
    localStorage.setItem('ai_dost_session_id', id);
    setSessionId(id);
    setMessages([WELCOME]);
    setShowFollowUps(false);
    setBackendHistory(null);
    setActiveArtifact(null);
  };

  const switchSession = useCallback((id) => {
    if (!id) return;
    saveCurrentToStorage();
    try {
      localStorage.setItem('ai_dost_session_id', id);
    } catch (_) {}
    setSessionId(id);
    setShowFollowUps(false);
    setActiveArtifact(null);
    setBackendHistory(null);

    let loaded = false;
    try {
      const saved = localStorage.getItem(getMsgKey(id));
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0 && !(parsed.length === 1 && parsed[0].id === 'welcome')) {
        setMessages(parsed);
        loaded = true;
      }
    } catch (_) {}

    if (!loaded) {
      setMessages([WELCOME]);
    }
  }, [saveCurrentToStorage]);

  useEffect(() => {
    const handleCustomSwitch = (e) => {
      const targetId = e?.detail;
      if (targetId && typeof targetId === 'string') {
        switchSession(targetId);
      }
    };
    window.addEventListener('ai_dost_switch_session', handleCustomSwitch);
    return () => window.removeEventListener('ai_dost_switch_session', handleCustomSwitch);
  }, [switchSession]);

  const renameSession = (id) => {
    const title = window.prompt('Session ka naam:', sessions.find((s) => s.id === id)?.title || '');
    if (title && title.trim()) {
      persistSessions(sessions.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)));
    }
  };

  const deleteSession = (id) => {
    if (!window.confirm('Ye session delete karna hai?')) return;
    try { localStorage.removeItem(getMsgKey(id)); } catch (_) {}
    const list = sessions.filter((s) => s.id !== id);
    persistSessions(list);
    if (id === sessionId) {
      localStorage.setItem('ai_dost_session_id', 'default');
      setSessionId('default');
      setMessages([WELCOME]);
      setShowFollowUps(false);
      setActiveArtifact(null);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          setAttachment({ name: file.name, type: 'image', mime: file.type, base64: String(dataUrl).split(',')[1] });
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const buf = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        setAttachment({ name: file.name, type: 'pdf', base64: btoa(binary) });
      } else {
        const text = await file.text();
        setAttachment({ name: file.name, type: 'text', text: text.slice(0, 15000) });
      }
    } catch (_) {}
    e.target.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const mime = file.type || 'image/png';
            const base64 = String(dataUrl).split(',')[1];
            setAttachment({
              name: file.name && file.name !== 'image.png' ? file.name : `pasted-image-${Date.now().toString().slice(-4)}.png`,
              type: 'image',
              mime,
              base64,
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ai_dost_toast', {
                detail: { type: 'success', message: 'Image pasted from clipboard 📋' }
              }));
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
  };

  const loadVariants = async () => {
    const lastIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastIdx === -1) return;
    const q = messages[lastIdx].content;
    setThinking(true);
    try {
      const res = await api.post('/chat/', {
        message: `Sawal: "${q}"\nIs sawal ke 3 alag-alag answers do. Sirf "1. ..." "2. ..." "3. ..." format me.`,
        model: model === 'auto' ? 'auto' : model,
        section: 'chat',
        history: [],
        mode: 'chat',
        persona,
      });
      const raw = res.data?.reply || '';
      const items = raw
        .split(/\n\s*(?=\d+\.\s)/)
        .filter((s) => s.trim() && /^\d+\.\s/.test(s.trim()))
        .map((s) => s.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3);
      if (items.length >= 2) setVariants({ items, msgIndex: messages.length - 1 });
      else setVariants({ items: [], msgIndex: -1 });
    } catch (_) {
      setVariants({ items: [], msgIndex: -1 });
    } finally {
      setThinking(false);
    }
  };

  const applyVariant = (v) => {
    if (!variants || variants.msgIndex < 0) return;
    setMessages((prev) => prev.map((m, i) => (i === variants.msgIndex ? { ...m, content: v, sources: undefined } : m)));
    setVariants(null);
  };

  const setPersonaAndSave = (id) => {
    setPersona(id);
    try { localStorage.setItem(PERSONA_KEY, id); } catch (_) {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentSessionName = sessions.find((s) => s.id === sessionId)?.title || 'New conversation';
  const displayMessages = messages.filter((m) => m.id !== 'welcome');
  const isEmpty = displayMessages.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-row overflow-hidden bg-canvas-base">
      <div className="relative flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <SmartChatHeader
          sessionName={currentSessionName}
          sessions={sessions}
          sessionId={sessionId}
          onNewSession={createSession}
          onSwitchSession={switchSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-6 px-4 md:px-6 flex flex-col"
        >
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
            {isEmpty && !thinking && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[46vh] w-full max-w-2xl mx-auto px-4 text-center select-none">
                <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-canvas-surface border border-border shadow-xs mb-5 transition-transform hover:scale-105 duration-200">
                  <AiDostMark size={24} />
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-paper-100 tracking-tight mb-2.5">
                  Hey. What are we working on today?
                </h1>
                <p className="text-sm sm:text-base text-ink-muted max-w-md mx-auto leading-relaxed">
                  Ask me anything, or give me something to build, research, analyze, or create.
                </p>
              </div>
            )}

            <div className="space-y-6">
              {isEmpty && backendHistory && backendHistory.length > 0 && (
                <div className="flex justify-center mb-6">
                  <button
                    type="button"
                    onClick={loadBackendHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-canvas-surface border border-border text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-fast cursor-pointer"
                  >
                    🕐 Load previous conversation ({backendHistory.length} messages)
                  </button>
                </div>
              )}

              {displayMessages.map((msg, index) => (
                <ChatMessageBubble
                  key={msg.id || index}
                  msg={msg}
                  isLast={index === displayMessages.length - 1}
                  onRegenerate={handleRegenerate}
                  onOpenImage={(url) => setLightboxUrl(url)}
                  onVariants={loadVariants}
                  onNavigate={onNavigate}
                  onOpenArtifact={setActiveArtifact}
                  onEdit={handleEditMessage}
                  onStartAssessment={(asmt) => setActiveAssessment(asmt)}
                />
              ))}

              {variants && variants.items.length > 0 && !thinking && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <p className="text-xs text-ink-muted">3 alternative responses:</p>
                  <div className="space-y-1.5">
                    {variants.items.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => applyVariant(v)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-fast cursor-pointer hover:bg-canvas-elevated bg-canvas-surface border border-border text-paper-200"
                      >
                        <span className="font-semibold mr-1.5 text-accent">Option {i + 1}:</span>
                        {v.slice(0, 240)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {thinking && (
                  <ThinkingDot key="thinking" label={thinkingLabel} elapsed={thinkingElapsed} />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-16 shrink-0" aria-hidden="true" />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showJumpToBottom && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="jump-to-bottom-btn"
                aria-label="Jump to latest message"
              >
                <ArrowDown size={13} className="text-accent" />
                <span>Jump to latest</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 md:px-6 pb-4 pt-2 bg-canvas-base border-t border-border-subtle shrink-0">
          <div className="max-w-3xl mx-auto">
            {attachment && (
              <div className="flex items-center gap-2.5 mb-2 px-3 py-1.5 rounded-lg text-xs bg-canvas-surface border border-border">
                {attachment.type === 'image' && attachment.base64 ? (
                  <img
                    src={`data:${attachment.mime || 'image/png'};base64,${attachment.base64}`}
                    alt="Attachment"
                    className="w-7 h-7 rounded object-cover border border-border shrink-0"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-accent" />
                )}
                <span className="truncate flex-1 text-paper-100 font-medium">{attachment.name}</span>
                <span className="text-[10px] text-ink-muted uppercase font-mono px-1.5 py-0.5 rounded bg-canvas-elevated">
                  {attachment.type}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="p-1 rounded text-ink-muted hover:text-paper-100 cursor-pointer hover:bg-canvas-elevated transition-fast"
                  aria-label="Remove attachment"
                  title="Remove attachment"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="relative rounded-xl bg-canvas-surface border border-border focus-within:border-accent/40 focus-within:shadow-sm transition-fast">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                rows={Math.min(5, Math.max(1, input.split('\n').length))}
                placeholder="Ask AI-Dost anything, or paste an image (Ctrl+V)…"
                aria-label="Ask AI-Dost anything"
                className="w-full bg-transparent resize-none text-sm focus:outline-none placeholder:text-ink-muted text-paper-100 leading-relaxed px-4 pt-3.5 pb-2 font-sans"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.csv,.xlsx,.java,.c,.cpp,.go,.rs"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="flex items-center justify-between px-3 pb-2.5 pt-1 select-none">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title="Attach file"
                    aria-label="Attach file"
                    className="p-1.5 rounded-lg hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 transition-fast cursor-pointer focus-ring"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {onOpenVoice && (
                    <button
                      type="button"
                      onClick={onOpenVoice}
                      title="Voice input"
                      aria-label="Voice input"
                      className="p-1.5 rounded-lg hover:bg-canvas-elevated text-paper-200 hover:text-accent transition-fast cursor-pointer focus-ring"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={handleModelChange}
                    title="Select model"
                    aria-label="Select model"
                    className="px-2.5 py-1 rounded-lg text-[12px] font-medium bg-canvas-elevated border border-border text-paper-100 cursor-pointer focus:outline-none focus:border-accent transition-fast"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || thinking}
                    title="Send (Enter)"
                    aria-label="Send message"
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer focus-ring ${
                      input.trim() && !thinking
                        ? 'bg-accent text-black hover:bg-accent/90 shadow-sm active:scale-95'
                        : 'bg-canvas-elevated text-ink-muted opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {activeArtifact && (
          <ChatArtifactsCanvas
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
            onOpenInCopilot={handleOpenArtifactInCopilot}
          />
        )}
      </AnimatePresence>

      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {activeAssessment && (
        <AssessmentRunner
          assessment={activeAssessment}
          onClose={() => setActiveAssessment(null)}
          onComplete={(res) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ai_dost_toast', {
                detail: { type: 'success', message: `Assessment complete! Score: ${res.netScore}/${res.totalMarks} (${res.percentage}%)` }
              }));
            }
          }}
        />
      )}
    </div>
  );
}
