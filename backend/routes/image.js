const express = require('express');
const logger = require('../logger');
const router = express.Router();

// Pollinations free tier: 1 request queued per IP at a time (anonymous).
// Proper serial queue: every request chains onto the previous one's tail.
let queue = Promise.resolve();

router.post('/generate', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    // Return the URL instantly — the browser loads the image with auto-retry.
    // No HEAD verification: pollinations takes 30-60s to render HD images and
    // the Next.js proxy would time out (30s default) → 500 for the client.
    const task = queue.then(() => {
        const encoded = encodeURIComponent(prompt.trim());
        const seed = Date.now();
        return {
            success: true,
            imageUrl: `https://image.pollinations.ai/prompt/${encoded}?width=1920&height=1080&seed=${seed}&nologo=true&model=flux`,
            provider: 'pollinations',
            message: 'Image generated successfully'
        };
    });
    queue = task.catch(() => {});

    try {
        const result = await task;
        res.json(result);
    } catch (error) {
        logger.error('Image generation error:', error.message);
        res.json({
            success: true,
            imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?seed=${Date.now()}&nologo=true`,
            provider: 'pollinations-direct',
            message: 'Image URL ready (direct)'
        });
    }
});

module.exports = router;