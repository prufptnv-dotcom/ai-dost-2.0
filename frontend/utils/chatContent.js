const INTERNAL_TAG_RE = /\[GENERATE_(?:PDF|PPTX|PPT|DOC|DOCX|CSV|XLSX|CODE|FILE|ACTION|TOOL)(?::\s*[^\]]*)?\]|\[TOOL_CALL:[^\]]*\]/gi;
const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const CODE_BLOCK_RE = /```([a-zA-Z0-9_-]*)\s*\n([\s\S]*?)```/g;

export function stripInternalTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(INTERNAL_TAG_RE, '').trim();
}

export function extractImages(content) {
  const images = [];
  let match;
  const re = new RegExp(IMAGE_MARKDOWN_RE.source, IMAGE_MARKDOWN_RE.flags);
  while ((match = re.exec(content || ''))) {
    images.push({ alt: match[1], url: match[2] });
  }
  return images;
}

function collectCodeBlocks(content) {
  const blocks = [];
  let match;
  const re = new RegExp(CODE_BLOCK_RE.source, CODE_BLOCK_RE.flags);
  while ((match = re.exec(content || ''))) {
    const lang = (match[1] || '').toLowerCase().trim();
    const code = match[2].trim();
    if (code) blocks.push({ lang, code });
  }
  return blocks;
}

export function extractArtifact(content) {
  if (!content || typeof content !== 'string') return null;

  const blocks = collectCodeBlocks(content);
  if (blocks.length === 0) return null;

  const htmlBlock = blocks.find((b) =>
    ['html', 'htm', 'xml', 'svg'].includes(b.lang) ||
    (b.code.includes('<') && b.code.includes('</'))
  );

  const cssBlock = blocks.find((b) =>
    ['css', 'scss', 'less', 'style'].includes(b.lang) ||
    (!htmlBlock && /^[.#a-zA-Z0-9_\-\s,>:+*]+\s*\{[\s\S]*\}/m.test(b.code))
  );

  const jsBlock = blocks.find((b) =>
    ['javascript', 'js', 'ts', 'jsx', 'script'].includes(b.lang) ||
    (!htmlBlock && !cssBlock && /\b(function|const|let|var|document\.|window\.)\b/.test(b.code))
  );

  if (htmlBlock) {
    let combinedCode = htmlBlock.code;
    const isSvg = htmlBlock.lang === 'svg' ||
      (combinedCode.startsWith('<svg') && combinedCode.includes('</svg>'));

    if (!isSvg) {
      if (cssBlock?.code) {
        if (/<link\b[^>]*href=["'][^"']*\.css["'][^>]*>/i.test(combinedCode)) {
          combinedCode = combinedCode.replace(
            /<link\b[^>]*href=["'][^"']*\.css["'][^>]*>/gi,
            `<style>\n${cssBlock.code}\n</style>`
          );
        } else if (combinedCode.includes('</head>')) {
          combinedCode = combinedCode.replace(
            '</head>',
            `<style>\n${cssBlock.code}\n</style>\n</head>`
          );
        } else {
          combinedCode = `<style>\n${cssBlock.code}\n</style>\n${combinedCode}`;
        }
      }

      if (jsBlock?.code) {
        if (/<script\b[^>]*src=["'][^"']*\.js["'][^>]*>\s*<\/script>/i.test(combinedCode)) {
          combinedCode = combinedCode.replace(
            /<script\b[^>]*src=["'][^"']*\.js["'][^>]*>\s*<\/script>/gi,
            `<script>\n${jsBlock.code}\n</script>`
          );
        } else if (combinedCode.includes('</body>')) {
          combinedCode = combinedCode.replace(
            '</body>',
            `<script>\n${jsBlock.code}\n</script>\n</body>`
          );
        } else {
          combinedCode += `\n<script>\n${jsBlock.code}\n</script>`;
        }
      }

      combinedCode = combinedCode
        .replace(/<link\b[^>]*href=["'](?!(?:https?:|\/\/|data:))[^"']+\.css["'][^>]*>/gi, '')
        .replace(/<script\b[^>]*src=["'](?!(?:https?:|\/\/|data:))[^"']+\.js["'][^>]*>\s*<\/script>/gi, '');
    }

    return {
      title: isSvg ? 'SVG Vector Graphic' : 'Interactive UI Artifact',
      code: combinedCode,
      language: isSvg ? 'svg' : 'html',
    };
  }

  if (jsBlock) {
    const isInteractiveJS =
      jsBlock.code.length > 300 &&
      /\b(document\.|canvas|animation|requestAnimationFrame|setInterval|addEventListener|createElement|getElementById|querySelector|render|draw|ctx\.|THREE\.|p5)\b/.test(jsBlock.code);

    if (isInteractiveJS) {
      return {
        title: 'JavaScript Live Animation',
        code: jsBlock.code,
        language: 'javascript',
      };
    }
  }

  if (cssBlock) {
    const isVisualCSS =
      cssBlock.code.length > 200 &&
      /\b(@keyframes|animation|canvas|transition.*animation|\.animate|scroll-snap|parallax|particle)\b/.test(cssBlock.code);

    if (isVisualCSS) {
      return {
        title: 'CSS Animation',
        code: cssBlock.code,
        language: 'css',
      };
    }
  }

  return null;
}
