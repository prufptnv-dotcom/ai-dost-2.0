const logger = require('../logger');
const { extractFileContent, detectAnalysisMode, FILE_ANALYSIS_STUDIO_DIRECTIVE } = require('../services/fileAnalysisEngine');
const { withQualityStandard } = require('../services/outputQualityStandard');
const GroqService = require('../services/groqService');
const CerebrasService = require('../services/cerebrasService');

exports.handleFileAnalysis = async (req, res) => {
    const { message, text, imageBase64, imageMime, pdfBase64, docxBase64, pptxBase64, xlsxBase64, files } = req.body;
    
    // Normalize incoming files into a unified array
    const rawFiles = Array.isArray(files) && files.length > 0 ? [...files] : [];
    if (pdfBase64) rawFiles.push({ name: 'document.pdf', base64: pdfBase64, mime: 'application/pdf' });
    if (docxBase64) rawFiles.push({ name: 'document.docx', base64: docxBase64, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    if (pptxBase64) rawFiles.push({ name: 'presentation.pptx', base64: pptxBase64, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    if (xlsxBase64) rawFiles.push({ name: 'spreadsheet.xlsx', base64: xlsxBase64, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (text) rawFiles.push({ name: 'snippet.txt', text });

    if (!message && !imageBase64 && rawFiles.length === 0) {
        return res.status(400).json({ success: false, error: 'Nothing to analyze. Upload a PDF, DOCX, PPTX, XLSX, CSV, image, or text file.' });
    }

    // 1. Extract content across all provided files
    const parsedFiles = [];
    for (const f of rawFiles) {
        try {
            const extracted = await extractFileContent(f);
            parsedFiles.push(extracted);
        } catch (fErr) {
            logger.warn(`[Analyze] File extract error for ${f.name}: ${fErr.message}`);
            parsedFiles.push({ name: f.name || 'file', ext: '', text: `[Error reading file: ${fErr.message}]` });
        }
    }

    // 2. Detect Analytical Mode & Intent
    const mode = detectAnalysisMode(message, parsedFiles.length);

    // 3. Assemble Consolidated Context
    let contextText = '';
    if (parsedFiles.length === 1) {
        contextText = `FILE NAME: ${parsedFiles[0].name}\nFILE EXTENSION: .${parsedFiles[0].ext}\n\nCONTENT:\n${parsedFiles[0].text}`;
    } else if (parsedFiles.length > 1) {
        contextText = `MULTIPLE FILES FOR COMPARISON & ANALYSIS (${parsedFiles.length} files):\n\n` +
            parsedFiles.map((pf, idx) => `══════════════════════════════════════════════════════════════\nFILE ${idx + 1}: ${pf.name} (.${pf.ext})\n══════════════════════════════════════════════════════════════\n${pf.text}`).join('\n\n');
    }

    // Trim context safely if too large for prompt budget
    if (contextText.length > 35000) {
        contextText = contextText.slice(0, 35000) + '\n\n[...content truncated for context budget...]';
    }

    // 4. Build 2030 Executive Analysis Prompt
    const userPrompt = message || (imageBase64 ? 'Analyze this image and explain what is depicted with high accuracy.' : 'Provide a comprehensive executive analysis and summary of this file in Hinglish.');

    const systemPrompt = `${FILE_ANALYSIS_STUDIO_DIRECTIVE}

CURRENT TASK DIRECTIVE:
You are AI-Dost's Master Analyst & Auditor.
The user has uploaded ${parsedFiles.length} file(s) and requested analysis mode: "${mode}".
Deliver a top-tier, authoritative, exhaustive response adhering strictly to the Category 7 Protocol.
Ensure all tables, metrics, rubrics, and code blocks are completely filled out with concrete facts (no placeholders).`;

    // 5. Multi-Model Cascade
    // Attempt 1: Gemini Vision / Multimodal (handles images + rich file text)
    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        let parts = [];
        if (contextText) {
            parts.push({ text: `${contextText}\n\nUSER INSTRUCTION: ${userPrompt}` });
        } else {
            parts.push({ text: userPrompt });
        }
        if (imageBase64) {
            parts.unshift({
                inlineData: {
                    mimeType: imageMime || 'image/png',
                    data: imageBase64
                }
            });
        }

        const geminiModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const gModel of geminiModels) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 45000);
                const r = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts }],
                            systemInstruction: { parts: [{ text: withQualityStandard(systemPrompt) }] }
                        }),
                        signal: controller.signal
                    }
                );
                clearTimeout(timer);
                if (r.ok) {
                    const data = await r.json();
                    const reply = (data?.candidates?.[0]?.content?.parts || [])
                        .map((p) => p.text).filter(Boolean).join('\n');
                    if (reply && reply.length > 20) {
                        return res.json({
                            success: true,
                            reply,
                            mode,
                            fileCount: parsedFiles.length,
                            provider: imageBase64 ? `gemini-vision (${gModel})` : `gemini-analysis (${gModel})`
                        });
                    }
                }
            } catch (errModel) {
                logger.warn(`[Analyze] Gemini model ${gModel} failed:`, errModel.message);
            }
        }
    } catch (e) {
        logger.warn('[Analyze] Gemini cascade failed:', e.message);
    }

    // Attempt 2: Groq Cascade Fallback
    try {
        const groqPrompt = `${systemPrompt}\n\n${contextText ? contextText.slice(0, 16000) + '\n\n' : ''}USER INSTRUCTION: ${userPrompt}`;
        const reply = await GroqService.chat(groqPrompt, [], 'chat');
        if (reply && !reply.startsWith('Groq')) {
            return res.json({
                success: true,
                reply,
                mode,
                fileCount: parsedFiles.length,
                provider: 'groq-analysis'
            });
        }
    } catch (e) {
        logger.warn('[Analyze] Groq fallback failed:', e.message);
    }

    // Attempt 3: Cerebras / OpenRouter Fallback
    try {
        const cerebrasPrompt = `${systemPrompt}\n\n${contextText ? contextText.slice(0, 14000) + '\n\n' : ''}USER INSTRUCTION: ${userPrompt}`;
        const reply = await CerebrasService.chat(cerebrasPrompt, [], 'chat');
        if (reply && reply.length > 20) {
            return res.json({
                success: true,
                reply,
                mode,
                fileCount: parsedFiles.length,
                provider: 'cerebras-analysis'
            });
        }
    } catch (e) {
        logger.warn('[Analyze] Cerebras fallback failed:', e.message);
    }

    return res.json({
        success: true,
        reply: 'File ka analysis poori tarah se generate nahi ho paya — kripya dobara try karein.',
        provider: 'none'
    });
};
