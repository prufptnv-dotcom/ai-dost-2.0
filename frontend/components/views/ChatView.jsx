import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Copy, Volume2, RefreshCw, ThumbsUp, ThumbsDown,
  Sparkles, FileText, Mic, Paperclip, Bot, User, Check,
  Lightbulb, Globe, Wand2, Eraser, History as HistoryIcon,
  Pencil, Download, Search, ExternalLink, FileDown
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '../../services/api';
import { ImageCard, ImageLightbox } from './ImageLightbox';

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';

const PERSONAS = [
  { id: 'hinglish', label: '💬 Hinglish' },
  { id: 'english', label: '🇬🇧 English' },
  { id: 'formal', label: '🎩 Formal' },
];

const QUICK_PROMPTS = [
  { icon: Sparkles, label: 'Website banao', prompt: 'Ek modern portfolio website bana do with HTML, CSS and JavaScript' },
  { icon: FileText, label: 'Resume banao', prompt: 'Mera resume bana do — full stack developer, 3 saal experience React aur Node.js me' },
  { icon: Globe, label: 'Explain', prompt: 'Explain how WebSockets work in simple Hinglish' },
  { icon: Wand2, label: 'Code fix', prompt: 'Python me ek function likho jo Fibonacci series generate kare' },
  { icon: Search, label: 'Research', prompt: 'Latest AI trends search karo aur sources ke saath batao' },
];

const IMAGE_CREATE_INTENT =
  /\b(create|generate|make|draw|design)\b.*\b(image|photo|picture|logo|wallpaper|cartoon|anime|illustration|poster|meme|sketch|painting|drawing|art)\b|\b(image|photo|picture|logo|wallpaper|cartoon|anime|illustration|poster|meme|sketch|painting|drawing|art)\b.*\b(banao|bana|banake|make|create|generate|draw|design)\b/i;

const PROJECT_INTENT =
  /\b(fullstack|project|app|website|web ?site|portfolio|mern|crud|clone|todo|blog|e-?commerce|chatbot|dashboard|landing page)\b.*\b(banao|bana|banake|make|create|build|generate)\b|\b(banao|bana|banake|make|create|build|generate)\b.*\b(project|app|website|web ?site|fullstack)\b/i;

// Document intents: Word / PowerPoint / Excel-CSV — MS Office ka kaam chat se
// Fuzzy patterns: "doct", "docc", "ppt" typos bhi match ho (doc[a-z]* prefix match)
const DOC_INTENTS = [
  { type: 'docx', re: /\b(doc[a-z]*|word ?file|word ?document|document|report)\b.*\b(banao|bana|banake|make|create|generate|likho|likh|research|report|chahiye)\b|\b(banao|bana|banake|make|create|generate|likho|likh|research|report|chahiye)\b.*\b(doc[a-z]*|word ?file|word ?document|document|report)\b/i },
  { type: 'pptx', re: /\b(ppt[a-z]*|powerpoint|presentation|slides?)\b.*\b(banao|bana|banake|make|create|generate)\b|\b(banao|bana|banake|make|create|generate)\b.*\b(ppt[a-z]*|powerpoint|presentation|slides?)\b/i },
  { type: 'csv', re: /\b(csv|excel|spreadsheet|sheet|table|list)\b.*\b(banao|bana|banake|make|create|generate|do|de|dijiye)\b|\b(banao|bana|banake|make|create|generate|do|de|dijiye)\b.*\b(csv|excel|spreadsheet|sheet|table|list)\b/i },
];

// Chat se koi bhi view directly kholo — universal interface
const NAV_INTENTS = [
  { re: /\b(projects?|meri projects?|my projects?)\b.*\b(kholo|dikhao|dikha|open|show|list)\b/i, view: 'projects' },
  { re: /\b(history|purani baatein|chat history|old chats?)\b.*\b(kholo|dikhao|dikha|open|show|load|dekh)\b/i, view: 'history' },
  { re: /\b(copilot|ide|code editor|editor)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'copilot' },
  { re: /\b(agent mode|autonomous mode|agent)\b.*\b(kholo|dikhao|dikha|open|show|run|chal)\b/i, view: 'agent' },
  { re: /\b(settings|setting)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'settings' },
  { re: /\b(image generator|images? view|gallery)\b.*\b(kholo|dikhao|dikha|open|show)\b/i, view: 'images' },
  { re: /\b(voice assistant|voice view|voice)\b.*\b(kholo|open|start|use)\b/i, view: 'voice' },
];

// Web search intent (Perplexity-style, sources ke saath)
const SEARCH_INTENT =
  /\b(research|deep research)\b|\b(search|google|pata karo|dhundho)\b.*\b(karo|kar|karke|do)\b|\b(latest|current|today'?s|aaj ki)\b.*\b(news|update|price|weather|score|status)\b|\b(news|weather|stock price|cricket score|football score|match result|trending)\b.*\b(batao|bata|dikhao|kya hai|do|kar)\b/i;

const MODEL_OPTIONS = [
  { id: 'auto', label: '⚡ Auto' },
  { id: 'gemini', label: '✨ Gemini' },
  { id: 'groq', label: '🚀 Groq' },
  { id: 'nvidia', label: '🔷 NVIDIA' },
  { id: 'together', label: '🧠 Together' },
  { id: 'deepseek', label: '🐋 DeepSeek' },
  { id: 'mistral', label: '🌬️ Mistral' },
  { id: 'ollama', label: '💻 Ollama' },
];

const FOLLOW_UPS = [
  'Isme aur kya add kar sakta hoon?',
  'Sample code with output dikhao',
  'Isse fullstack project me convert karo',
  'Deep dive karke explain karo',
];

const WELCOME = {
  role: 'assistant',
  content: `Namaste! 🙏 Main **AI-Dost** hoon — aapka personal AI developer assistant.

Main aapki madad kar sakta hoon:
- 💬 **Chat** — kuch bhi pucho, Hinglish/Hindi/English me jawab
- 📄 **Resume** — "resume bana do" bolo, side me live preview aa jayega
- 🤖 **Copilot** — fullstack project ek command me banao
- 🎤 **Voice** — Perplexity jaisa voice assistant

Kya karna hai aaj?`,
  timestamp: new Date().toISOString(),
};

const renderMarkdown = (text) => DOMPurify.sanitize(marked.parse((text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')));

const extractImages = (content) => {
  const images = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content || ''))) images.push({ alt: m[1], url: m[2] });
  return images;
};

function useTypewriter(fullText, isActive) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (!isActive) { setShown(fullText); return; }
    setShown('');
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setShown(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 12);
    return () => clearInterval(interval);
  }, [fullText, isActive]);
  return shown;
}

function MessageBubble({ msg, isTyping, onOpenImage, onRegenerate, onEdit, isLast, onVariants }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const rendered = useTypewriter(msg.content, isTyping);
  const images = isUser ? [] : extractImages(msg.content);
  const proseRef = useRef(null);

  // Add copy button to every code block
  useEffect(() => {
    const el = proseRef.current;
    if (!el || isTyping) return;
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.chat-code-copy')) return;
      pre.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'chat-code-copy';
      btn.textContent = '📋';
      btn.title = 'Copy code';
      btn.style.cssText =
        'position:absolute;top:6px;right:6px;z-index:2;width:26px;height:24px;border:none;border-radius:6px;cursor:pointer;font-size:11px;background:rgba(255,255,255,0.08);color:#e2e8f0;transition:background .15s;';
      btn.addEventListener('mouseenter', () => (btn.style.background = 'rgba(255,255,255,0.2)'));
      btn.addEventListener('mouseleave', () => (btn.style.background = 'rgba(255,255,255,0.08)'));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        const text = code ? code.innerText : pre.innerText;
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✓';
          setTimeout(() => (btn.textContent = '📋'), 1200);
        });
      });
      pre.appendChild(btn);
    });
  }, [msg.content, isTyping]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* noop */ }
  };

  const [speaking, setSpeaking] = useState(false);
  const [speakErr, setSpeakErr] = useState(false);

  const speak = async () => {
    const text = msg.content.replace(/[*#`>\[\]]/g, '').slice(0, 1500);
    if (!text.trim()) return;
    try {
      // Edge TTS via backend (free, natural Hindi/English voices)
      const audioUrl = `${api.defaults.baseURL}/agent/ai/tts`;
      const ttsRes = await fetch(audioUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'en-IN-PrabhatNeural' }),
      });
      if (ttsRes.ok && !speakErr) {
        setSpeaking(true);
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch (e) { /* fallback below */ }

    // Fallback: browser speechSynthesis
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      window.speechSynthesis.speak(utter);
    } catch (e) { /* noop */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser ? 'rgba(161,66,244,0.15)' : 'var(--gradient-primary)',
          border: isUser ? '1px solid rgba(161,66,244,0.3)' : 'none',
          boxShadow: isUser ? 'none' : '0 0 12px var(--color-primary-glow)',
        }}
      >
        {isUser ? <User className="w-4 h-4 text-[var(--color-secondary)]" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isUser ? 'items-end' : 'items-start'} reveal-subtle`}>
        <div
          className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
          style={{
            background: isUser ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.045)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
            color: isUser ? '#fff' : 'var(--color-text-primary)',
            borderTopRightRadius: isUser ? 4 : 16,
            borderTopLeftRadius: isUser ? 16 : 4,
            boxShadow: isUser ? '0 4px 16px var(--color-primary-glow)' : 'none',
          }}
        >
          {isTyping ? (
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-sm opacity-80">{rendered}</span>
              <span className="blink-cursor" />
            </div>
          ) : (
            <div
              ref={proseRef}
              className="prose-chat"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}

          {/* Attached files */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.attachments.map((n, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(161,66,244,0.12)', border: '1px solid rgba(161,66,244,0.3)', color: 'var(--color-secondary)' }}>
                  <Paperclip className="w-2.5 h-2.5" /> {n}
                </span>
              ))}
            </div>
          )}

          {/* Search sources (Perplexity-style) */}
          {!isTyping && msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
              {msg.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 max-w-[220px] truncate transition-colors cursor-pointer hover:bg-white/10"
                  style={{ background: 'rgba(75,139,252,0.1)', border: '1px solid rgba(75,139,252,0.3)', color: 'var(--color-primary)' }}
                  title={s.url}
                >
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" /> [{i + 1}] {s.title || s.url}
                </a>
              ))}
            </div>
          )}

          {/* Generated images */}
          {!isTyping && images.length > 0 && (
            <div className={`grid gap-2.5 mt-3 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ minWidth: 200 }}>
              {images.map((img, idx) => (
                <ImageCard key={idx} src={img.url} alt={img.alt} index={idx} onOpen={onOpenImage} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUser && !isTyping && (
          <div className="flex items-center gap-1 mt-1.5">
            {[
              { icon: Copy, fn: copyText, title: 'Copy' },
              { icon: Volume2, fn: speak, title: 'Read aloud' },
              { icon: ThumbsUp, fn: () => api.post('/learning/feedback', { type: 'positive', message: 'thumbs up' }).catch(() => {}), title: 'Good' },
              { icon: ThumbsDown, fn: () => api.post('/learning/feedback', { type: 'negative', message: 'thumbs down' }).catch(() => {}), title: 'Needs work' },
              ...(isLast ? [
                { icon: RefreshCw, fn: () => onRegenerate && onRegenerate(), title: 'Regenerate' },
                { icon: Sparkles, fn: () => onVariants && onVariants(), title: 'Variants' },
              ] : []),
            ].map(({ icon: Icon, fn, title }, i) => (
              <button
                key={i}
                onClick={fn}
                title={title}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {title === 'Copy' && copied ? <Check className="w-3 h-3 text-[var(--color-success)]" /> : <Icon className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
        {isUser && !isTyping && (
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={() => onEdit && onEdit(msg)}
              title="Edit message"
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DeepAnalyzing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-4 py-3"
    >
      <div className="deep-analyzing-orb">
        <div className="orb-core" />
        <div className="orb-ring" />
        <div className="orb-ring" />
        <div className="orb-ring" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">Deep analysing...</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          AI-Dost is thinking across models
        </p>
      </div>
    </motion.div>
  );
}

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingIndex, setTypingIndex] = useState(null);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [localThinking, setLocalThinking] = useState(false);
  const [backendHistory, setBackendHistory] = useState(null);
  const [suggestView, setSuggestView] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [persona, setPersona] = useState('hinglish');
  const [variants, setVariants] = useState(null);
  const [sessionId, setSessionId] = useState('default');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const newChatCount = useRef(0);
  const fileInputRef = useRef(null);

  const msgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);

  const thinking = thinkingProp !== undefined ? thinkingProp : localThinking;
  const setThinking = typeof setIsThinkingProp === 'function' ? setIsThinkingProp : setLocalThinking;

  // Load persisted chat
  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSONA_KEY);
      if (p) setPersona(p);
      const s = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
      if (Array.isArray(s) && s.length > 0) setSessions(s);
      const sid = localStorage.getItem('ai_dost_session_id');
      if (sid) setSessionId(sid);
    } catch (e) { /* noop */ }

    try {
      const saved = localStorage.getItem(msgKey(sessionId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) { /* noop */ }
    setMessages([WELCOME]);
    // Fetch backend history as fallback (offer to restore)
    api.get('/chat/history', { params: { session_id: sessionId, limit: 50 } })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.history || []);
        if (rows.length > 0) setBackendHistory(rows);
      })
      .catch(() => { /* backend off */ });
  }, [sessionId]);

  const loadBackendHistory = () => {
    if (!backendHistory || backendHistory.length === 0) return;
    const restored = [];
    for (const row of backendHistory) {
      const userMsg = row.user_message || row.prompt;
      const reply = row.response;
      if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg });
      if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply.slice(0, 2000) });
    }
    if (restored.length > 0) {
      setMessages(restored);
      setBackendHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: `Purani baatein load hui (${restored.length} messages)` } }));
      }
    }
  };

  // Persist
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(msgKey(sessionId), JSON.stringify(messages));
      } catch (e) { /* noop */ }
    }
  }, [messages, sessionId]);

  // Save to backend history (fire and forget)
  useEffect(() => {
    if (messages.length > 1) {
      api.post('/chat/save', { session_id: sessionId, messages: messages.slice(-20) }).catch(() => {});
    }
  }, [messages, sessionId]);

  // New chat signal from sidebar
  useEffect(() => {
    if (newChatCount.current > 0) {
      setMessages([WELCOME]);
      setShowFollowUps(false);
    }
  }, [onNewChatSignal]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, typingIndex, thinking]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || thinking) return;
    setInput('');
    setShowFollowUps(false);

    const userMsg = { role: 'user', content, timestamp: new Date().toISOString(), attachments: attachment ? [attachment.name] : undefined };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);
    setSuggestView(null);

    // ── File/image/PDF analysis ──
    if (attachment) {
      try {
        const payload = { message: content || 'Is file ka analysis do — Hinglish me, important points ke saath.' };
        if (attachment.type === 'image') { payload.imageBase64 = attachment.base64; payload.imageMime = attachment.mime; }
        else if (attachment.type === 'pdf') { payload.pdfBase64 = attachment.base64; }
        else if (attachment.type === 'text') { payload.text = attachment.text; }
        const res = await api.post('/chat/analyze', payload);
        const reply = res.data?.reply || 'File padh nahi paya — dobara try karo.';
        const aiMsg = { role: 'assistant', content: reply, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
        setTypingIndex(messages.length + 1);
        setLastReply(reply);
        setTimeout(() => {
          setTypingIndex(null);
          setShowFollowUps(true);
        }, Math.min(1500, 200 + reply.length * 2));
        setAttachment(null);
        setThinking(false);
        return;
      } catch (e) {
        setAttachment(null);
        /* fall through to normal chat */
      }
    }

    // ── Image generation intent ──
    if (IMAGE_CREATE_INTENT.test(content)) {
      try {
        const r1 = await api.post('/image/generate', { prompt: content });
        const urls = [r1.data?.imageUrl].filter(Boolean);
        if (urls.length > 0) {
          const imageReply = {
            role: 'assistant',
            content: `Haan bhai, ho gaya! 🎨 Maine aapki image banayi (HD quality):\n\n![Image 1](${urls[0]})\n\n[⬇️ Download Image](${urls[0]}) • [🔗 Full screen me kholo](${urls[0]})\n\nKuch aur change chahiye to batao — style, colors, size — sab kar dunga! ✨`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, imageReply]);
          setTypingIndex(messages.length + 1);
          setLastReply(imageReply.content);
          setTimeout(() => {
            setTypingIndex(null);
            setShowFollowUps(true);
          }, Math.min(1500, 200 + imageReply.content.length));
          setThinking(false);
          return;
        }
      } catch (e) {
        /* image API fail → fall through to normal chat */
      }
    }

    // ── Document intent: docx / pptx / csv — MS Office ka kaam chat se ──
    const docIntent = DOC_INTENTS.find((d) => d.re.test(content));
    if (docIntent) {
      try {
        const topic = content.replace(docIntent.re, '').replace(/^(bihar|india|15 august|independence day|raksha|shaheed|shahid|martyr)[\s,:-]*/i, '').trim() || content;
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'Excel/CSV' }[docIntent.type];
        const toast = { role: 'assistant', content: `⏳ **${typeLabel} file ban rahi hai...** Research + file generation me 30-90s lag sakte hain.`, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, toast]);
        setTypingIndex(messages.length + 1);
        const r = await api.post('/document/generate', { type: docIntent.type, topic, title: content.slice(0, 50) });
        if (r.data?.success && r.data.downloadUrl) {
          const readyMsg = {
            role: 'assistant',
            content: `✅ **${typeLabel} file ready!**\n\n📄 **${r.data.filename}**\n\n[⬇️ Download karo](${r.data.downloadUrl}) • [🔗 Naye tab me kholo](${r.data.downloadUrl})\n\nAur kuch chahiye to batao — title, content, sections — sab change kar dunga! ✨`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, readyMsg]);
          setTypingIndex(messages.length + 1);
          setLastReply(readyMsg.content);
          setTimeout(() => {
            setTypingIndex(null);
            setShowFollowUps(true);
          }, Math.min(1500, 200 + readyMsg.content.length * 2));
        } else {
          setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ File ban nahi payi: ${r.data?.error || 'unknown error'}`, timestamp: new Date().toISOString() }]);
          setTypingIndex(null);
        }
        setThinking(false);
        return;
      } catch (e) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ File banane me problem aayi: ${e?.message || 'backend down?'} — dobara try karo ya thodi der baad.`, timestamp: new Date().toISOString() }]);
        setTypingIndex(null);
        setThinking(false);
        return;
      }
    }

    // ── Resume intent detection ──
    if (/(resume|cv|bio.?data|resume bana|cv bana)/i.test(content)) {
      try {
        const data = await api.post('/resume/generate', { prompt: content });
        if (data.data && !data.data.error) {
          const resumeMsg = {
            role: 'assistant',
            content: `📄 **Resume ready!** Maine aapki details se ek professional resume bana diya hai.\n\n**${data.data.fullName || 'Your Name'}** — ${data.data.summary || ''}\n\nSide preview me live dikh raha hai. Template change kar sakte ho aur PDF download kar sakte ho.`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, resumeMsg]);
          setTypingIndex(messages.length + 1);
          setTimeout(() => {
            setTypingIndex(null);
            onOpenResumeWithData(data.data);
          }, 400);
          setThinking(false);
          return;
        }
      } catch (e) { /* fall through to normal chat */ }
    }

    // ── Navigation intent: chat se hi koi bhi view kholo ──
    const nav = NAV_INTENTS.find((n) => n.re.test(content));
    if (nav) {
      const navReply = {
        role: 'assistant',
        content: `Le chal raha hoon **${nav.view}** view me... 👉`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, navReply]);
      setTypingIndex(messages.length + 1);
      setLastReply(navReply.content);
      setTimeout(() => {
        setTypingIndex(null);
        setShowFollowUps(true);
        if (onNavigate) onNavigate(nav.view);
      }, 600);
      setThinking(false);
      return;
    }

    // ── Web search intent: research karo → sources ke saath jawab ──
    if (SEARCH_INTENT.test(content)) {
      try {
        const res = await api.post('/chat/search', { message: content });
        const reply = res.data?.reply || 'Search se kuch nahi mila — thoda specific banao.';
        const sources = res.data?.sources || [];
        const searchMsg = {
          role: 'assistant',
          content: reply,
          sources,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, searchMsg]);
        setTypingIndex(messages.length + 1);
        setLastReply(reply);
        setTimeout(() => {
          setTypingIndex(null);
          setShowFollowUps(true);
        }, Math.min(1500, 200 + reply.length * 2));
        setThinking(false);
        return;
      } catch (e) {
        /* search fail → normal chat fallback */
      }
    }

    // ── Normal chat ──
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

    try {
      const res = await api.post('/chat/', {
        message: content,
        model: model === 'auto' ? 'auto' : model,
        section: 'chat',
        history,
        mode: 'chat',
        persona,
      });
      const reply = res.data?.reply || res.data?.message || 'Sorry, response nahi mil paya. Dobara try karo.';

      // ── AI ne [GENERATE_IMAGE: prompt] tag diya → Pollinations se image banao ──
      const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
      const imageMatch = reply.match(imageTagRegex);
      if (imageMatch) {
        const imagePromptText = imageMatch[1].trim();
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        reply = reply.replace(imageTagRegex, '🎨 Image ban gayi — neeche dekho:').trim();
        reply += `\n\n![Generated: ${imagePromptText}](${pollinationsUrl})`;
      }

      const aiMsg = { role: 'assistant', content: reply, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      setTypingIndex(messages.length + 1);
      setLastReply(reply);
      if (PROJECT_INTENT.test(content)) setSuggestView('project');
      setTimeout(() => {
        setTypingIndex(null);
        setShowFollowUps(true);
      }, Math.min(1500, 200 + reply.length * 2));
    } catch (e) {
      const errMsg = {
        role: 'assistant',
        content: `⚠️ **Error:** ${e?.message || 'Network error'}\n\nBackend chal raha hai check karo (localhost:5000) aur dobara try karo.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setThinking(false);
    }
  }, [input, thinking, messages, model, setThinking, onOpenResumeWithData, onNavigate, attachment, persona]);

  const handleRegenerate = () => {
    if (thinking) return;
    const lastIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastIdx === -1) return;
    const lastUserContent = messages[lastIdx].content;
    setMessages((prev) => prev.slice(0, lastIdx + 1));
    setShowFollowUps(false);
    setSuggestView(null);
    sendMessage(lastUserContent);
  };

  const handleEditMessage = (msg) => {
    const idx = messages.indexOf(msg);
    if (idx === -1) return;
    setMessages((prev) => prev.slice(0, idx));
    setInput(msg.content);
    setShowFollowUps(false);
    setSuggestView(null);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  const exportMarkdown = () => {
    const md = messages
      .map((m) => `${m.role === 'user' ? '**You:**' : '**AI-Dost:**'}\n\n${m.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([`# AI-Dost Chat Export\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-dost-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    try {
      const md = messages
        .map((m) => `${m.role === 'user' ? 'You:' : 'AI-Dost:'}\n${m.content}`)
        .join('\n\n');
      const res = await api.post('/pdf/generate', { title: 'AI-Dost Chat', content: md });
      const filename = res.data?.filename;
      if (filename) {
        const host = process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || 'http://localhost:5000';
        window.open(`${host}/api/pdf/download/${encodeURIComponent(filename)}`, '_blank');
      } else {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'error', message: 'PDF bana nahi paya — dobara try karo.' } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'error', message: `PDF export failed: ${e?.message || 'error'}` } }));
    }
  };

  const handleModelChange = (e) => {
    const val = e.target.value;
    if (onModelChange) onModelChange(val);
    try { localStorage.setItem('ai_dost_model', val); } catch (err) { /* noop */ }
  };

  const persistSessions = (list) => {
    setSessions(list);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
  };

  const saveCurrentToStorage = () => {
    try {
      if (messages.length > 0) localStorage.setItem(msgKey(sessionId), JSON.stringify(messages));
    } catch (e) { /* noop */ }
  };

  const createSession = () => {
    saveCurrentToStorage();
    const id = Date.now().toString(36);
    const list = [{ id, title: 'Nayi baat', updatedAt: Date.now() }, ...sessions];
    persistSessions(list.slice(0, 20));
    localStorage.setItem('ai_dost_session_id', id);
    setSessionId(id);
    setMessages([WELCOME]);
    setShowFollowUps(false);
    setBackendHistory(null);
  };

  const switchSession = (id) => {
    saveCurrentToStorage();
    localStorage.setItem('ai_dost_session_id', id);
    setSessionId(id);
    setMessages([]);
    setShowFollowUps(false);
    setSuggestView(null);
    setSessionsOpen(false);
    const saved = localStorage.getItem(msgKey(id));
    try {
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      else setMessages([WELCOME]);
    } catch (e) { setMessages([WELCOME]); }
  };

  const renameSession = (id) => {
    const title = window.prompt('Session ka naya naam:', sessions.find((s) => s.id === id)?.title || '');
    if (title && title.trim()) {
      persistSessions(sessions.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)));
    }
  };

  const deleteSession = (id) => {
    if (!window.confirm('Ye session delete karna hai?')) return;
    try { localStorage.removeItem(msgKey(id)); } catch (e) { /* noop */ }
    const list = sessions.filter((s) => s.id !== id);
    persistSessions(list);
    if (id === sessionId) {
      localStorage.setItem('ai_dost_session_id', 'default');
      setSessionId('default');
      setMessages([]);
      setShowFollowUps(false);
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
    } catch (err) { /* noop */ }
    e.target.value = '';
  };

  const setPersonaAndSave = (id) => {
    setPersona(id);
    try { localStorage.setItem(PERSONA_KEY, id); } catch (e) { /* noop */ }
  };

  const loadVariants = async () => {
    const lastIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastIdx === -1) return;
    const q = messages[lastIdx].content;
    setThinking(true);
    try {
      const res = await api.post('/chat/', {
        message: `Sawal: "${q}"\nIs sawal ke 3 alag-alag chhote answers do. Sirf "1. ..." "2. ..." "3. ..." format me, bilkul koi extra text nahi.`,
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
    } catch (e) {
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Session bar */}
      <div className="shrink-0 px-4 md:px-8 pt-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setSessionsOpen(!sessionsOpen)}
              title="Sessions"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              💬 {sessions.find((s) => s.id === sessionId)?.title || 'Default chat'}
              <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>▾</span>
            </button>
            {sessionsOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-60 rounded-xl overflow-hidden z-40 shadow-2xl"
                style={{ background: '#0d1117', border: '1px solid var(--color-border)' }}
              >
                <div className="max-h-56 overflow-y-auto">
                  {[{ id: 'default', title: 'Default chat' }, ...sessions].map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-1 px-3 py-2 cursor-pointer hover:bg-white/5"
                      style={{ background: s.id === sessionId ? 'rgba(75,139,252,0.12)' : 'transparent' }}
                    >
                      <span
                        className="flex-1 truncate text-xs"
                        style={{ color: s.id === sessionId ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
                        onClick={() => switchSession(s.id)}
                      >
                        {s.title}
                      </span>
                      {s.id !== 'default' && (
                        <>
                          <button onClick={() => renameSession(s.id)} title="Rename" className="w-6 h-6 rounded-md hover:bg-white/10 cursor-pointer text-[10px]" style={{ color: 'var(--color-text-muted)' }}>✏️</button>
                          <button onClick={() => deleteSession(s.id)} title="Delete" className="w-6 h-6 rounded-md hover:bg-white/10 cursor-pointer text-[10px]" style={{ color: 'var(--color-text-muted)' }}>🗑️</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={createSession}
            title="Nayi chat"
            className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer hover:bg-white/10"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            +
          </button>
          <div className="ml-auto flex items-center gap-1">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersonaAndSave(p.id)}
                className="px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer"
                style={{
                  background: persona === p.id ? 'rgba(161,66,244,0.15)' : 'transparent',
                  border: '1px solid ' + (persona === p.id ? 'rgba(161,66,244,0.4)' : 'var(--color-border)'),
                  color: persona === p.id ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-6"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              isTyping={typingIndex === i}
              onOpenImage={setLightboxUrl}
              onRegenerate={handleRegenerate}
              onEdit={handleEditMessage}
              isLast={i === messages.length - 1}
              onVariants={loadVariants}
            />
          ))}

          {/* Variants panel */}
          {variants && variants.items.length > 0 && !thinking && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                ✨ 3 variants — kisi pe click karo
              </p>
              <div className="space-y-2">
                {variants.items.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => applyVariant(v)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    <span className="font-bold mr-1.5" style={{ color: 'var(--color-secondary)' }}>V{i + 1}:</span>
                    {v.slice(0, 200)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {thinking && <DeepAnalyzing key="thinking" />}
          </AnimatePresence>

          {/* Follow-up suggestions */}
          <AnimatePresence>
            {showFollowUps && lastReply && !thinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pt-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Follow-up questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {FOLLOW_UPS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer hover:scale-[1.03]"
                      style={{
                        background: 'rgba(75,139,252,0.08)',
                        border: '1px solid rgba(75,139,252,0.25)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action suggestions (project → Copilot/Agent) */}
          <AnimatePresence>
            {suggestView === 'project' && !thinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pt-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Chaho to poora project banwalo
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onNavigate && onNavigate('copilot')}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer hover:scale-[1.03]"
                    style={{ background: 'rgba(75,139,252,0.12)', border: '1px solid rgba(75,139,252,0.35)', color: 'var(--color-primary)' }}
                  >
                    ⚡ Copilot IDE me banao (files + run)
                  </button>
                  <button
                    onClick={() => onNavigate && onNavigate('agent')}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer hover:scale-[1.03]"
                    style={{ background: 'rgba(161,66,244,0.12)', border: '1px solid rgba(161,66,244,0.35)', color: 'var(--color-secondary)' }}
                  >
                    🤖 Agent se banao (autonomous)
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Quick prompts (only when few messages) */}
      {messages.length <= 2 && !thinking && (
        <div className="px-4 md:px-8 pb-2">
          <div className="max-w-3xl mx-auto">
            {backendHistory && backendHistory.length > 0 && (
              <button
                onClick={loadBackendHistory}
                className="mb-2 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:scale-[1.02]"
                style={{ background: 'rgba(161,66,244,0.1)', border: '1px solid rgba(161,66,244,0.3)', color: 'var(--color-secondary)' }}
              >
                <HistoryIcon className="w-3.5 h-3.5" /> Purani baatein load karo ({backendHistory.length} saved)
              </button>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => sendMessage(prompt)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer hover:scale-[1.02]"
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Icon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span className="truncate">{label}</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 md:px-8 pb-5 pt-2">
        <div className="max-w-3xl mx-auto">
          {attachment && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(161,66,244,0.08)', border: '1px solid rgba(161,66,244,0.3)' }}>
              <Paperclip className="w-3.5 h-3.5" style={{ color: 'var(--color-secondary)' }} />
              <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>{attachment.name}</span>
              <button
                onClick={() => setAttachment(null)}
                className="ml-auto px-2 py-0.5 rounded-lg text-[10px] cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ✕ hatao
              </button>
            </div>
          )}
          <div
            className="flex items-end gap-2 px-3 py-2.5 rounded-2xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.045)',
              border: '1px solid var(--color-border)',
              boxShadow: thinking ? '0 0 0 1px rgba(75,139,252,0.3)' : 'none',
            }}
          >
            <select
              value={model}
              onChange={handleModelChange}
              title="Model select karo"
              className="shrink-0 mb-0.5 px-1.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} style={{ color: '#0b0d12', background: '#fff' }}>
                  {m.label}
                </option>
              ))}
            </select>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={Math.min(4, Math.max(1, input.split('\n').length))}
              placeholder="AI-Dost se kuch bhi pucho... (Enter = send)"
              className="flex-1 bg-transparent resize-none text-sm focus:outline-none placeholder:text-[var(--color-text-muted)]"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.csv,.java,.c,.cpp,.go,.rs"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              title="File attach (image / PDF / text)"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenVoice}
              title="Voice input"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10"
              style={{ color: 'var(--color-secondary)' }}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || thinking}
              title="Send (Enter)"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 0 14px var(--color-primary-glow)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              AI-Dost galtiyan kar sakta hai — important cheezein verify karo
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={exportMarkdown}
                title="Export as Markdown"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                <FileDown className="w-3 h-3" /> .md
              </button>
              <button
                onClick={exportPdf}
                title="Export as PDF"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}