const express = require('express');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const DeepSeekService = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const NvidiaService = require('../services/nvidiaService');
const OpenRouterService = require('../services/openrouterService');

// Local models list endpoint
router.get('/local-models', async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        if (!response.ok) {
            return res.json({ success: true, models: [] });
        }
        const data = await response.json();
        
        const formattedModels = (data.models || []).map(m => {
            const sizeInGB = m.size / (1024 * 1024 * 1024);
            let weight = 'Lightweight';
            let category = 'Light (Fast)';
            
            const paramSize = m.details?.parameter_size || '';
            let paramNum = 0;
            if (paramSize) {
                const num = parseFloat(paramSize);
                if (!isNaN(num)) {
                    paramNum = num;
                    if (num >= 10) {
                        weight = 'Heavy';
                        category = 'Heavy (Needs GPU)';
                    } else if (num >= 4) {
                        weight = 'Medium';
                        category = 'Medium (Balanced)';
                    }
                }
            }

            // Guard RTX 4050 (6GB VRAM): Incompatible if parameters > 9.0B or file size > 5.6 GB
            let isCompatible = true;
            let warning = '';
            if (paramNum > 9.0 || sizeInGB > 5.6) {
                isCompatible = false;
                warning = '⚠️ Exceeds 6GB VRAM';
            }

            return {
                id: `local:${m.name}`,
                name: m.name,
                size: `${sizeInGB.toFixed(2)} GB`,
                weight: weight,
                category: category,
                isCompatible: isCompatible,
                warning: warning,
                details: m.details
            };
        });
        
        res.json({ success: true, models: formattedModels });
    } catch (error) {
        // Return empty list if Ollama is not running
        res.json({ success: true, models: [] });
    }
});

// Main chat endpoint
router.post('/', async (req, res) => {
    try {
        const { message, model, section, fileContent, history, mode, customKeys, uploadedDocs } = req.body;
        
        let processedMessage = message;
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }
        
        // Clean history: remove extra parameters like timestamp and map role 'ai' to 'assistant'
        const cleanHistory = (history || [])
            .filter(msg => msg.role && msg.content)
            .map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

        let response;
        
        if (model && model.startsWith('local:')) {
            const localModelName = model.substring(6);
            const localMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
            
            console.log(`🔄 Routing request to local model: ${localModelName}`);
            const localPayload = {
                model: localModelName,
                messages: [
                    ...cleanHistory,
                    { role: 'user', content: localMsg }
                ],
                stream: false
            };
            
            const localRes = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localPayload)
            });
            
            if (!localRes.ok) {
                const errText = await localRes.text();
                throw new Error(`Local model error: ${errText}`);
            }
            
            const localData = await localRes.json();
            response = localData.message?.content || 'No response from local model.';
        } else {
            // Choose AI model based on selection
            switch(model) {
                case 'groq': {
                    const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
                    break;
                }
                case 'gemini':
                    response = await GeminiService.chat(processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini);
                    break;
                case 'nvidia': {
                    const nvMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await NvidiaService.chat(nvMsg, cleanHistory, customKeys?.nvidia);
                    break;
                }
                case 'deepseek': {
                    const dsMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await DeepSeekService.chat(dsMsg, cleanHistory, customKeys?.deepseek);
                    break;
                }
                case 'openrouter': {
                    const orMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await OpenRouterService.chat(orMsg, cleanHistory, customKeys?.openrouter);
                    break;
                }
                case 'huggingface': {
                    const hfMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await HuggingFaceService.chat(hfMsg);
                    break;
                }
                default:
                    // Auto-select best model
                    response = await autoSelectModel(processedMessage, section, fileContent, cleanHistory, mode, customKeys);
            }
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
