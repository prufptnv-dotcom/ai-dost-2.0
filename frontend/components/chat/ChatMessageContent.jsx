import React from 'react';
import PropTypes from 'prop-types';
import { ChatMarkdownText } from './ChatMarkdownText';
import { ChatQuizCard } from './ChatQuizCard';

export function ChatMessageContent({ text, onWriteCode, query = '' }) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Match fenced code blocks: ```lang\ncode```
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

  // Email Detection Helper
  const isEmail = /subject:\s*(.*)/i.test(text) || (/\b(dear|respected|hi|hello)\b/i.test(text) && /\b(regards|sincerely|thanks|best)\b/i.test(text));
  const subjectMatch = text.match(/subject:\s*(.*)/i);
  const emailSubject = subjectMatch ? subjectMatch[1].trim() : 'Email Draft';

  return (
    <div className="space-y-2.5 p-3">
      {isEmail && (
        <div className="mb-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
          <div className="flex items-center justify-between font-bold text-purple-400 mb-1">
            <span className="flex items-center gap-1.5 text-[11px]">
              ✉️ Email Draft: <span className="text-text-primary font-normal">{emailSubject}</span>
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  alert('✉️ Email draft copied to clipboard!');
                }}
                className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 text-[9px] font-bold transition cursor-pointer"
                aria-label="Copy Email"
              >
                Copy Email
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="px-2 py-0.5 rounded bg-primary text-bg-default text-[9px] font-bold transition cursor-pointer"
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
            <div key={`code-${i}`} className="my-2 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0c0c10] font-mono text-xs shadow-inner">
              <div className="flex justify-between items-center px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.08] text-text-secondary select-none">
                <span className="capitalize text-[10px] font-bold text-primary">{part.language || 'code'}</span>
                {onWriteCode && (
                  <button
                    onClick={() => onWriteCode(part.content)}
                    className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary font-bold rounded-lg text-[9px] hover:bg-primary hover:text-bg-default transition cursor-pointer"
                    aria-label="Apply Code"
                  >
                    Apply Code
                  </button>
                )}
              </div>
              <pre className="p-3 overflow-x-auto select-text">
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
