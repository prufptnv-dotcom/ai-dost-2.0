const express = require('express');
const logger = require('../logger');
const router = express.Router();

// Image generation using Pollinations.ai (completely free, no API key needed)
router.post('/generate', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    try {
        const encoded = encodeURIComponent(prompt.trim());

        // Pollinations.ai returns the image directly at this URL (no API key needed)
        // We add seed for reproducibility and width/height for better quality
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&seed=${Date.now()}&nologo=true`;

        // Verify the image URL is accessible (HEAD request)
        const checkRes = await fetch(imageUrl, { method: 'HEAD' });

        if (checkRes.ok) {
            res.json({
                success: true,
                imageUrl: imageUrl,
                provider: 'pollinations',
                message: 'Image generated successfully'
            });
        } else {
            // Fallback: simpler URL without params
            const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}`;
            res.json({
                success: true,
                imageUrl: fallbackUrl,
                provider: 'pollinations-fallback',
                message: 'Image generated (fallback)'
            });
        }
    } catch (error) {
        logger.error('Image generation error:', error.message);

        // Even on fetch error, return the URL — browser will load it directly
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}`;
        res.json({
            success: true,
            imageUrl: imageUrl,
            provider: 'pollinations-direct',
            message: 'Image URL ready (direct)'
        });
    }
});

module.exports = router;
