import React, { memo, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CodeBlock from './CodeBlock';
import CanvasArtifact from './CanvasArtifact';
import { stripInternalTags } from '../../utils/chatContent';

const MD_CACHE = new Map();
const MAX_CACHE = 400;

function renderMarkdown(text) {
  if (!text) return '';
  if (MD_CACHE.has(text)) return MD_CACHE.get(text);

  let clean = '';
  try {
    const raw = marked.parse(stripInternalTags(text).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ''));
    clean = DOMPurify.sanitize(raw);
  } catch (err) {
    console.error('DOMPurify failed:', err);
    clean = `<div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 my-2">
      <div class="font-bold flex items-center gap-2 mb-1"><span>⚠️</span> Content Formatting Error</div>
      <div class="opacity-80">This message could not be formatted safely. Showing raw text:</div>
      <pre class="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">${String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>`;
  }

  if (MD_CACHE.size >= MAX_CACHE) {
    const firstKey = MD_CACHE.keys().next().value;
    MD_CACHE.delete(firstKey);
  }
  MD_CACHE.set(text, clean);
  return clean;
}

function ParsedMarkdown({
  content,
  isStreaming,
  onNavigate,
  onPreviewArtifact,
  detectedArtifact,
}) {
  const parts = useMemo(() => {
    if (!content) return [];
    return content.split(/(```[\s\S]*?(?:```|$))/g);
  }, [content]);

  if (!content || parts.length === 0) return null;

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const inner = part.slice(3);
          const isClosed = inner.endsWith('```');
          const textContent = isClosed ? inner.slice(0, -3) : inner;
          const newlineIdx = textContent.indexOf('\n');
          let langLine = 'text';
          let code = textContent;

          if (newlineIdx !== -1) {
            langLine = textContent.slice(0, newlineIdx).trim();
            code = textContent.slice(newlineIdx + 1);
          } else {
            langLine = textContent.trim();
            code = '';
          }
          
          // Render Canvas UI for long scripts/code, fallback to standard CodeBlock
          if (code.split('\n').length > 15 && (langLine.includes('js') || langLine.includes('javascript') || langLine.includes('python') || langLine.includes('py') || langLine.includes('html') || langLine.includes('htm') || langLine.includes('css'))) {
              return (
                  <div key={i} style={{ height: '500px', margin: '15px 0' }}>
                      <CanvasArtifact initialCode={code} language={langLine} />
                  </div>
              );
          }

          return (
            <CodeBlock
              key={i}
              code={code}
              language={langLine || 'text'}
              canRun={true}
              canPreview={true}
              onPreviewArtifact={
                detectedArtifact
                  ? () => onPreviewArtifact(detectedArtifact)
                  : onPreviewArtifact
              }
              onOpenIDE={() => {
                if (onNavigate) {
                  try {
                    localStorage.setItem(
                      'ai_dost_copilot_import',
                      JSON.stringify({
                        title: 'chat-code',
                        code,
                        language: langLine,
                        timestamp: Date.now(),
                      })
                    );
                  } catch (_) {}
                  onNavigate('copilot');
                }
              }}
            />
          );
        }

        if (part) {
          return (
            <div
              key={i}
              className="prose-chat"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
            />
          );
        }

        return null;
      })}
    </>
  );
}

export default memo(ParsedMarkdown);
