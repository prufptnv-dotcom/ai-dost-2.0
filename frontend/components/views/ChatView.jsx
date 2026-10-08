import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { ImageLightbox } from './ImageLightbox';
import ChatArtifactsCanvas from '../chat/ChatArtifactsCanvas';
import { AiDostMark } from '../brand/AiDostMark';
import SmartChatHeader from '../chat/SmartChatHeader';
import ChatMessageList from '../chat/ChatMessageList';
import ChatMessageBubble from '../chat/ChatMessageBubble';
import ThinkingDot from '../chat/ThinkingDot';
import { extractArtifact, stripInternalTags } from '../../utils/chatContent';
import { AssessmentRunner } from '../assessment/AssessmentRunner';
import { getFuturistic2030Html, getThreeJsSolarSystemHtml } from '../../lib/threeJsTemplates';
import ChatComposerDock from '../chat/ChatComposerDock';
import { streamChatResponse } from '../../hooks/useChatStream';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ai_dost_messages_chat';
const SESSIONS_KEY = 'ai_dost_chat_sessions';
const PERSONA_KEY = 'ai_dost_persona';
const getMsgKey = (id) => (id === 'default' ? STORAGE_KEY : `ai_dost_messages_${id}`);

const DOC_KEYWORDS = [
  { type: 'pdf', re: /pdf\b|pdf notes|syllabus|research paper|lab assignment|curriculum/i },
  { type: 'pptx', re: /ppt[a-z]*|powerpoint|presentation|slides?|pitch deck/i },
  { type: 'xlsx', re: /xlsx|excel\b|spreadsheet/i },
  { type: 'csv', re: /csv\b/i },
  { type: 'docx', re: /\bdocx?\b|\bdoct\b|word ?file|word ?document|document|report|resume|cv\b|cover letter|proposal|technical design|tdd|readme|api doc|meeting notes|mom\b|professional letter/i },
];

const NAV_INTENTS = [
  { re: /\b(preview|live preview)\b.*\b(kholo|dikhao|dikha|open|show|run|chalao|start|de do|do)\b|\b(open|show|kholo|dikhao|dikha|run|chalao|start)\b.*\b(preview|live preview)\b|^preview$/i, view: 'copilot', label: 'Live Preview', mode: 'preview' },
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
  /\b(endless highway|cyberpunk highway|dark road|procedural highway|cyberpunk car|hovercar|supercar|dna|double helix|chromosome|cyberpunk city|neo tokyo|metropolis|polyhedron|tesseract|icosahedron|particle system|stardust|solar system|solar-system|celestial simulation|gravity simulation|n-body simulation|fluid simulation|sorting visualizer|neural network 3d|earth 3d|3d earth globe|periodic table 3d|kinetic typography|kinetic text|space ship game)\b/i;


const MODEL_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'vkp-omni', label: 'VKP-Omni-2B (Custom Trained)' },
  { id: 'groq', label: 'Groq' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'opencode', label: 'OpenCode (Free Gateway)' },
  { id: 'nvidia', label: 'NVIDIA' },
  { id: 'together', label: 'Together' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'ollama', label: 'Ollama (Local)' },

  // OpenRouter Free Models
  { id: 'openrouter', label: '🪐 OpenRouter (Auto Best Free)', group: 'OpenRouter Free Models' },

  // 1. General Reasoning & Heavy Tasks
  { id: 'openrouter:nemotron_3_super', label: 'Nemotron 3 Super (120B)', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:nemotron_3_ultra', label: 'Nemotron 3 Ultra (550B)', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:nemotron_3_lightning', label: 'Nemotron 3.5 Lightning', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:inkling', label: 'Inkling (Agentic)', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:inkling_small', label: 'Inkling Small', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:dots_3_note', label: 'Dots 3 Note Preview', group: 'OpenRouter · Reasoning' },
  { id: 'openrouter:lfm_reasoning', label: 'Liquid LFM 2.5 (Reasoning)', group: 'OpenRouter · Reasoning' },

  // 2. Coding & Developer Agents
  { id: 'openrouter:north_mini_code', label: 'Cohere North Mini Code', group: 'OpenRouter · Coding' },
  { id: 'openrouter:laguna_s', label: 'Poolside Laguna-S 2.1', group: 'OpenRouter · Coding' },
  { id: 'openrouter:laguna_xs', label: 'Poolside Laguna-XS 2.1', group: 'OpenRouter · Coding' },

  // 3. Multimodal & Vision
  { id: 'openrouter:gemma_26b', label: 'Google Gemma 4 (26B)', group: 'OpenRouter · Multimodal' },
  { id: 'openrouter:gemma_31b', label: 'Google Gemma 4 (31B)', group: 'OpenRouter · Multimodal' },
  { id: 'openrouter:qwen_38', label: 'Qwen 3.8 (27B)', group: 'OpenRouter · Multimodal' },
  { id: 'openrouter:nemotron_nano_omni', label: 'Nemotron Nano Omni (30B)', group: 'OpenRouter · Multimodal' },
  { id: 'openrouter:nemotron_rerank_vl', label: 'Nemotron Rerank VL', group: 'OpenRouter · Multimodal' },
  { id: 'openrouter:nemotron_embed_vl', label: 'Nemotron Embed VL', group: 'OpenRouter · Multimodal' },

  // 4. Specialized & Niche Tasks
  { id: 'openrouter:ling_sante', label: 'Ling 3.0 Santé (Medical)', group: 'OpenRouter · Specialized' },
  { id: 'openrouter:apodex_mini', label: 'Apodex 1.1 Mini (Research)', group: 'OpenRouter · Specialized' },
  { id: 'openrouter:mercury_decide', label: 'Mercury Decide', group: 'OpenRouter · Specialized' },
  { id: 'openrouter:content_safety', label: 'Nemotron Content Safety', group: 'OpenRouter · Specialized' },
  { id: 'openrouter:nemotron_embed', label: 'Nemotron Embed 1B', group: 'OpenRouter · Specialized' },
];

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: 'Namaste! Main AI-Dost hoon. Aap kya karna chahte hain aaj?',
  timestamp: new Date().toISOString(),
};

// ─── ChatView ────────────────────────────────────────────────────────────────

import { useChatView } from '../../hooks/useChatView';

export default function ChatView({
  model = 'auto', initialPrompt = '', thinking: thinkingProp, setIsThinking: setIsThinkingProp, onOpenResumeWithData, onOpenVoice, onNewChatSignal, onNavigate, onModelChange
}) {
  const {
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
  } = useChatView({ model, initialPrompt, thinking: thinkingProp, setIsThinking: setIsThinkingProp, onOpenResumeWithData, onOpenVoice, onNewChatSignal, onNavigate, onModelChange });

  const isWriting = displayMessages.some((m) => m.isStreaming && m.content);

  // ─── Draggable artifact split (Claude/Cursor-style resizable divider) ───
  const SPLIT_KEY = 'ai_dost_chat_split_pct';
  const splitContainerRef = useRef(null);
  const draggingRef = useRef(false);
  const [splitPct, setSplitPct] = useState(52);

  useEffect(() => {
    try {
      const v = parseInt(window.localStorage.getItem(SPLIT_KEY), 10);
      if (Number.isFinite(v) && v >= 30 && v <= 75) setSplitPct(v);
    } catch (_) { /* ignore */ }
  }, []);

  const commitSplit = (pct) => {
    const clamped = Math.min(75, Math.max(30, Math.round(pct)));
    setSplitPct(clamped);
    try { window.localStorage.setItem(SPLIT_KEY, String(clamped)); } catch (_) { /* ignore */ }
  };

  const handleSplitPointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleSplitPointerMove = (e) => {
    if (!draggingRef.current) return;
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((rect.right - e.clientX) / rect.width) * 100;
    setSplitPct(Math.min(75, Math.max(30, pct)));
  };

  const handleSplitPointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) commitSplit(((rect.right - e.clientX) / rect.width) * 100);
  };

  const handleSplitKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); commitSplit(splitPct + 4); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); commitSplit(splitPct - 4); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commitSplit(52); }
  };

  return (
    <div ref={splitContainerRef} className="h-full flex flex-row overflow-hidden bg-canvas-base relative">
      {/* LEFT PANE: Chat Interface */}
      <div className={`relative flex flex-col h-full overflow-hidden transition-all duration-500 ease-in-out ${activeArtifact ? 'flex-1 min-w-0' : 'flex-1 max-w-4xl mx-auto'}`}>
        <SmartChatHeader
          sessionName={currentSessionName}
          sessions={sessions}
          sessionId={sessionId}
          onNewSession={createSession}
          onSwitchSession={switchSession}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
        />

        <ChatMessageList
          scrollRef={scrollRef}
          messagesEndRef={messagesEndRef}
          onScroll={handleScroll}
          displayMessages={displayMessages}
          isEmpty={isEmpty}
          thinking={thinking && !isWriting}
          thinkingLabel={thinkingLabel}
          thinkingElapsed={thinkingElapsed}
          variants={variants}
          applyVariant={applyVariant}
          backendHistory={backendHistory}
          loadBackendHistory={loadBackendHistory}
          onSelectPrompt={(p) => sendMessage(p)}
          handleRegenerate={handleRegenerate}
          setLightboxUrl={(url) => setLightboxUrl(url)}
          loadVariants={loadVariants}
          onNavigate={onNavigate}
          setActiveArtifact={setActiveArtifact}
          handleEditMessage={handleEditMessage}
          setActiveAssessment={(asmt) => setActiveAssessment(asmt)}
          showJumpToBottom={showJumpToBottom}
          scrollToBottom={scrollToBottom}
        />

        <ChatComposerDock
          input={input}
          setInput={setInput}
          attachments={attachments}
          setAttachments={setAttachments}
          thinking={thinking}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          modelOptions={MODEL_OPTIONS}
          onSend={() => sendMessage()}
          onStop={stopStreaming}
          stopActive={thinking && displayMessages.some((m) => m.isStreaming)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFileSelect={handleFileSelect}
          fileInputRef={fileInputRef}
          inputRef={inputRef}
          onOpenVoice={onOpenVoice}
        />
      </div>

      {/* Draggable split divider */}
      {activeArtifact && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat and artifact panes"
          aria-valuenow={Math.round(splitPct)}
          aria-valuemin={30}
          aria-valuemax={75}
          tabIndex={0}
          onPointerDown={handleSplitPointerDown}
          onPointerMove={handleSplitPointerMove}
          onPointerUp={handleSplitPointerUp}
          onPointerCancel={() => { draggingRef.current = false; }}
          onDoubleClick={() => commitSplit(52)}
          onKeyDown={handleSplitKeyDown}
          className="group relative w-[6px] shrink-0 cursor-col-resize bg-canvas-base focus:outline-none touch-none"
          title="Drag to resize · Double-click to reset"
          data-testid="split-divider"
        >
          <span className="absolute inset-y-0 left-0 right-0 m-auto w-px bg-border-default transition-colors duration-150 group-hover:bg-accent group-focus-visible:bg-accent" />
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* RIGHT PANE: Artifacts Workspace */}
      <AnimatePresence>
        {activeArtifact && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${splitPct}%`, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 120 }}
            className="h-full bg-canvas-subtle overflow-hidden"
          >
            <ChatArtifactsCanvas 
              artifact={activeArtifact} 
              onClose={() => setActiveArtifact(null)} 
              onOpenInCopilot={handleOpenArtifactInCopilot} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {activeAssessment && (
        <AssessmentRunner
          assessment={activeAssessment}
          onClose={() => setActiveAssessment(null)}
          onComplete={(res) => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: `Assessment complete! Score: ${res.netScore}/${res.totalMarks} (${res.percentage}%)` } }));
            }
          }}
        />
      )}
    </div>
  );
}

