import React from 'react';
import PropTypes from 'prop-types';
import { Play, Square, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
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
      <div className={`max-w-[92%] rounded-xl text-sm overflow-hidden shadow-md backdrop-blur-md transition-all duration-200 ${
        isAI
          ? 'bg-white/[0.03] border border-white/[0.08] text-text-primary hover:border-primary/15'
          : 'bg-primary/10 border border-primary/30 text-text-primary'
      }`}>
        {cleanText && (
          <ChatMessageContent text={cleanText} onWriteCode={onWriteCode} query={msg.query || ''} />
        )}
        
        {/* Perplexity Styled Sources Grid */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="px-3 pb-3 pt-1.5 border-t border-white/[0.05] bg-black/10 select-text">
            <div className="text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>🌐</span> Sources & Citations
            </div>
            <div className="grid grid-cols-2 gap-2">
              {msg.sources.map((src, idx) => (
                <a 
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] rounded flex flex-col text-[10px] min-w-0 transition-all duration-200 cursor-pointer shadow-sm"
                >
                  <span className="font-semibold text-primary truncate">{src.title}</span>
                  <span className="text-[8px] text-text-secondary truncate">{src.domain}</span>
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
              className="mt-2 flex items-center justify-center gap-2 p-2 bg-success text-bg-default font-bold rounded-lg hover:bg-success/80 transition text-xs cursor-pointer text-center"
            >
              📥 Download PDF: {msg.pdfName || 'Document'}
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

        {/* Action Bar */}
        {isAI && cleanText && (
          <div className="px-3 pb-2 pt-1 flex items-center justify-between border-t border-white/[0.05] mt-1 bg-white/[0.02] gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => msg.onPlayAudio ? msg.onPlayAudio(cleanText) : null}
                className={`px-2 py-1 rounded text-[10px] transition cursor-pointer flex items-center gap-1.5 font-medium ${
                  msg.isPlaying ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-text-muted hover:text-text-primary'
                }`}
                title={msg.isPlaying ? "Stop reading" : "Read message aloud"}
                aria-label={msg.isPlaying ? "Stop reading" : "Read message aloud"}
              >
                {msg.isPlaying ? (
                  <>
                    <Square className="w-3 h-3 text-primary fill-primary" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-primary fill-primary" />
                    <span>Play Voice</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(cleanText);
                    if (msg.onShowToast) msg.onShowToast({ type: 'success', message: '📋 Message copied to clipboard!' });
                  }
                }}
                className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-text-muted hover:text-text-primary rounded text-[10px] transition cursor-pointer flex items-center gap-1 font-medium"
                title="Copy response text"
                aria-label="Copy response text"
              >
                <Copy className="w-3 h-3 text-primary" />
                <span>Copy</span>
              </button>

              <button
                onClick={() => {
                  if (msg.onFeedback) msg.onFeedback('up', cleanText);
                }}
                className="p-1 bg-white/[0.04] hover:bg-success/20 border border-white/[0.08] hover:border-success/40 text-text-muted hover:text-success rounded text-[10px] transition cursor-pointer"
                title="Good response! (Train Personal Brain)"
                aria-label="Good response"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>

              <button
                onClick={() => {
                  if (msg.onFeedback) msg.onFeedback('down', cleanText);
                }}
                className="p-1 bg-white/[0.04] hover:bg-warning/20 border border-white/[0.08] hover:border-warning/40 text-text-muted hover:text-warning rounded text-[10px] transition cursor-pointer"
                title="Needs Improvement (Open Feedback & Self-Correction Modal)"
                aria-label="Needs improvement"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>

            {onCreatePage && (
              <button
                onClick={() => onCreatePage(msg.query || 'Research Article', cleanText)}
                className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-text-muted hover:text-text-primary rounded text-[9px] transition cursor-pointer flex items-center gap-1 font-medium shrink-0"
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
