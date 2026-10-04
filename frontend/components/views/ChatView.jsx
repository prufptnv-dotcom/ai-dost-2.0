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

  return (
    <div className="h-full flex flex-row overflow-hidden bg-canvas-base relative">
      {/* LEFT PANE: Chat Interface */}
      <div className={`relative flex flex-col h-full overflow-hidden transition-all duration-500 ease-in-out ${activeArtifact ? 'flex-1 max-w-2xl' : 'flex-1 max-w-4xl mx-auto'}`}>
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

      {/* RIGHT PANE: Artifacts Workspace */}
      <AnimatePresence>
        {activeArtifact && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="h-full border-l border-slate-800 bg-slate-950 overflow-hidden"
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

