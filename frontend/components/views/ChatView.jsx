import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Copy, Volume2, RefreshCw, ThumbsUp, ThumbsDown,
  Sparkles, FileText, Mic, Paperclip, Bot, User, Check,
  Lightbulb, Globe, Wand2, Eraser, History as HistoryIcon,
  Pencil, Download, Search, ExternalLink, FileDown, ArrowRight,
  Play, Terminal, Loader2, Code2, Eye, LayoutTemplate
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '../../services/api';
import { ImageCard, ImageLightbox } from './ImageLightbox';
import ChatArtifactsCanvas from '../chat/ChatArtifactsCanvas';
import BrandLogo from '../ui/BrandLogo';
import { AiDostMark } from '../brand/AiDostMark';

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';

const PERSONAS = [
  { id: 'hinglish', label: '💬 Hinglish' },
  { id: 'english', label: '🇬🇧 English' },
  { id: 'formal', label: '🎩 Formal' },
];

const QUICK_PROMPTS = [
  { icon: Sparkles, label: 'Calculator Widget', prompt: 'Ek modern interactive calculator widget bana do with HTML, Tailwind CSS and JavaScript' },
  { icon: FileText, label: 'Resume banao', prompt: 'Mera resume bana do — full stack developer, 3 saal experience React aur Node.js me' },
  { icon: Code2, label: 'Python Script', prompt: 'Python me ek recursive Fibonacci aur prime numbers generator script likho aur output print karo' },
  { icon: Globe, label: 'Explain WebSockets', prompt: 'Explain how WebSockets work in simple Hinglish with architecture diagram' },
  { icon: Search, label: 'Research AI News', prompt: 'Latest AI news aur major breakthrough trends search karo aur sources ke saath batao' },
];

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
  { re: /\b(projects?|meri projects?|my projects?)\b.*\b(kholo|dikhao|dikha|open|show|list)\b/i, view: 'projects', label: 'Projects View' },
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
  { id: 'auto', label: '⚡ Auto (Smart Pick)' },
  { id: 'groq', label: '🚀 Groq (GPT-OSS 120B)' },
  { id: 'gemini', label: '✨ Gemini 2.5 Flash' },
  { id: 'nvidia', label: '🔷 NVIDIA NIM' },
  { id: 'together', label: '🧠 Together AI' },
  { id: 'deepseek', label: '🐋 DeepSeek' },
  { id: 'mistral', label: '🌬️ Mistral' },
  { id: 'ollama', label: '💻 Ollama (Local Offline)' },
];

const FOLLOW_UPS = [
  'Isme aur kya styling ya logic add kar sakte hain?',
  'Interactive Claude Artifacts Canvas me open karo',
  'Isse Copilot IDE me fullstack project me badlo',
  'Code ka step-by-step mathematical breakdown do',
];

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: `Namaste! 🙏 Main **AI-Dost** hoon — aapka supercharged AI assistant.

### 🌟 New Capabilities:
- 🎨 **Claude-Style Live Canvas** — HTML/JS widgets chat ke right side me live run hote hain
- ▶️ **In-Chat Code Interpreter** — Python & JS code block me direct \`Run\` dabayein
- ⚡ **1-Click Copilot IDE Bridge** — Koi bhi code instantly full IDE workspace me bhejein
- 🧠 **20+ Turn Context Memory** — Purana reference kabhi nahi bhulega
- 🌐 **Perplexity-Grade Search** — Real-time sources and grounding

Kya banana ya discuss karna hai aaj?`,
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

// Detect HTML / SVG code block for interactive Claude artifact
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

function MessageBubble({
  msg,
  onOpenImage,
  onRegenerate,
  onEdit,
  isLast,
  onVariants,
  onNavigate,
  onOpenArtifact
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isStreaming = !!msg.isStreaming;
  const images = isUser ? [] : extractImages(msg.content);
  const proseRef = useRef(null);

  const detectedArtifact = !isUser && !isStreaming ? extractArtifact(msg.content) : null;

  // Code Block Top Bar + Copy + In-Chat Execution Runner
  useEffect(() => {
    const el = proseRef.current;
    if (!el || isStreaming) return;
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.chat-code-header')) return;
      pre.style.position = 'relative';
      pre.style.borderRadius = '12px';
      pre.style.overflow = 'hidden';
      pre.style.margin = '14px 0';
      pre.style.background = '#0a0d14';
      pre.style.border = '1px solid rgba(255,255,255,0.12)';

      const code = pre.querySelector('code');
      let lang = 'CODE';
      if (code && code.className) {
        const m = code.className.match(/language-([a-zA-Z0-9_-]+)/);
        if (m) lang = m[1].toUpperCase();
      }

      const rawCode = code ? code.innerText : pre.innerText;

      const header = document.createElement('div');
      header.className = 'chat-code-header';
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;';

      const langSpan = document.createElement('span');
      langSpan.textContent = lang;

      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex;align-items:center;gap:6px;';

      // Run button for Python/JS
      const isRunnable = /^(PYTHON|PY|JAVASCRIPT|JS|NODE)$/i.test(lang);
      let runBtn = null;
      let outputContainer = null;

      if (isRunnable) {
        runBtn = document.createElement('button');
        runBtn.className = 'chat-code-run';
        runBtn.innerHTML = '<span>▶ Run</span>';
        runBtn.title = 'Execute code in sandbox';
        runBtn.style.cssText = 'display:flex;align-items:center;gap:4px;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.3);transition:all .15s;';
        
        outputContainer = document.createElement('div');
        outputContainer.className = 'chat-code-output';
        outputContainer.style.cssText = 'display:none;padding:10px 14px;background:#030712;border-top:1px solid rgba(255,255,255,0.08);font-family:monospace;font-size:11px;color:#cbd5e1;white-space:pre-wrap;max-height:180px;overflow-y:auto;';

        runBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          runBtn.innerHTML = '<span>⏳ Running...</span>';
          outputContainer.style.display = 'block';
          outputContainer.innerHTML = '<span style="color:#94a3b8">Executing in sandbox environment...</span>';

          try {
            const res = await api.post('/chat/execute', { code: rawCode, language: lang });
            const data = res.data;
            if (data.success) {
              outputContainer.innerHTML = `<span style="color:#34d399;font-weight:600;">[Exit Code 0 • ${data.duration || 0}ms]</span>\n${data.stdout || '(No output)'}`;
            } else {
              outputContainer.innerHTML = `<span style="color:#f87171;font-weight:600;">[Error • ${data.duration || 0}ms]</span>\n${data.stderr || data.error || 'Execution failed'}`;
            }
          } catch (err) {
            outputContainer.innerHTML = `<span style="color:#f87171;">Failed to connect to execution sandbox: ${err.message}</span>`;
          } finally {
            runBtn.innerHTML = '<span>▶ Run Again</span>';
          }
        });
        btnGroup.appendChild(runBtn);
      }

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'chat-code-copy';
      copyBtn.innerHTML = '<span>📋 Copy</span>';
      copyBtn.title = 'Copy code';
      copyBtn.style.cssText = 'display:flex;align-items:center;gap:4px;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;background:rgba(255,255,255,0.08);color:#e2e8f0;transition:all .15s;';
      copyBtn.addEventListener('mouseenter', () => (copyBtn.style.background = 'rgba(255,255,255,0.2)'));
      copyBtn.addEventListener('mouseleave', () => (copyBtn.style.background = 'rgba(255,255,255,0.08)'));
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(rawCode).then(() => {
          copyBtn.innerHTML = '<span style="color:#34d399">✓ Copied!</span>';
          setTimeout(() => (copyBtn.innerHTML = '<span>📋 Copy</span>'), 1500);
        });
      });
      btnGroup.appendChild(copyBtn);

      header.appendChild(langSpan);
      header.appendChild(btnGroup);
      pre.insertBefore(header, pre.firstChild);
      if (outputContainer) pre.appendChild(outputContainer);
    });
  }, [msg.content, isStreaming]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* noop */ }
  };

  const [speaking, setSpeaking] = useState(false);

  const speak = async () => {
    const text = msg.content.replace(/[*#`>\[\]]/g, '').slice(0, 1500);
    if (!text.trim()) return;
    try {
      const audioUrl = `${api.defaults.baseURL}/agent/ai/tts`;
      const ttsRes = await fetch(audioUrl, {
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
    } catch (e) { /* fallback */ }

    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      window.speechSynthesis.speak(utter);
    } catch (e) { /* noop */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar / Monogram */}
      <div className="flex-shrink-0 mt-0.5 select-none">
        {isUser ? (
          <div className="w-7 h-7 rounded-xs flex items-center justify-center bg-canvas-surface border border-border text-ink-muted text-xs font-mono">
            U
          </div>
        ) : (
          <div className="w-7 h-7 rounded-xs flex items-center justify-center bg-canvas-surface border border-border text-accent-primary">
            <AiDostMark size={16} />
          </div>
        )}
      </div>

      {/* Bubble / Editorial Message Block */}
      <div className={`max-w-[92%] md:max-w-[82%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 text-xs leading-relaxed ${
            isUser
              ? 'rounded-xs bg-canvas-surface border border-border text-paper-100'
              : 'rounded-xs bg-canvas-surface/40 border border-border-subtle text-paper-100'
          }`}
        >
          {isStreaming && msg.content.length === 0 ? (
            <div className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs text-slate-300">AI-Dost response stream kar raha hai...</span>
            </div>
          ) : isStreaming ? (
            <div>
              <div
                ref={proseRef}
                className="prose-chat"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
            </div>
          ) : (
            <div
              ref={proseRef}
              className="prose-chat"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}

          {/* Claude-Style Live Artifact Preview Trigger */}
          {detectedArtifact && (
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="text-xs font-semibold text-purple-300">Interactive Canvas Ready</span>
              </div>
              <button
                onClick={() => onOpenArtifact && onOpenArtifact(detectedArtifact)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 transition-all cursor-pointer shadow-lg hover:scale-[1.02]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Canvas Kholo</span>
              </button>
            </div>
          )}

          {/* Quick Action Navigation Chip */}
          {msg.navView && (
            <div className="mt-3 pt-2.5 border-t border-white/10">
              <button
                onClick={() => onNavigate && onNavigate(msg.navView)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/40 hover:bg-blue-500/30 transition-all cursor-pointer shadow-lg"
              >
                <span>👉 {msg.navLabel || msg.navView} me chalein</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached files */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.attachments.map((n, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-300">
                  <Paperclip className="w-2.5 h-2.5" /> {n}
                </span>
              ))}
            </div>
          )}

          {/* Search sources with Favicons */}
          {!isStreaming && msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-white/10">
              {msg.sources.map((s, i) => {
                let domain = '';
                try { domain = new URL(s.url).hostname; } catch (_) {}
                return (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-2.5 py-1.5 rounded-xl flex items-center gap-2 max-w-[240px] truncate bg-blue-500/10 border border-blue-400/30 text-blue-300 hover:bg-blue-500/20 transition-colors shadow-sm"
                    title={s.url}
                  >
                    <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">[{i + 1}] {s.title || domain}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                  </a>
                );
              })}
            </div>
          )}

          {/* Generated images */}
          {!isStreaming && images.length > 0 && (
            <div className={`grid gap-2.5 mt-3 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ minWidth: 220 }}>
              {images.map((img, idx) => (
                <ImageCard key={idx} src={img.url} alt={img.alt} index={idx} onOpen={onOpenImage} />
              ))}
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 px-1 bg-white/5 rounded-lg border border-white/5 py-0.5">
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
                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-white/15 text-slate-400 hover:text-slate-200"
              >
                {title === 'Copy' && copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Icon className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}
        {isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 px-1">
            <button
              onClick={() => onEdit && onEdit(msg)}
              title="Edit message"
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-white/10 text-slate-400"
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5 py-2 px-3.5 rounded-md bg-canvas-surface border border-border text-txt-secondary text-xs max-w-sm"
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
      <div className="flex flex-col">
        <span className="font-medium text-txt-primary">Synthesizing response...</span>
        <span className="text-[10px] text-txt-muted">Evaluating multi-model cascade</span>
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
  const [activeArtifact, setActiveArtifact] = useState(null);
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
      if (reply) restored.push({ id: Date.now() + restored.length, role: 'assistant', content: reply.slice(0, 3000) });
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

  // Save to backend history
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
      setActiveArtifact(null);
    }
  }, [onNewChatSignal]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking]);

  // 1-Click Bridge: Open Artifact into Copilot IDE
  const handleOpenArtifactInCopilot = (art) => {
    try {
      const payload = {
        title: art.title || 'chat-artifact',
        code: art.code || '',
        language: art.language || 'html',
        timestamp: Date.now(),
      };
      localStorage.setItem('ai_dost_copilot_import', JSON.stringify(payload));
    } catch (_) {}
    if (onNavigate) onNavigate('copilot');
  };

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || thinking) return;
    setInput('');
    setShowFollowUps(false);

    const userMsg = { id: Date.now(), role: 'user', content, timestamp: new Date().toISOString(), attachments: attachment ? [attachment.name] : undefined };
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
        const aiMsg = { id: Date.now() + 1, role: 'assistant', content: reply, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
        setLastReply(reply);
        setShowFollowUps(true);
        setAttachment(null);
        setThinking(false);
        return;
      } catch (e) {
        setAttachment(null);
      }
    }

    // ── Image generation intent ──
    if (IMAGE_CREATE_INTENT.test(content)) {
      try {
        const r1 = await api.post('/image/generate', { prompt: content });
        const urls = [r1.data?.imageUrl].filter(Boolean);
        if (urls.length > 0) {
          const imageReply = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `Haan bhai, ho gaya! 🎨 Maine aapki image banayi (HD quality):\n\n![Image 1](${urls[0]})\n\n[⬇️ Download Image](${urls[0]}) • [🔗 Full screen me kholo](${urls[0]})\n\nKuch aur change chahiye to batao! ✨`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, imageReply]);
          setLastReply(imageReply.content);
          setShowFollowUps(true);
          setThinking(false);
          return;
        }
      } catch (e) { /* fall through */ }
    }

    // ── Document intent: pdf / docx / pptx / csv / xlsx ──
    const specificDoc = DOC_KEYWORDS
      .filter((k) => k.type !== 'docx')
      .map((k) => ({ type: k.type, pos: content.search(k.re) }))
      .filter((m) => m.pos >= 0)
      .sort((a, b) => a.pos - b.pos)[0];
    const docxKeyword = DOC_KEYWORDS.find((k) => k.type === 'docx');
    const docIntent = specificDoc || (content.search(docxKeyword.re) >= 0 ? docxKeyword : null);
    if (docIntent) {
      try {
        const topic = content.replace(docIntent.re, '').replace(/^(bihar|india|15 august|independence day|raksha|shaheed|shahid|martyr)[\s,:-]*/i, '').trim() || content;
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[docIntent.type] || docIntent.type;
        const toast = { id: Date.now() + 1, role: 'assistant', content: `⏳ **${typeLabel} file ban rahi hai...** AI research + generation chal raha hai.`, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, toast]);
        const r = await api.post('/document/generate', { type: docIntent.type, topic, title: content.slice(0, 50) });
        if (r.data?.success && r.data.downloadUrl) {
          const readyMsg = {
            id: Date.now() + 2,
            role: 'assistant',
            content: `✅ **${typeLabel} file ready!**\n\n📄 **${r.data.filename}**\n\n[⬇️ Download karo](${r.data.downloadUrl}) • [🔗 Naye tab me kholo](${r.data.downloadUrl})\n\nAur koi badlaav chahiye to batao! ✨`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, readyMsg]);
          setLastReply(readyMsg.content);
          setShowFollowUps(true);
        } else {
          setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: `⚠️ File ban nahi payi: ${r.data?.error || 'unknown error'}`, timestamp: new Date().toISOString() }]);
        }
        setThinking(false);
        return;
      } catch (e) {
        setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: `⚠️ File banane me problem aayi: ${e?.message || 'backend error'}`, timestamp: new Date().toISOString() }]);
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
            id: Date.now() + 1,
            role: 'assistant',
            content: `📄 **Resume ready!** Maine aapki details se ek professional resume bana diya hai.\n\n**${data.data.fullName || 'Developer'}** — ${data.data.summary || ''}\n\nSide preview me live dikh raha hai. PDF download kar sakte ho.`,
            timestamp: new Date().toISOString(),
            navView: 'resume',
            navLabel: 'Resume Builder Open Karo'
          };
          setMessages((prev) => [...prev, resumeMsg]);
          if (onOpenResumeWithData) onOpenResumeWithData(data.data);
          setThinking(false);
          return;
        }
      } catch (e) { /* fall through */ }
    }

    // ── Navigation intent ──
    const nav = NAV_INTENTS.find((n) => n.re.test(content));
    if (nav) {
      const navReply = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Le chal raha hoon **${nav.label}** me... 👉`,
        timestamp: new Date().toISOString(),
        navView: nav.view,
        navLabel: nav.label
      };
      setMessages((prev) => [...prev, navReply]);
      setLastReply(navReply.content);
      if (onNavigate) onNavigate(nav.view);
      setThinking(false);
      return;
    }

    // ── Web search intent ──
    if (SEARCH_INTENT.test(content)) {
      try {
        const res = await api.post('/chat/search', { message: content });
        const reply = res.data?.reply || 'Search se kuch nahi mila — thoda specific banao.';
        const sources = res.data?.sources || [];
        const searchMsg = {
          id: Date.now() + 1,
          role: 'assistant',
          content: reply,
          sources,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, searchMsg]);
        setLastReply(reply);
        setShowFollowUps(true);
        setThinking(false);
        return;
      } catch (e) { /* fall through */ }
    }

    // ── Real-Time SSE Token Streaming ──
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 2500) }));

    const aiMsgId = Date.now() + 1;
    const placeholder = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, placeholder]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          model: model === 'auto' ? 'auto' : model,
          section: 'chat',
          history,
          mode: 'chat',
          persona,
        }),
      });

      if (!response.ok) {
        throw new Error(`Streaming failed with status: ${response.status}`);
      }

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
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: accumulated, isStreaming: true } : m
                )
              );
            }
          } catch (_) {}
        }
      }

      // Check final generated image tags
      let finalReply = accumulated;
      const imageTagRegex = /\[GENERATE_IMAGE:\s*(.*?)\]/i;
      const imageMatch = finalReply.match(imageTagRegex);
      if (imageMatch) {
        const imagePromptText = imageMatch[1].trim();
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePromptText)}?width=768&height=512&nologo=true`;
        finalReply = finalReply.replace(imageTagRegex, '🎨 Image ban gayi — neeche dekho:').trim();
        finalReply += `\n\n![Generated: ${imagePromptText}](${pollinationsUrl})`;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: finalReply || 'Kuch response nahi mila.', isStreaming: false } : m
        )
      );
      setLastReply(finalReply);

      // Auto open Claude-style artifact if HTML/widget is detected
      const artifact = extractArtifact(finalReply);
      if (artifact) {
        setActiveArtifact(artifact);
      }

      if (PROJECT_INTENT.test(content)) setSuggestView('project');
      setShowFollowUps(true);
    } catch (err) {
      console.warn('Stream failed, falling back to REST endpoint:', err.message);
      try {
        const res = await api.post('/chat/', {
          message: content,
          model: model === 'auto' ? 'auto' : model,
          section: 'chat',
          history,
          mode: 'chat',
          persona,
        });
        const reply0 = res.data?.reply || res.data?.message || 'Sorry, response nahi mil paya. Dobara try karo.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: reply0, isStreaming: false } : m
          )
        );
        setLastReply(reply0);
        const artifact = extractArtifact(reply0);
        if (artifact) setActiveArtifact(artifact);
        setShowFollowUps(true);
      } catch (e2) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: `⚠️ **Error:** ${e2?.message || 'Network error'}\n\nBackend chal raha hai check karo (localhost:5000) aur dobara try karo.`,
                  isStreaming: false,
                }
              : m
          )
        );
      }
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
    setActiveArtifact(null);
  };

  const switchSession = (id) => {
    saveCurrentToStorage();
    localStorage.setItem('ai_dost_session_id', id);
    setSessionId(id);
    setMessages([]);
    setShowFollowUps(false);
    setSuggestView(null);
    setSessionsOpen(false);
    setActiveArtifact(null);
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
    <div className="h-full flex flex-row overflow-hidden bg-canvas-base">
      {/* Left / Main Chat Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Docked Sticky Sub-Header Bar */}
        <div className="shrink-0 px-4 md:px-8 py-2 bg-canvas-subtle/80 border-b border-border z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSessionsOpen(!sessionsOpen)}
                  title="Sessions"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated border border-border text-txt-primary cursor-pointer transition-fast shadow-xs focus-ring"
                >
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">{sessions.find((s) => s.id === sessionId)?.title || 'Default session'}</span>
                  <span className="text-[10px] text-txt-muted">▾</span>
                </button>
                {sessionsOpen && (
                  <div
                    className="absolute top-full left-0 mt-1.5 w-64 rounded-lg overflow-hidden z-50 shadow-popover bg-canvas-surface border border-border-strong"
                  >
                    <div className="max-h-56 overflow-y-auto py-1 divide-y divide-border-subtle">
                      {[{ id: 'default', title: 'Default session' }, ...sessions].map((s) => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-fast ${
                            s.id === sessionId ? 'bg-accent/10 text-accent font-medium' : 'hover:bg-white/5 text-txt-secondary'
                          }`}
                        >
                          <span
                            className="flex-1 truncate text-xs"
                            onClick={() => switchSession(s.id)}
                          >
                            {s.title}
                          </span>
                          {s.id !== 'default' && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => renameSession(s.id)} title="Rename" className="p-1 rounded-xs hover:bg-white/10 cursor-pointer text-[10px] text-txt-muted hover:text-txt-primary">✏️</button>
                              <button onClick={() => deleteSession(s.id)} title="Delete" className="p-1 rounded-xs hover:bg-white/10 cursor-pointer text-[10px] text-txt-muted hover:text-status-error">🗑️</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={createSession}
                title="New session"
                className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer bg-canvas-surface hover:bg-canvas-elevated border border-border text-txt-secondary hover:text-txt-primary transition-fast text-xs focus-ring"
              >
                +
              </button>
            </div>

            {/* Persona Tone Selector */}
            <div className="flex items-center gap-1 bg-canvas-surface p-0.5 rounded-md border border-border">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonaAndSave(p.id)}
                  className={`px-2 py-1 rounded-xs text-[11px] font-medium transition-fast cursor-pointer focus-ring ${
                    persona === p.id
                      ? 'bg-canvas-elevated text-accent border border-border shadow-xs'
                      : 'text-txt-muted hover:text-txt-secondary border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message Stream */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-6"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id || i}
                msg={msg}
                onOpenImage={setLightboxUrl}
                onRegenerate={handleRegenerate}
                onEdit={handleEditMessage}
                isLast={i === messages.length - 1}
                onVariants={loadVariants}
                onNavigate={onNavigate}
                onOpenArtifact={setActiveArtifact}
              />
            ))}

            {/* Variants panel */}
            {variants && variants.items.length > 0 && !thinking && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400">
                  ✨ 3 Variants Available
                </p>
                <div className="space-y-2">
                  {variants.items.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => applyVariant(v)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer hover:bg-white/10 bg-white/5 border border-white/10 text-slate-200"
                    >
                      <span className="font-bold mr-1.5 text-purple-400">Option {i + 1}:</span>
                      {v.slice(0, 240)}
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
                  className="pt-3 border-t border-white/5"
                >
                  <p className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                    Suggested follow-ups
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOW_UPS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer hover:scale-[1.02] bg-blue-500/10 border border-blue-400/25 text-blue-300 hover:bg-blue-500/20"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Project View Suggestions */}
            <AnimatePresence>
              {suggestView === 'project' && !thinking && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pt-2"
                >
                  <p className="text-[11px] font-semibold text-slate-400 mb-2">
                    ⚡ Chaho to poora project Copilot IDE me open karo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onNavigate && onNavigate('copilot')}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-all cursor-pointer"
                    >
                      <span>⚡ Copilot IDE me open karo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigate && onNavigate('agent')}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 transition-all cursor-pointer"
                    >
                      <span>🤖 Autonomous Agent se banao</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Quick Prompts */}
        {messages.length <= 2 && !thinking && (
          <div className="px-4 md:px-8 pb-2">
            <div className="max-w-4xl mx-auto">
              {backendHistory && backendHistory.length > 0 && (
                <button
                  type="button"
                  onClick={loadBackendHistory}
                  className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated border border-border text-txt-secondary hover:text-txt-primary transition-fast cursor-pointer focus-ring"
                >
                  <HistoryIcon className="w-3.5 h-3.5" /> Previous conversation history ({backendHistory.length} saved)
                </button>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-fast cursor-pointer bg-canvas-surface hover:bg-canvas-elevated border border-border text-txt-secondary hover:text-txt-primary text-left focus-ring"
                  >
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 md:px-8 pb-4 pt-2 bg-canvas-base border-t border-border-subtle">
          <div className="max-w-4xl mx-auto">
            {attachment && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-md text-xs bg-canvas-surface border border-border">
                <Paperclip className="w-3.5 h-3.5 text-accent" />
                <span className="truncate text-txt-primary">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="ml-auto px-1.5 py-0.5 rounded-xs text-[10px] text-txt-muted hover:text-txt-primary cursor-pointer hover:bg-canvas-elevated"
                >
                  ✕ remove
                </button>
              </div>
            )}
            <div
              className="relative rounded-xl bg-canvas-surface border border-border focus-within:border-border-focus focus-within:shadow-md transition-fast"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={Math.min(5, Math.max(1, input.split('\n').length))}
                placeholder="Ask AI-Dost anything, generate code, or orchestrate agent... (Enter = send, Shift+Enter = newline)"
                className="w-full bg-transparent resize-none text-sm focus:outline-none placeholder:text-txt-muted text-txt-primary leading-relaxed px-4 pt-3 pb-2 font-sans"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.csv,.xlsx,.java,.c,.cpp,.go,.rs"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border-subtle select-none">
                <div className="flex items-center gap-1.5">
                  <select
                    value={model}
                    onChange={handleModelChange}
                    title="Select model"
                    className="px-2 py-1 rounded-sm text-xs font-medium bg-canvas-elevated border border-border text-txt-secondary cursor-pointer focus:outline-none"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    title="Attach file"
                    className="p-1.5 rounded-sm hover:bg-canvas-elevated text-txt-muted hover:text-txt-primary transition-fast cursor-pointer focus-ring"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {onOpenVoice && (
                    <button
                      type="button"
                      onClick={onOpenVoice}
                      title="Voice input"
                      className="p-1.5 rounded-sm hover:bg-canvas-elevated text-txt-muted hover:text-accent transition-fast cursor-pointer focus-ring"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-txt-muted hidden sm:inline">
                    <kbd className="font-mono">Enter</kbd> to send
                  </span>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || thinking}
                    title="Send message"
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-fast cursor-pointer shadow-xs focus-ring"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 px-1 text-[11px] text-txt-muted">
              <span>AI-Dost • Live Artifacts Canvas & Code Execution Active</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={exportMarkdown}
                  title="Export Markdown"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] text-txt-muted hover:text-txt-primary border border-border hover:bg-canvas-surface transition-fast cursor-pointer"
                >
                  <FileDown className="w-3 h-3" /> .md
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  title="Export PDF"
                  className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] text-txt-muted hover:text-txt-primary border border-border hover:bg-canvas-surface transition-fast cursor-pointer"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Right / Claude-Style Live Artifacts Canvas (Split Screen) */}
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