const logger = require('../logger');
const { ollamaBaseUrl } = require('./ollamaEnv');
const { DEEP_REASONING_SYSTEM_PROMPT: SHARED_DEEP_REASONING_SYSTEM_PROMPT } = require('./outputQualityStandard');
const { isValidResponse } = require('../utils/chatUtils');
const { generateFuturistic2030Animation } = require('./threeJsSimulator');
const { ReasoningStreamFilter } = require('../utils/streamUtils');

async function runStreamCascade({
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
    DEEP_REASONING_SYSTEM_PROMPT = SHARED_DEEP_REASONING_SYSTEM_PROMPT
}) {
        let streamedSuccessfully = false;
        let usedModel = 'auto';

        // 1. If Local Ollama requested
        if (model === 'ollama' || (model && model.startsWith('local:'))) {
            const localModelName = model.startsWith('local:') ? model.substring(6) : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b');
            try {
                const ollamaRes = await fetch(`${ollamaBaseUrl()}/api/chat`, {
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
            const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp-01-21', 'gemini-flash-latest'];
            for (const gModel of geminiModels) {
                try {
                    const geminiRes = await fetch(
                        // #54: key via header, never in the URL (logs)
                        `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:streamGenerateContent?alt=sse`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
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
                    } catch (e) {
                        logger.warn(`Gemini streaming (${gModel}) failed:`, e.message);
                    }
                }
            }
        }

        // 4. Try OpenRouter Streaming (with verified 2026 Free Models & Thinking/Reasoning support)
        const isOrRequested = model === 'openrouter' || (model && (model.startsWith('openrouter:') || OpenRouterService.isSupportedModel?.(model)));
        if (!streamedSuccessfully && (isOrRequested || model === 'auto' || !model)) {
            const openrouterKey = customKeys?.openrouter || process.env.OPENROUTER_API_KEY;
            if (openrouterKey) {
                let requestedOrModel = null;
                if (model && model.startsWith('openrouter:')) requestedOrModel = OpenRouterService.resolveModel?.(model.slice(11));
                else if (model && OpenRouterService.isSupportedModel?.(model)) requestedOrModel = OpenRouterService.resolveModel?.(model);

                const baseOrModels = [
                    'openrouter/free',
                    'nvidia/nemotron-3-super-120b-a12b:free',
                    'cohere/north-mini-code:free',
                    'liquid/lfm-2.5-2.6b:free',
                    'nvidia/nemotron-3.5-lightning:free',
                    'poolside/laguna-s-2.1:free',
                    'inclusionai/ling-3.0-flash-sante:free',
                    'apodex/apodex-1.1-mini:free',
                    'google/gemma-4-31b-it:free',
                    'google/gemma-4-26b-a4b-it:free'
                ];
                const orModels = requestedOrModel ? [requestedOrModel, ...baseOrModels.filter(m => m !== requestedOrModel)] : baseOrModels;
                for (const orModel of orModels) {
                    try {
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
                    } catch (e) {
                        logger.warn(`OpenRouter streaming (${orModel}) failed:`, e.message);
                    }
                }
            }
        }

        // 5. Fallback to normal cascading chat if streaming had no output
        if (!streamedSuccessfully) {
            if (model === 'ollama' || (model && model.startsWith('local:'))) {
                const ollamaModelName = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
                sendEvent({ chunk: 'Ai-Dost: Local Ollama model (' + ollamaModelName + ') connect nahi ho pa raha.\nKripya check karein:\n1. Kya "ollama serve" terminal me chal raha hai?\n2. Kya apne model download kiya hai? ("ollama pull ' + ollamaModelName + '")' });
                return 'ollama-error';
            }
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

    return usedModel;
}

module.exports = { runStreamCascade };
