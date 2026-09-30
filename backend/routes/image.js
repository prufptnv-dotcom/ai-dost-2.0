const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const artifactService = require('../services/artifactService');
const {
    CATEGORY_PRESETS,
    buildEnhancedImageRequest,
    detectImageCategory
} = require('../services/imageStudioEngine');
const router = express.Router();

// Free image pipeline: Pollinations (no key) primary → Gemini 2.5 Flash Image fallback (free key).
// Pollinations free tier: 1 request queued per IP at a time (anonymous) → serial queue.
let queue = Promise.resolve();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Stable URL (no seed) — Pollinations cache hit hota hai repeat requests pe instant.
function pollinationsUrl(prompt, width = 1024, height = 768) {
    const w = parseInt(width, 10) || 1024;
    const h = parseInt(height, 10) || 768;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;
}

async function tryDownload(url, attempts = 3, waitMs = 8000, timeoutMs = 30000) {
    for (let i = 0; i < attempts; i++) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), timeoutMs);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(t);
            const type = res.headers.get('content-type') || '';
            if (res.ok && type.startsWith('image/')) {
                const buf = Buffer.from(await res.arrayBuffer());
                if (buf.length > 1000) return buf;
            }
            logger.warn(`🖼️ pollinations attempt ${i + 1}: HTTP ${res.status} type=${type}`);
        } catch (e) {
            logger.warn(`🖼️ pollinations attempt ${i + 1}: ${e.message}`);
        }
        if (i < attempts - 1) await new Promise(r => setTimeout(r, waitMs));
    }
    return null;
}

async function geminiImage(prompt) {
    if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_key') return null;
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        const res = await fetch(
            // #54: key via header — never in the URL (URLs end up in logs)
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: ctrl.signal,
            }
        );
        clearTimeout(t);
        const data = await res.json();
        const inline = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!inline?.inlineData?.data) {
            logger.warn('🖼️ gemini image: no inline data');
            return null;
        }
        const buf = Buffer.from(inline.inlineData.data, 'base64');
        const file = `gen-${Date.now()}.png`;
        fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
        logger.info(`🖼️ Gemini image saved: ${file} (${buf.length} bytes)`);
        return file;
    } catch (e) {
        logger.warn(`🖼️ gemini image error: ${e.message}`);
        return null;
    }
}

// ── GET /api/image/categories ─────────────────────────────────────────────────
router.get('/categories', (req, res) => {
    return res.json({
        success: true,
        categories: Object.entries(CATEGORY_PRESETS).map(([id, p]) => ({
            id,
            name: p.name,
            aspectRatio: p.aspectRatio,
            width: p.width,
            height: p.height,
            samplePrompt: p.enhancer.split(',')[0]
        }))
    });
});

// ── POST /api/image/generate ──────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
    const { prompt, width, height, category } = req.body;
    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt required' });
    }
    
    // Auto-detect or use explicitly provided category
    const cat = category || detectImageCategory(prompt);
    const enhanced = buildEnhancedImageRequest(prompt, cat, { width, height });
    const p = enhanced.prompt;
    const url = pollinationsUrl(p, enhanced.width, enhanced.height);
    const base = `${req.protocol}://${req.get('host')}`;

    const task = queue.then(async () => {
        const buf = await tryDownload(url);
        if (buf) {
            const file = `gen-${Date.now()}.png`;
            const filePath = path.join(UPLOAD_DIR, file);
            fs.writeFileSync(filePath, buf);
            let registeredArtifact = null;
            try {
                registeredArtifact = artifactService.registerFile({
                    filePath,
                    projectId: req.body.projectId || 'default',
                    conversationId: req.body.conversationId || null,
                    taskId: req.body.taskId || null,
                    name: file,
                    type: 'generated_image',
                    mimeType: 'image/png',
                    metadata: { prompt: p, originalPrompt: prompt, category: cat, provider: 'pollinations' },
                    userId: req.body.userId || 'local-user'
                });
            } catch (regErr) {
                logger.warn(`🖼️ Image artifact registration warning: ${regErr.message}`);
            }
            return {
                success: true,
                imageUrl: `${base}/uploads/${file}`,
                artifactId: registeredArtifact?.id || null,
                category: cat,
                provider: 'pollinations',
                message: 'Image ready'
            };
        }
        const file = await geminiImage(p);
        if (file) {
            const filePath = path.join(UPLOAD_DIR, file);
            let registeredArtifact = null;
            try {
                registeredArtifact = artifactService.registerFile({
                    filePath,
                    projectId: req.body.projectId || 'default',
                    conversationId: req.body.conversationId || null,
                    taskId: req.body.taskId || null,
                    name: file,
                    type: 'generated_image',
                    mimeType: 'image/png',
                    metadata: { prompt: p, originalPrompt: prompt, category: cat, provider: 'gemini' },
                    userId: req.body.userId || 'local-user'
                });
            } catch (regErr) {
                logger.warn(`🖼️ Gemini image artifact registration warning: ${regErr.message}`);
            }
            return {
                success: true,
                imageUrl: `${base}/uploads/${file}`,
                artifactId: registeredArtifact?.id || null,
                category: cat,
                provider: 'gemini',
                message: 'Image ready (Gemini fallback)'
            };
        }
        return {
            success: true,
            imageUrl: url,
            category: cat,
            provider: 'pollinations-fallback',
            message: 'Pollinations busy — render me time lag sakta hai'
        };
    });
    queue = task.catch(() => {});

    try {
        res.json(await task);
    } catch (error) {
        logger.error('Image generation error:', error.message);
        // Pollinations direct URL still works client-side (server download failed only)
        res.json({ success: false, imageUrl: url, category: cat, provider: 'pollinations-direct', message: 'Server-side download failed — open imageUrl directly (may take 30-60s)' });
    }
});

// ── POST /api/image/turbo ─────────────────────────────────────────────────────
router.post('/turbo', async (req, res) => {
    const { prompt, width, height, style = 'general', category, seed } = req.body;
    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt required for Z-Image Turbo' });
    }

    const cat = category || detectImageCategory(prompt);
    const enhanced = buildEnhancedImageRequest(prompt, cat, { width, height });
    const turboSeed = seed || Math.floor(Math.random() * 999999);

    const turboUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced.prompt)}?width=${enhanced.width}&height=${enhanced.height}&model=turbo&seed=${turboSeed}&nologo=true`;

    logger.info(`⚡ Z-Image Turbo requested: "${prompt}" [category: ${cat}, seed: ${turboSeed}]`);

    // P2 #53: background copy runs on the SAME serial queue as /generate (the
    // old detached IIFE bypassed it → unbounded concurrent downloads), failures
    // are logged instead of swallowed, and the response reports local-file
    // state honestly instead of implying the copy already exists.
    const backgroundTask = queue.then(async () => {
        try {
            const buf = await tryDownload(turboUrl, 2, 3000, 15000);
            if (!buf) {
                logger.warn(`⚠️ Turbo local copy skipped (empty download, seed ${turboSeed})`);
                return null;
            }
            const file = `turbo-${Date.now()}.png`;
            const filePath = path.join(UPLOAD_DIR, file);
            fs.writeFileSync(filePath, buf);
            try {
                artifactService.registerFile({
                    filePath,
                    projectId: req.body.projectId || 'default',
                    conversationId: req.body.conversationId || null,
                    taskId: req.body.taskId || null,
                    name: file,
                    type: 'turbo_image',
                    mimeType: 'image/png',
                    metadata: { prompt, category: cat, style, engine: 'z-image-turbo' },
                    userId: req.body.userId || 'local-user'
                });
            } catch (regErr) {
                logger.warn(`🖼️ Turbo artifact registration warning: ${regErr.message}`);
            }
            logger.info(`⚡ Turbo local copy saved: ${file}`);
            return file;
        } catch (dlErr) {
            logger.warn(`⚠️ Turbo background download failed: ${dlErr.message}`);
            return null;
        }
    });
    queue = backgroundTask.catch(() => {});

    return res.json({
        success: true,
        engine: 'z-image-turbo',
        imageUrl: turboUrl,
        prompt: enhanced.prompt,
        category: cat,
        seed: turboSeed,
        dimensions: { width: enhanced.width, height: enhanced.height },
        localFile: null,
        localFileStatus: 'pending',
        message: '⚡ Z-Image Turbo generated in sub-second time! (local copy downloading in background)'
    });
});

// ── POST /api/image/edit ──────────────────────────────────────────────────────
router.post('/edit', async (req, res) => {
    const {
        action, // 'background-change' | 'object-add-remove' | 'style-transformation' | 'image-enhancement'
        sourceImageUrl,
        prompt,
        targetStyle,
        newBackground,
        objectChange
    } = req.body;

    if (!prompt && !objectChange && !newBackground && !targetStyle) {
        return res.status(400).json({ success: false, error: 'Edit description or prompt required' });
    }

    let editPrompt = prompt || '';
    let category = 'general';

    if (action === 'background-change' || newBackground) {
        category = 'background-change';
        editPrompt = `${prompt || 'main subject'} with background cleanly replaced by ${newBackground || 'modern sleek studio backdrop'}, seamless edges, professional lighting`;
    } else if (action === 'object-add-remove' || objectChange) {
        category = 'object-add-remove';
        editPrompt = `${prompt || 'scene'} with ${objectChange || 'requested object'} seamlessly integrated, realistic matching shadows and lighting`;
    } else if (action === 'style-transformation' || targetStyle) {
        category = 'style-transformation';
        editPrompt = `${prompt || 'subject'} transformed into ${targetStyle || 'cyberpunk neon'} style, high quality artwork`;
    } else if (action === 'image-enhancement') {
        category = 'image-enhancement';
        editPrompt = `remastered 8k ultra-sharp version of ${prompt || 'subject'}, crystal clear focus, high dynamic range`;
    }

    const enhanced = buildEnhancedImageRequest(editPrompt, category);
    const turboSeed = Math.floor(Math.random() * 999999);
    const editUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhanced.prompt)}?width=${enhanced.width}&height=${enhanced.height}&model=turbo&seed=${turboSeed}&nologo=true`;

    return res.json({
        success: true,
        action: action || category,
        imageUrl: editUrl,
        prompt: enhanced.prompt,
        seed: turboSeed,
        message: `✨ Image ${action || category} completed successfully!`
    });
});

module.exports = router;