const express = require('express');
const router = express.Router();
const OpenRouterService = require('../services/openrouterService');
const logger = require('../logger');

/**
 * GET /api/openrouter/models
 * Returns the categorized catalog of all OpenRouter free models
 */
router.get('/models', (req, res) => {
    try {
        const catalog = OpenRouterService.getModelCatalog();
        const configured = Boolean(process.env.OPENROUTER_API_KEY);
        res.json({
            success: true,
            configured,
            count: catalog.length,
            models: catalog,
            rawModels: OpenRouterService.FREE_MODELS
        });
    } catch (e) {
        logger.error('Failed to get OpenRouter models catalog:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/openrouter/ask
 * Exact drop-in API endpoint for user's Python script ask_ai function:
 * Body: { prompt, task_key, system_prompt, apiKey }
 */
router.post('/ask', async (req, res) => {
    const { prompt, task_key = 'auto', system_prompt = 'You are a helpful assistant.', apiKey } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    try {
        const response = await OpenRouterService.askAi(prompt, task_key, system_prompt, apiKey);
        res.json({
            success: true,
            task_key,
            model: OpenRouterService.resolveModel(task_key),
            response
        });
    } catch (e) {
        logger.error(`Error in OpenRouter ask (${task_key}):`, e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/openrouter/test
 * Test a single model or all models live
 * Body: { model: "nemotron_3_super" | "all", apiKey }
 */
router.post('/test', async (req, res) => {
    const { model = 'auto', apiKey } = req.body;

    try {
        if (model === 'all') {
            const results = await OpenRouterService.testAllModels(apiKey);
            return res.json({ success: true, count: results.length, results });
        }

        const result = await OpenRouterService.testModel(model, apiKey);
        res.json({ success: true, result });
    } catch (e) {
        logger.error(`Error in OpenRouter test (${model}):`, e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/openrouter/chat
 * General chat endpoint with model selection
 */
router.post('/chat', async (req, res) => {
    const { message, history = [], customApiKey, mode = 'project', model } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: 'message is required' });
    }

    try {
        const response = await OpenRouterService.chat(message, history, customApiKey, mode, model);
        res.json({
            success: true,
            model: OpenRouterService.resolveModel(model),
            response
        });
    } catch (e) {
        logger.error('Error in OpenRouter chat:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
