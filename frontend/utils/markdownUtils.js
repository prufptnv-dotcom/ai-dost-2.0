import { marked } from 'marked';
import DOMPurify from 'dompurify';
import React from 'react';

// Configure marked for safe, well-formatted output
marked.setOptions({ breaks: true, gfm: true });

// Render markdown text to sanitized HTML string (safe on server AND client)
export function renderMarkdown(text) {
  if (!text) return '';
  const raw = marked.parse(text);
  try {
    if (typeof window !== 'undefined' && DOMPurify?.isSupported !== false && typeof DOMPurify?.sanitize === 'function') {
      return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
    }
  } catch (_) { /* fall through to regex strip */ }
  // Server / unsupported DOMPurify: return HTML with ALL tags removed (never raw)
  return String(raw).replace(/<[^>]*>/g, '');
}

// Extract image URLs from AI text
export const IMAGE_URL_REGEX = /https?:\/\/[^\s"'<>]+?\.(png|jpg|jpeg|gif|webp)(\?[^\s"'<>]*)?/gi;
export const POLLINATIONS_REGEX = /https?:\/\/image\.pollinations\.ai\/[^\s"'<>]+/gi;

export function extractImages(text) {
  if (!text) return [];
  const all = [
    ...(text.match(IMAGE_URL_REGEX) || []),
    ...(text.match(POLLINATIONS_REGEX) || []),
  ];
  return [...new Set(all)];
}

export function stripImageUrls(text) {
  if (!text) return '';
  return text
    .replace(IMAGE_URL_REGEX, '')
    .replace(POLLINATIONS_REGEX, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Render citations as styled clickable badges
export function formatTextWithCitations(text, query) {
  if (!text) return null;
  const citationRegex = /\[([0-9]+)\]/g;
  const searchUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query || 'Bihar')}`;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = citationRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }
    
    const num = match[1];
    parts.push(
      <a 
        key={`cite-${num}-${matchIndex}`}
        href={searchUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full mx-0.5 hover:bg-primary hover:text-bg-default transition select-none cursor-pointer align-super"
        title={`Click to check Wikipedia source search for: ${query}`}
      >
        {num}
      </a>
    );
    
    lastIndex = citationRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : text;
}
