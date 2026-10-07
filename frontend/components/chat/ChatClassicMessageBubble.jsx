import React from 'react';
import PropTypes from 'prop-types';
import AppIcon from '../ui/AppIcon';
import { extractImages, stripImageUrls } from '../../utils/markdownUtils';
import { ChatMessageContent } from './ChatMessageContent';
import { ChatGeneratedImage } from './ChatGeneratedImage';

export function ChatClassicMessageBubble({ msg, onWriteCode, onCreatePage }) {
  const isAI = msg.sender === 'ai';
  const images = msg.images || [];
  const cleanText = msg.text ? stripImageUrls(msg.text) : '';
  const inlineImages = msg.text ? extractImages(msg.text) : [];
  const allImages = [...new Set([...images, ...inlineImages])];

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-1`}>
      <div className={`max-w-[92%] rounded-xl text-sm overflow-hidden shadow-xs backdrop-blur-md transition-all duration-200 ${
        isAI
          ? 'bg-canvas-elevated/50 border border-border text-paper-100 hover:border-accent/20'
          : 'bg-accent/10 border border-accent/20 text-paper-100'
      }`}>
        {cleanText && (
          <ChatMessageContent text={cleanText} onWriteCode={onWriteCode} query={msg.query || ''} />
        )}

        {msg.sources && msg.sources.length > 0 && (
          <div className="px-3 pb-3 pt-1.5 border-t border-border-subtle bg-canvas-surface/50 select-text">
            <div className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AppIcon name="globe" size={10} /> Sources & Citations
            </div>
            <div className="grid grid-cols-2 gap-2">
              {msg.sources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-2 bg-canvas-elevated hover:bg-canvas-surface border border-border rounded-lg flex flex-col text-[10px] min-w-0 transition-all duration-200 cursor-pointer shadow-xs"
                >
                  <span className="font-semibold text-paper-100 truncate">{src.title}</span>
                  <span className="text-[8px] text-ink-muted truncate">{src.domain}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {msg.pdfUrl && (
          <div className="px-3 pb-3">
            <a
              href={msg.pdfUrl}
              download
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 flex items-center justify-center gap-2 p-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold rounded-lg hover:bg-emerald-500/25 transition text-xs cursor-pointer text-center"
            >
              <AppIcon name="download" size={13} /> Download PDF: {msg.pdfName || 'Document'}
            </a>
          </div>
        )}

        {allImages.length > 0 && (
          <div className={`space-y-2 ${cleanText ? 'px-3 pb-3' : 'p-3'}`}>
            {allImages.map((url, idx) => (
              <ChatGeneratedImage key={`${url}-${idx}`} url={url} alt={cleanText} />
            ))}
          </div>
        )}

        {isAI && cleanText && (
          <div className="px-3 pb-2 pt-1 flex items-center justify-between border-t border-border-subtle mt-1 bg-canvas-surface/50 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => msg.onPlayAudio ? msg.onPlayAudio(cleanText) : null}
                className={`px-2 py-1 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1.5 font-medium ${
                  msg.isPlaying ? 'bg-accent/15 border border-accent/25 text-accent' : 'bg-canvas-elevated hover:bg-canvas-surface border border-border text-ink-muted hover:text-paper-100'
                }`}
                title={msg.isPlaying ? "Stop reading" : "Read message aloud"}
                aria-label={msg.isPlaying ? "Stop reading" : "Read message aloud"}
              >
                {msg.isPlaying ? (
                  <>
                    <AppIcon name="square" size={10} className="text-accent fill-accent" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <AppIcon name="play" size={10} className="text-accent fill-accent" />
                    <span>Play Voice</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(cleanText);
                    if (msg.onShowToast) msg.onShowToast({ type: 'success', message: 'Message copied to clipboard!' });
                  }
                }}
                className="px-2 py-1 bg-canvas-elevated hover:bg-canvas-surface border border-border text-ink-muted hover:text-paper-100 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1 font-medium"
                title="Copy response text"
                aria-label="Copy response text"
              >
                <AppIcon name="copy" size={10} className="text-accent" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => {
                  if (msg.onFeedback) msg.onFeedback('up', cleanText);
                }}
                className="p-1 bg-canvas-elevated hover:bg-emerald-500/15 border border-border hover:border-emerald-500/30 text-ink-muted hover:text-emerald-400 rounded-lg text-[10px] transition cursor-pointer"
                title="Good response! (Train Personal Brain)"
                aria-label="Good response"
              >
                <AppIcon name="thumbsUp" size={11} />
              </button>

              <button
                onClick={() => {
                  if (msg.onFeedback) msg.onFeedback('down', cleanText);
                }}
                className="p-1 bg-canvas-elevated hover:bg-red-500/15 border border-border hover:border-red-500/30 text-ink-muted hover:text-red-400 rounded-lg text-[10px] transition cursor-pointer"
                title="Needs Improvement (Open Feedback & Self-Correction Modal)"
                aria-label="Needs improvement"
              >
                <AppIcon name="thumbsDown" size={11} />
              </button>
            </div>

            {onCreatePage && (
              <button
                onClick={() => onCreatePage(msg.query || 'Research Article', cleanText)}
                className="px-2 py-1 bg-canvas-elevated hover:bg-canvas-surface border border-border text-ink-muted hover:text-paper-100 rounded-lg text-[9px] transition cursor-pointer flex items-center gap-1 font-medium shrink-0"
                title="Convert this research response into a shareable Page document"
                aria-label="Convert to document"
              >
                <span>Document Page</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ChatClassicMessageBubble.propTypes = {
  msg: PropTypes.shape({
    sender: PropTypes.string,
    text: PropTypes.string,
    images: PropTypes.array,
    query: PropTypes.string,
    sources: PropTypes.array,
    pdfUrl: PropTypes.string,
    pdfName: PropTypes.string,
    isPlaying: PropTypes.bool,
    onPlayAudio: PropTypes.func,
    onShowToast: PropTypes.func,
    onFeedback: PropTypes.func,
  }).isRequired,
  onWriteCode: PropTypes.func,
  onCreatePage: PropTypes.func,
};
