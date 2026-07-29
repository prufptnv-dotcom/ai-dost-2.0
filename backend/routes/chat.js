const express = require('express');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const DeepSeekService = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');

// Main chat endpoint
router.post('/', async (req, res) => {
    try {
        const { message, model, section, fileContent, history, mode, customKeys } = req.body;
        
        // Clean history: remove extra parameters like timestamp and map role 'ai' to 'assistant'
        const cleanHistory = (history || [])
            .filter(msg => msg.role && msg.content)
            .map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

        let response;
        
        // Choose AI model based on selection
        switch(model) {
            case 'groq': {
                const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
                response = await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
                break;
            }
            case 'gemini':
                response = await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini);
                break;
            case 'deepseek': {
                const dsMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
                response = await DeepSeekService.chat(dsMsg, cleanHistory, customKeys?.deepseek);
                break;
            }
            case 'huggingface': {
                const hfMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
                response = await HuggingFaceService.chat(hfMsg);
                break;
            }
            default:
                // Auto-select best model
                response = await autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys);
        }
        
        res.json({
            success: true,
            reply: response,
            model: model || 'auto'
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({
            success: false,
            reply: 'Sorry, error aaya. Dubara try karo.',
            error: error.message
        });
    }
});

// Auto select best AI model
async function autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys = null) {
    // Coding ke liye Groq best hai
    if (section === 'coding') {
        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
        return await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
    }
    // Writing ke liye Gemini (with fallback to Groq if key fails)
    else if (section === 'writing') {
        const response = await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini);
        if (response.startsWith('Gemini API error') || response.startsWith('Gemini service me error') || response.includes('key set nahi hai')) {
            console.log('⚠️ Gemini failed, falling back to Groq');
            const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
            return await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
        }
        return response;
    }
    // Default to Groq (Since DeepSeek has insufficient balance)
    else {
        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;
        return await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
    }
}

module.exports = router;
