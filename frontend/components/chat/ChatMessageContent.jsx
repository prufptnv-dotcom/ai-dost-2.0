import React from 'react';
import PropTypes from 'prop-types';
import { ChatMarkdownText } from './ChatMarkdownText';
import { ChatQuizCard } from './ChatQuizCard';
import AppIcon from '../ui/AppIcon';

export function ChatMessageContent({ text, onWriteCode, query = '' }) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  const regex = /```(\w*)\n?([\s\S]*?)```/g;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'code', language: match[1], content: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  if (parts.length === 0) {
    return <div className="p-3"><ChatMarkdownText text={text} /></div>;
  }

  const isEmail = /subject:\s*(.*)/i.test(text) || (/\b(dear|respected|hi|hello)\b/i.test(text) && /\b(regards|sincerely|thanks|best)\b/i.test(text));
  const subjectMatch = text.match(/subject:\s*(.*)/i);
  const emailSubject = subjectMatch ? subjectMatch[1].trim() : 'Email Draft';

  return (
    <div className="space-y-2.5 p-3">
      {isEmail && (
        <div className="mb-2 p-3 rounded-xl bg-purple-500/[0.07] border border-purple-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400">
              <AppIcon name="mail" className="w-3.5 h-3.5" />
              Email Draft: <span className="text-paper-100 font-normal">{emailSubject}</span>
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  alert('Email draft copied to clipboard!');
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 text-[10px] font-semibold transition cursor-pointer"
                aria-label="Copy Email"
              >
                Copy Email
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="px-2.5 py-1 rounded-lg bg-accent text-white text-[10px] font-semibold hover:bg-accent-hover transition cursor-pointer"
              >
                Open in Mail App
              </a>
            </div>
          </div>
        </div>
      )}
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <ChatMarkdownText key={`text-${i}`} text={part.content} />;
        } else if (part.language === 'quiz') {
          return <ChatQuizCard key={`quiz-${i}`} content={part.content} />;
        } else {
          return (
            <div key={`code-${i}`} className="my-2 rounded-xl overflow-hidden border border-border bg-canvas-elevated shadow-xs">
              <div className="flex justify-between items-center px-3 py-2 bg-canvas-surface border-b border-border-subtle select-none">
                <span className="capitalize text-[10px] font-bold text-accent flex items-center gap-1.5">
                  <AppIcon name="code" className="w-3 h-3" />
                  {part.language || 'code'}
                </span>
                {onWriteCode && (
                  <button
                    onClick={() => onWriteCode(part.content)}
                    className="px-2.5 py-1 bg-accent/10 border border-accent/20 text-accent font-semibold rounded-lg text-[10px] hover:bg-accent hover:text-white transition cursor-pointer"
                    aria-label="Apply Code"
                  >
                    Apply Code
                  </button>
                )}
              </div>
              <pre className="p-3 overflow-x-auto select-text text-xs leading-relaxed text-paper-100">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }
      })}
    </div>
  );
}

ChatMessageContent.propTypes = {
  text: PropTypes.string.isRequired,
  onWriteCode: PropTypes.func,
  query: PropTypes.string,
};
