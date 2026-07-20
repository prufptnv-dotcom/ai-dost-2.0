const express = require('express');
const router = express.Router();

// Test endpoint for all APIs
router.get('/all', async (req, res) => {
    const results = {};
    
    // Test Groq
    try {
        const GroqService = require('../services/groqService');
        const groqResponse = await GroqService.chat('Hello, say hi');
        results.groq = { status: '✅ Working', response: groqResponse.substring(0, 50) };
    } catch (e) {
        results.groq = { status: '❌ Failed', error: e.message };
    }
    
    // Test Gemini
    try {
        const GeminiService = require('../services/geminiService');
        const geminiResponse = await GeminiService.chat('Hello, say hi');
        results.gemini = { status: '✅ Working', response: geminiResponse.substring(0, 50) };
    } catch (e) {
        results.gemini = { status: '❌ Failed', error: e.message };
    }
    
    // Test DeepSeek
    try {
        const DeepSeekService = require('../services/deepseekService');
        const deepseekResponse = await DeepSeekService.chat('Hello, say hi');
        results.deepseek = { status: '✅ Working', response: deepseekResponse.substring(0, 50) };
    } catch (e) {
        results.deepseek = { status: '❌ Failed', error: e.message };
    }
    
    res.json({
        message: 'API Test Results',
        results,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
