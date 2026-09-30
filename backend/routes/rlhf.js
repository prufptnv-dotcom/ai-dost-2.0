const express = require('express');
const router = express.Router();
const logger = require('../logger');
const dpoService = require('../services/dpoService');

/**
 * rlhf.js
 * 
 * Routes for handling Reinforcement Learning from Human Feedback (RLHF)
 * and Direct Preference Optimization (DPO) pipelines.
 */

// POST /api/rlhf/feedback
router.post('/feedback', (req, res) => {
    try {
        const { prompt, aiResponse, userCorrection, isPositive } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: "Prompt is required for RLHF logging." });
        }

        let chosen = "";
        let rejected = "";

        if (isPositive) {
            // User liked the response, so it becomes the 'chosen' response. No rejection.
            chosen = aiResponse;
            rejected = ""; 
        } else if (userCorrection) {
            // User disliked the response and provided a correction.
            // The correction is the 'chosen' response (what the AI SHOULD have said).
            // The AI's actual response is the 'rejected' one.
            chosen = userCorrection;
            rejected = aiResponse;
        } else {
            // User disliked but didn't correct. We can't log a DPO pair easily without a 'chosen' response.
            // We'll skip logging for DPO, as DPO requires a chosen response to pull gradients towards.
            return res.json({ success: true, message: "Negative feedback noted, but no correction provided for DPO." });
        }

        const success = dpoService.logPreference(prompt, chosen, rejected);

        if (success) {
            res.json({ success: true, message: "RLHF Preference logged successfully for fine-tuning." });
        } else {
            res.status(500).json({ success: false, error: "Failed to log preference." });
        }
    } catch (e) {
        logger.error("RLHF API Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/rlhf/stats
router.get('/stats', (req, res) => {
    const stats = dpoService.getStats();
    res.json({ success: true, dataset: stats });
});

module.exports = router;
