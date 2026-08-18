const express = require('express');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const router = express.Router();

// Free image pipeline: Pollinations (no key) primary → Gemini 2.5 Flash Image fallback (free key).
// Pollinations free tier: 1 request queued per IP at a time (anonymous) → serial queue.
let queue = Promise.resolve();

const UPLOAD_DIR = path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Stable URL (no seed) — Pollinations cache hit hota hai repeat requests pe instant.
// Seed lagane se har request fresh 60-90s render force karta tha → 500s under load.
function pollinationsUrl(prompt) {
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=768&nologo=true`;
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

router.post('/generate', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt required' });
    }
    const p = prompt.trim();
    const url = pollinationsUrl(p);
    const base = `${req.protocol}://${req.get('host')}`;

    const task = queue.then(async () => {
        const buf = await tryDownload(url);
        if (buf) {
            return { success: true, imageUrl: url, provider: 'pollinations', message: 'Image ready' };
        }
        const file = await geminiImage(p);
        if (file) {
            return { success: true, imageUrl: `${base}/uploads/${file}`, provider: 'gemini', message: 'Image ready (Gemini fallback)' };
        }
        return {
            success: true,
            imageUrl: url,
            provider: 'pollinations-fallback',
            message: 'Pollinations busy — render me time lag sakta hai'
        };
    });
    queue = task.catch(() => {});

    try {
        res.json(await task);
    } catch (error) {
        logger.error('Image generation error:', error.message);
        res.json({ success: true, imageUrl: url, provider: 'pollinations-direct', message: 'Direct URL' });
    }
});

module.exports = router;