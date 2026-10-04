const express = require('express');
const logger = require('../logger');
const { executeCascadingFailover, autoSelectModel } = require('../services/chatCascadeService');
const { runStreamCascade } = require('../services/llmCascadeService');
const { ReasoningStreamFilter } = require('../utils/streamUtils');
const router = express.Router();
const { DEEP_REASONING_SYSTEM_PROMPT } = require('../services/outputQualityStandard');
const { isImageCreateRequest } = require('../services/imageIntent');
const MoERouterService = require('../services/moeRouterService');
const VllmService = require('../services/vllmService');
const { detectResponseLanguage } = require('../services/languageDetector');
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const DeepSeekService = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const NvidiaService = require('../services/nvidiaService');
const OpenRouterService = require('../services/openrouterService');
const MistralService = require('../services/mistralService');
const TogetherService = require('../services/togetherService');
const CerebrasService = require('../services/cerebrasService');
const OpenAIService = require('../services/openaiService');
const webSearchService = require('../services/webSearchService');
const { fetchSafeUrl } = require('../services/urlFetcherService');
// P3 #191: one configurable Ollama endpoint (was hard-coded 127.0.0.1:11434)
const { ollamaBaseUrl } = require('../services/ollamaEnv');
const settingsStore = require('../services/settingsStore');
const { classifyWebIntent } = require('../services/webIntentClassifier');
const { getPublicConfig } = require('../config/webAccessConfig');
const { classifyAssessmentIntent, INTENTS: ASSESS_INTENTS } = require('../services/assessmentIntentClassifier');
const { generateAssessment } = require('../services/assessmentGeneratorService');
const { sanitizeAssessmentForClient } = require('../services/assessmentSchema');
const assessmentDAO = require('../db/dao/AssessmentDAO');
const bharatService = require('../services/bharatApis');
const { getDatabase } = require('../db');
const MemoryService = require('../services/memoryService');
const { THREEJS_WEBGL_SYSTEM_DIRECTIVE, generateThreeJsSolarSystem, generateFuturistic2030Animation } = require('../services/threeJsSimulator');
const { CODING_SOFTWARE_DEV_DIRECTIVE } = require('../services/softwareEngineeringDirective');
const { IMAGE_STUDIO_DIRECTIVE, detectImageCategory, buildEnhancedImageRequest } = require('../services/imageStudioEngine');
const { RESEARCH_WEB_SEARCH_DIRECTIVE } = require('../services/researchDirective');
const { TEACHING_PEDAGOGY_DIRECTIVE, detectTeachingProfile } = require('../services/personalTeacherEngine');
const { DOCUMENT_STUDIO_DIRECTIVE, detectDocumentRequest } = require('../services/documentStudioEngine');
const { extractFileContent, detectAnalysisMode, ANALYSIS_MODES, FILE_ANALYSIS_STUDIO_DIRECTIVE } = require('../services/fileAnalysisEngine');
const { DATA_ANALYTICS_STUDIO_DIRECTIVE, detectDataAnalyticsIntent } = require('../services/dataAnalyticsEngine');
const { AIML_PROJECTS_DIRECTIVE, detectAiMlProjectIntent } = require('../services/aiMlStudioEngine');
const { GIT_PROJECT_MANAGEMENT_DIRECTIVE, detectGitPmIntent } = require('../services/gitProjectManagementEngine');
const { WRITING_COMMUNICATION_DIRECTIVE, detectWritingIntent } = require('../services/writingCommunicationEngine');
const { PLANNING_PRODUCTIVITY_DIRECTIVE, detectPlanningIntent } = require('../services/planningProductivityEngine');
const { AUTOMATION_REMINDERS_DIRECTIVE, detectAutomationIntent } = require('../services/automationRemindersEngine');
const { LOCAL_BUSINESS_TRAVEL_DIRECTIVE, detectTravelIntent } = require('../services/localBusinessTravelEngine');
const { LANGUAGE_TRANSLATION_DIRECTIVE, detectLanguageIntent } = require('../services/languageTranslationEngine');
const { DECISION_SUPPORT_DIRECTIVE, detectDecisionIntent } = require('../services/decisionSupportEngine');
const { CYBERSECURITY_DEFENSIVE_DIRECTIVE, detectSecurityIntent } = require('../services/cybersecurityEngine');
const { detectMasterCapability } = require('../services/masterCapabilityCatalog');
const { isRateLimitedOrError, isValidResponse, buildCleanHistory } = require('../utils/chatUtils');
// Retrieve all user feedback corrections & learned rules to enforce 100% accuracy
function getLearnedMemoryDirectives(projectId = 'default') {
    try {
        const db = getDatabase();
        const mem = new MemoryService(db);
        const rules = mem.nodeDAO.listByProject(projectId, 'LEARNING_RULE');
        if (rules && rules.length > 0) {
            const ruleTexts = rules.map(r => `• ${r.contentSummary}`).join('\n');
            return `\n\n[USER VERIFIED ACCURACY RULES & CORRECTIONS — MUST OBEY 100%]:\n${ruleTexts}\n`;
        }
    } catch (err) {
        console.error('[Memory] DB Connection or Query Error in getLearnedMemoryDirectives:', err);
    }
    return '';
}


exports.handleChatSync = async (req, res) => {
    const startTime = Date.now();
    try {
        let { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
        customKeys = settingsStore.mergeCustomKeys(customKeys);

        // Privacy Mode Interceptor
        if (req.headers['x-privacy-mode'] === 'true') {
            logger.info("🛡️ Privacy Mode Active: Forcing local model execution.");
            model = 'local:' + (process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b');
        }

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
                code: 'MISSING_MESSAGE'
            });
        }
        
        // Clean history: sliding window up to 20 messages
        const cleanHistory = buildCleanHistory(history, 20, 24000);

        // Production-Grade Automatic Response-Language Matching
        const langInfo = detectResponseLanguage(message, cleanHistory, { persona });
        logger.info(`🌐 [Language Matcher] Latest Message -> Detected: ${langInfo.languageName} (${langInfo.detectedResponseLanguage}, confidence: ${langInfo.languageConfidence})`);

        let processedMessage = message;
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }
        // Prepend locked language directive to guarantee response language consistency
        const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const GLOBAL_SYSTEM_RULES = `
[CRITICAL SYSTEM RULES & REAL-TIME CONTEXT]
1. Current Date: Today is ${todayStr}. NEVER hallucinate past dates.
2. Crypto & Financial Data: Do NOT fabricate or guess prices, market caps, or numbers. If you don't have real-time data, state it clearly. Always provide actual URLs (e.g. CoinGecko/CoinMarketCap) when discussing crypto.
3. Book & PDF Links: Do NOT hallucinate direct PDF links (e.g. .pdf files) unless you are 100% sure they exist. Instead, provide the official website or download page URL.
4. Interactive UI Elements: Do NOT hallucinate or pretend to generate interactive UI buttons like "Launch Assessment" in plain text chat. Present quizzes or questions directly in plain text or markdown.
5. Language Consistency: The user has chosen a specific language (e.g., Hinglish). You MUST reply entirely in that chosen language. Do not switch back to English except for technical terms.
6. Citation Style: When citing sources, ALWAYS include the full clickable URL in this format: [1] https://... (do not just write [1] without the link).
`;
        processedMessage = `${GLOBAL_SYSTEM_RULES}\n\n${langInfo.instruction}\n\n${processedMessage}`;

        // 100% Accuracy: Inject user verified memory corrections & learned rules
        const learnedMemory = getLearnedMemoryDirectives(req.body.projectId || 'default');
        if (learnedMemory) {
            processedMessage += learnedMemory;
        }

        // Production-Grade Web Intent Classification & Live Data Injection
        let attachedSources = [];
        const webIntent = classifyWebIntent(message);

        if (webIntent.needsWeb && section !== 'document' && section !== 'research') {
            logger.info(`🌐 [Chat Router] Web intent: ${webIntent.intent} for query: "${webIntent.query}"`);
            if (webIntent.intent === 'URL_FETCH' && webIntent.extractedUrls.length > 0) {
                const targetUrl = webIntent.extractedUrls[0];
                const fetchRes = await fetchSafeUrl(targetUrl);
                if (fetchRes.success) {
                    attachedSources = [{
                        citationId: 1,
                        title: fetchRes.title || fetchRes.domain,
                        url: fetchRes.url,
                        domain: fetchRes.domain,
                        snippet: fetchRes.content.slice(0, 300)
                    }];
                    processedMessage += `\n\n[FETCHED_PAGE_CONTENT: ${targetUrl}]\nTitle: ${fetchRes.title}\nDomain: ${fetchRes.domain}\nContent:\n${fetchRes.content}\n\nInstructions: Answer the user's prompt using the fetched webpage content above. Cite the source using [1] or (${fetchRes.domain}).`;
                } else {
                    processedMessage += `\n\n[NOTE: Could not open URL: ${targetUrl}. Security/Network reason: ${fetchRes.error}. Please inform the user honestly.]`;
                }
            } else {
                const searchRes = await webSearchService.search(webIntent.query, { maxResults: 5 });
                
                // Schema validation for search results
                if (searchRes.success && Array.isArray(searchRes.results)) {
                    searchRes.results = searchRes.results.filter(r => 
                        r && typeof r === 'object' && r.url && r.title && typeof r.url === 'string'
                    );
                }

                if (searchRes.success && searchRes.results && searchRes.results.length > 0) {
                    attachedSources = searchRes.results.map((r, i) => ({
                        citationId: i + 1,
                        title: r.title,
                        url: r.url,
                        domain: r.domain,
                        snippet: r.snippet,
                        publishedDate: r.publishedDate,
                        retrievalTimestamp: r.retrievalTimestamp,
                        reliability: r.reliability
                    }));

                    const webContextText = searchRes.results.map((r, i) => `[${i + 1}] ${r.title} (${r.domain})\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');

                    processedMessage += `\n\n[VERIFIED_LIVE_WEB_SEARCH_RESULTS]\nQuery: ${webIntent.query}\nIntent: ${webIntent.intent}\nProvider: ${searchRes.provider}\nSources:\n${webContextText}\n\nStrict Instructions for Live Web Answers (Category 4 Protocol):\n1. Base factual claims strictly on the verified web search results above.\n2. Cite sources using [1], [2], etc., matching the numbered sources.\n3. Whenever the user requests deep research, product comparison, or analytical breakdown, structure the output using the 7 standard research formats:\n   - 📌 Executive Summary\n   - 🔍 Detailed Findings\n   - 📊 Comparison Table (where applicable)\n   - ⚖️ Pros and Cons (where applicable)\n   - 🎯 Practical Recommendation Criteria\n   - 🗺️ Implementation Roadmap\n   - 🔗 Reliable Sources & Citations\n4. Do not invent facts or URLs. Keep URLs and domain names exact.\n5. Answer in the locked user language: ${langInfo.languageName} (${langInfo.detectedResponseLanguage}).`;
                }
            }
        }

        const { processIntents } = require('../services/chatIntentOrchestrator');
        processedMessage = await processIntents(message, processedMessage, langInfo, bharatService);

        let response;
        let usedModel = model || 'auto';
        let fallbacksAttempted = [];
        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;

        if (model && model.startsWith('local:')) {
            const localModelName = model.substring(6);
            const localMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
            
            logger.info(`🔄 Routing request to local model: ${localModelName}`);
            const localPayload = {
                model: localModelName,
                messages: [
                    ...cleanHistory,
                    { role: 'user', content: localMsg }
                ],
                stream: false
            };
            
            const localRes = await fetch(`${ollamaBaseUrl()}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localPayload),
                signal: AbortSignal.timeout(30000)
            });
            
            if (!localRes.ok) {
                const errText = await localRes.text();
                throw new Error(`Local model error: ${errText}`);
            }
            
            const localData = await localRes.json();
            response = localData.message?.content || 'No response from local model.';
        } else {
            // Model-specific routing with intelligent failover
            
            const tryModel = async (modelName, serviceFn, ...args) => {
                fallbacksAttempted.push(modelName);
                logger.info(`🔄 Trying model: ${modelName}`);
                const result = await serviceFn(...args);
                return result;
            };

            const executeWithFailover = async (primaryModel, primaryFn, primaryArgs, fallbackChain) => {
                // Try primary model
                let result = await tryModel(primaryModel, primaryFn, ...primaryArgs);
                
                if (isValidResponse(result)) {
                    return { response: result, model: primaryModel };
                }
                
                logger.warn(`⚠️ ${primaryModel} failed or rate limited, trying fallbacks...`);
                
                // Try fallback chain
                for (const { name, fn, args } of fallbackChain) {
                    result = await tryModel(name, fn, ...args);
                    if (isValidResponse(result)) {
                        logger.info(`✅ Fallback to ${name} succeeded`);
                        return { response: result, model: name };
                    }
                    logger.warn(`⚠️ Fallback ${name} also failed`);
                }
                
                return { response: null, model: primaryModel };
            };

            switch(model) {
                case 'groq': {
                    const result = await executeWithFailover(
                        'groq',
                        GroqService.chat,
                        [groqMsg, cleanHistory, mode, customKeys?.groq],
                        [
                            { name: 'gemini', fn: GeminiService.chat, args: [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'nvidia', fn: NvidiaService.chat, args: [groqMsg, cleanHistory, customKeys?.nvidia] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] },
                            { name: 'together', fn: TogetherService.chat, args: [groqMsg, cleanHistory, customKeys?.together] },
                            { name: 'deepseek', fn: DeepSeekService.chat, args: [groqMsg, cleanHistory, customKeys?.deepseek] },
                            { name: 'mistral', fn: MistralService.chat, args: [groqMsg, cleanHistory, customKeys?.mistral] },
                            { name: 'huggingface', fn: HuggingFaceService.chat, args: [groqMsg] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'gemini': {
                    const result = await executeWithFailover(
                        'gemini',
                        GeminiService.chat,
                        [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini],
                        [
                            { name: 'groq', fn: GroqService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.groq] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'nvidia', fn: NvidiaService.chat, args: [groqMsg, cleanHistory, customKeys?.nvidia] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'nvidia': {
                    const result = await executeWithFailover(
                        'nvidia',
                        NvidiaService.chat,
                        [groqMsg, cleanHistory, customKeys?.nvidia],
                        [
                            { name: 'groq', fn: GroqService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.groq] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'gemini', fn: GeminiService.chat, args: [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'deepseek':
                    response = await DeepSeekService.chat(groqMsg, cleanHistory, customKeys?.deepseek);
                    break;
                case 'cerebras':
                    response = await CerebrasService.chat(groqMsg, cleanHistory, mode, customKeys?.cerebras);
                    break;
                case 'openrouter':
                    response = await OpenRouterService.chat(groqMsg, cleanHistory, customKeys?.openrouter);
                    break;
                case 'mistral':
                    response = await MistralService.chat(groqMsg, cleanHistory, customKeys?.mistral);
                    break;
                case 'together':
                    response = await TogetherService.chat(groqMsg, cleanHistory, customKeys?.together);
                    break;
                case 'huggingface':
                    response = await HuggingFaceService.chat(groqMsg);
                    break;
                default: {
                    // Auto-select best model with intelligent intent detection
                    const autoResult = await autoSelectModel(processedMessage, section, fileContent, cleanHistory, mode, customKeys);
                    response = autoResult.response;
                    usedModel = autoResult.model;
                    break;
                }
            }
        }
        
        // Final fallback if all models failed
        if (!isValidResponse(response)) {
            logger.warn(`⚠️ Primary selected model failed (${usedModel}), attempting global cascading failover...`);
            try {
                const fallbackResult = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
                response = fallbackResult.response;
                usedModel = fallbackResult.winner;
            } catch (failoverError) {
                logger.error('Cascading failover threw an error:', failoverError);
                logger.error('All AI models failed, checking autonomous generator fallback');
            if (/(?:three\.?js|webgl|dna|helix|genetic|molecule|cellular|highway|road|car|vehicle|city|skyline|crystal|quantum|polyhedron|solar system|earth|gravity|orbit|planet|space simulation|sorting|neural|periodic|science|simulation|game|runner|tron|hyperdrive|logo|brand|reveal|text|typography|kinetic|font|2030|cyberpunk|ultra hd|3d scene|3d model|3d visual|3d)/i.test(message)) {
                response = generateFuturistic2030Animation(message, langInfo.detectedResponseLanguage);
                usedModel = '2030-futuristic-engine';
            } else if (/(?:anime\.?js|2d animation|motion design|krishna|peacock|aura)/i.test(message)) {
                response = `### ✨ 3D Interactive Animation (Anime.js)\n\nAapka **3D Motion Animation** ready hai! Isme Anime.js 3D perspective transforms, rotating multi-layered rings, aur floating orb depth effect integrate kiya gaya hai:\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>\n  <style>\n    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #0d1b2a 0%, #000814 100%); overflow: hidden; perspective: 1000px; font-family: sans-serif; }\n    .scene { position: relative; width: 300px; height: 300px; transform-style: preserve-3d; display: flex; align-items: center; justify-content: center; }\n    .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(254, 215, 102, 0.7); box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); transform-style: preserve-3d; }\n    .ring-1 { width: 260px; height: 260px; border-color: #38bdf8; box-shadow: 0 0 30px #0284c7; }\n    .ring-2 { width: 200px; height: 200px; border-color: #facc15; box-shadow: 0 0 35px #eab308; }\n    .ring-3 { width: 140px; height: 140px; border-color: #a855f7; box-shadow: 0 0 40px #9333ea; }\n    .center-orb { width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle, #fef08a 20%, #eab308 60%, #ca8a04 100%); box-shadow: 0 0 50px #fbbf24; transform: translateZ(50px); }\n    .peacock-feather { position: absolute; top: -40px; font-size: 34px; filter: drop-shadow(0 0 10px #22c55e); transform: translateZ(70px); }\n    .title { position: absolute; bottom: 20px; color: #fde047; font-size: 15px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 12px rgba(250,204,21,0.8); }\n  </style>\n</head>\n<body>\n  <div class="scene">\n    <div class="ring ring-1"></div>\n    <div class="ring ring-2"></div>\n    <div class="ring ring-3"></div>\n    <div class="center-orb"></div>\n    <div class="peacock-feather">🪶</div>\n  </div>\n  <div class="title">Divine 3D Motion Aura</div>\n  <script>\n    anime({\n      targets: '.ring-1',\n      rotateX: [0, 360],\n      rotateY: [0, 180],\n      duration: 6000,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-2',\n      rotateY: [0, 360],\n      rotateZ: [0, 180],\n      duration: 4500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-3',\n      rotateX: [360, 0],\n      rotateZ: [0, 360],\n      duration: 3500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.center-orb, .peacock-feather',\n      translateZ: [30, 80],\n      scale: [0.95, 1.1],\n      direction: 'alternate',\n      duration: 1800,\n      loop: true,\n      easing: 'easeInOutQuad'\n    });\n  </script>\n</body>\n</html>\n\`\`\`\n\n*Aap upar **Run/Preview** button par click karke live animation dekh sakte hain!*`;
                usedModel = 'anime-3d-engine';
            } else {
                response = "Ai-Dost: Sabhi AI models temporarily unavailable. Please check your API keys in settings, try again in a moment, or use local Ollama (http://127.0.0.1:11434) for offline mode.";
                usedModel = 'fallback';
            }
            } // Close catch block
        } // Close if block

        let responseThought = '';
        if (typeof response === 'string' && /<think>/i.test(response)) {
            const tMatch = response.match(/<think>([\s\S]*?)<\/think>/i);
            if (tMatch) {
                responseThought = tMatch[1].trim();
                response = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`✅ Chat completed in ${duration}ms using model: ${usedModel}`);
        
        res.json({
            success: true,
            reply: response,
            thought: responseThought,
            model: usedModel,
            sources: attachedSources,
            detectedResponseLanguage: langInfo.detectedResponseLanguage,
            languageName: langInfo.languageName,
            languageConfidence: langInfo.languageConfidence,
            explicitLanguageOverride: langInfo.isExplicitOverride,
            script: langInfo.script,
            languageInfo: {
                detectedResponseLanguage: langInfo.detectedResponseLanguage,
                languageName: langInfo.languageName,
                languageConfidence: langInfo.languageConfidence,
                explicitLanguageOverride: langInfo.isExplicitOverride,
                script: langInfo.script
            },
            fallbacksAttempted,
            duration
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            code: 'CHAT_ERROR',
            duration
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL PROVIDER RACING — O(1) latency vs O(N) sequential fallback
// Strategy: Race providers in tiers. First valid response wins.
// Tier 1: 3 fastest providers race simultaneously  → target 2-5s
// Tier 2: Next 4 providers race simultaneously     → target 5-10s  
// Tier 3: Slower providers + Ollama               → target 10-60s
// ═══════════════════════════════════════════════════════════════════════════
exports.handleChatStream = async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendEvent = (data) => {
        if (!res.writableEnded) {
            res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
        }
    };

    try {
        let { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
        customKeys = settingsStore.mergeCustomKeys(customKeys);
        if (!message || !message.trim()) {
            sendEvent({ error: 'Message is required' });
            sendEvent('[DONE]');
            return res.end();
        }

        const cleanHistory = buildCleanHistory(history, 20, 24000);

        // Production-Grade Automatic Response-Language Matching (Locked before streaming starts)
        const langInfo = detectResponseLanguage(message, cleanHistory, { persona });
        logger.info(`🌐 [Stream Language Matcher] Locking Language: ${langInfo.languageName} (${langInfo.detectedResponseLanguage}, confidence: ${langInfo.languageConfidence})`);

        // Emit language lock event before any text chunks (Requirements 5 & 6)
        sendEvent({
            type: 'language_lock',
            detectedResponseLanguage: langInfo.detectedResponseLanguage,
            languageName: langInfo.languageName,
            languageConfidence: langInfo.languageConfidence,
            script: langInfo.script,
            explicitLanguageOverride: langInfo.isExplicitOverride
        });

        let processedMessage = message;
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }
        // Prepend locked language directive
        processedMessage = `${langInfo.instruction}\n\n${processedMessage}`;

        // 100% Accuracy: Inject user verified memory corrections & learned rules
        const streamLearnedMemory = getLearnedMemoryDirectives(req.body.projectId || 'default');
        if (streamLearnedMemory) {
            processedMessage += streamLearnedMemory;
        }

        // Production-Grade Assessment Intent Detection
        const assessIntent = classifyAssessmentIntent(message, { hasPdf: !!fileContent, uploadedDocs });
        if (assessIntent.isAssessment && [ASSESS_INTENTS.QUIZ_START, ASSESS_INTENTS.MOCK_TEST_START, ASSESS_INTENTS.INTERVIEW_MODE, ASSESS_INTENTS.ADAPTIVE_QUIZ, ASSESS_INTENTS.PDF_GROUNDED_TEST].includes(assessIntent.intent)) {
            logger.info(`📝 [Chat Router] Assessment intent: ${assessIntent.intent} for topic: "${assessIntent.topic}" (${assessIntent.questionCount} Qs)`);
            sendEvent({
                type: 'assessment_creating',
                status: `Preparing ${assessIntent.mode} assessment on ${assessIntent.topic}...`
            });

            let weakTopics = [];
            if (assessIntent.mode === 'adaptive') {
                const userWeak = assessmentDAO.getUserWeakTopics(req.body.userId || 'default');
                weakTopics = userWeak.map(w => w.topic);
            }

            const docText = fileContent || (uploadedDocs && uploadedDocs[0]?.content) || null;
            const docName = (uploadedDocs && uploadedDocs[0]?.name) || 'Uploaded Document';

            const masterAssessment = await generateAssessment({
                topic: assessIntent.topic,
                subject: assessIntent.subject,
                mode: assessIntent.mode,
                difficulty: assessIntent.difficulty,
                questionCount: assessIntent.questionCount,
                timeLimit: assessIntent.timeLimit,
                negativeMarks: assessIntent.negativeMarks,
                docContent: docText,
                docName,
                weakTopics
            });

            assessmentDAO.saveAssessment(masterAssessment, req.body.userId || 'default');
            const clientSafe = sanitizeAssessmentForClient(masterAssessment);

            sendEvent({
                type: 'assessment_created',
                assessment: clientSafe
            });

            const isHindi = langInfo.detectedResponseLanguage === 'hindi';
            const isHinglish = langInfo.detectedResponseLanguage === 'hinglish';
            let intro = `I have prepared a **${clientSafe.title}** for you! (${clientSafe.questionCount} questions, Mode: ${clientSafe.mode}, Difficulty: ${clientSafe.difficulty}).\n\nClick **"Launch Assessment"** below to start the interactive test.`;
            if (isHindi) {
                intro = `मैंने आपके लिए **${clientSafe.title}** तैयार कर लिया है! (${clientSafe.questionCount} प्रश्न, मोड: ${clientSafe.mode}, स्तर: ${clientSafe.difficulty})।\n\nनीचे दिए गए **"Launch Assessment"** बटन पर क्लिक करके टेस्ट शुरू करें।`;
            } else if (isHinglish) {
                intro = `Maine aapke liye **${clientSafe.title}** ready kar diya hai! (${clientSafe.questionCount} questions, Mode: ${clientSafe.mode}, Difficulty: ${clientSafe.difficulty}).\n\nNeeche diye gaye **"Launch Assessment"** button par click karke interactive test shuru karein.`;
            }

            sendEvent({ chunk: intro });
            sendEvent({ done: true, model: 'assessment-engine', assessment: clientSafe });
            sendEvent('[DONE]');
            return res.end();
        }

        // Production-Grade Web Intent Classification & Live Data Injection for SSE
        let attachedSources = [];
        const webIntent = classifyWebIntent(message);

        if (webIntent.needsWeb) {
            logger.info(`🌐 [Stream Router] Web intent: ${webIntent.intent} for query: "${webIntent.query}"`);
            if (webIntent.intent === 'URL_FETCH' && webIntent.extractedUrls.length > 0) {
                const targetUrl = webIntent.extractedUrls[0];
                sendEvent({
                    type: 'web_search_start',
                    intent: 'URL_FETCH',
                    status: 'Reading webpage...',
                    url: targetUrl
                });

                const fetchRes = await fetchSafeUrl(targetUrl);
                if (fetchRes.success) {
                    attachedSources = [{
                        citationId: 1,
                        title: fetchRes.title || fetchRes.domain,
                        url: fetchRes.url,
                        domain: fetchRes.domain,
                        snippet: fetchRes.content.slice(0, 300)
                    }];
                    sendEvent({
                        type: 'web_search_sources',
                        sources: attachedSources
                    });

                    processedMessage += `\n\n[FETCHED_PAGE_CONTENT: ${targetUrl}]\nTitle: ${fetchRes.title}\nDomain: ${fetchRes.domain}\nContent:\n${fetchRes.content}\n\nInstructions: Answer the user's prompt using the fetched webpage content above. Cite the source using [1] or (${fetchRes.domain}).`;
                    sendEvent({ type: 'web_search_done', totalResults: 1 });
                } else {
                    sendEvent({
                        type: 'web_search_error',
                        error: fetchRes.error || 'Failed to fetch webpage safely'
                    });
                    processedMessage += `\n\n[NOTE: Could not open URL: ${targetUrl}. Security/Network reason: ${fetchRes.error}. Please inform the user honestly.]`;
                }
            } else {
                sendEvent({
                    type: 'web_search_start',
                    intent: webIntent.intent,
                    status: 'Searching live web...',
                    query: webIntent.query
                });

                const searchRes = await webSearchService.search(webIntent.query, { maxResults: 5 });
                
                // Schema validation for search results
                if (searchRes.success && Array.isArray(searchRes.results)) {
                    searchRes.results = searchRes.results.filter(r => 
                        r && typeof r === 'object' && r.url && r.title && typeof r.url === 'string'
                    );
                }

                if (searchRes.success && searchRes.results && searchRes.results.length > 0) {
                    attachedSources = searchRes.results.map((r, i) => ({
                        citationId: i + 1,
                        title: r.title,
                        url: r.url,
                        domain: r.domain,
                        snippet: r.snippet,
                        publishedDate: r.publishedDate,
                        retrievalTimestamp: r.retrievalTimestamp,
                        reliability: r.reliability
                    }));

                    sendEvent({
                        type: 'web_search_sources',
                        sources: attachedSources
                    });

                    const webContextText = attachedSources.map(s => `[${s.citationId}] "${s.title}" (${s.domain})\nURL: ${s.url}\nDate: ${s.publishedDate || 'recent'}\nSnippet: ${s.snippet}`).join('\n\n');

                    processedMessage += `\n\n[VERIFIED_LIVE_WEB_SEARCH_RESULTS]\nQuery: ${webIntent.query}\nProvider: ${searchRes.provider}\nSources:\n${webContextText}\n\nStrict Instructions for Live Web Answers:\n1. Base factual claims only on the verified web search results above.\n2. Cite sources using [1], [2], etc., matching the numbered sources.\n3. If facts cannot be verified or sources conflict, state this honestly.\n4. Do not invent facts or URLs. Keep URLs and domain names exact.\n5. Answer in the locked user language: ${langInfo.languageName} (${langInfo.detectedResponseLanguage}).`;

                    sendEvent({ type: 'web_search_done', totalResults: attachedSources.length });
                } else {
                    sendEvent({
                        type: 'web_search_done',
                        totalResults: 0,
                        status: searchRes.status || 'NO_RESULTS'
                    });
                }
            }
        }

        // ── Autonomous Intent Matcher for Streaming: Bharat APIs, Z-Image Turbo & Anime.js 3D ──
        try {
            // 1. India Post Pincode Intent
            const pincodeMatch = message.match(/(?:pincode|pin code|pin)\s*:?\s*(\d{6})/i) || message.match(/\b(\d{6})\b/);
            if (pincodeMatch && /(pincode|post|dak|post office|circle|delivery)/i.test(message)) {
                const pin = pincodeMatch[1];
                const pinRes = await bharatService.lookupPincode(pin);
                if (pinRes && pinRes.status === 'success' && pinRes.postOffices) {
                    const poSummary = pinRes.postOffices.slice(0, 6).map(po => `• ${po.Name} (${po.BranchType}, ${po.DeliveryStatus}) - District: ${po.District}, State: ${po.State}`).join('\n');
                    processedMessage += `\n\n[BHARAT_OPEN_API: INDIA POST PINCODE ${pin}]\nTotal Offices: ${pinRes.totalPostOffices}\nOffices:\n${poSummary}\n\nInstructions: Inform user with these verified India Post details clearly in ${langInfo.languageName}.`;
                }
            }

            // 2. Razorpay IFSC Banking Intent
            const ifscMatch = message.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
            if (ifscMatch) {
                const ifscCode = ifscMatch[1].toUpperCase();
                const ifscRes = await bharatService.lookupIFSC(ifscCode);
                if (ifscRes && ifscRes.status === 'success') {
                    processedMessage += `\n\n[BHARAT_OPEN_API: RAZORPAY BANK IFSC ${ifscCode}]\nBank: ${ifscRes.bank}\nBranch: ${ifscRes.branch}\nAddress: ${ifscRes.address}\nCity: ${ifscRes.city}, District: ${ifscRes.district}, State: ${ifscRes.state}\nMICR: ${ifscRes.micr || 'N/A'}\nPayment Rails: UPI=${ifscRes.upi}, IMPS=${ifscRes.imps}, NEFT=${ifscRes.neft}, RTGS=${ifscRes.rtgs}\n\nInstructions: Provide these verified banking details cleanly to the user in ${langInfo.languageName}.`;
                }
            }

            // 3. Mandi Bhav / Krishi Commodity Intent
            if (/(?:mandi|mandi bhav|gehun|sarson|pyaz|tamatar|chawal|kapaas|agmarknet|commodity rate|crop price)/i.test(message)) {
                const mandiRes = await bharatService.getMandiBhav('', '');
                if (mandiRes && mandiRes.commodities) {
                    const mandiSummary = mandiRes.commodities.slice(0, 7).map(c => `• ${c.name}: ${c.modalPrice} (${c.market}, ${c.state})`).join('\n');
                    processedMessage += `\n\n[BHARAT_OPEN_API: AGMARKNET MANDI BHAV]\nLive Commodity Rates:\n${mandiSummary}\n\nInstructions: Present these current Indian Mandi rates to the user with variety and market name in ${langInfo.languageName}.`;
                }
            }

            // 4. ISRO Missions & Bhuvan Geo-Portal Intent
            if (/(?:isro|chandrayaan|aditya\s*-?l1|gaganyaan|bhuvan|navic)/i.test(message)) {
                const isroRes = bharatService.getIsroData();
                const missionsSummary = isroRes.notableMissions.map(m => `• ${m.name}: ${m.objective} [Status: ${m.status}]`).join('\n');
                processedMessage += `\n\n[BHARAT_OPEN_API: ISRO SPACE & BHUVAN]\nAgency: ${isroRes.agency}\nBhuvan 2D/3D Portal: ${isroRes.bhuvanGeoPortal}\nMissions:\n${missionsSummary}\n\nInstructions: Explain India's indigenous ISRO achievements and Bhuvan Geo-Portal access in ${langInfo.languageName}.`;
            }

            // 5. Indian Holidays Intent
            if (/(?:holiday|holidays|chhutti|chhutiyan|festival|diwali|holi|eid|republic day|independence day|2026)/i.test(message) && !message.toLowerCase().includes('vacation booking')) {
                const holRes = bharatService.getIndianHolidays(2026);
                const holSummary = holRes.holidays.map(h => `• ${h.date} (${h.day}): ${h.name} - ${h.type}`).join('\n');
                processedMessage += `\n\n[BHARAT_OPEN_API: INDIAN NATIONAL GAZETTED HOLIDAYS 2026]\nOfficial Holidays:\n${holSummary}\n\nInstructions: Provide the official Indian holiday list in ${langInfo.languageName}.`;
            }

            // 6. Z-Image Turbo Intent (ONLY for static image generation, never for 3D/animation/games)
            // Shared matcher: the old literal phrase list missed plurals ("ek cat ka
            // images banao") and "banado", so no instruction was injected and the
            // model answered with Python/Pillow code instead of emitting the tag.
            if (isImageCreateRequest(message)) {
                processedMessage += `\n\n[INSTRUCTION: The user is requesting static image generation. You MUST include the tag '[GENERATE_IMAGE: <clean english prompt>]' in your response and keep any prose to one or two short sentences. HARD RULE: do NOT reply with source code (Pillow/PIL, matplotlib, SVG, canvas, HTML), do NOT produce a Plan/Assumptions/Implementation breakdown, and do NOT suggest installing packages — render the picture instead. Since Z-Image Turbo is active, optimize the prompt for vibrant, high-detail generation.]`;
            }

            // 7. Anime.js 3D Animation Intent
            if (/(?:anime\.?js|3d animation|3d motion|motion design|3d transform|3d card|particle animation)/i.test(message)) {
                processedMessage += `\n\n[INSTRUCTION: The user is requesting 3D animation design with Anime.js. Provide a complete, interactive, self-contained HTML/CSS+JS or React component utilizing 'animejs' with 3D perspective transforms, rotateX, rotateY, translateZ, and spring physics. Explain how the 3D depth works.]`;
            }

            // 8. Three.js + WebGL 3D Simulation Intent
            if (/(?:three\.?js|webgl|solar system|gravity simulation|orbit simulation|3d simulation|physics simulation|space simulation|3d planet|3d galaxy|3d world)/i.test(message)) {
                processedMessage += `\n\n[MANDATORY INSTRUCTION: The user is requesting an interactive 3D simulation / Three.js + WebGL scene.
STRICT MANDATE: Do NOT give textbook explanations, markdown tables of concepts, or theoretical lecture notes!
You MUST generate a COMPLETE, PRODUCTION-READY, 100% SELF-CONTAINED interactive HTML simulation inside a \`\`\`html ... \`\`\` block.
Include:
- Three.js (r128) and OrbitControls from CDN.
- Interactive OrbitControls camera with damping and zoom.
- Realistic celestial lighting (Sun PointLight + corona flare aura, ambient fill).
- Realistic planetary geometries, axial rotations, and orbital paths with Keplerian velocities (v = sqrt(G*M/r)).
- Saturn rings, Earth-Moon sub-system, 3,000+ particle cosmic starfield.
- Floating Glassmorphic HUD with Play/Pause, Speed slider, Gravity slider, and Planet focus dropdown.]`;
            }
        } catch (intentErr) {
            logger.warn(`⚠️ Bharat / Turbo chat stream intent matcher note: ${intentErr.message}`);
        }

        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;

        const usedModel = await runStreamCascade({
            model,
            message,
            groqMsg,
            processedMessage,
            cleanHistory,
            fileContent,
            section,
            mode,
            customKeys,
            langInfo,
            sendEvent,
            autoSelectModel,
            DEEP_REASONING_SYSTEM_PROMPT
        });
        sendEvent({ done: true, model: usedModel, sources: attachedSources });
        sendEvent('[DONE]');
        res.end();
    } catch (error) {
        logger.error('Stream chat error:', error);
        sendEvent({ error: error.message || 'Stream failed' });
        sendEvent('[DONE]');
        res.end();
    }
};

// ── In-Chat Code Execution Runner (Node.js / Python Sandbox) ────────────────
const { exec: runChildExec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
