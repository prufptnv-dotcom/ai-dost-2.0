import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Paperclip, Sparkles, Code2, FileText, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { ImageLightbox } from '../components/views/ImageLightbox';
import ChatArtifactsCanvas from '../components/chat/ChatArtifactsCanvas';
import { AiDostMark } from '../components/brand/AiDostMark';
import SmartChatHeader from '../components/chat/SmartChatHeader';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatMessageBubble from '../components/chat/ChatMessageBubble';
import ThinkingDot from '../components/chat/ThinkingDot';
import { extractArtifact, stripInternalTags } from '../utils/chatContent';
import { AssessmentRunner } from '../components/assessment/AssessmentRunner';
import { getFuturistic2030Html, getThreeJsSolarSystemHtml } from '../lib/threeJsTemplates';
import ChatComposerDock from '../components/chat/ChatComposerDock';
import { streamChatResponse } from './useChatStream';
import { useChatHistory } from './useChatHistory';
import { isImageCreateRequest, extractImageSubject } from '../lib/imageIntent';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';
const getMsgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);

const PROJECT_INTENT =
  /\b(fullstack|project|app|website|web ?site|portfolio|mern|crud|clone|todo|blog|e-?commerce|chatbot|dashboard|landing page)\b.*\b(banao|bana|banake|make|create|build|generate)\b|\b(banao|bana|banake|make|create|build|generate)\b.*\b(project|app|website|web ?site|fullstack)\b/i;

const DOC_KEYWORDS = [
  { type: 'pdf', re: /pdf\b|pdf notes|syllabus|research paper|lab assignment|curriculum/i },
  { type: 'pptx', re: /ppt[a-z]*|powerpoint|presentation|slides?|pitch deck/i },
  { type: 'xlsx', re: /xlsx|excel\b|spreadsheet/i },
  { type: 'csv', re: /csv\b/i },
  { type: 'docx', re: /\bdocx?\b|\bdoct\b|word ?file|word ?document|document|report|resume|cv\b|cover letter|proposal|technical design|tdd|readme|api doc|meeting notes|mom\b|professional letter/i },
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

const EXPLICIT_3D_SIMULATION_INTENT =
  /\b(endless highway|cyberpunk highway|dark road|procedural highway|cyberpunk car|hovercar|supercar|dna|double helix|chromosome|cyberpunk city|neo tokyo|metropolis|polyhedron|tesseract|icosahedron|particle system|stardust|solar system|solar-system|celestial simulation|gravity simulation|n-body simulation|fluid simulation|sorting visualizer|neural network 3d|earth 3d|3d earth globe|periodic table 3d|kinetic typography|kinetic text|space ship game|quantum|quantum field|quantum realm|wormhole|black hole|animation|3d animation|microverse|entanglement|subatomic)\b/i;


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


export function useChatView({
  model, initialPrompt, thinking: thinkingProp, setIsThinking: setIsThinkingProp, onOpenResumeWithData, onOpenVoice, onNewChatSignal, onNavigate, onModelChange
}) {
  const {
    messages,
    setMessages,
sessionId,
    setSessionId,
    switchSession: switchSessionHistory,
    sessions,
    setSessions,
persona,
    setPersona,
    backendHistory,
    setBackendHistory,
    loadBackendHistory,
    createNewChat,
    clearChat
  } = useChatHistory();

  const [input, setInput] = useState('');
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [localThinking, setLocalThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Thinking…');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [attachments, setAttachments] = useState([]);
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
  const abortRef = useRef(null);

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

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [initialPrompt]);

  const handleModelChange = (e) => {
    const nextModel = e.target.value;
    setSelectedModel(nextModel);
    try {
      localStorage.setItem('ai_dost_model', nextModel);
    } catch (_) {}
    if (typeof onModelChange === 'function') onModelChange(nextModel);
  };

  const thinking = thinkingProp !== undefined ? thinkingProp : localThinking;
  const setThinking = typeof setIsThinkingProp === 'function' ? setIsThinkingProp : setLocalThinking;

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


  useEffect(() => {
    const isStreaming = messages.some((m) => m.isStreaming);
    if (messages.length > 1 && !isStreaming) {
      const timer = setTimeout(() => {
        api.post('/chat/save', { session_id: sessionId, messages: messages.slice(-20) }).catch(() => {});
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (newChatCount.current > 0) {
      setMessages([WELCOME]);
      setShowFollowUps(false);
      setActiveArtifact(null);
    }
  }, [onNewChatSignal, setMessages]);

  useEffect(() => {
    const handleOpenArtifactEvent = (e) => {
      if (e.detail) {
        setActiveArtifact(e.detail);
      }
    };
    window.addEventListener('ai_dost_open_artifact', handleOpenArtifactEvent);
    return () => window.removeEventListener('ai_dost_open_artifact', handleOpenArtifactEvent);
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
      }
    });
  }, []);

  const scrollRafRef = useRef(null);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUpRef.current = distFromBottom >= 120;
      setShowJumpToBottom(distFromBottom > 160);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (userSentMessageRef.current || !userScrolledUpRef.current) {
      userSentMessageRef.current = false;
      const isStreaming = messages.some((m) => m.isStreaming);
      scrollToBottom(isStreaming || messages.length <= 2 ? 'auto' : 'smooth');
    }
  }, [messages, variants, scrollToBottom]);

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
    let content = (text || input).trim();
    if (!content || thinking) return;
    
    let isExplicitChat = false;
    if (content.toLowerCase().startsWith('/chat ')) {
      isExplicitChat = true;
      content = content.replace(/^\/chat\s*/i, '').trim();
    }
    if (!content) return;

    setInput('');
    setShowFollowUps(false);

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments: attachments.length > 0 ? attachments.map((a) => a.name) : undefined,
      imageAttachment: attachments.find((a) => a.type === 'image')?.base64,
      imageMime: attachments.find((a) => a.type === 'image')?.mime || 'image/png',
    };
    userSentMessageRef.current = true;
    userScrolledUpRef.current = false;
    setMessages((prev) => [...prev, userMsg]);

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
      try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated.slice(0, 30))); } catch (_) {}
      return updated;
    });

    if (typeof window !== 'undefined') {
      setTimeout(() => window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated')), 0);
    }

    setThinking(true);
    setThinkingLabel('Thinking…');
    setTimeout(() => scrollToBottom('smooth'), 20);

    if (attachments.length > 0) {
      try {
        const payload = {
          message: content || (attachments.length > 1 ? 'In sabhi files ko compare karke deep analysis do.' : 'Is file ka comprehensive analysis do.'),
          files: attachments,
        };
        if (attachments.length === 1) {
          const single = attachments[0];
          if (single.type === 'image') { payload.imageBase64 = single.base64; payload.imageMime = single.mime; }
          else if (single.type === 'pdf') { payload.pdfBase64 = single.base64; }
          else if (single.type === 'docx') { payload.docxBase64 = single.base64; }
          else if (single.type === 'pptx') { payload.pptxBase64 = single.base64; }
          else if (single.type === 'xlsx') { payload.xlsxBase64 = single.base64; }
          else if (single.type === 'text') { payload.text = single.text; }
        }
        const res = await api.post('/chat/analyze', payload);
        const reply = res.data?.reply || 'File padh nahi paya — dobara try karo.';
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
        setLastReply(reply);
        const art = extractArtifact(reply);
        if (art) setActiveArtifact(art);
        setShowFollowUps(true);
        setAttachments([]);
        setThinking(false);
        return;
      } catch (_) { setAttachments([]); }
    }

    if (!isExplicitChat && isImageCreateRequest(content)) {
      setThinkingLabel('⚡ Z-Image Turbo rendering…');
      const imagePrompt = extractImageSubject(content);
      // Two attempts, then an explicit failure bubble. We must NEVER fall
      // through to the plain LLM here — that is exactly what produced a
      // "Plan → Assumptions" Python/Pillow answer instead of a picture.
      let imageUrl = '';
      let lastError = '';
      for (let attempt = 0; attempt < 2 && !imageUrl; attempt += 1) {
        try {
          const r1 = await api.post('/image/turbo', { prompt: imagePrompt, style: 'general' });
          imageUrl = r1.data?.imageUrl || '';
          if (!imageUrl) lastError = r1.data?.error || 'Image model ne URL return nahi kiya.';
        } catch (err) {
          lastError = err?.response?.data?.error || err?.message || 'Image model unavailable.';
        }
        if (!imageUrl && attempt === 0) await new Promise((r) => setTimeout(r, 700));
      }

      if (imageUrl) {
        const imageReply = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `⚡ **Z-Image Turbo Generated!** 🎨\n\n![Image](${imageUrl})\n\n[⬇️ Download Image](${imageUrl})\n\n*Prompt: ${imagePrompt}*`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, imageReply]);
        setLastReply(imageReply.content);
        setShowFollowUps(true);
        setThinking(false);
        return;
      }

      const failReply = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `⚠️ **Image generate nahi ho payi.**\n\n${lastError || 'Image model unavailable.'}\n\n*Request:* "${content}"\n\n*Try again* dabake retry karo — ya prompt thoda simple likho.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, failReply]);
      setLastReply(failReply.content);
      setShowFollowUps(true);
      setThinking(false);
      return;
    }

    const DOC_CREATE_INTENT = /\b(banao|bana\s*do|bana\s*de|chahiye|taiyar\s*karo|likhdo|draft|export|nikalo|bana\s*kar\s*do)\b|\b(create|generate|make|build|write|draft|prepare)\b.*?\b(pdf|docx?|pptx?|csv|xlsx|file|doc|report|document|presentation|slides?|notes|syllabus|resume|cv|cover letter|proposal|tdd|readme|documentation|assignment|letter|paper|mom)\b/i;

    const specificDoc = (!isExplicitChat && DOC_CREATE_INTENT.test(content))
      ? DOC_KEYWORDS
          .filter((k) => k.type !== 'docx')
          .map((k) => ({ type: k.type, pos: content.search(k.re) }))
          .filter((m) => m.pos >= 0)
          .sort((a, b) => a.pos - b.pos)[0]
      : null;
    const docxKeyword = DOC_KEYWORDS.find((k) => k.type === 'docx');
    const docIntent = specificDoc || ((!isExplicitChat && DOC_CREATE_INTENT.test(content)) && content.search(docxKeyword.re) >= 0 ? docxKeyword : null);

    if (docIntent) {
      setThinkingLabel('Creating document…');
      try {
        const rawTopic = content.replace(docIntent.re, '').trim() || content;
        const topic = rawTopic
          .replace(/^(?:write|create|generate|make|build|draft|please|kripya)\s+(?:a|an|the|ek)?\s*(?:report|document|presentation|slides?|doc|pdf|csv|sheet|xlsx)?\s*(?:on|about|ke liye|pe)?\s*/i, '')
          .replace(/(\s*(?:or|aur|and|tatha|bhi)?\s*(?:iska|iski|iske)?\s*(?:pdf|docx?|pptx?|csv|xlsx|document|doc|report|presentation|slides?|file)?\s*(?:banao|bana\s*do|bana\s*de|chahiye|likhdo|generate|create|download|export)?)+$/i, '')
          .replace(/^(?:or|aur|and|tatha|bhi)\s+/i, '')
          .trim() || rawTopic;
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[docIntent.type] || docIntent.type;
        
        // Find latest genuine assistant message with actual research content (ignore cards, progress, errors)
        const isGenuineResearchMessage = (m) => {
          if (!m || m.role !== 'assistant' || !m.content) return false;
          if (m.id === 'welcome') return false;
          const t = m.content.trim();
          if (t.startsWith('⏳') || t.startsWith('⚠️') || t.startsWith('✅')) return false;
          if (/\[⬇️?\s*Download\]/i.test(t) || /\/downloads\//i.test(t)) return false;
          if (/\b(?:PDF|Word|PowerPoint|Excel|CSV)\s*ready!/i.test(t)) return false;
          if (t.includes('file ban rahi') || t.includes('dobara try karo') || t.includes('File nahi bani')) return false;
          return t.length >= 80;
        };

        const lastResearchMsg = [...messages].reverse().find(isGenuineResearchMessage);

        const isDirectExportDirective =
          Boolean(lastResearchMsg) &&
          (topic.length <= 25 &&
           /^(?:fir\s*se|firse|dobara|wahi|yehi|is|iska|iski|iske|ye|yeh|upar|above|is\s+research|is\s+report|jo\s+likha)\b/i.test(topic));

        let payloadContent = null;
        let finalTitle = topic;

        if (isDirectExportDirective && lastResearchMsg) {
          payloadContent = lastResearchMsg.content;
          if (!topic || topic.length < 5 || /\b(is|iska|iski|iske|ye|yeh|upar|above|firse|fir\s*se|dobara)\b/i.test(topic)) {
            const firstHeader = lastResearchMsg.content.match(/^#+\s*(.+)$/m) || lastResearchMsg.content.match(/^(.+?)(?:\n|$)/);
            finalTitle = firstHeader ? firstHeader[1].replace(/[*_#`]/g, '').trim().slice(0, 80) : 'Research Report';
          }
        }

        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: `⏳ ${typeLabel} file ban rahi hai…`, timestamp: new Date().toISOString() }]);
        const r = await api.post('/document/generate', {
          type: docIntent.type,
          topic: finalTitle || topic,
          title: (finalTitle || topic).slice(0, 80),
          content: payloadContent,
        }, { timeout: 180000 });
        if (r.data?.success && r.data.downloadUrl) {
          const docTitle = finalTitle || topic || `${typeLabel} Document`;
          const readyMsg = {
            id: Date.now() + 2,
            role: 'assistant',
            content: `✅ **${typeLabel} Ready!**\n\n📌 **${docTitle}**\n📄 \`${r.data.filename}\`\n\n[⬇️ Download ${typeLabel}](${r.data.downloadUrl})\n\nAap is document ko download karke dekh sakte hain.`,
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

    if (!isExplicitChat && EXPLICIT_3D_SIMULATION_INTENT.test(content) && !docIntent) {
      setThinkingLabel('Rendering 3D Canvas…');
      try {
        const html = getFuturistic2030Html(content);
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : '3D Interactive Simulation';
        const simReply = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `### 🪐 ${title}\n\nAapka interactive 3D simulation taiyar hai! Isko side-by-side **Split Canvas** me render kiya gaya hai jahan aap interactive orbit controls, physics settings, aur real-time rendering interact kar sakte hain.\n\n\`\`\`html\n${html}\n\`\`\``,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, simReply]);
        setLastReply(simReply.content);
        setActiveArtifact({
          title,
          language: 'html',
          code: html,
        });
        setShowFollowUps(true);
        setThinking(false);
        return;
      } catch (e) {
        console.error('3D rendering error:', e);
      }
    }

    const RESUME_DOC_CREATE =
      /\b(resume|cv|bio.?data)\b(?!\s*k?ar)[\s\S]{0,40}?\b(banao|bana\s*do|bana\s*de|chahiye|taiyar|likhdo|draft|create|generate\s+(?:my|mera|meri|ek)|make|write)\b|\b(banao|bana\s*do|bana\s*de|chahiye|taiyar\s*karo|likhdo|draft\s*karo|create|generate\s+(?:my|mera|meri|ek)|make\s+(?:my|me\s+a)|write)\b[\s\S]{0,60}?\b(resume|cv|bio.?data)\b/i;

    if (!isExplicitChat && RESUME_DOC_CREATE.test(content)) {
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
      } catch (_) {}
    }

    const nav = !isExplicitChat ? NAV_INTENTS.find((n) => n.re.test(content)) : null;
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

    if (!isExplicitChat && SEARCH_INTENT.test(content)) {
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
      } catch (_) {}
    }

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2500) }));

    const aiMsgId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true }]);

    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatResponse({
        content,
        selectedModel,
        history,
        persona,
        aiMsgId,
        setMessages,
        setThinking,
        setThinkingLabel,
        setActiveArtifact,
        setLastReply,
        setShowFollowUps,
        signal: controller.signal,
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [input, thinking, messages, selectedModel, setThinking, onOpenResumeWithData, onNavigate, attachments, persona, scrollToBottom, sessionId, setMessages, setSessions]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) {}
      abortRef.current = null;
    } else if (thinking) {
      setThinking(false);
    }
  }, [thinking, setThinking]);

  // Esc = stop generating (ChatGPT/Claude parity) — global while a stream is live
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && abortRef.current) {
        e.preventDefault();
        try { abortRef.current.abort(); } catch (_) {}
        abortRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
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
    // P2 #112: setItem guarded like the sibling at switchSession — a
    // QuotaError here broke createSession mid-flight.
    try { localStorage.setItem('ai_dost_session_id', id); } catch (_) {}
    setSessionId(id);
    setMessages([WELCOME]);
    setShowFollowUps(false);
    setBackendHistory(null);
    setActiveArtifact(null);
  };

  const switchSession = useCallback((id) => {
    if (!id) return;
    saveCurrentToStorage();
    try { localStorage.setItem('ai_dost_session_id', id); } catch (_) {}
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

    if (!loaded) setMessages([WELCOME]);
  }, [saveCurrentToStorage, setMessages, setSessionId, setBackendHistory]);

  useEffect(() => {
    const handleCustomSwitch = (e) => {
      const targetId = e?.detail;
      if (targetId && typeof targetId === 'string') switchSession(targetId);
    };
    window.addEventListener('ai_dost_switch_session', handleCustomSwitch);
    return () => window.removeEventListener('ai_dost_switch_session', handleCustomSwitch);
  }, [switchSession]);

  // P3 #119: announce readiness AFTER the switch listener above is attached
  // (effects run in declaration order) so parents can replace fixed-timeout
  // races with this handshake.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ai_dost_chat_ready'));
  }, []);

  const renameSession = (id) => {
    const title = window.prompt('Session ka naam:', sessions.find((s) => s.id === id)?.title || '');
    if (title && title.trim()) persistSessions(sessions.map((s) => (s.id === id ? { ...s, title: title.trim() } : s)));
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
    const fileList = e.target.files ? Array.from(e.target.files) : [];
    if (fileList.length === 0) return;

    const readAsBase64 = (f) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(f);
    });

    const newAttachments = [];
    for (const file of fileList) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      try {
        if (file.type.startsWith('image/')) {
          const b64 = await readAsBase64(file);
          newAttachments.push({ name: file.name, type: 'image', ext, mime: file.type, base64: b64 });
        } else if (ext === 'pdf') {
          const b64 = await readAsBase64(file);
          newAttachments.push({ name: file.name, type: 'pdf', ext, mime: 'application/pdf', base64: b64 });
        } else if (ext === 'docx') {
          const b64 = await readAsBase64(file);
          newAttachments.push({ name: file.name, type: 'docx', ext, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', base64: b64 });
        } else if (ext === 'pptx') {
          const b64 = await readAsBase64(file);
          newAttachments.push({ name: file.name, type: 'pptx', ext, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', base64: b64 });
        } else if (ext === 'xlsx' || ext === 'xls') {
          const b64 = await readAsBase64(file);
          newAttachments.push({ name: file.name, type: 'xlsx', ext, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: b64 });
        } else {
          const text = await file.text();
          newAttachments.push({ name: file.name, type: 'text', ext, text: text.slice(0, 25000) });
        }
      } catch (_) {}
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
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
            setAttachments((prev) => [...prev, { name: file.name && file.name !== 'image.png' ? file.name : `pasted-image-${Date.now().toString().slice(-4)}.png`, type: 'image', mime, base64 }]);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Image pasted from clipboard 📋' } }));
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

  return {
    scrollRef,
    messagesEndRef,
    userSentMessageRef,
    userScrolledUpRef,
    inputRef,
    newChatCount,
    fileInputRef,
    handleModelChange,
    thinking,
    setThinking,
    scrollToBottom,
    scrollRafRef,
    handleScroll,
    handleOpenArtifactInCopilot,
    sendMessage,
    stopStreaming,
    handleRegenerate,
    handleEditMessage,
    persistSessions,
    saveCurrentToStorage,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    handleFileSelect,
    handlePaste,
    loadVariants,
    applyVariant,
    setPersonaAndSave,
    handleKeyDown,
    currentSessionName,
    displayMessages,
    isEmpty,
    input,
    setInput,
    showFollowUps,
    setShowFollowUps,
    lastReply,
    setLastReply,
    activeAssessment,
    setActiveAssessment,
    localThinking,
    setLocalThinking,
    thinkingLabel,
    setThinkingLabel,
    lightboxUrl,
    setLightboxUrl,
    attachments,
    setAttachments,
    variants,
    setVariants,
    activeArtifact,
    setActiveArtifact,
    thinkingElapsed,
    setThinkingElapsed,
    showJumpToBottom,
    setShowJumpToBottom,
    selectedModel,
    setSelectedModel,
    messages,
    setMessages,
    sessionId,
    sessions,
    setSessions,
    persona,
    setPersona,
    backendHistory,
    loadBackendHistory,
    createNewChat,
    clearChat
  };
}
