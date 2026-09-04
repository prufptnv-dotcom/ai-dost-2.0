/**
 * compileLiveHtml.js
 * Compiles code snippets (HTML, CSS, JavaScript, Canvas, SVG, React)
 * into a standalone, safe, interactive HTML document for live preview in chat.
 */

export function isVisualCode(code = '', language = 'text') {
  if (!code || typeof code !== 'string') return false;
  const lang = (language || '').toLowerCase().trim();

  // Known visual languages
  if (['html', 'htm', 'svg', 'css', 'jsx', 'tsx', 'react', 'vue'].includes(lang)) {
    return true;
  }

  // Check for HTML elements
  if (/<(div|canvas|button|svg|style|script|section|span|p|h[1-6]|ul|ol|li|form|input|table|a|main|article|header|footer)\b/i.test(code)) {
    return true;
  }

  // Check for CSS animations & styling
  if (/@keyframes\b|animation\s*:|transition\s*:|\btransform\s*:/i.test(code)) {
    return true;
  }

  // Check for browser DOM / Canvas / animation APIs
  if (/document\.(getElementById|querySelector|querySelectorAll|createElement|body)|window\.(requestAnimationFrame|cancelAnimationFrame|addEventListener)|getContext\s*\(\s*['"]2d['"]\s*\)|setInterval\s*\(|setTimeout\s*\(/i.test(code)) {
    return true;
  }

  return false;
}

export function compileLiveHtml(code = '', language = 'html') {
  if (!code || typeof code !== 'string') return '';
  const lang = (language || 'html').toLowerCase().trim();

  // 1. Full HTML documents
  if (code.includes('<html') || code.includes('<!DOCTYPE') || code.includes('<!doctype')) {
    let cleanCode = code;
    // Strip unresolved relative stylesheet links and script tags that don't have absolute http/https/data URLs
    // e.g. <link rel="stylesheet" href="style.css"> or <script src="script.js"></script>
    // to prevent 404 console errors in browser
    cleanCode = cleanCode
      .replace(/<link\b[^>]*href=["'](?!(?:https?:|\/\/|data:))[^"']+\.css["'][^>]*>/gi, '')
      .replace(/<script\b[^>]*src=["'](?!(?:https?:|\/\/|data:))[^"']+\.js["'][^>]*>\s*<\/script>/gi, '');

    // If no background style is defined in the HTML document, ensure it defaults to dark instead of blinding white
    if (!/background\s*:/i.test(cleanCode) && cleanCode.includes('</head>')) {
      cleanCode = cleanCode.replace(
        '</head>',
        '<style>body{background:#090d16;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:16px;}</style></head>'
      );
    }
    return cleanCode;
  }

  // 2. Pure SVG
  if (lang === 'svg' || (code.trim().startsWith('<svg') && code.trim().includes('</svg>'))) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SVG Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090d16;
      overflow: hidden;
    }
    svg { max-width: 90vw; max-height: 90vh; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
  }

  // 3. HTML Snippet (or code containing HTML tags)
  const hasHtmlTags = /<(div|canvas|button|svg|style|section|span|p|h[1-6]|ul|ol|li)\b/i.test(code);
  if (lang === 'html' || lang === 'htm' || hasHtmlTags) {
    let cleanSnippet = code
      .replace(/<link\b[^>]*href=["'](?!(?:https?:|\/\/|data:))[^"']+\.css["'][^>]*>/gi, '')
      .replace(/<script\b[^>]*src=["'](?!(?:https?:|\/\/|data:))[^"']+\.js["'][^>]*>\s*<\/script>/gi, '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live Animation Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f8fafc;
      margin: 0;
      padding: 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  ${cleanSnippet}
</body>
</html>`;
  }

  // 4. CSS Animations & Keyframes
  if (lang === 'css' || code.includes('@keyframes')) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CSS Animation Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090d16;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 24px;
    }
    ${code}
  </style>
</head>
<body>
  <div class="animation-preview-wrapper" style="display:flex;flex-direction:column;align-items:center;gap:20px;">
    <div class="animated-box" style="padding: 24px 36px; border-radius: 16px; background: linear-gradient(135deg, #0ea5e9, #8b5cf6); font-weight: 700; font-size: 16px; box-shadow: 0 10px 30px rgba(14,165,233,0.4); text-align: center;">
      Animated Element
    </div>
    <span style="font-size: 12px; color: #94a3b8; font-family: monospace;">CSS Animation Active</span>
  </div>
</body>
</html>`;
  }

  // 5. JavaScript / Animation / Canvas Scripts
  if (['javascript', 'js', 'node'].includes(lang)) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>JavaScript Live Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #090d16;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: auto;
    }
    canvas {
      max-width: 100%;
      border-radius: 12px;
      box-shadow: 0 12px 35px rgba(0,0,0,0.6);
      background: #0d111c;
    }
  </style>
</head>
<body>
  <!-- Pre-configured canvas & app mount points -->
  <canvas id="canvas" width="600" height="350"></canvas>
  <div id="app"></div>
  <div id="root"></div>

  <script>
    // Universal Canvas and Element Provisioning Guard
    (function() {
      const origGetElementById = document.getElementById.bind(document);
      document.getElementById = function(id) {
        let el = origGetElementById(id);
        if (!el) {
          if (id.toLowerCase().includes('canvas') || /canvas/i.test(id)) {
            el = document.createElement('canvas');
            el.id = id;
            el.width = 600;
            el.height = 600;
            el.style = 'max-width: 100%; border-radius: 12px; box-shadow: 0 12px 35px rgba(0,0,0,0.6); display: block; margin: 0 auto; background: #0d111c;';
            document.body.prepend(el);
          } else {
            el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
          }
        }
        return el;
      };
    })();

    window.onerror = function(msg, url, lineNo) {
      const banner = document.createElement('div');
      banner.style = 'background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 10px 14px; border-radius: 8px; font-family: monospace; font-size: 12px; margin-top: 14px; max-width: 90vw;';
      banner.textContent = 'Runtime error: ' + msg + (lineNo ? ' (line ' + lineNo + ')' : '');
      document.body.appendChild(banner);
    };

    try {
      ${code}
    } catch (e) {
      window.onerror(e.message, '', 0);
    }
  </script>
</body>
</html>`;
  }

  // Fallback plaintext wrapper
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{background:#090d16;color:#f8fafc;padding:16px;font-family:monospace;}</style></head>
<body><pre>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body>
</html>`;
}

