/**
 * AI-Dost Document Engine v3.0 - THE NUCLEAR FIX
 * This version removes all AI "personality" and conversational filler.
 * It focuses on RAW, structured content that follows the user's genre demand.
 */
const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const artifactService = require('../services/artifactService');
const { resolveDownloadsDir } = require('../services/downloadsDir');
const { selfBaseUrl } = require('../services/selfUrl');
const DOWNLOADS_DIR = resolveDownloadsDir();
const BASE = selfBaseUrl();

router.use((req, res, next) => {
    if (req.method === 'POST') {
        try {
            const { sweepDownloads } = require('../services/downloadStore');
            setImmediate(() => sweepDownloads(DOWNLOADS_DIR));
        } catch(e) {}
    }
    next();
});

// ── THE RAW CONTENT ENGINE (Zero Filler) ─────────────────────────────────────
async function generateRawContent(topic, type) {
    try {
        const MoERouterService = require('../services/moeRouterService');
        
        // GENRE MAPPING: Hard-coded structural requirements
        const genreMap = {
            'pdf': 'Professional Document / Report',
            'docx': 'Professional Document / Report',
            'pptx': 'Presentation Slides',
            'csv': 'Data Table',
            'xlsx': 'Structured Spreadsheet'
        };

        const genre = genreMap[type] || 'General Document';
        
        // THE "NUCLEAR" PROMPT: No personality, no chatbotting, just the raw output.
        const strictPrompt = `SYSTEM: You are a raw content generator. You produce NO conversational text.
        GENRE: ${genre}
        USER DEMAND: ${topic}
        
        STRICT OUTPUT RULES:
        1. START IMMEDIATELY with the content. 
        2. NO "Here is your...", "Certainly!", "I have generated...", or any other intro/outro.
        3. NO markdown chat tags like [DOWNLOAD_ARTIFACT].
        4. FORMATTING:
           - If "Nibandh/Essay" -> Write a deep, structured essay with paragraphs.
           - If "Letter/Application" -> Use Formal Letter Format (Date, To, From, Subject, Body, Regards).
           - If "Lyrics/Poem" -> Use stanzas and verses.
           - If "Resume/CV" -> Use professional sections.
           - If "Recipe/Guide" -> Use Ingredients and Numbered Steps.
        5. If the user provided a language (Hindi/English/Hinglish), use it strictly.
        6. RETURN ONLY THE RAW CONTENT.
        
        CONTENT:`;

        const route = MoERouterService.analyzeAndRoute(strictPrompt, 'document', false, false, true, false);
        const result = await MoERouterService.executeExpert(route, strictPrompt, strictPrompt, [], '', 'chat', {});
        
        let content = result.response || '';
        
        // POST-PROCESSING: Strip any accidental chatbot filler
        // Remove lines that look like "Here is your..." or "I hope this..."
        const lines = content.split('\\n');
        const filteredLines = lines.filter(line => {
            const lower = line.toLowerCase();
            return !(
                lower.startsWith('here is') || 
                lower.startsWith('certainly') || 
                lower.startsWith('i have') || 
                lower.startsWith('sure') || 
                lower.startsWith('i hope') ||
                lower.includes('generated a pdf')
            );
        });
        
        content = filteredLines.join('\\n').trim();
        
        if (content && content.length >= 30) return content;
    } catch (e) {
        logger.error(`📄 Raw Content Generation Error: ${e.message}`);
    }
    throw new Error('Failed to generate content');
}

// ── Word (.docx) ───────────────────────────────────────────────────────────
async function buildDocx(markdown, title, filename) {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
    const children = [];
    children.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, size: 40, color: '1C2030' })],
        spacing: { after: 300 },
    }));
    for (const rawLine of markdown.split('\\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        const runs = [];
        const parts = line.split(/\\*\\*(.+?)\\*\\*/g);
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            runs.push(new TextRun({ text: parts[i], bold: i % 2 === 1 }));
        }
        if (line.startsWith('### ')) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs, spacing: { before: 200, after: 100 } }));
        } else if (line.startsWith('## ')) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: runs, spacing: { before: 260, after: 120 } }));
        } else if (line.startsWith('# ')) {
            children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs, spacing: { before: 320, after: 160 } }));
        } else if (/^[-*•] /.test(line)) {
            children.push(new Paragraph({ bullet: { level: 0 }, children: runs, spacing: { after: 60 } }));
        } else if (/^\\d+\\. /.test(line)) {
            children.push(new Paragraph({ numbering: { reference: 'ordered-list', level: 0 }, children: runs, spacing: { after: 60 } }));
        } else {
            children.push(new Paragraph({ children: runs, spacing: { after: 120 } }));
        }
    }
    const doc = new Document({
        numbering: { config: [{ reference: 'ordered-list', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }] }] },
        styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
        sections: [{ children }],
    });
    const buffer = await Packer.toBuffer(doc);
    const filePath = path.join(DOWNLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return filename;
}

// ── PDF via nodePdfService ──────────────────────────────────────────────────
const { generatePdfFile } = require('../services/nodePdfService');
async function buildPdf(markdown, title, filename) {
    const outputPdfPath = path.join(DOWNLOADS_DIR, filename);
    await generatePdfFile(markdown, title, outputPdfPath);
    return filename;
}

// ── PowerPoint (.pptx) ─────────────────────────────────────────────────────
async function buildPptx(deckJson, title, filename) {
    const pptxgen = require('pptxgenjs');
    const pptx = new pptxgen();
    pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
    pptx.layout = 'WIDE';
    pptx.author = 'AI-Dost';
    pptx.subject = title;
    const s0 = pptx.addSlide();
    s0.background = { color: '1C2030' };
    s0.addText(title, { x: 0.8, y: 2.3, w: 11.7, h: 1.8, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Segoe UI' });
    s0.addText('AI-Dost Presentation', { x: 0.8, y: 4.3, w: 11.7, h: 0.6, fontSize: 16, color: '4B8BFC', align: 'center' });
    const slides = (deckJson.slides || []).slice(0, 14);
    for (const [idx, s] of slides.entries()) {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.16, fill: { color: '4B8BFC' } });
        slide.addText(s.title || `Slide ${idx + 1}`, { x: 0.7, y: 0.45, w: 11.9, h: 0.9, fontSize: 28, bold: true, color: '1C2030', fontFace: 'Segoe UI' });
        const points = (s.points || []).map(p => ({ text: p, options: { bullet: true, color: '333333', fontSize: 18, breakLine: true, paraSpaceAfter: 10 } }));
        slide.addText(points, { x: 0.9, y: 1.6, w: 11.5, h: 5.3, valign: 'top', fontFace: 'Segoe UI' });
    }
    await pptx.writeFile({ fileName: path.join(DOWNLOADS_DIR, filename) });
    const filePath = path.join(DOWNLOADS_DIR, filename);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1000) throw new Error('PPTX file write failed');
    return filename;
}

// ── CSV ────────────────────────────────────────────────────────────────────
function buildCsv(csvText, filename) {
    const cleaned = String(csvText).replace(/```csv\\s*/gi, '').replace(/```\\s*/g, '').trim();
    const rows = cleaned.split('\\n').filter(r => r.trim().length > 1);
    if (rows.length < 4) throw new Error('CSV content too short');
    const filePath = path.join(DOWNLOADS_DIR, filename);
    fs.writeFileSync(filePath, '\\uFEFF' + cleaned + '\\n', 'utf-8');
    return filename;
}

// ── Excel (.xlsx) via Node.js exceljs ───────────────────────────────────────
async function buildXlsxNode(jsonContent, title, filename) {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'AI-Dost';
    const ws = wb.addWorksheet(title.slice(0, 31));
    let columns = [], dataRows = [];
    try {
        const src = String(jsonContent);
        const stripped = src.replace(/```json\\s*/gi, '').replace(/```\\s*/g, '').trim();
        const start = stripped.indexOf('{');
        const end = stripped.lastIndexOf('}');
        const parsed = JSON.parse(stripped.slice(start, end + 1));
        columns = parsed.columns || [];
        dataRows = parsed.rows || [];
    } catch (_) {
        columns = ['Topic', 'Category', 'Detail', 'Status', 'Notes'];
        dataRows = [[title, 'Overview', 'AI-generated data', 'Active', 'Generated by AI-Dost']];
    }
    const headerRow = ws.addRow(columns);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B8BFC' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    ws.getRow(1).height = 22;
    dataRows.forEach((rowData, i) => {
        const row = ws.addRow(rowData);
        const bg = i % 2 === 0 ? 'FFF0F4FF' : 'FFFFFFFF';
        row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.font = { size: 11 };
        });
    });
    columns.forEach((_, i) => {
        const col = ws.getColumn(i + 1);
        let maxLen = String(columns[i] || '').length;
        dataRows.forEach(r => { maxLen = Math.max(maxLen, String(r[i] || '').length); });
        col.width = Math.min(Math.max(maxLen + 4, 12), 45);
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const outPath = path.join(DOWNLOADS_DIR, filename);
    await wb.xlsx.writeFile(outPath);
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 500) throw new Error('XLSX write failed');
    return filename;
}

const TYPE_EXT = { docx: '.docx', pptx: '.pptx', csv: '.csv', pdf: '.pdf', xlsx: '.xlsx' };

function sanitizeDocumentTitle(raw) {
    if (!raw || typeof raw !== 'string') return 'Document';
    let cleaned = raw.replace(/^\s*(\[GENERATE_[A-Z]+:\s*|\[.*?\])\s*/i, '').replace(/\b(please\s+)?(write|create|generate|make|build|draft|export|download|banao|bana\s*do|likho|likhdo|mujhe|ek)\s+(a\s+|an\s+|the\s+|mera\s+|meri\s+)?(report|document|presentation|slides?|pdf|file|csv|spreadsheet|xlsx|excel|paper|doc)?\s*(on|about|for|pe|par|ka|ki|ke)?\s*/gi, '').replace(/\[\/?[A-Z_]+\]/g, '').trim();
    if (!cleaned || cleaned.length < 3) cleaned = raw.replace(/[\[\]]/g, '').trim();
    cleaned = cleaned.replace(/^[ \\-_.]+|[ \\-_.]+$/g, '');
    if (!cleaned) cleaned = 'Document';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 80);
}

router.post('/generate', async (req, res) => {
    const { type, topic, title, content: explicitContent, markdown: explicitMarkdown } = req.body;
    const t = (type || '').toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'csv', 'xlsx'].includes(t)) {
        return res.status(400).json({ success: false, error: 'type must be docx | pptx | csv | pdf | xlsx' });
    }
    if ((!topic || !topic.trim()) && !explicitContent && !explicitMarkdown) {
        return res.status(400).json({ success: false, error: 'Topic or content required' });
    }
    try {
        const safeTitle = sanitizeDocumentTitle(title || topic || 'Research Document');
        const cleanTopic = sanitizeDocumentTitle(topic || safeTitle);
        let content = explicitContent || explicitMarkdown;
        if (content && typeof content === 'string' && content.trim().length >= 30) {
            logger.info(`📄 Using explicit content provided in request for ${t}`);
        } else {
            try {
                content = await generateRawContent(cleanTopic, t);
            } catch (e) {
                logger.warn(`📄 Raw content generation failed, using template: ${e.message}`);
                content = templateContent(t, cleanTopic);
            }
        }
        const fileId = crypto.randomUUID().substring(0, 8);
        const slug = safeTitle.toLowerCase().replace(/[^a-z0-9\\u0900-\\u097F]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
        const filename = `${slug || 'doc'}_${fileId}${TYPE_EXT[t]}`;
        let finalName;
        if (t === 'pdf') {
            finalName = await buildPdf(content, safeTitle, filename);
        } else if (t === 'docx') {
            finalName = await buildDocx(content, safeTitle, filename);
        } else if (t === 'pptx') {
            let deck;
            try {
                const src = String(content);
                const stripped = src.replace(/```json\\s*/gi, '').replace(/```\\s*/g, '').trim();
                const start = stripped.indexOf('{');
                const end = stripped.lastIndexOf('}');
                deck = JSON.parse(stripped.slice(start, end + 1));
            } catch (_) {
                deck = JSON.parse(templateContent('pptx', topic));
            }
            finalName = await buildPptx(deck, deck.title || safeTitle, filename);
        } else if (t === 'xlsx') {
            finalName = await buildXlsxNode(content, safeTitle, filename);
        } else {
            finalName = buildCsv(content, filename);
        }
        const fullDocPath = path.join(DOWNLOADS_DIR, finalName);
        const registeredArtifact = artifactService.registerFile({
            filePath: fullDocPath,
            projectId: req.body.projectId || 'default',
            conversationId: req.body.conversationId || null,
            taskId: req.body.taskId || null,
            name: finalName,
            type: `document_${t}`,
            metadata: { topic, title: safeTitle, generatedAt: new Date().toISOString() },
            userId: req.body.userId || 'local-user'
        });
        res.json({
            success: true,
            type: t,
            downloadUrl: `/downloads/${finalName}`,
            filename: finalName,
            artifactId: registeredArtifact?.id || null,
            message: `${t.toUpperCase()} file ready! [DOWNLOAD_ARTIFACT: /downloads/${finalName}]`,
        });
    } catch (e) {
        logger.error(`Document generation (${t}) error:`, e.message);
        res.status(500).json({ success: false, error: `Document generation failed: ${e.message}` });
    }
});

module.exports = router;
