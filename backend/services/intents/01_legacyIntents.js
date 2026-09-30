
const { THREEJS_WEBGL_SYSTEM_DIRECTIVE } = require('../threeJsSimulator');
const { IMAGE_STUDIO_DIRECTIVE, detectImageCategory, buildEnhancedImageRequest } = require('../imageStudioEngine');
const { TEACHING_PEDAGOGY_DIRECTIVE, detectTeachingProfile } = require('../personalTeacherEngine');
const { DOCUMENT_STUDIO_DIRECTIVE, detectDocumentRequest } = require('../documentStudioEngine');
const { detectDataAnalyticsIntent, DATA_ANALYTICS_STUDIO_DIRECTIVE } = require('../dataAnalyticsEngine');
const { AIML_PROJECTS_DIRECTIVE, detectAiMlProjectIntent } = require('../aiMlStudioEngine');
const { GIT_PROJECT_MANAGEMENT_DIRECTIVE, detectGitPmIntent } = require('../gitProjectManagementEngine');
const { WRITING_COMMUNICATION_DIRECTIVE, detectWritingIntent } = require('../writingCommunicationEngine');
const { PLANNING_PRODUCTIVITY_DIRECTIVE, detectPlanningIntent } = require('../planningProductivityEngine');
const { AUTOMATION_REMINDERS_DIRECTIVE, detectAutomationIntent } = require('../automationRemindersEngine');
const { LOCAL_BUSINESS_TRAVEL_DIRECTIVE, detectTravelIntent } = require('../localBusinessTravelEngine');
const { LANGUAGE_TRANSLATION_DIRECTIVE, detectLanguageIntent } = require('../languageTranslationEngine');
const { DECISION_SUPPORT_DIRECTIVE, detectDecisionIntent } = require('../decisionSupportEngine');
const { CYBERSECURITY_DEFENSIVE_DIRECTIVE, detectSecurityIntent } = require('../cybersecurityEngine');
const { detectMasterCapability } = require('../masterCapabilityCatalog');

module.exports = {
    name: 'Legacy Intents Processor',
    priority: 10, // Run early
    evaluate: async (message, langInfo, bharatService) => {
        let appendedMessage = '';
        // 1. India Post Pincode Intent
        const pincodeMatch = message.match(/(?:pincode|pin code|pin)\s*:?\s*(\d{6})/i) || message.match(/\b(\d{6})\b/);
        if (pincodeMatch && /(pincode|post|dak|post office|circle|delivery)/i.test(message)) {
            const pin = pincodeMatch[1];
            const pinRes = await bharatService.lookupPincode(pin);
            if (pinRes && pinRes.status === 'success' && pinRes.postOffices) {
                const poSummary = pinRes.postOffices.slice(0, 6).map(po => `• ${po.Name} (${po.BranchType}, ${po.DeliveryStatus}) - District: ${po.District}, State: ${po.State}`).join('\n');
                appendedMessage += `\n\n[BHARAT_OPEN_API: INDIA POST PINCODE ${pin}]\nTotal Offices: ${pinRes.totalPostOffices}\nOffices:\n${poSummary}\n\nInstructions: Inform user with these verified India Post details clearly in ${langInfo.languageName}.`;
            }
        }

        // 2. Razorpay IFSC Banking Intent
        const ifscMatch = message.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
        if (ifscMatch) {
            const ifscCode = ifscMatch[1].toUpperCase();
            const ifscRes = await bharatService.lookupIFSC(ifscCode);
            if (ifscRes && ifscRes.status === 'success') {
                appendedMessage += `\n\n[BHARAT_OPEN_API: RAZORPAY BANK IFSC ${ifscCode}]\nBank: ${ifscRes.bank}\nBranch: ${ifscRes.branch}\nAddress: ${ifscRes.address}\nCity: ${ifscRes.city}, District: ${ifscRes.district}, State: ${ifscRes.state}\nMICR: ${ifscRes.micr || 'N/A'}\nPayment Rails: UPI=${ifscRes.upi}, IMPS=${ifscRes.imps}, NEFT=${ifscRes.neft}, RTGS=${ifscRes.rtgs}\n\nInstructions: Provide these verified banking details cleanly to the user in ${langInfo.languageName}.`;
            }
        }

        // 3. Mandi Bhav / Krishi Commodity Intent
        if (/(?:mandi|mandi bhav|gehun|sarson|pyaz|tamatar|chawal|kapaas|agmarknet|commodity rate|crop price)/i.test(message)) {
            const mandiRes = await bharatService.getMandiBhav('', '');
            if (mandiRes && mandiRes.commodities) {
                const mandiSummary = mandiRes.commodities.slice(0, 7).map(c => `• ${c.name}: ${c.modalPrice} (${c.market}, ${c.state})`).join('\n');
                appendedMessage += `\n\n[BHARAT_OPEN_API: AGMARKNET MANDI BHAV]\nLive Commodity Rates:\n${mandiSummary}\n\nInstructions: Present these current Indian Mandi rates to the user with variety and market name in ${langInfo.languageName}.`;
            }
        }

        // 4. ISRO Missions & Bhuvan Geo-Portal Intent
        if (/(?:isro|chandrayaan|aditya\s*-?l1|gaganyaan|bhuvan|navic)/i.test(message)) {
            const isroRes = bharatService.getIsroData();
            const missionsSummary = isroRes.notableMissions.map(m => `• ${m.name}: ${m.objective} [Status: ${m.status}]`).join('\n');
            appendedMessage += `\n\n[BHARAT_OPEN_API: ISRO SPACE & BHUVAN]\nAgency: ${isroRes.agency}\nBhuvan 2D/3D Portal: ${isroRes.bhuvanGeoPortal}\nMissions:\n${missionsSummary}\n\nInstructions: Explain India's indigenous ISRO achievements and Bhuvan Geo-Portal access in ${langInfo.languageName}.`;
        }

        // 5. Indian Holidays Intent
        if (/(?:holiday|holidays|chhutti|chhutiyan|festival|diwali|holi|eid|republic day|independence day|2026)/i.test(message) && !message.toLowerCase().includes('vacation booking')) {
            const holRes = bharatService.getIndianHolidays(2026);
            const holSummary = holRes.holidays.map(h => `• ${h.date} (${h.day}): ${h.name} - ${h.type}`).join('\n');
            appendedMessage += `\n\n[BHARAT_OPEN_API: INDIAN NATIONAL GAZETTED HOLIDAYS 2026]\nOfficial Holidays:\n${holSummary}\n\nInstructions: Provide the official Indian holiday list in ${langInfo.languageName}.`;
        }

        // 6. Category 3: Image Generation & Editing Intent (All 17 Types)
        const isImageIntent = /(?:image banao|fast image|turbo image|photo banao|generate image|picture of|logo banao|banner banao|poster banao|thumbnail banao|character design|portrait banao|infographic|concept art|mockup|book cover|social media post|background remove|remove background|object add|style transform|enhance image)/i.test(message) && !/(?:animation|3d scene|three\.?js|webgl|playable game|simulation|kinetic|typography reveal|runner)/i.test(message);
        if (isImageIntent) {
            const detectedCat = detectImageCategory(message);
            const reqSpec = buildEnhancedImageRequest(message, detectedCat);
            appendedMessage += `\n\n[INSTRUCTION: The user is requesting Image Generation / Editing (Category: ${detectedCat}).
You MUST include the tag '[GENERATE_IMAGE: ${reqSpec.prompt.replace(/[\[\]]/g, '')}]' in your response.
Provide a brief, confident, helpful 1-2 sentence description in ${langInfo.languageName}.]`;
        }

        // 7. Anime.js CSS 3D Transforms (when explicitly requested)
        if (/(?:anime\.?js|css 3d transform|perspective card|flip card|kinetic text)/i.test(message)) {
            appendedMessage += `\n\n[INSTRUCTION: The user is requesting 3D animation design with Anime.js / CSS 3D. Provide a complete, interactive, self-contained HTML+CSS+JS component utilizing 'animejs' with 3D perspective transforms, rotateX, rotateY, translateZ, and spring physics. Explain how the 3D depth works.]`;
        }

        // 8. Universal Three.js & WebGL 3D Animation & Simulation Studio Intent
        if (/(?:three\.?js|webgl|3d animation|3d simulation|3d model|3d scene|3d interactive|3d visualizer|3d physics|\b3d\b)/i.test(message)) {
            appendedMessage += `\n\n${THREEJS_WEBGL_SYSTEM_DIRECTIVE}\n\n[MANDATORY 3D ACCURACY INSTRUCTION: The user is requesting an interactive 3D scene / animation.
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
            appendedMessage += `\n\n${TEACHING_PEDAGOGY_DIRECTIVE}\n\n[INSTRUCTION: The user is in Study & Teaching Mode (Subject: ${teachProfile.subject}, Requested Pedagogical Tools: ${teachProfile.styles.join(', ')}).
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
            appendedMessage += `\n\n${DOCUMENT_STUDIO_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting a Category 6 Document / Report: "${docReq.typeName}" on topic: "${docReq.topic}".
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
            appendedMessage += `\n\n${DATA_ANALYTICS_STUDIO_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 8 Data Analysis & Visualization (Sub-domain: ${dataIntent.domain}).
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
            appendedMessage += `\n\n${AIML_PROJECTS_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 9 AI/ML Systems Design & Implementation (Domain: ${aimlIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
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
            appendedMessage += `\n\n${GIT_PROJECT_MANAGEMENT_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 10 GitHub & Project Management (Domain: ${gitPmIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
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
            appendedMessage += `\n\n${WRITING_COMMUNICATION_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 11 Writing & Communication (Format: ${writingIntent.format}${fConfig ? ` - ${fConfig.name}` : ''}, Tone: ${writingIntent.tone}${tConfig ? ` - ${tConfig.name}` : ''}).
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
            appendedMessage += `\n\n${PLANNING_PRODUCTIVITY_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 12 Planning & Productivity (Domain: ${planningIntent.domain}${pConfig ? ` - ${pConfig.name}` : ''}).
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
            appendedMessage += `\n\n${AUTOMATION_REMINDERS_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 13 Automation & Reminders (Domain: ${automationIntent.domain}${aConfig ? ` - ${aConfig.name}` : ''}).
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
            appendedMessage += `\n\n${LOCAL_BUSINESS_TRAVEL_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 14 Local Business & Travel Assistance (Domain: ${travelIntent.domain}${tConfig ? ` - ${tConfig.name}` : ''}).
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
            appendedMessage += `\n\n${LANGUAGE_TRANSLATION_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 15 Language & Translation (Mode: ${langIntent.mode}${mConfig ? ` - ${mConfig.name}` : ''}, Target: ${langIntent.targetLanguage || 'appropriate language'}).
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
            appendedMessage += `\n\n${DECISION_SUPPORT_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 16 Problem Solving & Decision Support (Domain: ${decisionIntent.domain}${dConfig ? ` - ${dConfig.name}` : ''}).
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
            appendedMessage += `\n\n${CYBERSECURITY_DEFENSIVE_DIRECTIVE}\n\n[INSTRUCTION: The user is requesting Category 17 Security & Cybersecurity (Domain: ${secIntent.domain}${sConfig ? ` - ${sConfig.name}` : ''}).
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
            appendedMessage += `\n\n${masterCap.directive}\n\n[INSTRUCTION: The user query matches Master Capability #${masterCap.capability.id}: "${masterCap.matchedDomain}" (${masterCap.capability.cluster}).
Follow the high-level professional standards and methodology defined for this domain.
Structure the answer clearly, use appropriate diagrams, code, tables, or step-by-step reasoning where applicable, and respond in ${langInfo.languageName}.]`;
        }
        
        // 22. Conversational & Feedback Guardrail (Prevents LLM from blindly repeating code from history)
        if (/^(?:ok|okay|good|great|awesome|sahi hai|thanks|thank you|shukriya|dhanyawad|nahi|no|stop|wait|ruko|kaha tha|sun lo|mat likho|sabasi|mast|badhiya)/i.test(message.trim()) || /code likhne.*nahi/i.test(message) || (message.length < 50 && !isImageIntent && !masterCap.isMatch)) {
            appendedMessage += `\n\n[CONVERSATIONAL GUARDRAIL: The user is providing conversational feedback or a short reply ("${message}"). Do NOT generate or repeat large code blocks, simulations, or reports unless the user explicitly asks for a modification. Acknowledge their message naturally, concisely, and politely in ${langInfo.languageName} without unnecessary filler.]`;
        }
    
        return appendedMessage;
    }
};
