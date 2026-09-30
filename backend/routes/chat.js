const express = require('express');
const logger = require('../logger');
const { ReasoningStreamFilter } = require('../utils/streamUtils');
const { OUTPUT_QUALITY_STANDARD } = require('../services/outputQualityStandard');
const DEEP_REASONING_SYSTEM_PROMPT = `You are AI-Dost — an elite autonomous AI system combining the depth of a principal engineer and research analyst with the execution autonomy of a Devin-class AI developer (ChatGPT/Claude-level output quality is the minimum bar).

[THINKING PROTOCOL]
Before producing the final reply, reason step-by-step INTERNALLY inside <think>...</think> tags.
Do NOT reveal these tags or the raw chain-of-thought in the conversational reply — the frontend parses them into a visible "thought trace". If the model emits native reasoning (reasoning_content), prefer that; otherwise use the <think>...</think> wrapper.

[PRIMARY DIRECTIVE]
Deliver complete, expert-level, actionable answers: depth, precision, and working solutions over brevity. Do the thinking for the user — never offload basic reasoning as follow-up questions. For build/fix requests, work like an autonomous agent: Plan -> Assumptions -> Implementation -> Verify -> Next steps.

${OUTPUT_QUALITY_STANDARD}

Always communicate conversationally in Hinglish unless requested otherwise.`;
const router = express.Router();
const { handleWebSearch } = require('../controllers/searchController');
const { handleFileAnalysis } = require('../controllers/analyzeController');
const { handleExecute } = require('../controllers/executeController');
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
    } catch (_) {}
    return '';
}

// Helper to check if response indicates rate limit or error
function isRateLimitedOrError(response) {
    if (!response || typeof response !== 'string') return false;
    const errorIndicators = [
        'RATE_LIMIT',
        'CIRCUIT_OPEN',
        'rate_limit',
        '429',
        '413',
        'Quota exceeded',
        'quota exceeded',
        'API error',
        'API Error',
        'key set nahi hai',
        'service me error',
        'service error',
        'Service Error',
        'temporarily unavailable',
        'unexpected response',
        'not found',
        'All models unavailable',
        'Max retries exceeded'
    ];
    return errorIndicators.some(indicator => response.includes(indicator));
}

// Helper to check if response is a valid AI response
function isValidResponse(response) {
    if (!response || typeof response !== 'string' || response.trim().length < 10) return false;
    if (isRateLimitedOrError(response)) return false;
    const trimmed = response.trim();
    // Filter out provider safety echo / empty wrappers from free tier models (e.g. OpenRouter "User Safety: safe")
    if (/^(user safety:\s*(safe|unsafe)?|safety:\s*(safe|unsafe)?)$/i.test(trimmed)) return false;
    if (/^(groq|gemini|nvidia|deepseek|openrouter|mistral|together|huggingface|hf).*error/i.test(trimmed)) return false;
    if (trimmed.length < 25 && /^(safe|ok|success|done|received|error|null|undefined)$/i.test(trimmed)) return false;
    return true;
}

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

// Service health check endpoint
router.get('/health/services', async (req, res) => {
    const services = {
        groq: { available: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_your_key_here' },
        gemini: { available: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_key' },
        nvidia: { available: !!process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'your_nvidia_key' },
        deepseek: { available: !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_key' },
        openrouter: { available: !!process.env.OPENROUTER_API_KEY },
        mistral: { available: !!process.env.MISTRAL_API_KEY },
        together: { available: !!process.env.TOGETHER_API_KEY },
        huggingface: { available: !!process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== 'hf_your_key_here' },
        ollama: { available: false }
    };

    // Check Ollama
    try {
        const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        services.ollama.available = ollamaRes.ok;
    } catch (e) {
        services.ollama.available = false;
    }

    res.json({ success: true, services });
});

// Clean history: dynamic sliding window up to 20 messages and 24,000 char budget
function buildCleanHistory(history, maxMessages = 20, maxTotalChars = 24000) {
    if (!history || !Array.isArray(history)) return [];
    const valid = history.filter(msg => msg && msg.role && msg.content);
    const sliced = valid.slice(-maxMessages);
    let totalChars = 0;
    const result = [];
    for (let i = sliced.length - 1; i >= 0; i--) {
        const item = sliced[i];
        const contentStr = String(item.content || '').substring(0, 3000);
        if (totalChars + contentStr.length > maxTotalChars && result.length > 0) {
            break;
        }
        totalChars += contentStr.length;
        result.unshift({
            role: item.role === 'ai' || item.role === 'model' ? 'assistant' : item.role,
            content: contentStr
        });
    }
    return result;
}

// Main chat endpoint
router.post('/', async (req, res) => {
    const startTime = Date.now();
    try {
        let { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
        
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
7. Completeness (MANDATORY): Never truncate an answer mid-way, never use placeholder code ("// rest of code here", "// TODO", "your_code_here"), and never give a shallow one-liner when the question needs depth. Code must be complete and runnable with imports + error handling.
8. Self-Verification: Before finalizing, confirm silently — the actual question is answered, every code block is complete, steps are in runnable order, citations are real, and filler is removed.
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

        // ── Autonomous Intent Matcher: Bharat APIs, Z-Image Turbo & Anime.js 3D ──
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

            // 6. Category 3: Image Generation & Editing Intent (All 17 Types)
            const isImageIntent = /(?:image banao|fast image|turbo image|photo banao|generate image|picture of|logo banao|banner banao|poster banao|thumbnail banao|character design|portrait banao|infographic|concept art|mockup|book cover|social media post|background remove|remove background|object add|style transform|enhance image)/i.test(message) && !/(?:animation|3d scene|three\.?js|webgl|playable game|simulation|kinetic|typography reveal|runner)/i.test(message);
            if (isImageIntent) {
                const detectedCat = detectImageCategory(message);
                const reqSpec = buildEnhancedImageRequest(message, detectedCat);
                processedMessage += `\n\n[INSTRUCTION: The user is requesting Image Generation / Editing (Category: ${detectedCat}).
You MUST include the tag '[GENERATE_IMAGE: ${reqSpec.prompt.replace(/[\[\]]/g, '')}]' in your response.
Provide a brief, confident, helpful 1-2 sentence description in ${langInfo.languageName}.]`;
            }

            // 7. Anime.js CSS 3D Transforms (when explicitly requested)
            if (/(?:anime\.?js|css 3d transform|perspective card|flip card|kinetic text)/i.test(message)) {
                processedMessage += `\n\n[INSTRUCTION: The user is requesting 3D animation design with Anime.js / CSS 3D. Provide a complete, interactive, self-contained HTML+CSS+JS component utilizing 'animejs' with 3D perspective transforms, rotateX, rotateY, translateZ, and spring physics. Explain how the 3D depth works.]`;
            }

            // 8. Universal Three.js & WebGL 3D Animation & Simulation Studio Intent
            if (/(?:three\.?js|webgl|3d animation|3d simulation|3d model|3d scene|3d interactive|3d visualizer|3d physics|\b3d\b)/i.test(message)) {
                processedMessage += `\n\n${THREEJS_WEBGL_SYSTEM_DIRECTIVE}\n\n[MANDATORY 3D ACCURACY INSTRUCTION: The user is requesting an interactive 3D scene / animation.
USER DEMAND: "${message}".
ACCURACY MANDATE:
- Analyze the user's EXACT requested subject (e.g. vehicle, character, architecture, biological/DNA, mechanical, space, gaming, particles, abstract).
- Do NOT substitute with unrelated objects (e.g. do NOT generate planets if the user asked for a car, robot, cube, or city).
- Construct compound Three.js (r128) geometries and meshes that ACCURATELY represent the requested subject.
- Setup professional Three.js scene:
  • CDNs: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js and https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
  • OrbitControls with smooth damping (\`controls.enableDamping = true\`).
  • Studio lighting: AmbientLight + DirectionalLight with specular highlights + PointLights with emissive colored glow.
  • Rich materials: \`THREE.MeshStandardMaterial\` with realistic metalness, roughness, and emissive colors.
  • Smooth requestAnimationFrame animation loop animating the specific kinetic mechanisms requested.
  • Cyber Glassmorphic HUD overlay with Orbitron/Space Grotesk typography, status pill, and interactive controls (speed slider, wireframe toggle, color/effect toggles, reset view button).
- You MUST output the complete, 100% runnable, self-contained HTML code inside a single \`\`\`html ... \`\`\` code fence with ZERO broken external assets.]`;
            }

            // 9. Category 5: Study & Teaching Intent (Personal AI Teacher / Guru)
            const teachProfile = detectTeachingProfile(message);
            if (teachProfile.isTeachingQuery) {
                processedMessage += `\n\n${TEACHING_PEDAGOGY_DIRECTIVE}\n\n[INSTRUCTION: The user is in Study & Teaching Mode (Subject: ${teachProfile.subject}, Requested Pedagogical Tools: ${teachProfile.styles.join(', ')}).
Act as AI-Dost's Master Teacher & Guru.
Apply the requested pedagogical formats:
${teachProfile.styles.map(s => `• ${s}`).join('\n')}
Adhere strictly to Category 5 standards:
- Start with intuitive beginner-friendly foundation & real-life analogies.
- Visualize mechanisms with ASCII diagrams or structured tables.
- Include practice questions, viva questions, or mistake analysis as requested.
- If the user's query is vague, proactively ask clarifying questions (subject, level, goal).
- Maintain humble confidence and a warm, encouraging mentor tone in ${langInfo.languageName}.]`;
            }

            // 10. Category 6: PDF, Documents, PPT & Reports Studio Intent
            const docReq = detectDocumentRequest(message);
            if (docReq.isDocumentIntent) {
                processedMessage += `\n\n${DOCUMENT_STUDIO_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting a Category 6 Document / Report: "${docReq.typeName}" on topic: "${docReq.topic}".
Adhere strictly to 2030 Executive Document & Report standards:
- Provide a complete, production-grade, authoritative document.
- Follow the professional sections for ${docReq.type}.
- Include relevant tables, structured bullet points, metrics, and actionable details.
- Avoid superficial placeholders.
- Maintain a highly professional, authoritative tone in ${langInfo.languageName}.]`;
            }

            // 11. Category 8: Data Analysis, Science & Visualization Intent
            const dataIntent = detectDataAnalyticsIntent(message);
            if (dataIntent.isAnalytics) {
                processedMessage += `\n\n${DATA_ANALYTICS_STUDIO_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 8 Data Analysis & Visualization (Sub-domain: ${dataIntent.domain}).
Act as AI-Dost's Principal Data Scientist & Analytics Architect.
Adhere strictly to 2030 Data Science standards:
- If asked for statistical summary, data cleaning, or missing values, provide precise mathematical formulas, IQR bounds, and imputation strategies.
- If asked for code, provide clean, production-grade, vectorized Python (Pandas/Polars) or SQL with CTEs and window functions.
- If recommending charts or dashboards, outline the layout, KPI metrics (LTV, CAC, NRR), and Chart.js/Recharts data schema.
- Respond authoritatively in ${langInfo.languageName}.]`;
            }

                // 12. Category 9: AI/ML Projects & Systems Design Intent
            const aimlIntent = detectAiMlProjectIntent(message);
            if (aimlIntent.isAiMl) {
                const dConfig = aimlIntent.domainConfig;
                processedMessage += `\n\n${AIML_PROJECTS_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 9 AI/ML Systems Design & Implementation (Domain: ${aimlIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
Act as AI-Dost's Principal AI/ML Architect.
Adhere strictly to 2030 AI/ML Engineering standards:
- Provide complete, production-grade architectural design diagrams (ASCII/Mermaid).
- Provide copy-paste runnable production code (Python / TypeScript / PyTorch / LangChain / LlamaIndex / vLLM).
- Detail the exact tech stack: ${dConfig ? dConfig.stack : 'Modern AI Stack'}.
- Include performance metrics: latency SLAs, VRAM memory sizing, throughput, quantization (GGUF/AWQ/QLoRA), and evaluation rubrics (RAGAS/G-Eval).
- Respond authoritatively and encourage implementation in ${langInfo.languageName}.]`;
            }

            // 13. Category 10: GitHub & Project Management Protocol
            const gitPmIntent = detectGitPmIntent(message);
            if (gitPmIntent.isGitPm) {
                const dConfig = gitPmIntent.domainConfig;
                processedMessage += `\n\n${GIT_PROJECT_MANAGEMENT_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 10 GitHub & Project Management (Domain: ${gitPmIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
Act as AI-Dost's Principal Staff Engineer & Technical Project Director.
Follow 2030 Principal Engineering Standards:
- If suggesting commits, strictly use Conventional Commits format with 3 distinct options (concise, detailed, and breaking/migration).
- If creating an Issue or PR, provide comprehensive, production-ready markdown with checkboxes, reproduction steps, and impact assessment.
- If designing repo structure, provide full directory trees with dotfiles (.gitignore, .editorconfig, CI/CD).
- If drafting an ADR, follow Michael Nygard format (Status, Context, Decision, Consequences, Alternatives).
- If drafting branching/release/changelog/quality/security/testing/refactoring plans, make them immediately actionable with concrete checklists and runbooks.
- Format all code, git commands, and markdown cleanly for immediate execution.
- Respond in ${langInfo.languageName}.]`;
            }

            // 14. Category 11: Writing & Professional Communication Protocol
            const writingIntent = detectWritingIntent(message);
            if (writingIntent.isWriting) {
                const fConfig = writingIntent.formatConfig;
                const tConfig = writingIntent.toneConfig;
                processedMessage += `\n\n${WRITING_COMMUNICATION_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 11 Writing & Communication (Format: ${writingIntent.format}${fConfig ? ` - ${fConfig.name}` : ''}, Tone: ${writingIntent.tone}${tConfig ? ` - ${tConfig.name}` : ''}).
Act as AI-Dost's Master Copywriter & Executive Communication Director.
Adhere strictly to 2030 Professional Writing standards:
- Tone Adaptation: Faithfully embody the requested tone (${tConfig ? tConfig.description : writingIntent.tone}).
- Scannability & Impact: Use bold headings, bullet points, clean spacing, and eliminate generic filler phrases.
- If an email, include a high-converting Subject Line.
- If a script, include explicit camera/B-roll directions [in brackets] and timestamps.
- If translation or rewriting, provide the polished version along with key enhancements/nuance notes.
- Format cleanly in Markdown ready for copy-pasting or publishing.
- Respond in ${langInfo.languageName}.]`;
            }

            // 15. Category 12: Planning & Productivity Protocol
            const planningIntent = detectPlanningIntent(message);
            if (planningIntent.isPlanning) {
                const pConfig = planningIntent.domainConfig;
                processedMessage += `\n\n${PLANNING_PRODUCTIVITY_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 12 Planning & Productivity (Domain: ${planningIntent.domain}${pConfig ? ` - ${pConfig.name}` : ''}).
Act as AI-Dost's Principal Life Architect & Executive Productivity Director.
Adhere strictly to 2030 Scientific Life Architecture & Productivity Standards:
- Realistic & Sustainable: Never generate impossible burnout schedules. Build in 15-20% buffers, proper sleep, meals, and recovery.
- Time-Blocking: Format clear time blocks (e.g. 08:30 AM - 11:00 AM) with peak-energy alignment.
- Actionable Checklists: Use structured Markdown tables, milestone gates, and task checkboxes \`- [ ]\`.
- Scientific Rigor: Incorporate Spaced Repetition (Day 1, 3, 7, 21, 60), Pareto 80/20 prioritization, and James Clear's 2-Minute Habit Rule.
- Deliver ready-to-execute plans, timetables, or roadmaps.
- Respond motivatingly in ${langInfo.languageName}.]`;
            }

            // 16. Category 13: Automation & Reminders Protocol
            const automationIntent = detectAutomationIntent(message);
            if (automationIntent.isAutomation) {
                const aConfig = automationIntent.domainConfig;
                processedMessage += `\n\n${AUTOMATION_REMINDERS_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 13 Automation & Reminders (Domain: ${automationIntent.domain}${aConfig ? ` - ${aConfig.name}` : ''}).
Act as AI-Dost's Autonomous Operations Director & Agentic Watcher Architect.
Adhere strictly to 2030 Autonomous Agentic Automation Standards:
- Clearly define the Trigger Type (Schedule vs Event-driven) and exact cadence (e.g. Daily at 08:30 AM, Weekly on Sunday, Every 60 min).
- Specify the Action Type: ${aConfig ? aConfig.actionType : 'custom_task'} with concrete payload parameters.
- Detail multi-channel notification strategy: In-App Glassmorphic toasts + Telegram alerts.
- Provide the exact API call the user can make to provision this automation: POST /api/workflows with name, triggerType, triggerConfig, actionType, actionConfig, notifyChannels.
- Include deduplication, self-healing retry, and no-spam guardrails.
- If the user says "set karo" / "start karo" / "activate", confirm the automation is ready and guide them to the Automations panel.
- Respond helpfully and encouragingly in ${langInfo.languageName}.]`;
            }

            // 17. Category 14: Local Business & Travel Assistance Protocol
            const travelIntent = detectTravelIntent(message);
            if (travelIntent.isTravel) {
                const tConfig = travelIntent.domainConfig;
                processedMessage += `\n\n${LOCAL_BUSINESS_TRAVEL_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 14 Local Business & Travel Assistance (Domain: ${travelIntent.domain}${tConfig ? ` - ${tConfig.name}` : ''}).
Act as AI-Dost's Principal Travel Intelligence Director & Local Business Discovery Expert.
Adhere strictly to 2030 Travel Intelligence Standards:
- Provide specific, named recommendations (actual restaurant/hotel/attraction names) with approximate costs, ratings, and locations.
- Use structured Markdown tables for comparisons, budgets, and multi-option displays.
- For Indian destinations: use ₹ prices, mention local transport (auto/metro/bus), and include Hindi/local names of places.
- For itineraries: use specific time blocks (e.g. "9:00 AM - 11:30 AM"), include transit time between locations, and max 3-4 major activities per day.
- For budgets: always provide 3 tiers (Budget, Mid-Range, Premium) with 10-15% contingency buffer.
- For packing: adapt to destination weather and planned activities.
- Include a closing "Pro Travel Tip" or "Money-Saving Hack".
- Respond helpfully and enthusiastically in ${langInfo.languageName}.]`;
            }

            // 18. Category 15: Language & Translation Protocol
            const langIntent = detectLanguageIntent(message);
            if (langIntent.isLanguage) {
                const mConfig = langIntent.modeConfig;
                processedMessage += `\n\n${LANGUAGE_TRANSLATION_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 15 Language & Translation (Mode: ${langIntent.mode}${mConfig ? ` - ${mConfig.name}` : ''}, Target: ${langIntent.targetLanguage || 'appropriate language'}).
Act as AI-Dost's Master Polyglot, Principal Linguist & Executive Communication Coach.
Adhere strictly to Category 15 Linguistic standards:
- If translating (Hindi, English, Hinglish, Sanskrit, Marathi, Bengali, Urdu, Technical, Academic): Provide culturally nuanced translation, preserving idioms and tone. Provide pronunciation/script notes where relevant.
- If grammar check: Provide a clean Side-by-Side diff (❌ Original vs ✅ Corrected), bulleted rule breakdown (Subject-Verb, Tense, Prepositions), and a memory hack.
- If simplifying: Transform convoluted jargon into crystal-clear plain English / Hinglish (ELI5).
- If formalizing: Convert casual or rough drafts into polite, executive-grade corporate communication.
- If spoken English: Provide realistic dialogue turns, natural idiomatic phrasing, and phonetic/intonation guidance.
- If interview English: Provide a polished STAR framework response, confident power verbs, and eliminate filler words.
- If vocabulary building: Detail roots, connotations, 3 context sentences, subtle synonyms, and collocations.
- Respond with warm, encouraging mentorship in ${langInfo.languageName}.]`;
            }

            // 19. Category 16: Problem Solving & Decision Support Protocol
            const decisionIntent = detectDecisionIntent(message);
            if (decisionIntent.isDecision) {
                const dConfig = decisionIntent.domainConfig;
                processedMessage += `\n\n${DECISION_SUPPORT_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 16 Problem Solving & Decision Support (Domain: ${decisionIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
Act as AI-Dost's Principal Decision Scientist & Chief Technology Strategist.
Adhere strictly to Category 16 Scientific Decision Standards:
- State a clear, decisive winner/verdict upfront with 2-3 sentences. Never say "it depends" without taking a stand.
- Generate a structured Multi-Criteria Evaluation Matrix (Markdown table) comparing top options across criteria scored out of 10 with a Total / 50.
- Detail real hidden catches and trade-offs for each alternative (cold starts, lock-in, licensing, battery life, burnout).
- Provide a Reversibility Assessment: Classify as Type 1 (Irreversible / High-Stakes) vs Type 2 (Reversible / Low-Stakes) and outline an escape hatch / pivot strategy.
- Conclude with 3 concrete next action steps to execute today.
- Respond authoritatively and analytically in ${langInfo.languageName}.]`;
            }

            // 20. Category 17: Security & Defensive Cybersecurity Protocol
            const secIntent = detectSecurityIntent(message);
            if (secIntent.isSecurity) {
                const sConfig = secIntent.domainConfig;
                processedMessage += `\n\n${CYBERSECURITY_DEFENSIVE_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 17 Security & Cybersecurity (Domain: ${secIntent.domain}${sConfig ? ` - ${sConfig.name}` : ''}).
Act as AI-Dost's Principal Application Security Architect & Defensive Cybersecurity Engineer.
Strict Safety Mandate: Exclusively DEFENSIVE, REMEDIATION, AUDITING, and EDUCATIONAL guidance. Never output functional exploit scripts or attack payloads.
Adhere strictly to Category 17 Defensive Standards:
- Clearly state the Vulnerability / CWE / OWASP ID and real-world business risk.
- Contrast the Vulnerable Anti-Pattern against the Hardened Production Remediation.
- Provide production-grade, copy-paste ready secure code (e.g. parameterized queries, DOMPurify, Argon2id, crypto.timingSafeEqual, RS256 JWT checks).
- Provide a simple Defensive Verification test (unit test, header check, or linter rule) to verify the patch.
- Include a 3-point Hardening & Least-Privilege Checklist.
- Respond reassuringly and authoritatively in ${langInfo.languageName}.]`;
            }

            // 21. Master 50-Domain Capability Protocol
            const masterCap = detectMasterCapability(message);
            if (masterCap.isMatch && masterCap.capability) {
                processedMessage += `\n\n${masterCap.directive}\n\n[INSTRUCTION: The user query matches Master Capability #${masterCap.capability.id}: "${masterCap.matchedDomain}" (${masterCap.capability.cluster}).
Follow the high-level professional standards and methodology defined for this domain.
Structure the answer clearly, use appropriate diagrams, code, tables, or step-by-step reasoning where applicable, and respond in ${langInfo.languageName}.]`;
            }
            // 22. Conversational & Feedback Guardrail (Prevents LLM from blindly repeating code from history)
            if (/^(?:ok|okay|good|great|awesome|sahi hai|thanks|thank you|shukriya|dhanyawad|nahi|no|stop|wait|ruko|kaha tha|sun lo|mat likho|sabasi|mast|badhiya)/i.test(message.trim()) || /code likhne.*nahi/i.test(message) || (message.length < 50 && !isImageIntent && !masterCap.isMatch)) {
                processedMessage += `\n\n[CONVERSATIONAL GUARDRAIL: The user is providing conversational feedback or a short reply ("${message}"). Do NOT generate or repeat large code blocks, simulations, or reports unless the user explicitly asks for a modification. Acknowledge their message naturally, concisely, and politely in ${langInfo.languageName} without unnecessary filler.]`;
            }
        } catch (intentErr) {
            logger.warn(`⚠️ Bharat / Turbo chat intent matcher note: ${intentErr.message}`);
        }

        let response;
        let usedModel = model || 'auto';
        let fallbacksAttempted = [];
        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;

        if (model === 'ollama' || (model && model.startsWith('local:'))) {
            const localModelName = model.startsWith('local:') ? model.substring(6) : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b');
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
            
            const localRes = await fetch('http://127.0.0.1:11434/api/chat', {
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
});

// ═══════════════════════════════════════════════════════════════════════════
// PARALLEL PROVIDER RACING — O(1) latency vs O(N) sequential fallback
// Strategy: Race providers in tiers. First valid response wins.
// Tier 1: 3 fastest providers race simultaneously  → target 2-5s
// Tier 2: Next 4 providers race simultaneously     → target 5-10s  
// Tier 3: Slower providers + Ollama               → target 10-60s
// ═══════════════════════════════════════════════════════════════════════════
async function executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
    // Wrap each provider call: resolves with response if valid, rejects if not
    const makeRacer = async (name, fn, timeoutMs = 7000) => {
        try {
            logger.info(`⚡ Racing ${name}...`);
            const res = await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`${name}: timeout after ${timeoutMs}ms`)), timeoutMs))
            ]);
            if (isValidResponse(res)) {
                logger.info(`✅ ${name} won the race`);
                return { response: res, winner: name };
            } else {
                throw new Error(`${name}: invalid/rate-limited response`);
            }
        } catch (e) {
            throw new Error(`${name}: ${e.message}`);
        }
    };

    // ── TIER 1: Top fastest active providers — race simultaneously ────────
    try {
        const tier1 = await Promise.any([
            makeRacer('Gemini',     () => GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini), 20000),
            makeRacer('Groq',       () => GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq), 15000),
            makeRacer('OpenRouter', () => OpenRouterService.chat(groqMsg, cleanHistory, customKeys?.openrouter), 20000),
            makeRacer('Cerebras',   () => CerebrasService.chat(groqMsg, cleanHistory, mode, customKeys?.cerebras), 10000),
        ]);
        logger.info(`🏆 Tier-1 winner: ${tier1.winner}`);
        return tier1;
    } catch (t1Err) {
        logger.warn(`⚠️ Tier-1 all failed, escalating to Tier-2...`);
    }

    // ── TIER 2: Secondary providers ───────────────────────────────────────
    try {
        const tier2 = await Promise.any([
            makeRacer('NVIDIA',     () => NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia), 10000),
            makeRacer('OpenAI',     () => OpenAIService.chat(groqMsg, cleanHistory, mode, customKeys?.openai), 10000),
            makeRacer('Together',   () => TogetherService.chat(groqMsg, cleanHistory, customKeys?.together), 8000),
        ]);
        logger.info(`🏆 Tier-2 winner: ${tier2.winner}`);
        return tier2;
    } catch (t2Err) {
        logger.warn(`⚠️ Tier-2 all failed, escalating to Tier-3...`);
    }

    // ── TIER 3: Last resort providers ─────────────────────────────────────
    try {
        const tier3 = await Promise.any([
            makeRacer('DeepSeek',    () => DeepSeekService.chat(groqMsg, cleanHistory, customKeys?.deepseek), 3000),
            makeRacer('Mistral',     () => MistralService.chat(groqMsg, cleanHistory, customKeys?.mistral), 3000),
            makeRacer('HuggingFace', () => HuggingFaceService.chat(groqMsg), 3000),
        ]);
        logger.info(`🏆 Tier-3 winner: ${tier3.winner}`);
        return tier3;
    } catch (t3Err) {
        logger.warn(`⚠️ Tier-3 all failed, trying local Ollama...`);
    }

    // ── TIER 4: Local Ollama (offline fallback) ───────────────────────────
    try {
        logger.info("🦙 Trying local Ollama (offline fallback)...");
        const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (tagsRes.ok) {
            const tagsData = await tagsRes.json();
            const models = tagsData.models || [];
            if (models.length > 0) {
                const genRes = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: models[0].name, prompt: message, stream: false }),
                    signal: AbortSignal.timeout(60000)
                });
                if (genRes.ok) {
                    const genData = await genRes.json();
                    if (genData.response) {
                        logger.info('✅ Ollama local fallback succeeded');
                        return { response: genData.response, winner: 'ollama' };
                    }
                }
            }
        }
    } catch (e) {
        logger.warn("Ollama fallback failed:", e.message);
    }

    return { response: "Ai-Dost: Sabhi AI providers temporarily unavailable. Please check API keys in settings or start Ollama locally.", winner: 'fallback' };
}



// Auto select best AI model using Smart Natural Language Intent Detection (Mixture of Experts)
async function autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys = null) {
    const text = message.toLowerCase();
    const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;

    // Intent Detection
    const codeKeywords = ['code', 'function', 'bug', 'error', 'debug', 'refactor', 'python', 'javascript', 'html', 'css', 'java', 'c++', 'react', 'api', 'syntax', 'script', 'compile', 'regex', 'database', 'sql', 'backend', 'frontend', '3d', 'three.js', 'threejs', 'webgl', 'dna', 'helix', 'simulation', 'simulator', 'animation', 'canvas', 'render'];
    const isCodingIntent = section === 'coding' || codeKeywords.some(kw => text.includes(kw)) || /```[\s\S]*```/.test(message);

    const translationKeywords = ['translate', 'translation', 'anuvad', 'hindi me', 'english me', 'spanish', 'french', 'german', 'language conversion', 'convert text'];
    const isTranslationIntent = section === 'translation' || translationKeywords.some(kw => text.includes(kw));

    const writingKeywords = ['write an essay', 'write a blog', 'draft an email', 'write a story', 'poem', 'article', 'summary', 'paraphrase', 'cover letter', 'creative writing', 'kavita', 'kahani'];
    const isWritingIntent = section === 'writing' || writingKeywords.some(kw => text.includes(kw));

    const mathKeywords = ['solve', 'equation', 'math', 'calculus', 'algebra', 'matrix', 'derivative', 'integral', 'step by step math', 'proof'];
    const isMathIntent = section === 'math' || mathKeywords.some(kw => text.includes(kw));

    // Delegate to MoERouterService
    const route = MoERouterService.analyzeAndRoute(message, section, isCodingIntent, isMathIntent, isWritingIntent, isTranslationIntent);
    return await MoERouterService.executeExpert(route, message, groqMsg, cleanHistory, fileContent, mode, customKeys);
}

// ── Web Access Status & Health ───────────────────────────────────────────────
router.get('/web-status', (req, res) => {
    res.json({ success: true, ...getPublicConfig() });
});

// ── Web Search with sources (Perplexity-style) ────────────────────────────────
router.post('/search', handleWebSearch);
// ── Creative Canvas & Visual Art System Directive ───────────────────────────
const CREATIVE_CANVAS_SYSTEM_PROMPT = `You are AI-Dost, an elite Senior Software Engineer, Creative Canvas/SVG Technologist, and Autonomous AI Assistant.
Key Directives & Mandates:
1. Tone & Responsibility: Be confident, proactive, and authoritative. STRICT LANGUAGE RULE: Always respond in the EXACT language and script detected from the user's latest prompt (e.g. English for English questions, Hindi in Devanagari script for Hindi questions, Hinglish for Romanized Hindi, Bengali for Bengali, etc.). Never force Hinglish if the user asks in pure English or another language.
2. Multimodal Intents:
   - IMAGE REQUEST: If user asks ONLY for a static 2D image, drawing, or picture (e.g. "image banao", "photo draw karo"), respond ONLY with: [GENERATE_IMAGE: detailed English description]. 
     CRITICAL: DO NOT use [GENERATE_IMAGE: ...] if the user asks for an animation, 3D, game, simulation, Three.js, WebGL, logo reveal, kinetic text/font, or interactive code! For animations/games/3D, you MUST generate the interactive runnable HTML code!
   - PDF / REPORT: If user asks for a PDF or document, wrap in [GENERATE_PDF: Title] content [/GENERATE_PDF].
3. HIGH-FIDELITY CREATIVE CODING & ANIMATION RULES (STRICT AUTONOMOUS MANDATE):
   When asked for an animation, visual artwork, character/deity silhouette (e.g. Lord Krishna, Shiva, celestial art), game, or interactive canvas:
   - NEVER USE CRUDE PRIMITIVES: Never draw crude stick figures, elementary circles, or basic polygon outlines! Elementary stick figures are strictly prohibited.
   - 100% SELF-CONTAINED ARTIFACT: Provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block wrapped in \`\`\`html ... \`\`\` with CSS in <style> and JavaScript in <script> placed at the end of <body>. ZERO external CSS/JS dependencies.
   - ARTISTIC CANVAS ANATOMY & SILHOUETTE:
     * Use multi-segment Bezier and quadratic curves (ctx.bezierCurveTo(), ctx.quadraticCurveTo()) to sculpt organic silhouettes, flowing silks/robes, muscular anatomy, divine postures, and delicate facial profiles.
     * Use layered gradients (ctx.createRadialGradient(), ctx.createLinearGradient()) for depth, volumetric form, and celestial auras.
   - NEON GLOW & BLOOM EFFECT:
     * Multi-pass rendering: Set ctx.shadowBlur = 25 to 50, ctx.shadowColor = accentColor (e.g. '#00f0ff' electric cyan, '#ffd700' divine gold, '#ffffff'), and ctx.globalCompositeOperation = 'lighter' for luminous cosmic energy.
   - ICONOGRAPHY & ATTRIBUTES:
     * When rendering divine, mythological, or specific subjects (such as Lord Krishna): include all sacred iconography with extreme precision:
       • Glowing peacock feather (mor pankh) with concentric cyan, violet, and emerald gradients on the crown.
       • Radiant forehead Tilak shining with intense white-gold brilliance.
       • Raised index finger with rotating glowing Sudarshan Chakra featuring spinning spokes, solar flares, and particle sparks.
       • Golden glowing ornaments/malas rendered with shimmering pearls or metallic highlights.
       • Flowing luminous stole/drapes in waves across shoulders and waist.
       • Celestial stardust and ambient floating energy orbs in the deep cosmic background.
   - HIGH-DPI & ANIMATION LOOP:
     * High-DPI canvas scaling using window.devicePixelRatio and auto-resize listeners.
     * Smooth requestAnimationFrame(loop) using delta time for breathing aura, spinning chakra, and floating stardust.
4. 100% ACCURACY & ZERO-HALLUCINATION PROTOCOL:
   - FACTUAL EXACTNESS: Never guess or hallucinate facts, dates, specifications, or code APIs. If unsure, verify with ground truth or ask for clarification.
   - ZERO PLACEHOLDERS: Code must be 100% production-ready, complete, and syntactically flawless. Never omit critical blocks or write "// TODO".
   - LEARNED CORRECTIONS: Strictly obey all user verified accuracy rules and corrections provided in the prompt context as absolute ground truth.
   - BHARAT OPEN DATA: For Indian pincodes, bank IFSCs, agricultural mandi prices, ISRO missions, and national holidays, adhere 100% to the verified open data provided in context without modifying facts.
5. ${THREEJS_WEBGL_SYSTEM_DIRECTIVE}
${CODING_SOFTWARE_DEV_DIRECTIVE}`;

// ── Universal File Reader & Deep Analytical Studio (Category 7) ─────────────
router.post('/analyze', handleFileAnalysis);
// ── Stream Chat (Server-Sent Events) ─────────────────────────────────────────
router.post('/stream', async (req, res) => {
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
        const { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
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
            if (/(?:image banao|fast image|turbo image|photo banao|generate image|picture of)/i.test(message) && !/(?:animation|3d|three\.?js|webgl|game|simulation|kinetic|typography|reveal|code|runner)/i.test(message)) {
                processedMessage += `\n\n[INSTRUCTION: The user is requesting static image generation. You MUST include the tag '[GENERATE_IMAGE: <clean english prompt>]' in your response. Since Z-Image Turbo is active, optimize the prompt for vibrant, high-detail generation.]`;
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

        let streamedSuccessfully = false;
        let usedModel = 'auto';

        // 1. If Local Ollama requested
        if (model === 'ollama' || (model && model.startsWith('local:'))) {
            const localModelName = model.startsWith('local:') ? model.substring(6) : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b');
            try {
                const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: localModelName,
                        messages: [
                            { role: 'system', content: DEEP_REASONING_SYSTEM_PROMPT },
                            ...cleanHistory,
                            { role: 'user', content: groqMsg }
                        ],
                        stream: true
                    }),
                    signal: AbortSignal.timeout(60000)
                });
                if (ollamaRes.ok && ollamaRes.body) {
                    const reader = ollamaRes.body.getReader();
                    const decoder = new TextDecoder();
                    const filter = new ReasoningStreamFilter(
                        (t) => sendEvent({ type: 'thought_chunk', thought: t }),
                        (c) => { sendEvent({ chunk: c }); streamedSuccessfully = true; }
                    );
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunkText = decoder.decode(value, { stream: true });
                        const lines = chunkText.split('\n').filter(Boolean);
                        for (const line of lines) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.message?.reasoning_content) {
                                    filter.pushReasoningDelta(parsed.message.reasoning_content);
                                }
                                if (parsed.message?.content) {
                                    filter.pushContentDelta(parsed.message.content);
                                }
                            } catch (_) {}
                        }
                    }
                    filter.flush();
                    if (filter.hasEmittedThought) sendEvent({ type: 'thought_done' });
                    if (streamedSuccessfully) usedModel = `local:${localModelName}`;
                }
            } catch (err) {
                logger.warn('Ollama streaming error:', err.message);
            }
        }

        // 2. Try Groq Streaming (Primary Fast with Reasoning Support)
        if (!streamedSuccessfully && (model === 'groq' || model === 'auto' || !model)) {
            const apiKey = customKeys?.groq || process.env.GROQ_API_KEY;
            if (apiKey && apiKey !== 'gsk_your_key_here') {
                const groqCandidates = ['openai/gpt-oss-120b', 'deepseek-r1-distill-llama-70b', 'qwen-2.5-32b', 'llama-3.3-70b-versatile'];
                for (const groqModel of groqCandidates) {
                    try {
                        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: groqModel,
                                messages: [
                                    { role: 'system', content: DEEP_REASONING_SYSTEM_PROMPT },
                                    ...cleanHistory,
                                    { role: 'user', content: groqMsg }
                                ],
                                stream: true,
                                temperature: 0.2,
                                max_tokens: 4096
                            }),
                            signal: AbortSignal.timeout(20000)
                        });

                        if (groqRes.ok && groqRes.body) {
                            const reader = groqRes.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            const filter = new ReasoningStreamFilter(
                                (t) => sendEvent({ type: 'thought_chunk', thought: t }),
                                (c) => { sendEvent({ chunk: c }); streamedSuccessfully = true; }
                            );

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || '';
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('data: ')) {
                                        const dataStr = trimmed.slice(6);
                                        if (dataStr === '[DONE]') continue;
                                        try {
                                            const parsed = JSON.parse(dataStr);
                                            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning;
                                            if (reasoning) {
                                                filter.pushReasoningDelta(reasoning);
                                            }
                                            const delta = parsed.choices?.[0]?.delta?.content;
                                            if (delta) {
                                                filter.pushContentDelta(delta);
                                            }
                                        } catch (_) {}
                                    }
                                }
                            }
                            filter.flush();
                            if (filter.hasEmittedThought) sendEvent({ type: 'thought_done' });
                            if (streamedSuccessfully) {
                                usedModel = `groq (${groqModel})`;
                                break;
                            }
                        }
                    } catch (e) {
                        logger.warn(`Groq streaming (${groqModel}) failed:`, e.message);
                    }
                }
            }
        }

        // 3. Try Gemini Streaming (with Native Thought & Reasoning Filter)
        if (!streamedSuccessfully && (model === 'gemini' || model === 'auto' || !model)) {
            const geminiKey = customKeys?.gemini || process.env.GEMINI_API_KEY;
            if (geminiKey && geminiKey !== 'your_gemini_key') {
                try {
                    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp-01-21', 'gemini-flash-latest'];
                    for (const gModel of geminiModels) {
                        const geminiRes = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:streamGenerateContent?alt=sse&key=${geminiKey}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [
                                        ...cleanHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
                                        { role: 'user', parts: [{ text: processedMessage }] }
                                    ],
                                    systemInstruction: { parts: [{ text: DEEP_REASONING_SYSTEM_PROMPT }] },
                                    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
                                }),
                                signal: AbortSignal.timeout(25000)
                            }
                        );
                        if (geminiRes.ok && geminiRes.body) {
                            const reader = geminiRes.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            const filter = new ReasoningStreamFilter(
                                (t) => sendEvent({ type: 'thought_chunk', thought: t }),
                                (c) => { sendEvent({ chunk: c }); streamedSuccessfully = true; }
                            );

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || '';
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('data: ')) {
                                        try {
                                            const parsed = JSON.parse(trimmed.slice(6));
                                            const parts = parsed.candidates?.[0]?.content?.parts || [];
                                            for (const part of parts) {
                                                if (part.thought || part.thoughtText) {
                                                    filter.pushReasoningDelta(part.thought || part.thoughtText);
                                                }
                                                if (part.text) {
                                                    filter.pushContentDelta(part.text);
                                                }
                                            }
                                        } catch (_) {}
                                    }
                                }
                            }
                            filter.flush();
                            if (filter.hasEmittedThought) sendEvent({ type: 'thought_done' });
                            if (streamedSuccessfully) {
                                usedModel = `gemini (${gModel})`;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Gemini streaming failed:', e.message);
                }
            }
        }

        // 4. Try OpenRouter Streaming (DeepSeek-R1 / Qwen Reasoning)
        if (!streamedSuccessfully && (model === 'openrouter' || model === 'auto' || !model)) {
            const openrouterKey = customKeys?.openrouter || process.env.OPENROUTER_API_KEY;
            if (openrouterKey) {
                try {
                    const orModels = ['openai/gpt-oss-20b:free', 'deepseek/deepseek-r1:free', 'cohere/north-mini-code:free', 'google/gemma-4-31b-it:free'];
                    for (const orModel of orModels) {
                        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${openrouterKey}`,
                                'HTTP-Referer': 'http://localhost:3000',
                                'X-Title': 'AI-Dost'
                            },
                            body: JSON.stringify({
                                model: orModel,
                                messages: [
                                    { role: 'system', content: DEEP_REASONING_SYSTEM_PROMPT },
                                    ...cleanHistory,
                                    { role: 'user', content: groqMsg }
                                ],
                                stream: true,
                                temperature: 0.2,
                                max_tokens: 4096
                            }),
                            signal: AbortSignal.timeout(20000)
                        });

                        if (orRes.ok && orRes.body) {
                            const reader = orRes.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            const filter = new ReasoningStreamFilter(
                                (t) => sendEvent({ type: 'thought_chunk', thought: t }),
                                (c) => { sendEvent({ chunk: c }); streamedSuccessfully = true; }
                            );

                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || '';
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('data: ')) {
                                        const dataStr = trimmed.slice(6);
                                        if (dataStr === '[DONE]') continue;
                                        try {
                                            const parsed = JSON.parse(dataStr);
                                            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content || parsed.choices?.[0]?.delta?.reasoning;
                                            if (reasoning) {
                                                filter.pushReasoningDelta(reasoning);
                                            }
                                            const delta = parsed.choices?.[0]?.delta?.content;
                                            if (delta) {
                                                filter.pushContentDelta(delta);
                                            }
                                        } catch (_) {}
                                    }
                                }
                            }
                            filter.flush();
                            if (filter.hasEmittedThought) sendEvent({ type: 'thought_done' });
                            if (streamedSuccessfully) {
                                usedModel = `openrouter (${orModel})`;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('OpenRouter streaming failed:', e.message);
                }
            }
        }

        // 5. Fallback to normal cascading chat if streaming had no output
        if (!streamedSuccessfully) {
            if (model === 'ollama' || (model && model.startsWith('local:'))) {
                const ollamaModelName = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
                sendEvent({ chunk: 'Ai-Dost: Local Ollama model (' + ollamaModelName + ') connect nahi ho pa raha.\nKripya check karein:\n1. Kya "ollama serve" terminal me chal raha hai?\n2. Kya apne model download kiya hai? ("ollama pull ' + ollamaModelName + '")' });
                usedModel = 'ollama-error';
            } else {
            logger.info('Streaming fallbacks exhausted, falling back to synchronous cascade...');
            const fallbackResult = await autoSelectModel(processedMessage, section, fileContent, cleanHistory, mode, customKeys);
            if (isValidResponse(fallbackResult.response)) {
                let cleanReply = fallbackResult.response;
                if (/<think>/i.test(cleanReply)) {
                    const tMatch = cleanReply.match(/<think>([\s\S]*?)<\/think>/i);
                    if (tMatch) {
                        sendEvent({ type: 'thought_chunk', thought: tMatch[1].trim() });
                        sendEvent({ type: 'thought_done' });
                        cleanReply = cleanReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                    }
                }
                sendEvent({ chunk: cleanReply });
                usedModel = fallbackResult.model;
            } else {
                if (/(?:three\.?js|webgl|solar system|gravity|orbit|planet|space simulation|game|runner|tron|hyperdrive|logo|brand|reveal|text|typography|kinetic|font|2030|cyberpunk|ultra hd)/i.test(message)) {
                    const simText = generateFuturistic2030Animation(message, langInfo.detectedResponseLanguage);
                    sendEvent({ chunk: simText });
                    usedModel = '2030-futuristic-engine';
                } else if (/(?:anime\.?js|3d animation|3d motion|3d|motion design|krishna)/i.test(message)) {
                    const animText = `### ✨ 3D Interactive Animation (Anime.js)\n\nAapka **3D Motion Animation** ready hai! Isme Anime.js 3D perspective transforms, rotating multi-layered rings, aur floating orb depth effect integrate kiya gaya hai:\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head>\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>\n  <style>\n    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #0d1b2a 0%, #000814 100%); overflow: hidden; perspective: 1000px; font-family: sans-serif; }\n    .scene { position: relative; width: 300px; height: 300px; transform-style: preserve-3d; display: flex; align-items: center; justify-content: center; }\n    .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(254, 215, 102, 0.7); box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); transform-style: preserve-3d; }\n    .ring-1 { width: 260px; height: 260px; border-color: #38bdf8; box-shadow: 0 0 30px #0284c7; }\n    .ring-2 { width: 200px; height: 200px; border-color: #facc15; box-shadow: 0 0 35px #eab308; }\n    .ring-3 { width: 140px; height: 140px; border-color: #a855f7; box-shadow: 0 0 40px #9333ea; }\n    .center-orb { width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle, #fef08a 20%, #eab308 60%, #ca8a04 100%); box-shadow: 0 0 50px #fbbf24; transform: translateZ(50px); }\n    .peacock-feather { position: absolute; top: -40px; font-size: 34px; filter: drop-shadow(0 0 10px #22c55e); transform: translateZ(70px); }\n    .title { position: absolute; bottom: 20px; color: #fde047; font-size: 15px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 12px rgba(250,204,21,0.8); }\n  </style>\n</head>\n<body>\n  <div class="scene">\n    <div class="ring ring-1"></div>\n    <div class="ring ring-2"></div>\n    <div class="ring ring-3"></div>\n    <div class="center-orb"></div>\n    <div class="peacock-feather">🪶</div>\n  </div>\n  <div class="title">Divine 3D Motion Aura</div>\n  <script>\n    anime({\n      targets: '.ring-1',\n      rotateX: [0, 360],\n      rotateY: [0, 180],\n      duration: 6000,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-2',\n      rotateY: [0, 360],\n      rotateZ: [0, 180],\n      duration: 4500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.ring-3',\n      rotateX: [360, 0],\n      rotateZ: [0, 360],\n      duration: 3500,\n      loop: true,\n      easing: 'linear'\n    });\n    anime({\n      targets: '.center-orb, .peacock-feather',\n      translateZ: [30, 80],\n      scale: [0.95, 1.1],\n      direction: 'alternate',\n      duration: 1800,\n      loop: true,\n      easing: 'easeInOutQuad'\n    });\n  </script>\n</body>\n</html>\n\`\`\`\n\n*Aap upar **Run/Preview** button par click karke live animation dekh sakte hain!*`;
                    sendEvent({ chunk: animText });
                    usedModel = 'anime-3d-engine';
                } else {
                    sendEvent({ chunk: 'Ai-Dost: Sabhi AI models temporarily busy hain. Please kuch der baad try karein ya Local Ollama use karein.' });
                    usedModel = 'fallback';
                }
            }
        }
        }

        sendEvent({ done: true, model: usedModel, sources: attachedSources });
        sendEvent('[DONE]');
        res.end();
    } catch (error) {
        logger.error('Stream chat error:', error);
        sendEvent({ error: error.message || 'Stream failed' });
        sendEvent('[DONE]');
        res.end();
    }
});

// ── In-Chat Code Execution Runner (Node.js / Python Sandbox) ────────────────
const { exec: runChildExec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

router.post('/execute', handleExecute);

module.exports = router;