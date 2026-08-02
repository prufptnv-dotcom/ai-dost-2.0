const express = require('express');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const DeepSeekService = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const NvidiaService = require('../services/nvidiaService');
const OpenRouterService = require('../services/openrouterService');
const MistralService = require('../services/mistralService');
const TogetherService = require('../services/togetherService');

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
        
        // Clean history: truncate long content & limit to last 6 messages to stay under Groq TPM (6000 tokens) limit
        const cleanHistory = (history || [])
            .filter(msg => msg.role && msg.content)
            .slice(-6)
            .map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content).substring(0, 1500)
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
                    // Automatic failover to Gemini if Groq rate limit occurs
                    if (typeof response === 'string' && (response.includes('rate_limit_exceeded') || response.includes('413') || response.includes('429'))) {
                        console.log('⚠️ Groq rate limit hit. Auto-falling back to Gemini...');
                        response = await GeminiService.chat(processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini);
                    }
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
                case 'mistral': {
                    const misMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await MistralService.chat(misMsg, cleanHistory, customKeys?.mistral);
                    break;
                }
                case 'together': {
                    const togMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
                    response = await TogetherService.chat(togMsg, cleanHistory, customKeys?.together);
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

// Helper for cascading failover across AI models
async function executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
    // 1. Try Groq (Llama 3.3 70B)
    try {
        console.log("⚡ Tier 1: Executing Groq API request...");
        const res = await GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq);
        const isErrorResponse = typeof res === 'string' && (
            res.includes('rate_limit_exceeded') || 
            res.includes('413') || 
            res.includes('429') || 
            res.includes('error') || 
            res.includes('Quota exceeded')
        );
        if (!isErrorResponse && res) {
            return res;
        }
        console.log("⚠️ Tier 1 (Groq) rate limit or error encountered. Cascading to Tier 2 (NVIDIA NIM)...");
    } catch (e) {
        console.warn("Tier 1 (Groq) threw error:", e.message);
    }

    // 2. Try NVIDIA NIM (Llama 3.1 70B)
    try {
        console.log("💚 Tier 2: Executing NVIDIA NIM API request...");
        const res = await NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia);
        const isErrorResponse = typeof res === 'string' && (
            res.includes('Error') || 
            res.includes('429') || 
            res.includes('Unauthorized')
        );
        if (!isErrorResponse && res) {
            return res;
        }
        console.log("⚠️ Tier 2 (NVIDIA NIM) issue encountered. Cascading to Tier 3 (Gemini Flash)...");
    } catch (e) {
        console.warn("Tier 2 (NVIDIA NIM) threw error:", e.message);
    }

    // 3. Try Gemini Flash
    try {
        console.log("♊ Tier 3: Executing Gemini Flash API request...");
        const res = await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini);
        if (res && !res.includes('API error') && !res.includes('Quota exceeded')) {
            return res;
        }
    } catch (e) {
        console.warn("Tier 3 (Gemini) threw error:", e.message);
    }

    return "Ai-Dost: Direct API response unavailable right now due to provider rate limits. Please retry in a few seconds!";
}

// Auto select best AI model using Smart Natural Language Intent Detection
async function autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys = null) {
    const text = message.toLowerCase();
    const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;

    // 1. Coding & Debugging Intent Detection
    const codeKeywords = ['code', 'function', 'bug', 'error', 'debug', 'refactor', 'python', 'javascript', 'html', 'css', 'java', 'c++', 'react', 'api', 'syntax', 'script', 'compile', 'regex', 'database', 'sql', 'backend', 'frontend'];
    const isCodingIntent = section === 'coding' || codeKeywords.some(kw => text.includes(kw)) || /```[\s\S]*```/.test(message);

    // 2. Language Translation Intent Detection
    const translationKeywords = ['translate', 'translation', 'anuvad', 'hindi me', 'english me', 'spanish', 'french', 'german', 'language conversion', 'convert text'];
    const isTranslationIntent = section === 'translation' || translationKeywords.some(kw => text.includes(kw));

    // 3. Creative / Essay / Long-form Writing Intent Detection
    const writingKeywords = ['write an essay', 'write a blog', 'draft an email', 'write a story', 'poem', 'article', 'summary', 'paraphrase', 'cover letter', 'creative writing', 'kavita', 'kahani'];
    const isWritingIntent = section === 'writing' || writingKeywords.some(kw => text.includes(kw));

    // 4. Mathematical Problem Solving Intent
    const mathKeywords = ['solve', 'equation', 'math', 'calculus', 'algebra', 'matrix', 'derivative', 'integral', 'step by step math', 'proof'];
    const isMathIntent = section === 'math' || mathKeywords.some(kw => text.includes(kw));

    // Intent Routing Execution with 3-Tier Cascading Failover
    if (isCodingIntent) {
        console.log("🧠 Smart Intent Classifier: Detected [CODING/DEBUGGING] -> Cascading AI Router");
        return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
    } 
    else if (isTranslationIntent || isWritingIntent) {
        console.log("🧠 Smart Intent Classifier: Detected [TRANSLATION/WRITING] -> Primary Gemini Flash");
        try {
            const res = await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini);
            if (!res || res.includes('API error') || res.includes('Quota exceeded') || res.includes('key set nahi hai')) {
                return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
            }
            return res;
        } catch (e) {
            return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        }
    }
    else if (isMathIntent) {
        console.log("🧠 Smart Intent Classifier: Detected [MATHEMATICAL STEP-BY-STEP] -> Primary NVIDIA NIM");
        try {
            const res = await NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia);
            if (!res || res.includes('Error')) {
                return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
            }
            return res;
        } catch (e) {
            return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        }
    }
    else {
        console.log("🧠 Smart Intent Classifier: Default General Conversation -> Cascading AI Router");
        return await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
    }
}

module.exports = router;
