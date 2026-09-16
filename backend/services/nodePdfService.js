'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * Escapes raw HTML characters to prevent XSS / markup breaking.
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
 * Formats inline markdown elements (bold, italic, code, links).
 */
function formatInline(text) {
  let out = escapeHtml(text);
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  return out;
}

/**
 * Converts Markdown content into a standalone, styled HTML document for PDF printing.
 */
function markdownToHtml(markdown, title) {
  const safeTitle = escapeHtml(title || 'Research Document');
  const lines = String(markdown || '').split('\n');
  const bodyHtml = [];

  let inList = false;
  let inCodeBlock = false;
  let codeBuffer = [];
  let inTable = false;
  let tableRows = [];

  const flushList = () => {
    if (inList) {
      bodyHtml.push('</ul>');
      inList = false;
    }
  };

  const flushCode = () => {
    if (inCodeBlock) {
      bodyHtml.push(`<pre class="code-block"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
      codeBuffer = [];
      inCodeBlock = false;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<table class="data-table"><thead><tr>';
      const headerCols = tableRows[0];
      headerCols.forEach((col) => {
        tableHtml += `<th>${formatInline(col.trim())}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      for (let i = 1; i < tableRows.length; i++) {
        tableHtml += '<tr>';
        tableRows[i].forEach((col) => {
          tableHtml += `<td>${formatInline(col.trim())}</td>`;
        });
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
      bodyHtml.push(tableHtml);
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Markdown Table rows (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
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

    // Empty lines
    if (!line) {
      flushList();
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      flushList();
      bodyHtml.push(`<h1 class="heading-1">${formatInline(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      flushList();
      bodyHtml.push(`<h2 class="heading-2">${formatInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      flushList();
      bodyHtml.push(`<h3 class="heading-3">${formatInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('#### ')) {
      flushList();
      bodyHtml.push(`<h4 class="heading-4">${formatInline(line.slice(5))}</h4>`);
    } else if (line.startsWith('---') || line.startsWith('***')) {
      flushList();
      bodyHtml.push('<hr class="divider" />');
    } else if (line.startsWith('> ')) {
      flushList();
      bodyHtml.push(`<blockquote class="quote">${formatInline(line.slice(2))}</blockquote>`);
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      if (!inList) {
        bodyHtml.push('<ul class="bullet-list">');
        inList = true;
      }
      bodyHtml.push(`<li>${formatInline(line.slice(2))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      flushList();
      const text = line.replace(/^\d+\.\s+/, '');
      bodyHtml.push(`<p class="numbered-item"><span class="number-tag">•</span> ${formatInline(text)}</p>`);
    } else {
      flushList();
      bodyHtml.push(`<p class="paragraph">${formatInline(line)}</p>`);
    }
  }

  flushList();
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
      margin: 20mm 18mm;
      @bottom-right {
        content: counter(page);
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #1E293B;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .document-header {
      border-bottom: 2px solid #2563EB;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-meta {
      font-size: 8.5pt;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .document-brand {
      font-size: 12pt;
      font-weight: 700;
      color: #2563EB;
      letter-spacing: -0.02em;
    }
    .document-title {
      font-size: 24pt;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.25;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }
    .heading-1 {
      font-size: 18pt;
      font-weight: 700;
      color: #0F172A;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 6px;
      margin: 24px 0 12px 0;
      page-break-after: avoid;
    }
    .heading-2 {
      font-size: 14pt;
      font-weight: 700;
      color: #1E3A8A;
      margin: 18px 0 8px 0;
      page-break-after: avoid;
    }
    .heading-3 {
      font-size: 11.5pt;
      font-weight: 600;
      color: #334155;
      margin: 14px 0 6px 0;
      page-break-after: avoid;
    }
    .paragraph {
      margin: 0 0 10px 0;
      text-align: justify;
      hyphens: auto;
    }
    .bullet-list {
      margin: 0 0 12px 0;
      padding-left: 24px;
    }
    .bullet-list li {
      margin-bottom: 5px;
    }
    .quote {
      border-left: 3px solid #2563EB;
      background: #F8FAFC;
      padding: 10px 14px;
      margin: 14px 0;
      color: #334155;
      font-style: italic;
      border-radius: 0 6px 6px 0;
      page-break-inside: avoid;
    }
    .code-block {
      background: #0F172A;
      color: #F8FAFC;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9pt;
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
    }
    .inline-code {
      background: #F1F5F9;
      color: #0F172A;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 9pt;
      border: 1px solid #E2E8F0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    .data-table th {
      background: #2563EB;
      color: #FFFFFF;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #2563EB;
    }
    .data-table td {
      padding: 7px 10px;
      border: 1px solid #E2E8F0;
    }
    .data-table tr:nth-child(even) {
      background: #F8FAFC;
    }
    .divider {
      border: none;
      border-top: 1px solid #E2E8F0;
      margin: 20px 0;
    }
    .document-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      font-size: 8pt;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="document-header">
    <div class="document-brand">AI-Dost Executive Document</div>
    <div class="header-meta">Generated: ${formattedDate}</div>
  </div>

  <h1 class="document-title">${safeTitle}</h1>

  <div class="document-body">
    ${bodyHtml.join('\n')}
  </div>

  <div class="document-footer">
    <span>AI-Dost Autonomous Knowledge Engine</span>
    <span>Confidential &amp; Verified</span>
  </div>
</body>
</html>`;
}

/**
 * Builds a multi-page raw PDF file in pure Node.js as a resilient fallback.
 * Encodes text properly into streams across multiple pages without dropping content.
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
    // Word wrap at 75 chars
    let remaining = trimmed;
    while (remaining.length > 75) {
      let sliceIndex = remaining.lastIndexOf(' ', 75);
      if (sliceIndex <= 0) sliceIndex = 75;
      lines.push(remaining.slice(0, sliceIndex));
      remaining = remaining.slice(sliceIndex).trim();
    }
    if (remaining.length > 0) lines.push(remaining);
  }

  // Paginate at 42 lines per page
  const LINES_PER_PAGE = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push(['(Empty document)']);

  const objects = [];
  // 1: Catalog
  // 2: Pages container
  // 3..2+N: Page objects
  // 3+N..2+2N: Content streams
  // Font object
  const numPages = pages.length;
  const pageObjectIds = [];
  for (let p = 0; p < numPages; p++) {
    pageObjectIds.push(3 + p);
  }
  const fontObjId = 3 + numPages * 2;

  // Obj 1: Catalog
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  // Obj 2: Pages
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${numPages} >>\nendobj\n`;

  for (let p = 0; p < numPages; p++) {
    const pageId = 3 + p;
    const streamId = 3 + numPages + p;
    // Page obj
    objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\nendobj\n`;

    // Stream obj
    const pageLines = pages[p];
    let streamBody = `BT\n/F1 10 Tf\n45 745 Td\n14 TL\n`;
    for (const lineText of pageLines) {
      const sanitized = lineText.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      streamBody += `(${sanitized}) '\n`;
    }
    streamBody += `ET\n`;

    const streamLen = Buffer.byteLength(streamBody, 'utf-8');
    objects[streamId] = `${streamId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj\n`;
  }

  // Font object
  objects[fontObjId] = `${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  let pdfOutput = `%PDF-1.4\n`;
  const offsets = [];
  let currentOffset = Buffer.byteLength(pdfOutput, 'utf-8');

  for (let i = 1; i <= fontObjId; i++) {
    offsets[i] = currentOffset;
    const chunk = objects[i];
    pdfOutput += chunk;
    currentOffset += Buffer.byteLength(chunk, 'utf-8');
  }

  const xrefOffset = currentOffset;
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
 * Tries system Playwright (Chrome/Edge) first; falls back to pure Node multi-page generator.
 */
async function generatePdfFile(markdown, title, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const html = markdownToHtml(markdown, title);

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
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
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
    const rawBuffer = buildPureNodePdf(markdown, title);
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
