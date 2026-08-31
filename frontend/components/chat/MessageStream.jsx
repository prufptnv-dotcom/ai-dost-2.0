import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Play, RefreshCw, Volume2, Bot, User, Loader2, Sparkles, Terminal, FileCode } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import BrandLogo from '../ui/BrandLogo';
import { Badge } from '../ui/Badge';
import { ToolExecutionCard } from './ToolExecutionCard';
import { VerificationCard } from './VerificationCard';
import { ArtifactCard } from './ArtifactCard';

const renderMarkdown = (text) =>
  DOMPurify.sanitize(marked.parse((text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')));

export function MessageStream({
  messages = [],
  isThinking = false,
  thinkingText = 'Thinking...',
  onRegenerate,
  onOpenCanvas,
  onExecuteCode,
  onSpeak,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-6 max-w-3xl mx-auto w-full py-6 px-4 ${className}`}>
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        const isUser = msg.role === 'user';

        return isUser ? (
          <UserMessageItem key={msg.id || index} msg={msg} />
        ) : (
          <AssistantMessageItem
            key={msg.id || index}
            msg={msg}
            isLast={isLast}
            onRegenerate={onRegenerate}
            onOpenCanvas={onOpenCanvas}
            onExecuteCode={onExecuteCode}
            onSpeak={onSpeak}
          />
        );
      })}

      {/* Live Thinking Status */}
      {isThinking && (
        <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-canvas-surface border border-border text-txt-secondary text-xs max-w-sm animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="font-medium">{thinkingText}</span>
        </div>
      )}
    </div>
  );
}

function UserMessageItem({ msg }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex justify-end w-full group">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-xl bg-canvas-surface border border-border p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-1 text-[11px] text-txt-muted select-none">
          <span className="font-medium text-txt-secondary">You</span>
          <button
            type="button"
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-fast hover:text-txt-primary p-0.5"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-status-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="text-sm text-txt-primary leading-relaxed whitespace-pre-wrap font-sans">
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function AssistantMessageItem({
  msg,
  isLast,
  onRegenerate,
  onOpenCanvas,
  onExecuteCode,
  onSpeak,
}) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Enhance Code blocks with header, copy, and run buttons
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.code-block-header')) return;

      const codeEl = pre.querySelector('code');
      const codeText = codeEl ? codeEl.innerText : pre.innerText;
      const langMatch = pre.className.match(/language-(\w+)/) || (codeEl && codeEl.className.match(/language-(\w+)/));
      const lang = langMatch ? langMatch[1] : 'code';

      const header = document.createElement('div');
      header.className = 'code-block-header flex items-center justify-between px-3 py-1.5 bg-canvas-elevated border-b border-border text-[11px] font-mono text-txt-muted select-none';
      header.innerHTML = `
        <span>${lang}</span>
        <div class="flex items-center gap-2">
          <button type="button" class="copy-code-btn hover:text-txt-primary transition-fast cursor-pointer">Copy</button>
        </div>
      `;

      pre.insertBefore(header, pre.firstChild);

      const copyBtn = header.querySelector('.copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(codeText);
          copyBtn.innerText = 'Copied!';
          setTimeout(() => { copyBtn.innerText = 'Copy'; }, 1500);
        });
      }
    });
  }, [msg.content]);

  return (
    <div className="flex items-start gap-3 w-full group">
      <div className="mt-1 flex-shrink-0">
        <BrandLogo size={24} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1 select-none">
          <span className="text-xs font-semibold text-txt-primary font-display">
            AI-Dost
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-fast flex items-center gap-1.5 text-txt-muted">
            {onSpeak && (
              <button
                type="button"
                onClick={() => onSpeak(msg.content)}
                className="p-1 hover:text-txt-primary rounded-xs transition-fast"
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:text-txt-primary rounded-xs transition-fast"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {isLast && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="p-1 hover:text-txt-primary rounded-xs transition-fast"
                title="Regenerate response"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Markdown Content */}
        <div
          ref={contentRef}
          className="prose prose-invert max-w-none text-sm text-txt-primary leading-relaxed font-sans"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />

        {/* Structured Tool Executions if attached */}
        {msg.toolExecutions && msg.toolExecutions.map((tool, idx) => (
          <ToolExecutionCard key={idx} {...tool} />
        ))}

        {/* Verification Result if attached */}
        {msg.verification && (
          <VerificationCard {...msg.verification} />
        )}

        {/* Generated Artifact if attached */}
        {msg.artifact && (
          <ArtifactCard
            {...msg.artifact}
            onOpenCanvas={onOpenCanvas ? () => onOpenCanvas(msg.artifact) : undefined}
          />
        )}
      </div>
    </div>
  );
}

export default MessageStream;
