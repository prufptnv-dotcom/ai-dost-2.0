import React, { memo, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CodeBlock from './CodeBlock';
import CanvasArtifact from './CanvasArtifact';
import { stripInternalTags } from '../../utils/chatContent';
import { isVisualCode } from '../../lib/compileLiveHtml';

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
          
          const rawLang = (langLine || '').toLowerCase().trim();

          // 1. Python script detection (always runnable in terminal, never client-side iframe HTML preview)
          const isPython = /^(python|py|python3)$/i.test(rawLang) || (
            (!rawLang || rawLang === 'text') &&
            /^\s*(import\s+\w+|from\s+\w+\s+import|def\s+\w+\(|print\s*\(|class\s+\w+:|if\s+__name__\s*==)/m.test(code)
          );

          // 2. Visual Preview Code (HTML, CSS, SVG, React, JSX, Web apps, UI animations, Three.js, Canvas games)
          const isVisual = !isPython && (
            /^(html|htm|svg|css|jsx|tsx|react|vue)$/i.test(rawLang) ||
            isVisualCode(code, rawLang)
          );

          // 3. Runnable Terminal Code (Python, Node/JS scripts, Bash, Shell, PowerShell)
          // Renders CanvasArtifact with code editor and live Terminal Output console
          const isRunnableScript = !isVisual && (
            isPython ||
            /^(javascript|js|node|sh|bash|shell|zsh|powershell|ps1|terminal|console)$/i.test(rawLang)
          );

          if (isRunnableScript && code.trim().length > 0) {
            const artifactLang = isPython ? 'python' : (rawLang || 'javascript');
            const lineCount = (code.match(/\n/g) || []).length + 1;
            const cardHeight = Math.min(540, Math.max(300, 140 + lineCount * 20));

            return (
              <div key={i} style={{ height: `${cardHeight}px`, margin: '14px 0', width: '100%' }}>
                <CanvasArtifact
                  initialCode={code}
                  language={artifactLang}
                  onOpenIDE={() => {
                    if (onNavigate) {
                      try {
                        localStorage.setItem(
                          'ai_dost_copilot_import',
                          JSON.stringify({
                            title: `${artifactLang}-script`,
                            code,
                            language: artifactLang,
                            timestamp: Date.now(),
                          })
                        );
                      } catch (_) {}
                      onNavigate('copilot');
                    }
                  }}
                />
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
