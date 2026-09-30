import { CompanionLibraryOverlay } from './ui/CompanionLibraryOverlay';
import { CompanionHistoryOverlay } from './ui/CompanionHistoryOverlay';
import { CompanionFeedbackModal } from './ui/CompanionFeedbackModal';
import { CompanionMessageList } from './ui/CompanionMessageList';
import { CompanionInputArea } from './ui/CompanionInputArea';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { logger } from '../utils/logger';
import api, { API_HOST } from '../services/api';
import { Mic, MicOff, Volume2, VolumeX, Bot, Phone, Paperclip, Send, Library, Zap, CheckCircle, ImageIcon, FileText, X, ChevronLeft, Loader2, Play, Square, History, Trash2, MessageSquare, Sparkles, Image as ImageIconLucide, Plus, Copy, ThumbsUp, ThumbsDown, Maximize2, Minimize2, MoveHorizontal } from 'lucide-react';
import { ChatClassicMessageBubble as MessageBubble } from './chat/ChatClassicMessageBubble';

import AIPageView from "./views/AIPageView";
import AIAssistantModal from "./ui/AIAssistantModal";
import { useAICompanionChat } from '../hooks/useAICompanionChat';

const AICompanion = ({ onWriteCode, currentCode, currentFile }) => {
  const {
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
  } = useAICompanionChat({ onWriteCode, currentCode, currentFile });

  const { showToast } = useToast();

  return (
    <div 
      ref={containerRef}
      style={{ width: mode === 'chat' && customPixelWidth ? `${customPixelWidth}px` : undefined }}
      className={`h-full flex flex-col bg-bg-default/40 backdrop-blur-xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden relative animate-fadeIn animate-pulseGlow transition-all duration-200 group/container ${
        mode === 'project'
          ? 'w-full max-w-full'
          : customPixelWidth
            ? 'max-w-none'
            : widthMode === 'normal'
              ? 'max-w-4xl mx-auto w-full'
              : widthMode === 'wide'
                ? 'max-w-6xl mx-auto w-full'
                : 'max-w-none w-full'
      }`}
    >
      {/* Screen Reader ARIA Live Region for Chat Status */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only" 
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {isGeneratingImage ? "AI is generating an image..." : isThinking ? "AI is thinking..." : isTyping ? "AI is typing..." : ""}
      </div>

      {/* Show Resizer Handles ONLY in General Chat Mode */}
      {mode === 'chat' && (
        <>
          {/* Left Border Mouse Drag Resizer Handle (Double-Click to Activate ↔) */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none select-none">
            <div
              onDoubleClick={(e) => handleHandleDoubleClick(e, 'left')}
              className={`w-2.5 h-14 rounded-r-xl cursor-ew-resize pointer-events-auto transition-all flex items-center justify-center border-y border-r border-primary/30 shadow-md ${
                isDragActive ? 'bg-primary text-bg-default shadow-[0_0_15px_var(--color-primary-glow)] scale-110' : 'bg-bg-card/80 backdrop-blur-md hover:bg-primary/30 text-primary'
              }`}
              title="Double-Click & Drag Mouse Left/Right to Adjust Chat Width (↔)"
            >
              <div className="w-1 h-6 rounded-full bg-primary"></div>
            </div>
          </div>

          {/* Right Border Mouse Drag Resizer Handle (Double-Click to Activate ↔) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none select-none">
            <div
              onDoubleClick={(e) => handleHandleDoubleClick(e, 'right')}
              className={`w-2.5 h-14 rounded-l-xl cursor-ew-resize pointer-events-auto transition-all flex items-center justify-center border-y border-l border-primary/30 shadow-md ${
                isDragActive ? 'bg-primary text-bg-default shadow-[0_0_15px_var(--color-primary-glow)] scale-110' : 'bg-bg-card/80 backdrop-blur-md hover:bg-primary/30 text-primary'
              }`}
              title="Double-Click & Drag Mouse Left/Right to Adjust Chat Width (↔)"
            >
              <div className="w-1 h-6 rounded-full bg-primary"></div>
            </div>
          </div>
        </>
      )}
      {/* Fullscreen Document Page View */}
      {activePage && (
        <AIPageView 
          page={activePage} 
          onClose={() => setActivePage(null)} 
        />
      )}

      {isVoiceCallActive && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-8 text-center text-text-primary select-none animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col items-center gap-1 mt-4">
            <div className="text-xs text-text-secondary tracking-widest font-bold uppercase">AI-Dost Voice Room</div>
            <div className="text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full flex items-center gap-1.5 font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {voiceCallStatus}
            </div>
          </div>

          {/* Dynamic Waveform Visualizer */}
          <div className="flex items-center justify-center relative w-48 h-48 my-auto">
            {voiceCallStatus === 'Listening...' && (
              <>
                <div className="absolute w-44 h-44 rounded-full bg-primary/5 border border-primary/10 animate-ping" />
                <div className="absolute w-36 h-36 rounded-full bg-primary/10 border border-primary/20 animate-pulse duration-1000" />
              </>
            )}
            {voiceCallStatus === 'Thinking...' && (
              <div className="absolute w-36 h-36 rounded-full border border-dashed border-warning/40 animate-spin duration-3000" />
            )}
            {voiceCallStatus === 'Speaking...' && (
              <>
                <div className="absolute w-40 h-40 rounded-full bg-success/5 border border-success/15 animate-ping duration-1500" />
                <div className="absolute w-32 h-32 rounded-full bg-success/10 border border-success/30 animate-pulse" />
              </>
            )}
            
            {/* Center Circle */}
            <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border ${
              voiceCallStatus === 'Listening...' ? 'bg-primary/20 border-primary text-primary shadow-primary/20' :
              voiceCallStatus === 'Thinking...' ? 'bg-warning/20 border-warning text-warning shadow-warning/20' :
              voiceCallStatus === 'Speaking...' ? 'bg-success/20 border-success text-success shadow-success/20' :
              'bg-white/5 border-white/10 text-text-secondary'
            }`}>
              <span className="text-4xl">
                {voiceCallStatus === 'Listening...' ? '🎙️' :
                 voiceCallStatus === 'Thinking...' ? '🧠' :
                 voiceCallStatus === 'Speaking...' ? '🗣️' :
                 '📞'}
              </span>
            </div>
          </div>

          {/* Transcript Display Bubble */}
          <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] p-4 rounded-2xl min-h-[90px] flex items-center justify-center mb-6 select-text">
            <p className="text-xs italic text-text-secondary leading-relaxed max-h-[80px] overflow-y-auto w-full select-text">
              {voiceCallText || 'Speak now... AI-Dost is listening.'}
            </p>
          </div>

          {/* Footer Actions */}
          <button
            onClick={handleToggleVoiceCall}
            className="w-14 h-14 bg-danger hover:bg-danger/80 text-bg-default rounded-full flex items-center justify-center shadow-xl shadow-danger/20 transition-transform active:scale-95 cursor-pointer text-xl shrink-0"
            title="End Voice Call"
          >
            <span>🛑</span>
          </button>
        </div>
      )}

      {assistantTab && (
        <AIAssistantModal 
          activeTab={assistantTab}
          onClose={() => setAssistantTab(null)}
          onSubmit={(prompt) => {
            setInput(prompt);
            showToast({ type: 'success', message: 'Prompt ready! Click send to query AI-Dost.' });
          }}
        />
      )}

      <CompanionLibraryOverlay showLibrary={showLibrary} setShowLibrary={setShowLibrary} uploadedDocs={uploadedDocs} setUploadedDocs={setUploadedDocs} showToast={showToast} viewingDoc={viewingDoc} setViewingDoc={setViewingDoc} />
      
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border shrink-0 gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.jpg"
            alt="AI-Dost Logo"
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg object-cover border border-primary/30 shadow-[0_0_10px_var(--color-primary-glow)] shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-text-primary leading-none tracking-tight gradient-text">Ai-Dost</h1>
            {currentFile && (
              <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                <FileText className="w-2.5 h-2.5 text-primary" />{currentFile}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
          <select 
            suppressHydrationWarning
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-bg-hover text-text-secondary border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer shrink-0"
          >
            <option value="auto">Auto Model</option>
            <option value="groq">Groq · Llama 3</option>
            <option value="gemini">Gemini Flash</option>
            <option value="deepseek">DeepSeek V3</option>
            <option value="nvidia">NVIDIA NIM</option>
            <option value="openrouter">OpenRouter</option>
            {localModels.length > 0 && (
              <optgroup label="Local (Ollama)">
                {localModels.map(m => (
                  <option 
                    key={m.id} 
                    value={m.id}
                    disabled={!m.isCompatible}
                  >
                    {m.name} ({m.size}{!m.isCompatible ? ' — needs >6GB VRAM' : ''})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          
          {/* New Chat Button */}
          <button
            onClick={handleClearCurrentHistory}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/20 border border-primary/40 hover:bg-primary hover:text-bg-default text-primary text-xs font-bold transition cursor-pointer shrink-0"
            title="Start New Chat (Clears current session messages)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+New</span>
          </button>

          {/* History Drawer Trigger Button */}
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-hover border border-border hover:border-primary/40 text-text-secondary hover:text-primary text-xs font-medium transition cursor-pointer shrink-0"
            title="Open Chat History Drawer"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          {/* Delete Current Session Quick Trash Button */}
          <button
            onClick={handleClearCurrentHistory}
            className="p-1.5 rounded-lg bg-bg-hover border border-border hover:border-danger/40 text-text-muted hover:text-danger transition cursor-pointer shrink-0"
            title="Delete/Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-bg-hover border border-border hover:border-primary/40 text-text-secondary hover:text-primary text-xs font-medium transition cursor-pointer shrink-0"
            title="Document Library"
          >
            <Library className="w-3.5 h-3.5" />
            <span>Docs</span>
            {uploadedDocs.length > 0 && (
              <span className="bg-primary text-bg-default text-[9px] px-1.5 py-0.5 rounded-full font-bold">{uploadedDocs.length}</span>
            )}
          </button>

          {/* Double-Sided Arrow Width Adjuster Button (Chat Mode Only) */}
          {mode === 'chat' && (
            <button
              onClick={cycleWidthMode}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary text-xs font-bold transition cursor-pointer shrink-0 shadow-[0_0_10px_var(--color-primary-glow)]"
              title={`Adjust Chat Card Width: Current [${widthMode.toUpperCase()}] — Click to toggle (↔)`}
            >
              {widthMode === 'full' ? (
                <Minimize2 className="w-3.5 h-3.5 text-primary" />
              ) : widthMode === 'wide' ? (
                <MoveHorizontal className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="text-[10px] uppercase tracking-wider font-extrabold">{widthMode} ↔</span>
            </button>
          )}

          <span className="flex items-center gap-1 text-[10px] text-success font-semibold shrink-0 ml-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>Online
          </span>
        </div>
      </div>

      {/* Chat History Panel Drawer Overlay */}
      <CompanionHistoryOverlay showHistory={showHistory} setShowHistory={setShowHistory} mode={mode} handleClearCurrentHistory={handleClearCurrentHistory} messages={messages} setMessages={setMessages} showToast={showToast} />

      <CompanionMessageList messages={messages} playingMessageId={playingMessageId} speakText={speakText} handleFeedbackSignal={handleFeedbackSignal} showToast={showToast} onWriteCode={onWriteCode} setActivePage={setActivePage} isProSearch={isProSearch} proSearchStages={proSearchStages} isTyping={isTyping} isThinking={isThinking} isGeneratingImage={isGeneratingImage} bottomRef={bottomRef} ThinkingIndicator={ThinkingIndicator} ThinkingPulse={ThinkingPulse} />

      <CompanionInputArea attachedFile={attachedFile} setAttachedFile={setAttachedFile} mode={mode} setInput={setInput} input={input} copilotMode={copilotMode} setCopilotMode={setCopilotMode} speakOutput={speakOutput} setSpeakOutput={setSpeakOutput} isListening={isListening} toggleListening={toggleListening} isVoiceCallActive={isVoiceCallActive} handleToggleVoiceCall={handleToggleVoiceCall} fileInputRef={fileInputRef} handleFileChange={handleFileChange} setIsProSearch={setIsProSearch} isProSearch={isProSearch} handleSend={handleSend} handlePaste={handlePaste} isTyping={isTyping} />

      {/* Interactive Thumbs Down Feedback Modal */}
      <CompanionFeedbackModal showFeedbackModal={showFeedbackModal} setShowFeedbackModal={setShowFeedbackModal} feedbackCategory={feedbackCategory} setFeedbackCategory={setFeedbackCategory} correctionText={correctionText} setCorrectionText={setCorrectionText} handleSubmitFeedback={handleSubmitFeedback} />
    </div>
  );
};

// Thinking Indicator Component
const ThinkingIndicator = ({ isThinking, isGeneratingImage }) => {
  if (!isThinking && !isGeneratingImage) return null;

  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 bg-bg-card border border-border text-text-secondary px-3 py-2.5 rounded-xl text-xs">
        {isGeneratingImage ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Generating image...</span>
          </>
        ) : isThinking && (
          <>
            <ThinkingPulse className="w-3.5 h-3.5 me-2" />
            <span>Deep analysing...</span>
          </>
        )}
      </div>
    </div>
  );
};

// Thinking Pulse SVG Component
const ThinkingPulse = () => (
  <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

ThinkingPulse.displayName = 'ThinkingPulse';

export default AICompanion;

