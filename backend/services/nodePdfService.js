'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * Escapes raw HTML characters to prevent markup injection.
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Priority and Status Badges
 */
function badgePill(text) {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (lower === 'very high') {
    return `<span class="badge badge-very-high">${escapeHtml(t)}</span>`;
  }
  if (lower === 'high') {
    return `<span class="badge badge-high">${escapeHtml(t)}</span>`;
  }
  if (lower === 'medium-high' || lower === 'medium–high') {
    return `<span class="badge badge-medium-high">${escapeHtml(t)}</span>`;
  }
  if (lower === 'medium') {
    return `<span class="badge badge-medium">${escapeHtml(t)}</span>`;
  }
  if (lower === 'low') {
    return `<span class="badge badge-low">${escapeHtml(t)}</span>`;
  }
  if (lower === 'core' || lower === 'mandatory') {
    return `<span class="badge badge-core">${escapeHtml(t)}</span>`;
  }
  if (lower === 'active' || lower === 'verified' || lower === 'passed') {
    return `<span class="badge badge-active">${escapeHtml(t)}</span>`;
  }
  return null;
}

/**
 * Formats inline markdown elements (bold, italic, code, links, badges).
 */
function formatInline(text) {
  if (!text) return '';
  
  // Check if cell is an exact badge candidate
  const pill = badgePill(text);
  if (pill) return pill;

  let out = escapeHtml(text);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Markdown links [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" class="doc-link" target="_blank">$1</a>');
  return out;
}

/**
 * Converts Markdown content into an executive-grade HTML document for PDF printing.
 */
function markdownToHtml(markdown, title) {
  const cleanTitle = (title || 'Executive Document').trim();
  const safeTitle = escapeHtml(cleanTitle);
  const lines = String(markdown || '').split('\n');
  const bodyHtml = [];

  let inList = false;
  let inChecklist = false;
  let inCodeBlock = false;
  let codeBuffer = [];
  let inTable = false;
  let tableRows = [];
  let inCallout = false;
  let calloutType = 'note';
  let calloutTitle = '';
  let calloutBuffer = [];

  const flushList = () => {
    if (inList) {
      bodyHtml.push('</ul>');
      inList = false;
    }
    if (inChecklist) {
      bodyHtml.push('</div>');
      inChecklist = false;
    }
  };

  const flushCode = () => {
    if (inCodeBlock) {
      bodyHtml.push(`<pre class="code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
      codeBuffer = [];
      inCodeBlock = false;
    }
  };

  const flushCallout = () => {
    if (inCallout && calloutBuffer.length > 0) {
      const typeIcons = {
        tip: '💡',
        warning: '⚠️',
        caution: '⚠️',
        danger: '🛑',
        important: '📌',
        note: 'ℹ️'
      };
      const icon = typeIcons[calloutType] || 'ℹ️';
      const heading = calloutTitle || (calloutType.charAt(0).toUpperCase() + calloutType.slice(1));
      bodyHtml.push(`
        <div class="callout callout-${calloutType}">
          <div class="callout-header">
            <span class="callout-icon">${icon}</span>
            <strong class="callout-title">${escapeHtml(heading)}</strong>
          </div>
          <div class="callout-content">
            ${calloutBuffer.map(p => `<p>${formatInline(p)}</p>`).join('')}
          </div>
        </div>
      `);
      calloutBuffer = [];
      inCallout = false;
      calloutTitle = '';
      calloutType = 'note';
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<div class="table-container"><table class="data-table"><thead><tr>';
      const headerCols = tableRows[0];
      headerCols.forEach((col) => {
        tableHtml += `<th>${formatInline(col.trim())}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      for (let i = 1; i < tableRows.length; i++) {
        tableHtml += '<tr>';
        tableRows[i].forEach((col) => {
          const raw = col.trim();
          const pill = badgePill(raw);
          const cellContent = pill ? pill : formatInline(raw);
          tableHtml += `<td>${cellContent}</td>`;
        });
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      bodyHtml.push(tableHtml);
      tableRows = [];
      inTable = false;
    }
  };

  let hasMainHeadingInMarkdown = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Code blocks
    if (line.startsWith('```')) {
      flushList();
      flushCallout();
      flushTable();
      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Callout / Blockquote handling
    if (line.startsWith('>')) {
      flushList();
      flushTable();
      const quoteContent = line.replace(/^>\s?/, '').trim();
      
      // Check for GitHub Alerts: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT], > [!CAUTION]
      const alertMatch = quoteContent.match(/^\[\!(NOTE|TIP|WARNING|IMPORTANT|CAUTION|INFO|DANGER)\]\s*(.*)$/i);
      const customCautionMatch = quoteContent.match(/^(\*\*(?:How to use|Final caution|Important|Caution|Note|Pro-Tip|Notice|Warning)[^\*]*\*\*[:\s]*)(.*)$/i) ||
                                  quoteContent.match(/^((?:How to use|Final caution|Important|Caution|Note|Pro-Tip|Notice|Warning)[^:]*:)(.*)$/i);

      if (alertMatch) {
        flushCallout();
        inCallout = true;
        const tag = alertMatch[1].toLowerCase();
        calloutType = (tag === 'info') ? 'note' : (tag === 'caution' ? 'warning' : tag);
        calloutTitle = alertMatch[2] ? alertMatch[2].trim() : (calloutType.toUpperCase());
        continue;
      } else if (customCautionMatch) {
        flushCallout();
        inCallout = true;
        const headingRaw = customCautionMatch[1].replace(/[\*:]/g, '').trim();
        const lowerH = headingRaw.toLowerCase();
        calloutType = (lowerH.includes('caution') || lowerH.includes('warning')) ? 'warning' :
                      (lowerH.includes('tip')) ? 'tip' :
                      (lowerH.includes('how to use') || lowerH.includes('note') || lowerH.includes('important')) ? 'note' : 'note';
        calloutTitle = headingRaw;
        if (customCautionMatch[2] && customCautionMatch[2].trim()) {
          calloutBuffer.push(customCautionMatch[2].trim());
        }
        continue;
      }

      if (inCallout) {
        if (quoteContent) calloutBuffer.push(quoteContent);
        continue;
      } else {
        // Standard blockquote
        bodyHtml.push(`<blockquote class="quote">${formatInline(quoteContent)}</blockquote>`);
        continue;
      }
    } else if (inCallout) {
      flushCallout();
    }

    // Markdown Table rows (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      flushCallout();
      const parts = line.slice(1, -1).split('|');
      // Skip delimiter row (|---|---|)
      if (parts.every((p) => /^[\s-:]+$/.test(p))) {
        continue;
      }
      inTable = true;
      tableRows.push(parts);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (!line) {
      flushList();
      flushCallout();
      continue;
    }

    // Interactive Checklist items: - [ ] Task or - [x] Task
    const checklistMatch = line.match(/^[-*•]\s+\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      flushCallout();
      if (inList) flushList();
      if (!inChecklist) {
        bodyHtml.push('<div class="checklist-group">');
        inChecklist = true;
      }
      const isChecked = checklistMatch[1].toLowerCase() === 'x';
      bodyHtml.push(`
        <div class="checklist-item ${isChecked ? 'is-checked' : ''}">
          <span class="checklist-box ${isChecked ? 'checked' : ''}">${isChecked ? '✓' : ''}</span>
          <span class="checklist-label">${formatInline(checklistMatch[2])}</span>
        </div>
      `);
      continue;
    } else if (inChecklist) {
      flushList();
    }

    // Headings
    if (line.startsWith('# ')) {
      flushList();
      flushCallout();
      hasMainHeadingInMarkdown = true;
      bodyHtml.push(`<h1 class="heading-1">${formatInline(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      flushList();
      flushCallout();
      bodyHtml.push(`<h2 class="heading-2">${formatInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      flushList();
      flushCallout();
      bodyHtml.push(`<h3 class="heading-3">${formatInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('#### ')) {
      flushList();
      flushCallout();
      bodyHtml.push(`<h4 class="heading-4">${formatInline(line.slice(5))}</h4>`);
    } else if (line.startsWith('---') || line.startsWith('***')) {
      flushList();
      flushCallout();
      bodyHtml.push('<hr class="divider" />');
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      flushCallout();
      if (!inList) {
        bodyHtml.push('<ul class="bullet-list">');
        inList = true;
      }
      bodyHtml.push(`<li>${formatInline(line.slice(2))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      flushList();
      flushCallout();
      const numMatch = line.match(/^(\d+\.)\s+(.*)$/);
      bodyHtml.push(`<div class="ordered-step"><span class="step-num">${numMatch[1]}</span><span class="step-content">${formatInline(numMatch[2])}</span></div>`);
    } else {
      flushList();
      flushCallout();
      bodyHtml.push(`<p class="paragraph">${formatInline(line)}</p>`);
    }
  }

  flushList();
  flushCallout();
  flushCode();
  flushTable();

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.62;
      color: #1E293B;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }

    /* Executive Top Title Block */
    .document-hero {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #E2E8F0;
    }
    .hero-title {
      font-size: 24pt;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.22;
      margin: 0 0 10px 0;
      letter-spacing: -0.025em;
    }
    .hero-meta-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      font-size: 8.5pt;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 8px;
    }
    .hero-meta-badge {
      background: #F1F5F9;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
      color: #334155;
    }

    /* Headings */
    .heading-1 {
      font-size: 17pt;
      font-weight: 800;
      color: #0F172A;
      border-bottom: 1.5px solid #CBD5E1;
      padding-bottom: 6px;
      margin: 28px 0 12px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .heading-2 {
      font-size: 13.5pt;
      font-weight: 700;
      color: #1E3A8A;
      margin: 22px 0 8px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .heading-3 {
      font-size: 11pt;
      font-weight: 700;
      color: #0369A1;
      margin: 16px 0 6px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .heading-4 {
      font-size: 10pt;
      font-weight: 600;
      color: #475569;
      margin: 12px 0 4px 0;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Paragraphs & Text */
    .paragraph {
      margin: 0 0 9px 0;
      text-align: justify;
      hyphens: auto;
      color: #1E293B;
    }
    .doc-link {
      color: #2563EB;
      text-decoration: none;
      word-break: break-all;
    }

    /* Lists */
    .bullet-list {
      margin: 0 0 12px 0;
      padding-left: 20px;
    }
    .bullet-list li {
      margin-bottom: 5px;
      line-height: 1.55;
    }
    .ordered-step {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
      line-height: 1.55;
    }
    .step-num {
      font-weight: 700;
      color: #1E3A8A;
      min-width: 22px;
    }

    /* Interactive-style Checklists */
    .checklist-group {
      margin: 12px 0 16px 0;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 7px;
      font-size: 10pt;
    }
    .checklist-item:last-child {
      margin-bottom: 0;
    }
    .checklist-box {
      width: 14px;
      height: 14px;
      border: 1.5px solid #64748B;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      font-weight: 700;
      margin-top: 3px;
      flex-shrink: 0;
      background: #FFFFFF;
      color: #10B981;
    }
    .checklist-box.checked {
      background: #ECFDF5;
      border-color: #10B981;
    }

    /* Callout & Alert Blocks (Yellow/Amber, Blue, Green, Red) */
    .callout {
      margin: 16px 0;
      padding: 12px 16px;
      border-radius: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
      font-size: 10pt;
      line-height: 1.55;
    }
    .callout-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
      font-weight: 700;
    }
    .callout-icon {
      font-size: 11pt;
    }
    .callout-content p {
      margin: 0 0 5px 0;
    }
    .callout-content p:last-child {
      margin: 0;
    }

    /* Warning / Caution / How to use: Yellow/Amber */
    .callout-warning, .callout-caution {
      background: #FEF9C3;
      border: 1.5px solid #F59E0B;
      color: #78350F;
    }
    .callout-warning .callout-header, .callout-caution .callout-header {
      color: #92400E;
    }

    /* Note / Info / Important: Soft Blue */
    .callout-note, .callout-important {
      background: #EFF6FF;
      border: 1.5px solid #3B82F6;
      color: #1E3A8A;
    }
    .callout-note .callout-header, .callout-important .callout-header {
      color: #1D4ED8;
    }

    /* Tip / Best Practice: Emerald Green */
    .callout-tip {
      background: #ECFDF5;
      border: 1.5px solid #10B981;
      color: #064E3B;
    }
    .callout-tip .callout-header {
      color: #047857;
    }

    /* Tables */
    .table-container {
      margin: 16px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      overflow: hidden;
    }
    .data-table th {
      background: #F1F5F9;
      color: #0F172A;
      font-weight: 700;
      text-align: left;
      padding: 9px 12px;
      border-bottom: 2px solid #CBD5E1;
      border-right: 1px solid #E2E8F0;
    }
    .data-table th:last-child {
      border-right: none;
    }
    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #E2E8F0;
      border-right: 1px solid #E2E8F0;
      vertical-align: top;
    }
    .data-table td:last-child {
      border-right: none;
    }
    .data-table tr:nth-child(even) td {
      background: #F8FAFC;
    }
    .data-table tr:last-child td {
      border-bottom: none;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .badge-very-high {
      background: #FEE2E2;
      color: #991B1B;
      border: 1px solid #F87171;
    }
    .badge-high {
      background: #FEF3C7;
      color: #92400E;
      border: 1px solid #FCD34D;
    }
    .badge-medium-high, .badge-medium {
      background: #EFF6FF;
      color: #1E40AF;
      border: 1px solid #93C5FD;
    }
    .badge-low {
      background: #F1F5F9;
      color: #475569;
      border: 1px solid #CBD5E1;
    }
    .badge-core {
      background: #EDE9FE;
      color: #5B21B6;
      border: 1px solid #C4B5FD;
    }
    .badge-active {
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #6EE7B7;
    }

    /* Code Blocks */
    .code-block {
      background: #0F172A;
      color: #F8FAFC;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9pt;
      line-height: 1.5;
      overflow-x: auto;
      margin: 14px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .inline-code {
      background: #F1F5F9;
      color: #0F172A;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
      font-size: 9pt;
      border: 1px solid #E2E8F0;
    }

    .divider {
      border: none;
      border-top: 1.5px solid #E2E8F0;
      margin: 24px 0;
    }
    .quote {
      border-left: 3px solid #3B82F6;
      background: #F8FAFC;
      padding: 10px 14px;
      margin: 14px 0;
      color: #334155;
      font-style: italic;
      border-radius: 0 6px 6px 0;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${!hasMainHeadingInMarkdown ? `
  <div class="document-hero">
    <h1 class="hero-title">${safeTitle}</h1>
    <div class="hero-meta-bar">
      <span class="hero-meta-badge">AI-Dost Blueprint</span>
      <span>Date: ${formattedDate}</span>
      <span>Status: Verified</span>
    </div>
  </div>` : ''}

  <div class="document-body">
    ${bodyHtml.join('\n')}
  </div>
</body>
</html>`;
}

/**
 * Builds a multi-page raw PDF file in pure Node.js as a resilient fallback.
 */
function buildPureNodePdf(markdown, title) {
  const lines = [];
  const cleanTitle = (title || 'Research Document').replace(/[^\x20-\x7E]/g, '');
  lines.push(`Title: ${cleanTitle}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('--------------------------------------------------');

  const rawLines = String(markdown || '').split('\n');
  for (const l of rawLines) {
    const trimmed = l.trim().replace(/[^\x20-\x7E]/g, ' ');
    if (!trimmed) {
      lines.push('');
      continue;
    }
    let remaining = trimmed;
    while (remaining.length > 75) {
      let sliceIndex = remaining.lastIndexOf(' ', 75);
      if (sliceIndex <= 0) sliceIndex = 75;
      lines.push(remaining.slice(0, sliceIndex));
      remaining = remaining.slice(sliceIndex).trim();
    }
    if (remaining.length > 0) lines.push(remaining);
  }

  const LINES_PER_PAGE = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push(['(Empty document)']);

  const numPages = pages.length;
  const pageObjectIds = [];
  for (let p = 0; p < numPages; p++) {
    pageObjectIds.push(3 + p);
  }
  const fontObjId = 3 + numPages * 2;

  let pdfOutput = `%PDF-1.4\n`;
  const offsets = [];

  const addObj = (id, str) => {
    offsets[id] = Buffer.byteLength(pdfOutput, 'utf-8');
    pdfOutput += str;
  };

  addObj(1, `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  addObj(2, `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`);

  for (let p = 0; p < numPages; p++) {
    const pageId = 3 + p;
    const streamId = 3 + numPages + p;
    addObj(pageId, `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\nendobj\n`);

    const pageLines = pages[p];
    let streamText = `BT /F1 10 Tf 50 800 Td 14 TL\n`;
    for (const pl of pageLines) {
      const safe = pl.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      streamText += `(${safe}) '\n`;
    }
    streamText += `ET\n`;

    const streamLen = Buffer.byteLength(streamText, 'utf-8');
    addObj(streamId, `${streamId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}endstream\nendobj\n`);
  }

  addObj(fontObjId, `${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  const xrefOffset = Buffer.byteLength(pdfOutput, 'utf-8');
  pdfOutput += `xref\n0 ${fontObjId + 1}\n`;
  pdfOutput += `0000000000 65535 f \n`;
  for (let i = 1; i <= fontObjId; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    pdfOutput += `${offStr} 00000 n \n`;
  }
  pdfOutput += `trailer\n<< /Size ${fontObjId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdfOutput, 'utf-8');
}

/**
 * Generates high-quality PDF from markdown.
 * Uses system Playwright Chromium with dynamic running header/footer templates and professional page formatting.
 */
async function generatePdfFile(markdown, title, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const cleanTitle = (title || 'Executive Document').trim();
  const html = markdownToHtml(markdown, cleanTitle);

  // Strategy 1: System Chrome / Edge via Playwright
  let browser = null;
  const launchOptions = [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
    { headless: true },
  ];

  for (const opts of launchOptions) {
    try {
      const { chromium } = require('@playwright/test');
      browser = await chromium.launch(opts);
      if (browser) break;
    } catch (_) {}
  }

  if (browser) {
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });

      const headerTitle = escapeHtml(cleanTitle);

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 8pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #475569; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 16mm; height: 12mm; border-bottom: 1px solid #e2e8f0;">
            <span style="font-weight: 600; color: #0f172a; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${headerTitle}</span>
            <span style="color: #64748b;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 8pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #64748b; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 16mm; height: 12mm; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b; font-weight: 500;">${headerTitle} – AI-Dost Blueprint</span>
            <span style="color: #64748b;">Page <span class="pageNumber"></span></span>
          </div>
        `,
        margin: { top: '22mm', bottom: '22mm', left: '16mm', right: '16mm' },
      });
      await browser.close();

      if (pdfBuffer && pdfBuffer.length > 2000) {
        fs.writeFileSync(outputPath, pdfBuffer);
        logger.info(`📄 [nodePdfService] High-fidelity Chromium PDF generated: ${outputPath} (${pdfBuffer.length} bytes)`);
        return { success: true, size: pdfBuffer.length, method: 'chromium' };
      }
    } catch (err) {
      logger.warn(`📄 [nodePdfService] Chromium PDF attempt failed: ${err.message}, falling back to pure Node.`);
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }

  // Strategy 2: Resilient Pure Node.js Multi-page PDF Generator
  try {
    const rawBuffer = buildPureNodePdf(markdown, cleanTitle);
    fs.writeFileSync(outputPath, rawBuffer);
    logger.info(`📄 [nodePdfService] Pure Node.js multi-page PDF generated: ${outputPath} (${rawBuffer.length} bytes)`);
    return { success: true, size: rawBuffer.length, method: 'pure_node' };
  } catch (err) {
    logger.error(`❌ [nodePdfService] Pure Node PDF failed: ${err.message}`);
    throw err;
  }
}

module.exports = {
  markdownToHtml,
  buildPureNodePdf,
  generatePdfFile,
};
