/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  LayoutTemplate,
  Paperclip,
  Pencil,
  RefreshCw,
  Square,
  ThumbsDown,
  ThumbsUp,
  Volume2,
} from 'lucide-react';
import api from '../../services/api';
import { getPendingSuggestions } from '../../utils/visualHealer';
import { ImageCard } from '../views/ImageLightbox';
import { AiDostMark } from '../brand/AiDostMark';
import { AssessmentCard } from '../assessment/AssessmentCard';
import { extractImages, extractArtifact } from '../../utils/chatContent';
import ParsedMarkdown from './ParsedMarkdown';

export default function ChatMessageBubble({
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
  const audioRef = useRef(null);
  const isUser = msg.role === 'user';
  const isStreaming = !!msg.isStreaming;
  const images = isUser ? [] : extractImages(msg.content);
  const detectedArtifact = !isUser && !isStreaming ? extractArtifact(msg.content) : null;

  useEffect(() => {
    if (!isUser && !isStreaming) {
      const sugg = typeof getPendingSuggestions === 'function' ? getPendingSuggestions() : [];
      if (sugg && sugg.length) setVisualSuggestions(sugg);
    }
  }, [msg.id, isUser, isStreaming]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
        <div className="w-5 h-5 shrink-0 mt-0.5 opacity-70 select-none">
          <AiDostMark size={18} />
        </div>
      )}

      <div className={`flex flex-col min-w-0 ${isUser ? 'items-end max-w-[80%] ml-auto' : 'items-start w-full max-w-2xl'}`}>
        <div className={`${isUser ? 'chat-user-message' : 'text-sm leading-relaxed text-paper-100 w-full'}`}>
          {isStreaming && msg.content.length === 0 ? (
            <span className="inline-block w-2 h-4 bg-accent animate-pulse align-middle rounded-sm" />
          ) : (
            <>
              {isUser ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
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
                <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse align-middle rounded-sm" />
              )}
            </>
          )}

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

          {msg.imageAttachment && (
            <div className="mt-2.5 rounded-xl overflow-hidden border border-border max-w-xs shadow-sm bg-black/40">
              <img
                src={msg.imageAttachment.startsWith('data:') ? msg.imageAttachment : `data:${msg.imageMime || 'image/png'};base64,${msg.imageAttachment}`}
                alt="Attached reference"
                className="max-h-52 w-auto object-contain rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => onOpenImage && onOpenImage(msg.imageAttachment.startsWith('data:') ? msg.imageAttachment : `data:${msg.imageMime || 'image/png'};base64,${msg.imageAttachment}`)}
              />
            </div>
          )}

          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {msg.attachments.map((n, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-canvas-elevated border border-border text-ink-muted">
                  <Paperclip className="w-2.5 h-2.5" /> {n}
                </span>
              ))}
            </div>
          )}

          {msg.sources && msg.sources.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-3 pt-2.5 border-t border-border-subtle">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                <Globe className="w-3.5 h-3.5 text-accent" />
                <span>Web Sources ({msg.sources.length}):</span>
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
                      className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-[240px] truncate bg-canvas-elevated border border-border text-ink-muted hover:text-paper-100 hover:border-accent/40 transition-fast shadow-xs cursor-pointer"
                      title={s.title || domain}
                    >
                      <span className="font-mono text-accent text-[10px]">[{s.citationId || i + 1}]</span>
                      <span className="truncate">{s.title || domain}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60 ml-0.5" />
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

        {!isUser && !isStreaming && (
          <div className="chat-response-actions" role="toolbar" aria-label="Message actions">
            <button type="button" onClick={copyText} aria-label={copied ? 'Copied to clipboard' : 'Copy response'} title={copied ? 'Copied!' : 'Copy'} className={`transition-colors ${copied ? 'text-accent' : ''}`}>
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
            <button type="button" onClick={speak} aria-label={speaking ? 'Stop reading response' : 'Read response aloud'} title={speaking ? 'Stop reading' : 'Read aloud'} className={`transition-colors ${speaking ? 'text-accent' : ''}`}>
              {speaking ? <Square size={12} className="fill-current text-accent" /> : <Volume2 size={14} />}
            </button>
            {isLast && onRegenerate && (
              <button type="button" onClick={onRegenerate} aria-label="Try again" title="Try again" className="transition-colors hover:rotate-180 duration-300">
                <RefreshCw size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const next = feedback === 'positive' ? null : 'positive';
                setFeedback(next);
                if (next) api.post('/learning/feedback', { type: 'positive', message: msg.content }).catch(() => {});
              }}
              aria-label="Good response"
              title="Good response"
              className={`transition-colors ${feedback === 'positive' ? 'text-accent' : ''}`}
            >
              <ThumbsUp size={14} className={feedback === 'positive' ? 'fill-accent/20 text-accent' : ''} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = feedback === 'negative' ? null : 'negative';
                setFeedback(next);
                if (next) api.post('/learning/feedback', { type: 'negative', message: msg.content }).catch(() => {});
              }}
              aria-label="Bad response"
              title="Bad response"
              className={`transition-colors ${feedback === 'negative' ? 'text-red-400' : ''}`}
            >
              <ThumbsDown size={14} className={feedback === 'negative' ? 'fill-red-500/20 text-red-400' : ''} />
            </button>
          </div>
        )}

        {isUser && !isStreaming && (
          <div className="chat-response-actions" style={{ marginTop: '4px' }}>
            <button type="button" onClick={() => onEdit && onEdit(msg)} title="Edit message" aria-label="Edit message" className="transition-colors hover:text-accent">
              <Pencil size={13} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
