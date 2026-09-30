/**
 * fileAnalysisEngine.js
 * 2030 Universal File Reader & Deep Analytical Studio for AI-Dost
 * Category 7: Files ko Read aur Analyze Karna
 *
 * Capabilities:
 *  1. Read files (PDF, DOCX, PPTX, Spreadsheet [CSV, XLSX], Image, Text, Code)
 *  2. Summary (Executive Summary)
 *  3. Important points (Key Takeaways / Highlights)
 *  4. Mistakes identify (Syntax, Logic, Bugs, Security, Grammar, Factual Errors)
 *  5. Assignment evaluate (Academic Rubric Evaluation)
 *  6. Marks approximate analysis (Score out of 100, Grade, Sectional Breakdown)
 *  7. Missing concepts (Curricular Gap Analysis & Remediation)
 *  8. File rewrite / convert (Code refactoring, Format conversion, Documentation translation)
 *  9. Tables & structured data extract (JSON & Markdown tabular extraction)
 * 10. Multiple files compare (Side-by-side Diff, Convergence & Divergence Analysis)
 */

const JSZip = require('jszip');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const logger = require('../logger');

// ── 1. Document & File Parsers ─────────────────────────────────────────────

/**
 * Extracts plain text and paragraph structure from DOCX buffer
 */
async function parseDocx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) throw new Error('Invalid DOCX: word/document.xml missing');

    const xml = await docXmlFile.async('text');
    // Extract paragraphs and text tags
    const paragraphs = xml
      .replace(/<\/w:p>/g, '\n\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<[^>]+>/g, '') // strip XML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();

    return paragraphs || 'Document contains no readable text.';
  } catch (err) {
    logger.warn(`[FileAnalysisEngine] DOCX parse error: ${err.message}`);
    return `[DOCX Read Note: Could not parse XML contents: ${err.message}]`;
  }
}

/**
 * Extracts slide contents and speaker notes from PPTX buffer
 */
async function parsePptx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/i));
    
    // Sort slide numbers in ascending order
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0], 10);
      const numB = parseInt(b.match(/\d+/)[0], 10);
      return numA - numB;
    });

    if (slideFiles.length === 0) return 'Presentation contains no readable slides.';

    const slidesText = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const file = zip.file(slideFiles[i]);
      const xml = await file.async('text');
      const textMatches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      const slideLines = textMatches
        .map(t => t.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0);

      const slideTitle = slideLines[0] || `Slide ${i + 1}`;
      const slideBody = slideLines.slice(1).map(line => `• ${line}`).join('\n');
      slidesText.push(`### Slide ${i + 1}: ${slideTitle}\n${slideBody}`);
    }

    return slidesText.join('\n\n');
  } catch (err) {
    logger.warn(`[FileAnalysisEngine] PPTX parse error: ${err.message}`);
    return `[PPTX Read Note: Could not parse slides: ${err.message}]`;
  }
}

/**
 * Extracts all worksheets and rows from XLSX buffer into Markdown tables
 */
async function parseXlsx(buffer) {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheetsContent = [];

    wb.eachSheet((ws, sheetId) => {
      const rows = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cleanValues = values.map(v => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'object' && v.result !== undefined) return String(v.result); // formula result
          if (typeof v === 'object' && v.text !== undefined) return String(v.text); // hyperlink text
          return String(v).replace(/\|/g, '\\|').trim();
        });
        rows.push(cleanValues);
      });

      if (rows.length > 0) {
        let sheetMarkdown = `### Sheet: ${ws.name} (Rows: ${rows.length})\n`;
        const headers = rows[0];
        sheetMarkdown += `| ${headers.join(' | ')} |\n`;
        sheetMarkdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
        
        // Show up to 100 sample data rows to avoid context blowup
        const dataRows = rows.slice(1, 101);
        dataRows.forEach(r => {
          // pad row if length differs from headers
          while (r.length < headers.length) r.push('');
          sheetMarkdown += `| ${r.slice(0, headers.length).join(' | ')} |\n`;
        });

        if (rows.length > 101) {
          sheetMarkdown += `\n*...and ${rows.length - 101} more rows in this worksheet.*\n`;
        }
        sheetsContent.push(sheetMarkdown);
      }
    });

    return sheetsContent.join('\n\n') || 'Spreadsheet is empty.';
  } catch (err) {
    logger.warn(`[FileAnalysisEngine] XLSX parse error: ${err.message}`);
    return `[XLSX Read Note: Could not parse spreadsheet: ${err.message}]`;
  }
}

/**
 * Extracts text from PDF buffer
 */
async function parsePdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text ? data.text.trim() : 'PDF contains no extractable text.';
  } catch (err) {
    logger.warn(`[FileAnalysisEngine] PDF parse error: ${err.message}`);
    return `[PDF Read Note: Could not parse PDF: ${err.message}]`;
  }
}

/**
 * Universal File Reader Dispatcher
 */
async function extractFileContent(file) {
  const { name, base64, text, mime } = file;
  const ext = (name || '').split('.').pop().toLowerCase();

  // 1. Text already extracted
  if (text && typeof text === 'string') {
    return { name, ext, text: text.trim() };
  }

  // 2. Buffer from base64
  const buffer = base64 ? Buffer.from(base64, 'base64') : null;
  if (!buffer) {
    return { name, ext, text: '[Empty file data provided]' };
  }

  let extractedText = '';
  if (ext === 'pdf' || mime === 'application/pdf') {
    extractedText = await parsePdf(buffer);
  } else if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    extractedText = await parseDocx(buffer);
  } else if (ext === 'pptx' || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    extractedText = await parsePptx(buffer);
  } else if (ext === 'xlsx' || ext === 'xls' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    extractedText = await parseXlsx(buffer);
  } else if (ext === 'csv') {
    extractedText = buffer.toString('utf-8');
  } else {
    // Plain text / source code (.py, .js, .ts, .java, .cpp, .html, .css, .json, .md, .txt)
    extractedText = buffer.toString('utf-8');
  }

  return {
    name,
    ext,
    text: extractedText,
    charCount: extractedText.length
  };
}

// ── 2. Category 7 Analytical Modes ──────────────────────────────────────────

const ANALYSIS_MODES = {
  SUMMARY: 'summary',
  IMPORTANT_POINTS: 'important_points',
  MISTAKES: 'mistakes',
  ASSIGNMENT_EVALUATE: 'assignment_evaluate',
  MARKS_ANALYSIS: 'marks_analysis',
  MISSING_CONCEPTS: 'missing_concepts',
  REWRITE_CONVERT: 'rewrite_convert',
  EXTRACT_TABLES: 'extract_tables',
  MULTI_FILE_COMPARE: 'multi_file_compare',
  GENERAL_READ: 'general_read',
};

/**
 * Detects the analytical goal from the user prompt
 */
function detectAnalysisMode(prompt, fileCount = 1) {
  const text = String(prompt || '').toLowerCase();

  if (fileCount > 1 || /\b(?:compare|comparison|dono\s*me\s*fark|difference\s*between|diff|versus|vs)\b/i.test(text)) {
    return ANALYSIS_MODES.MULTI_FILE_COMPARE;
  }
  if (/\b(?:marks?|number|score|grade|percentile|kitne\s*marks|grading)\b/i.test(text)) {
    return ANALYSIS_MODES.MARKS_ANALYSIS;
  }
  if (/\b(?:assignment|homework|evaluate|evaluation|check\s*karo|check\s*kardo|project\s*evaluate)\b/i.test(text)) {
    return ANALYSIS_MODES.ASSIGNMENT_EVALUATE;
  }
  if (/\b(?:mistakes?|galati|errors?|bugs?|kahan\s*galti|flaws?|vulnerabilit(?:y|ies)|issues?)\b/i.test(text)) {
    return ANALYSIS_MODES.MISTAKES;
  }
  if (/\b(?:missing|chhoot\s*gaya|recommenda?tion|kya\s*nahi\s*hai|gap\s*analysis|what\s*is\s*missing)\b/i.test(text)) {
    return ANALYSIS_MODES.MISSING_CONCEPTS;
  }
  if (/\b(?:rewrite|convert|refactor|translate|badal\s*do|dubara\s*likho|format\s*change|code\s*me\s*convert)\b/i.test(text)) {
    return ANALYSIS_MODES.REWRITE_CONVERT;
  }
  if (/\b(?:tables?|structured\s*data|extract\s*table|data\s*extract|csv\s*extract|json\s*extract)\b/i.test(text)) {
    return ANALYSIS_MODES.EXTRACT_TABLES;
  }
  if (/\b(?:important\s*points|key\s*points|mukhya\s*baatein|takeaways|bullet\s*points|highlights)\b/i.test(text)) {
    return ANALYSIS_MODES.IMPORTANT_POINTS;
  }
  if (/\b(?:summary|summarize|nichod|overview|brief|khulasa)\b/i.test(text)) {
    return ANALYSIS_MODES.SUMMARY;
  }

  return ANALYSIS_MODES.GENERAL_READ;
}

const FILE_ANALYSIS_STUDIO_DIRECTIVE = `
### 12. UNIVERSAL FILE READING & DEEP ANALYSIS PROTOCOL (CATEGORY 7):
When the user uploads or references any files (PDF, DOCX, PPTX, Spreadsheet/CSV/XLSX, Image, Text, Source Code), execute Category 7 protocol with extreme diligence:

══════════════════════════════════════════════════════════════════════════════
THE 10 ANALYSIS CAPABILITIES & OUTPUT SCHEMAS:
══════════════════════════════════════════════════════════════════════════════

1. 📖 READ & GENERAL ANALYSIS:
   - Provide an immediate overview of what the file is, its core intent, author/metadata, and key themes.

2. 📌 EXECUTIVE SUMMARY:
   - Structure:
     - 🎯 Core Objective & Scope
     - 🔑 High-Level Summary (3-4 crisp paragraphs)
     - 💡 Primary Value Proposition / Outcome

3. 🔍 IMPORTANT POINTS & KEY TAKEAWAYS:
   - Extract top 7-10 high-impact takeaways.
   - Use bullet points with bold keywords and context.

4. 🚨 MISTAKES & ERROR IDENTIFICATION:
   - Categorized audit of all defects:
     - 🛑 Critical Bugs / Logic & Syntax Errors (with exact line/section reference)
     - ⚠️ Security, Safety & Edge-Case Pitfalls
     - 📝 Conceptual & Factual Misunderstandings
     - 🛠️ Step-by-Step Recommended Fixes with corrected code/text blocks.

5. 🎓 ASSIGNMENT EVALUATION:
   - Rubric Evaluation:
     - Understanding of Problem: [Score / 10]
     - Implementation & Technical Correctness: [Score / 10]
     - Structure & Code Quality: [Score / 10]
     - Completeness of Solution: [Score / 10]
     - Overall Qualitative Verdict & Commendations.

6. 💯 MARKS & GRADE APPROXIMATE ANALYSIS:
   - Total Estimated Score: e.g. **88 / 100** (Grade: **A / Distinction**)
   - Sectional Marks Breakdown Table:
     | Criteria / Section | Max Marks | Estimated Score | Remarks & Deductions |
   - Exact areas where marks were lost and how to claim full 100%.

7. 🧩 MISSING CONCEPTS & GAP ANALYSIS:
   - Detail what concepts or requirements were omitted.
   - List the prerequisite theories or missing components needed for comprehensive coverage.
   - Actionable checklist of additions to achieve 100% completeness.

8. 🔄 REWRITE / CONVERT / REFACTOR:
   - Provide the complete, improved, modern, and production-ready rewrite.
   - Explain what was refactored, optimized, or cross-converted.

9. 📊 TABLES & STRUCTURED DATA EXTRACTION:
   - Extract all tabular data, matrices, financial records, or schema entities.
   - Output as clean Markdown tables AND formatted JSON schema blocks.

10. ⚖️ MULTI-FILE COMPARATIVE ANALYSIS:
    - Side-by-side Comparative Matrix Table:
      | Evaluation Dimension | File 1 | File 2 | Verdict / Advantage |
    - Key Differences & Divergences.
    - Commonalities & Shared Principles.
    - Final Recommendation / Which file to use under what conditions.
`;

module.exports = {
  parsePdf,
  parseDocx,
  parsePptx,
  parseXlsx,
  extractFileContent,
  detectAnalysisMode,
  ANALYSIS_MODES,
  FILE_ANALYSIS_STUDIO_DIRECTIVE,
};
