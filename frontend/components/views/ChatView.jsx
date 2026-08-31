import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Copy, Volume2, RefreshCw, ThumbsUp, ThumbsDown,
  Sparkles, FileText, Mic, Paperclip, Check,
  Globe, Pencil, ExternalLink, ArrowRight,
  Eye, LayoutTemplate,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '../../services/api';
import { ImageCard, ImageLightbox } from './ImageLightbox';
import ChatArtifactsCanvas from '../chat/ChatArtifactsCanvas';
import { AiDostMark } from '../brand/AiDostMark';
import SmartChatHeader from '../chat/SmartChatHeader';
import CodeBlock from '../chat/CodeBlock';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';

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

const renderMarkdown = (text) =>
  DOMPurify.sanitize(marked.parse((text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')));

const extractImages = (content) => {
  const images = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content || ''))) images.push({ alt: m[1], url: m[2] });
  return images;
};

function extractArtifact(content) {
  if (!content) return null;
  const htmlMatch = content.match(/```(?:html|xml|svg)\s*\n([\s\S]*?)```/i);
  if (htmlMatch) {
    const code = htmlMatch[1].trim();
    if (code.includes('<') && code.includes('>')) {
      return {
        title: code.includes('<svg') ? 'SVG Vector Graphic' : 'Interactive UI Artifact',
        code,
        language: code.includes('<svg') ? 'svg' : 'html',
      };
    }
  }
  return null;
}



function ParsedMarkdown({ content, isStreaming, onNavigate }) {
  if (!content) return null;
  const parts = content.split(/(```[\s\S]*?(?:```|$))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const inner = part.slice(3);
          const isClosed = inner.endsWith('```');
          const textContent = isClosed ? inner.slice(0, -3) : inner;
          const newlineIdx = textContent.indexOf('\n');
          let langLine = 'text';
          let code = textContent;
          if (newlineIdx !== -1) {
            langLine = textContent.slice(0, newlineIdx).trim();
            code = textContent.slice(newlineIdx + 1);
          } else {
            langLine = textContent.trim();
            code = '';
          }
          return (
            <CodeBlock
              key={i}
              code={code}
              language={langLine || 'text'}
              canRun={/^(python|py|javascript|js|node)$/i.test(langLine)}
              canPreview={/^(html|react|jsx|tsx)$/i.test(langLine)}
              onOpenIDE={() => {
                if (onNavigate) {
                  try {
                    localStorage.setItem('ai_dost_copilot_import', JSON.stringify({
                      title: 'chat-code',
                      code: code,
                      language: langLine,
                      timestamp: Date.now()
                    }));
                  } catch (_) {}
                  onNavigate('copilot');
                }
              }}
            />
          );
        }
        if (part) {
          return <div key={i} className="prose-chat" dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }} />;
        }
        return null;
      })}
    </>
  );
}

function MessageBubble({
  msg,
  onOpenImage,
  onRegenerate,
  onEdit,
  isLast,
  onVariants,
  onNavigate,
  onOpenArtifact,
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const isUser = msg.role === 'user';
  const isStreaming = !!msg.isStreaming;
  const images = isUser ? [] : extractImages(msg.content);
  const detectedArtifact = !isUser && !isStreaming ? extractArtifact(msg.content) : null;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* noop */ }
  };

  const speak = async () => {
    const text = msg.content.replace(/[*#`>\[\]]/g, '').slice(0, 1500);
    if (!text.trim()) return;
    try {
      const ttsRes = await fetch(`${api.defaults.baseURL}/agent/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'en-IN-PrabhatNeural' }),
      });
      if (ttsRes.ok) {
        setSpeaking(true);
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch (_) { /* fallback */ }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      window.speechSynthesis.speak(utter);
    } catch (_) { /* noop */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-5 h-5 shrink-0 mt-0.5 opacity-70 select-none">
          <AiDostMark size={18} />
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col min-w-0 ${isUser ? 'items-end max-w-[80%] ml-auto' : 'items-start w-full max-w-2xl'}`}>
        <div
          className={`${
            isUser
              ? 'chat-user-message'
              : 'text-sm leading-relaxed text-paper-100 w-full'
          }`}
        >
          {/* Streaming cursor */}
          {isStreaming && msg.content.length === 0 ? (
            <span className="inline-block w-2 h-4 bg-accent animate-pulse align-middle rounded-sm" />
          ) : (
            <>
              {isUser ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <ParsedMarkdown content={msg.content} isStreaming={isStreaming} onNavigate={onNavigate} />
              )}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse align-middle rounded-sm" />
              )}
            </>
          )}

          {/* Artifact canvas trigger */}
          {detectedArtifact && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center gap-2.5 w-fit">
              <LayoutTemplate className="w-4 h-4 text-accent shrink-0" />
              <span className="text-xs text-ink-muted flex-1">Interactive canvas ready</span>
              <button
                onClick={() => onOpenArtifact && onOpenArtifact(detectedArtifact)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-subtle border border-accent-border text-paper-200 hover:bg-canvas-elevated transition-fast cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                Open canvas
              </button>
            </div>
          )}

          {/* Navigation chip */}
          {msg.navView && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle w-fit">
              <button
                onClick={() => onNavigate && onNavigate(msg.navView)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas-elevated border border-border text-paper-200 hover:bg-canvas-overlay transition-fast cursor-pointer"
              >
                {msg.navLabel || msg.navView}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.attachments.map((n, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-canvas-elevated border border-border text-ink-muted">
                  <Paperclip className="w-2.5 h-2.5" /> {n}
                </span>
              ))}
            </div>
          )}

          {/* Search sources */}
          {!isStreaming && msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-border-subtle">
              {msg.sources.map((s, i) => {
                let domain = '';
                try { domain = new URL(s.url).hostname; } catch (_) {}
                return (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-[220px] truncate bg-canvas-elevated border border-border text-ink-muted hover:text-paper-100 transition-fast shadow-xs"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">[{i + 1}] {s.title || domain}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Generated images */}
          {!isStreaming && images.length > 0 && (
            <div className={`grid gap-2 mt-3 w-fit ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ minWidth: 200 }}>
              {images.map((img, idx) => (
                <ImageCard key={idx} src={img.url} alt={img.alt} index={idx} onOpen={onOpenImage} />
              ))}
            </div>
          )}
        </div>

        {/* Action toolbar — AI messages only */}
        {!isUser && !isStreaming && (
          <div className="chat-response-actions">
            <button type="button" onClick={copyText} aria-label="Copy response" title="Copy">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button type="button" onClick={speak} aria-label="Read response aloud" title={speaking ? 'Stop reading' : 'Read aloud'}>
              <Volume2 size={14} />
            </button>
            {isLast && onRegenerate && (
              <button type="button" onClick={onRegenerate} aria-label="Try again" title="Try again">
                <RefreshCw size={14} />
              </button>
            )}
            <button type="button" onClick={() => api.post('/learning/feedback', { type: 'positive', message: msg.content }).catch(() => {})} aria-label="Good response" title="Good response">
              <ThumbsUp size={14} />
            </button>
            <button type="button" onClick={() => api.post('/learning/feedback', { type: 'negative', message: msg.content }).catch(() => {})} aria-label="Bad response" title="Bad response">
              <ThumbsDown size={14} />
            </button>
          </div>
        )}

        {/* Edit button — user messages */}
        {isUser && !isStreaming && (
          <div className="chat-response-actions" style={{ marginTop: '4px' }}>
            <button
              onClick={() => onEdit && onEdit(msg)}
              title="Edit message"
              aria-label="Edit message"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Thinking Indicator ───────────────────────────────────────────────────────

function ThinkingDot({ label = 'Thinking…' }) {
  return (
    <div className="thinking-indicator" role="status" aria-live="polite">
      <span className="thinking-dots">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}

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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [localThinking, setLocalThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Thinking…');
  const [backendHistory, setBackendHistory] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [attachment, setAttachment] = useState(null);
  const [persona, setPersona] = useState('hinglish');
  const [variants, setVariants] = useState(null);
  const [sessionId, setSessionId] = useState('default');
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const newChatCount = useRef(0);
  const fileInputRef = useRef(null);

  const msgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);
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

  // Load persisted chat
  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSONA_KEY);
      if (p) setPersona(p);
      const s = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
      if (Array.isArray(s) && s.length > 0) setSessions(s);
      const sid = localStorage.getItem('ai_dost_session_id');
      if (sid) setSessionId(sid);
    } catch (_) {}
    try {
      const saved = localStorage.getItem(msgKey(sessionId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) { setMessages(parsed); return; }
      }
    } catch (_) {}
    setMessages([WELCOME]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load backend history on session change
  useEffect(() => {
    api.get(`/chat/history?session_id=${sessionId}`)
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.history || []);
        if (rows.length > 0) setBackendHistory(rows);
      })
      .catch(() => {});
  }, [sessionId]);

  const loadBackendHistory = () => {
    if (!backendHistory || backendHistory.length === 0) return;
    const restored = [];
    for (const row of backendHistory) {
      const userMsg = row.user_message || row.prompt;
      const reply = row.response;
      if (userMsg) restored.push({ id: Date.now() + restored.length, role: 'user', content: userMsg });
      if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply.slice(0, 3000) });
    }
    if (restored.length > 0) {
      setMessages(restored);
      setBackendHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: `History loaded (${restored.length} messages)` } }));
      }
    }
  };

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(msgKey(sessionId), JSON.stringify(messages)); } catch (_) {}
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

  // Smart Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Only scroll if we're near the bottom
    if (distFromBottom < 120) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking]);

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
    };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);
    setThinkingLabel('Thinking…');

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

    // ── Document generation ──
    const specificDoc = DOC_KEYWORDS
      .filter((k) => k.type !== 'docx')
      .map((k) => ({ type: k.type, pos: content.search(k.re) }))
      .filter((m) => m.pos >= 0)
      .sort((a, b) => a.pos - b.pos)[0];
    const docxKeyword = DOC_KEYWORDS.find((k) => k.type === 'docx');
    const docIntent = specificDoc || (content.search(docxKeyword.re) >= 0 ? docxKeyword : null);
    if (docIntent) {
      setThinkingLabel('Creating document…');
      try {
        const topic = content.replace(docIntent.re, '').trim() || content;
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[docIntent.type] || docIntent.type;
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: `⏳ ${typeLabel} file ban rahi hai…`, timestamp: new Date().toISOString() }]);
        const r = await api.post('/document/generate', { type: docIntent.type, topic, title: content.slice(0, 50) });
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

    // ── Resume ──
    if (/(resume|cv|bio.?data|resume bana|cv bana)/i.test(content)) {
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
        body: JSON.stringify({ message: content, model: model === 'auto' ? 'auto' : model, section: 'chat', history, mode: 'chat', persona }),
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
            if (parsed.chunk) {
              accumulated += parsed.chunk;
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, content: accumulated, isStreaming: true } : m)
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
        const res = await api.post('/chat/', { message: content, model: model === 'auto' ? 'auto' : model, section: 'chat', history, mode: 'chat', persona });
        const reply0 = res.data?.reply || res.data?.message || 'Response nahi mila.';
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: reply0, isStreaming: false } : m)
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
  }, [input, thinking, messages, model, setThinking, onOpenResumeWithData, onNavigate, attachment, persona]);

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

  const handleModelChange = (e) => {
    const val = e.target.value;
    if (onModelChange) onModelChange(val);
    try { localStorage.setItem('ai_dost_model', val); } catch (_) {}
  };

  const persistSessions = (list) => {
    setSessions(list);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)); } catch (_) {}
  };

  const saveCurrentToStorage = () => {
    try { if (messages.length > 0) localStorage.setItem(msgKey(sessionId), JSON.stringify(messages)); } catch (_) {}
  };

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

  const switchSession = (id) => {
    saveCurrentToStorage();
    localStorage.setItem('ai_dost_session_id', id);
    setSessionId(id);
    setMessages([]);
    setShowFollowUps(false);
    setActiveArtifact(null);
    try {
      const saved = localStorage.getItem(msgKey(id));
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      else setMessages([WELCOME]);
    } catch (_) { setMessages([WELCOME]); }
  };

  const renameSession = (id) => {
    const title = window.prompt('Session ka naam:', sessions.find((s) => s.id === id)?.title || '');
    if (title && title.trim()) {
      persistSessions(sessions.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)));
    }
  };

  const deleteSession = (id) => {
    if (!window.confirm('Ye session delete karna hai?')) return;
    try { localStorage.removeItem(msgKey(id)); } catch (_) {}
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

  const setPersonaAndSave = (id) => {
    setPersona(id);
    try { localStorage.setItem(PERSONA_KEY, id); } catch (_) {}
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
      {/* Main chat panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">

        {/* Session bar — minimal integrated dropdown */}
        <SmartChatHeader
          sessionName={currentSessionName}
          sessions={sessions}
          sessionId={sessionId}
          onNewSession={createSession}
          onSwitchSession={switchSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
        />

        {/* Message stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 px-4 md:px-6 flex flex-col">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-end">

            {/* Empty state — inside the scroll container */}
            {isEmpty && !thinking && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh] w-full max-w-2xl mx-auto px-4">
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-canvas-elevated border border-border shadow-sm mb-2">
                    <AiDostMark size={24} />
                  </div>
                  <h1 className="text-2xl font-semibold text-paper-100 tracking-tight">Namaste 👋 Main AI-Dost hoon.</h1>
                  <p className="text-base text-ink-muted">Kya karna hai?</p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                  {['Build something', 'Research something', 'Create something'].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="px-4 py-2 rounded-full text-[13px] font-medium bg-canvas-surface border border-border text-paper-200 hover:bg-canvas-elevated hover:text-paper-100 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Restore history prompt */}
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
                <MessageBubble
                  key={msg.id || index}
                  msg={msg}
                  isLast={index === displayMessages.length - 1}
                  onRegenerate={handleRegenerate}
                  onOpenImage={(url) => setLightboxUrl(url)}
                  onVariants={loadVariants}
                  onNavigate={onNavigate}
                  onOpenArtifact={setActiveArtifact}
                  onEdit={handleEditMessage}
                />
              ))}

              {/* Variants panel */}
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

              {/* Thinking indicator */}
              <AnimatePresence>
                {thinking && (
                  <ThinkingDot key="thinking" label={thinkingLabel} />
                )}
              </AnimatePresence>


            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="px-4 md:px-6 pb-4 pt-2 bg-canvas-base border-t border-border-subtle shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment preview */}
            {attachment && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs bg-canvas-surface border border-border">
                <Paperclip className="w-3.5 h-3.5 text-accent" />
                <span className="truncate flex-1 text-paper-100">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="px-1.5 py-0.5 rounded text-[10px] text-ink-muted hover:text-paper-100 cursor-pointer hover:bg-canvas-elevated"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input box */}
            <div className="relative rounded-xl bg-canvas-surface border border-border focus-within:border-accent/40 focus-within:shadow-sm transition-fast">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={Math.min(4, Math.max(1, input.split('\n').length))}
                placeholder="Ask AI-Dost anything…"
                className="w-full bg-transparent resize-none text-sm focus:outline-none placeholder:text-ink-muted text-paper-100 leading-relaxed px-4 pt-3.5 pb-2 font-sans"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.csv,.xlsx,.java,.c,.cpp,.go,.rs"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1 select-none">
                <div className="flex items-center gap-1">
                  {/* Attach */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title="Attach file"
                    className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-paper-200 transition-fast cursor-pointer focus-ring"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {/* Voice */}
                  {onOpenVoice && (
                    <button
                      type="button"
                      onClick={onOpenVoice}
                      title="Voice input"
                      className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-accent transition-fast cursor-pointer focus-ring"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Model selector */}
                  <select
                    value={model}
                    onChange={handleModelChange}
                    title="Select model"
                    className="px-2 py-1 rounded-lg text-[11px] font-medium bg-canvas-elevated border border-border text-ink-muted cursor-pointer focus:outline-none transition-fast"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  {/* Send */}
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || thinking}
                    title="Send (Enter)"
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-black hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-fast cursor-pointer shadow-sm focus-ring"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Artifact canvas (split screen) */}
      <AnimatePresence>
        {activeArtifact && (
          <ChatArtifactsCanvas
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
            onOpenInCopilot={handleOpenArtifactInCopilot}
          />
        )}
      </AnimatePresence>

      {/* Image lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
