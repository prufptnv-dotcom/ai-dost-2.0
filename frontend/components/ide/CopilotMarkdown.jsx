import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Wrap marked's <pre><code> output in a styled block with a language tag +
// delegated Copy button (no per-node listeners — one click handler on root).
export function wrapCodeBlocks(html) {
  return String(html).replace(
    /<pre><code(?: class="language-([^"]{0,40})")?>([\s\S]*?)<\/code><\/pre>/gi,
    (_m, lang, body) => {
      const label = String(lang || 'code').split(/\s+/)[0].replace(/[^a-z0-9+#_.-]/gi, '') || 'code';
      return (
        `<div class="cm-code">` +
        `<div class="cm-code-bar"><span class="cm-code-lang">${label}</span>` +
        `<button type="button" class="cm-code-copy" data-cm-copy>Copy</button></div>` +
        `<pre><code class="language-${label}">${body}</code></pre>` +
        `</div>`
      );
    }
  );
}

export function renderCopilotMarkdown(text) {
  if (!text) return '';
  try {
    const raw = marked.parse(String(text));
    const wrapped = wrapCodeBlocks(raw);
    if (typeof window !== 'undefined' && DOMPurify?.isSupported !== false && typeof DOMPurify?.sanitize === 'function') {
      return DOMPurify.sanitize(wrapped, { ADD_ATTR: ['data-cm-copy'] });
    }
    return String(wrapped).replace(/<script[\s\S]*?<\/script>/gi, '');
  } catch (_) {
    return String(text).replace(/<[^>]*>/g, '');
  }
}

// Markdown bubble for copilot assistant messages: headings/lists/tables via
// .md-prose + copy-able code blocks (Devin-style, theme tokens).
export function CopilotMarkdown({ text, className = '' }) {
  const html = useMemo(() => renderCopilotMarkdown(text), [text]);

  const handleClick = async (e) => {
    const btn = e.target.closest?.('[data-cm-copy]');
    if (!btn) return;
    const pre = btn.closest('.cm-code')?.querySelector('pre');
    if (!pre) return;
    try {
      await navigator.clipboard.writeText(String(pre.textContent || '').replace(/\n+$/, ''));
      btn.textContent = 'Copied!';
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = 'Copy';
      }, 1200);
    } catch (_) { /* clipboard unavailable */ }
  };

  return (
    <div
      className={`cm md-prose ${className}`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

CopilotMarkdown.propTypes = {
  text: PropTypes.string,
  className: PropTypes.string,
};

export default CopilotMarkdown;
