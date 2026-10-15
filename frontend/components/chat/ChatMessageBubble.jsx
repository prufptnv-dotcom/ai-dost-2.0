import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import AppIcon from '../ui/AppIcon';
import api from '../../services/api';
import { getPendingSuggestions } from '../../utils/visualHealer';
import { ImageCard } from '../views/ImageLightbox';
import { AiDostMark } from '../brand/AiDostMark';
import { AssessmentCard } from '../assessment/AssessmentCard';
import { extractImages, extractArtifact } from '../../utils/chatContent';
import ParsedMarkdown from './ParsedMarkdown';
import FeedbackModal from './FeedbackModal';
import ThoughtProcessDrawer from './ThoughtProcessDrawer';
import ResearchProgressIndicator from './ResearchProgressIndicator';
import ToolExecutionCard from './ToolExecutionCard';
import Image from 'next/image';

function ChatMessageBubble({
  msg,
  onOpenImage,
  onRegenerate,
  onEdit,
  isLast,
  onVariants,
  onNavigate,
  onOpenArtifact,
  onStartAssessment,
}) {
  const [visualSuggestions, setVisualSuggestions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackModalType, setFeedbackModalType] = useState('negative');
  const audioRef = useRef(null);
  const isUser = msg.role === 'user';
  const isStreaming = !!msg.isStreaming;
  const images = useMemo(() => (isUser ? [] : extractImages(msg.content)), [isUser, msg.content]);
  const detectedArtifact = useMemo(() => (!isUser && !isStreaming ? extractArtifact(msg.content) : null), [isUser, isStreaming, msg.content]);

  useEffect(() => {
    if (!isUser && !isStreaming && detectedArtifact) {
      // Auto-open the artifact panel when the AI finishes generating the file
      onOpenArtifact && onOpenArtifact(detectedArtifact);
    }
  }, [isStreaming, detectedArtifact, isUser, onOpenArtifact]);

  const copyTimeoutRef = useRef(null);
  // P3 #124: clear the copied-reset timer on unmount (setState after unmount)
  useEffect(() => () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); }, []);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  const speak = async () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const text = msg.content.replace(/[*#`>\[\]]/g, '').slice(0, 1500);
    if (!text.trim()) return;
    setSpeaking(true);
    try {
      const ttsRes = await fetch(`${api.defaults.baseURL}/agent/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'en-IN-PrabhatNeural' }),
      });
      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); audioRef.current = null; URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); audioRef.current = null; URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch (_) {}
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch (_) {
      setSpeaking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 shrink-0 mt-0.5 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center select-none shadow-xs">
          <AiDostMark size={16} />
        </div>
      )}

      <div className={`flex flex-col min-w-0 ${isUser ? 'items-end max-w-[80%] ml-auto' : 'items-start w-full max-w-2xl'}`}>
        <div
          className={`${isUser ? 'chat-user-message' : 'text-sm leading-relaxed text-paper-100 w-full'}`}
          style={isUser ? { color: 'var(--chat-user-color, var(--paper-100, #0f172a))' } : undefined}
        >
          {!isUser && (msg.thought || msg.isThinkingTrace) && (
            <ThoughtProcessDrawer
              thought={msg.thought}
              isThinking={msg.isThinkingTrace}
              elapsed={msg.thoughtElapsed || 0}
            />
          )}

          {/* 3. Research Progress Indicator */}
          {!isUser && (msg.isSearching || (msg.sources && msg.sources.length > 0)) && (
            <ResearchProgressIndicator
              query={msg.searchQuery || ''}
              sources={msg.sources || []}
              isSearching={!!msg.isSearching}
              status={msg.searchStatus || ''}
              totalResults={msg.totalSources || (msg.sources ? msg.sources.length : 0)}
            />
          )}

          {/* 4. Tool Calling Animation */}
          {!isUser && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
            <div className="w-full my-2 space-y-2" data-testid="tool-calls-container">
              {msg.toolCalls.map((tc, idx) => (
                <ToolExecutionCard
                  key={idx}
                  tool={tc.tool || tc.name || 'tool_call'}
                  target={tc.target || tc.args?.target || tc.args?.path || tc.args?.query}
                  status={tc.status || 'success'}
                  duration={tc.duration}
                  output={tc.output || tc.result}
                />
              ))}
            </div>
          )}

          {!isUser && msg.toolExecution && (
            <div className="w-full my-2">
              <ToolExecutionCard
                tool={msg.toolExecution.tool || 'tool_call'}
                target={msg.toolExecution.target}
                status={msg.toolExecution.status || 'success'}
                duration={msg.toolExecution.duration}
                output={msg.toolExecution.output}
              />
            </div>
          )}

          {!isUser && Array.isArray(msg.agentPlan) && msg.agentPlan.length > 0 && (
            <div className="mb-2 rounded-lg border border-border bg-canvas-elevated/60 px-2.5 py-2" data-testid="bubble-plan">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                <AppIcon name="clipboard" className="w-3 h-3" /> Plan
              </div>
              <ol className="space-y-1">
                {msg.agentPlan.slice(0, 8).map((task, idx) => {
                  const status = String(task?.status || '').toLowerCase();
                  const done = ['done', 'completed', 'success'].includes(status);
                  const active = status === 'in_progress' || status === 'running';
                  const title = String(task?.title || task?.label || task?.action || '').trim() || `Step ${idx + 1}`;
                  return (
                    <li key={task?.id || idx} className="flex items-center gap-1.5 text-[11px] text-paper-200">
                      {done ? (
                        <AppIcon name="check" className="w-3 h-3 shrink-0 text-emerald-400" data-testid="bubble-plan-done" />
                      ) : active ? (
                        <AppIcon name="loader" className="w-3 h-3 shrink-0 text-accent" data-testid="bubble-plan-active" />
                      ) : (
                        <span className="w-3 shrink-0 text-center text-[9px] text-ink-muted">{idx + 1}</span>
                      )}
                      <span className={`truncate ${done ? 'text-ink-muted line-through' : ''}`} title={title}>{title}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {isStreaming && (!msg.content || msg.content.length === 0) ? (
            !msg.isThinkingTrace && (
              <div className="flex items-center gap-2 py-1 text-xs text-ink-muted select-none" data-testid="streaming-status-indicator">
                <span className="inline-block w-2.5 h-4 bg-gradient-to-b from-accent to-accent/60 animate-pulse align-middle rounded-xs shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                <span className="font-mono text-[11px] text-accent animate-pulse">Generating response…</span>
              </div>
            )
          ) : (
            <>
              {isUser ? (
                <div className="whitespace-pre-wrap select-text" style={{ color: 'inherit' }}>
                  {msg.content}
                </div>
              ) : (
                <ParsedMarkdown
                  content={msg.content}
                  isStreaming={isStreaming}
                  onNavigate={onNavigate}
                  onPreviewArtifact={onOpenArtifact}
                  detectedArtifact={detectedArtifact}
                />
              )}
              {isStreaming && (
                <>
                  <span
                    className="inline-block w-2.5 h-4 ml-1 bg-gradient-to-b from-accent to-accent/60 animate-pulse align-middle rounded-xs shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                    data-testid="streaming-cursor"
                  />
                  <div
                    className="mt-2.5 flex items-center gap-2 text-[11px] font-mono text-accent bg-accent/[0.07] border border-accent/15 px-2.5 py-1 rounded-lg w-fit animate-pulse select-none"
                    data-testid="streaming-status-indicator"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    <span>Streaming response…</span>
                    <span className="text-ink-muted/60">·</span>
                    <span className="text-ink-muted text-[10px]">Live token delivery</span>
                  </div>
                </>
              )}
            </>
          )}


          {detectedArtifact && (
            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-3 w-fit rounded-xl bg-canvas-surface/60 border border-border-subtle px-3 py-2">
              <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                <AppIcon name="layout" className="w-3.5 h-3.5 text-accent shrink-0" />
              </div>
              <span className="text-xs text-paper-200 flex-1 font-medium">Interactive canvas ready</span>
              <button
                onClick={() => onOpenArtifact && onOpenArtifact(detectedArtifact)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover shadow-xs transition-all duration-150 cursor-pointer"
              >
                <AppIcon name="eye" className="w-3.5 h-3.5" />
                Open canvas
              </button>
            </div>
          )}

          {msg.navView && (
            <div className="mt-3 pt-2.5 border-t border-border-subtle w-fit">
              <button
                onClick={() => {
                  if (msg.navLabel && msg.navLabel.includes('Preview')) {
                    try { sessionStorage.setItem('ai_dost_copilot_mode_override', 'preview'); } catch (_) {}
                  }
                  onNavigate && onNavigate(msg.navView);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas-elevated border border-border text-paper-200 hover:bg-canvas-overlay transition-fast cursor-pointer"
              >
                {msg.navLabel || msg.navView}
                <AppIcon name="arrowRight" className="w-3 h-3" />
              </button>
            </div>
          )}

          {msg.imageAttachment && (
            <div className="mt-2.5 rounded-xl overflow-hidden border border-border max-w-xs shadow-sm bg-black/40">
              <Image
                src={msg.imageAttachment.startsWith('data:') ? msg.imageAttachment : `data:${msg.imageMime || 'image/png'};base64,${msg.imageAttachment}`}
                alt="Attached reference"
                width={400}
                height={300}
                className="max-h-52 w-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => onOpenImage && onOpenImage(msg.imageAttachment.startsWith('data:') ? msg.imageAttachment : `data:${msg.imageMime || 'image/png'};base64,${msg.imageAttachment}`)}
              />
            </div>
          )}

          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.attachments.map((n, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-canvas-elevated border border-border text-ink-muted">
                  <AppIcon name="paperclip" className="w-2.5 h-2.5" /> {n}
                </span>
              ))}
            </div>
          )}

          {msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border-subtle">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-paper-200">
                <AppIcon name="globe" className="w-3.5 h-3.5 text-accent" />
                <span>Web Sources ({msg.sources.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {msg.sources.map((s, i) => {
                  let domain = '';
                  try { domain = new URL(s.url).hostname; } catch (_) {}
                  return (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 max-w-[240px] truncate bg-canvas-surface border border-border text-paper-200 hover:text-paper-100 hover:border-accent/40 hover:bg-canvas-elevated transition-fast shadow-xs cursor-pointer"
                      title={s.title || domain}
                    >
                      <span className="font-mono text-accent text-[10px] font-semibold">[{s.citationId || i + 1}]</span>
                      <span className="truncate">{s.title || domain}</span>
                      <AppIcon name="external" className="w-2.5 h-2.5 shrink-0 opacity-60 ml-0.5" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {msg.assessment && <AssessmentCard assessment={msg.assessment} onStart={onStartAssessment} />}

          {!isStreaming && images.length > 0 && (
            <div className={`grid gap-2 mt-3 w-fit ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ minWidth: 200 }}>
              {images.map((img, idx) => (
                <ImageCard key={idx} src={img.url} alt={img.alt} index={idx} onOpen={onOpenImage} />
              ))}
            </div>
          )}
        </div>

        {!isUser && !isStreaming && msg.meta && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-none text-ink-muted/80 font-mono select-none" title="Response transparency — kaunsa model, kitni der">
            <span className="inline-block w-1 h-1 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            <span className="text-accent/90">{msg.meta.provider || 'AI-Dost'}</span>
            {typeof msg.meta.totalMs === 'number' && msg.meta.totalMs > 0 && (
              <span>· {(msg.meta.totalMs / 1000).toFixed(1)}s</span>
            )}
            {typeof msg.meta.ttfbMs === 'number' && msg.meta.ttfbMs > 0 && (
              <span title="Time to first token">· 1st token {(msg.meta.ttfbMs / 1000).toFixed(1)}s</span>
            )}
            {msg.meta.stopped && <span className="text-amber-400/90">· stopped by you</span>}
          </div>
        )}

        {!isUser && !isStreaming && (
          <div className="chat-response-actions" role="toolbar" aria-label="Message actions">
            <button type="button" onClick={copyText} aria-label={copied ? 'Copied to clipboard' : 'Copy response'} title={copied ? 'Copied!' : 'Copy'} className={`transition-colors ${copied ? 'text-accent' : ''}`}>
              {copied ? <AppIcon name="check" size={14} className="text-accent" /> : <AppIcon name="copy" size={14} />}
            </button>
            <button type="button" onClick={speak} aria-label={speaking ? 'Stop reading response' : 'Read response aloud'} title={speaking ? 'Stop reading' : 'Read aloud'} className={`transition-colors ${speaking ? 'text-accent' : ''}`}>
              {speaking ? <AppIcon name="square" size={12} className="fill-current text-accent" /> : <AppIcon name="volume" size={14} />}
            </button>
            {isLast && onRegenerate && (
              <button type="button" onClick={onRegenerate} aria-label="Try again" title="Try again" className="transition-colors hover:rotate-180 duration-300">
                <AppIcon name="refresh" size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFeedback('positive');
                setFeedbackModalType('positive');
                setShowFeedbackModal(true);
              }}
              aria-label="Good response"
              title="Give feedback / Good response"
              className={`transition-colors ${feedback === 'positive' ? 'text-accent' : ''}`}
            >
              <AppIcon name="thumbsUp" size={14} className={feedback === 'positive' ? 'fill-accent/20 text-accent' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback('negative');
                setFeedbackModalType('negative');
                setShowFeedbackModal(true);
              }}
              aria-label="Bad response / Suggest correction"
              title="Suggest correction / Teach AI"
              className={`transition-colors ${feedback === 'negative' ? 'text-red-400' : ''}`}
            >
              <AppIcon name="thumbsDown" size={14} className={feedback === 'negative' ? 'fill-red-500/20 text-red-400' : ''} />
            </button>
          </div>
        )}

        {isUser && !isStreaming && (
          <div className="chat-response-actions" style={{ marginTop: '4px' }}>
            <button type="button" onClick={() => onEdit && onEdit(msg)} title="Edit message" aria-label="Edit message" className="transition-colors hover:text-accent">
              <AppIcon name="pencil" size={13} />
            </button>
          </div>
        )}

        {showFeedbackModal && (
          <FeedbackModal
            isOpen={showFeedbackModal}
            onClose={() => setShowFeedbackModal(false)}
            initialType={feedbackModalType}
            messageContent={msg.content}
            onSuccess={(data) => {
              setFeedback(data.type);
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

function areMessagePropsEqual(prev, next) {
  if (prev.msg.id !== next.msg.id) return false;
  if (prev.msg.content !== next.msg.content) return false;
  if (Boolean(prev.msg.isStreaming) !== Boolean(next.msg.isStreaming)) return false;
  if (prev.msg.meta !== next.msg.meta) return false;
  if (prev.msg.agentPlan !== next.msg.agentPlan) return false;
  if (prev.isLast !== next.isLast) return false;
  if (prev.msg.imageAttachment !== next.msg.imageAttachment) return false;
  if (prev.msg.role !== next.msg.role) return false;
  return true;
}

export default memo(ChatMessageBubble, areMessagePropsEqual);
