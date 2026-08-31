import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Copy,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreHorizontal,
  Sparkles,
  Bot,
  ExternalLink,
  Code2,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ActionTimeline from './ActionTimeline';

export default function SmartChatMessage({
  message,
  actions = [],
  isLast = false,
  onRetry,
  onOpenInCopilot,
  onPlayTTS,
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch (_) {}
  };

  const html = DOMPurify.sanitize(marked.parse(message.content || ''));

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`group flex gap-3.5 my-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="shrink-0 pt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 text-accent shadow-sm">
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
        </div>
      )}

      <div className={`min-w-0 ${isUser ? 'max-w-[720px]' : 'w-full max-w-[920px]'}`}>
        <div className="mb-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-ink-muted">
          <span className="font-semibold text-paper-300">{isUser ? 'You' : 'AI-Dost'}</span>
          <span>·</span>
          <span>
            {message.timestamp
              ? new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'now'}
          </span>
        </div>

        <div
          className={`${
            isUser
              ? 'rounded-2xl rounded-tr-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-md shadow-indigo-500/15'
              : 'rounded-2xl border border-border bg-canvas-surface px-5 py-4 shadow-sm'
          }`}
        >
          {message.isStreaming && !message.content ? (
            <div className="flex items-center gap-2 text-xs text-paper-300">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span>AI-Dost is working…</span>
            </div>
          ) : (
            <div
              className="prose-chat text-sm leading-7 text-paper-100"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {message.isStreaming && message.content && (
            <motion.span
              className="ml-1 inline-block h-4 w-[2px] translate-y-0.5 bg-accent align-middle"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
        </div>

        {!isUser && actions.length > 0 && <ActionTimeline actions={actions} />}

        <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={copy}
            title="Copy"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-canvas-surface hover:text-paper-100 focus-ring cursor-pointer transition-fast"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {!isUser && (
            <>
              {onPlayTTS && (
                <button
                  type="button"
                  onClick={() => onPlayTTS(message.content)}
                  title="Read aloud"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-canvas-surface hover:text-paper-100 focus-ring cursor-pointer transition-fast"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                title="Helpful"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-canvas-surface hover:text-paper-100 focus-ring cursor-pointer transition-fast"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Not helpful"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-canvas-surface hover:text-paper-100 focus-ring cursor-pointer transition-fast"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              {isLast && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  title="Try again"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-muted hover:bg-canvas-surface hover:text-paper-100 focus-ring cursor-pointer transition-fast"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              {onOpenInCopilot && (
                <button
                  type="button"
                  onClick={() => onOpenInCopilot(message.content)}
                  title="Open in Copilot IDE"
                  className="h-7 px-2 rounded-lg flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 focus-ring cursor-pointer transition-fast border border-emerald-500/20"
                >
                  <Code2 className="h-3 w-3" />
                  <span>IDE</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 pt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-tr from-indigo-600 to-violet-500 font-mono text-[10px] font-bold text-white shadow-sm ring-2 ring-indigo-500/20">
            U
          </div>
        </div>
      )}
    </motion.article>
  );
}
