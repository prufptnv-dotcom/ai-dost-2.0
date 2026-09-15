import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CodeBlock from './CodeBlock';
import { stripInternalTags } from '../../utils/chatContent';

function renderMarkdown(text) {
  return DOMPurify.sanitize(
    marked.parse(
      stripInternalTags(text || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
    )
  );
}

export default function ParsedMarkdown({
  content,
  isStreaming,
  onNavigate,
  onPreviewArtifact,
  detectedArtifact,
}) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?(?:```|$))/g);

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
