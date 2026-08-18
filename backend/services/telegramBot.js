/**
 * AI-Dost Telegram Bot — phone se AI-Dost control karo (100% free).
 * Long polling (no webhook) — local dev + free hosting dono me chalta hai.
 * Commands:
 *   /chat <msg>   — AI chat (full free cascade)
 *   /crew <task>  — CrewAI run (3 agents, files likhte hain)
 *   /tts <text>   — Edge TTS voice message
 *   /image <desc> — Pollinations image (free, no key)
 *   /status       — servers + quota status
 *   /help         — commands
 *   (plain text)  — chat ki tarah
 */
const logger = require('../logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_IDS = (process.env.TELEGRAM_ALLOWED_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
const BACKEND = `http://127.0.0.1:${process.env.PORT || 5000}`;

// Document keywords — same as ChatView: input me jo format keyword aaya → wahi file
// Specific format (pdf/csv/ppt) hamesha generic (report/document) pe jeeta
const DOC_KEYWORDS = [
    { type: 'pdf', re: /pdf/i },
    { type: 'pptx', re: /ppt[a-z]*|powerpoint|presentation|slides?/i },
    { type: 'csv', re: /csv|excel|spreadsheet|sheet/i },
    { type: 'docx', re: /\bdocx?\b|\bdoct\b|word ?file|word ?document|document|report/i },
];

function detectDocIntent(text) {
    const specificDoc = DOC_KEYWORDS
        .filter((k) => k.type !== 'docx')
        .map((k) => ({ type: k.type, pos: text.search(k.re) }))
        .filter((m) => m.pos >= 0)
        .sort((a, b) => a.pos - b.pos)[0];
    const docxKeyword = DOC_KEYWORDS.find((k) => k.type === 'docx');
    return specificDoc || (text.search(docxKeyword.re) >= 0 ? docxKeyword : null);
}

class TelegramBot {
    constructor(token) {
        this.token = token;
        this.api = `https://api.telegram.org/bot${token}`;
        this.offset = 0;
        this.running = false;
        this.busy = new Set();
    }

    async call(method, body = {}, timeoutMs = 35000) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(`${this.api}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
            const data = await res.json();
            if (!data.ok) logger.warn(`⚠️ Telegram ${method}: ${data.description || 'unknown error'}`);
            return data;
        } catch (e) {
            if (e.name !== 'AbortError') logger.warn(`⚠️ Telegram ${method} error: ${e.message}`);
            return { ok: false };
        } finally {
            clearTimeout(t);
        }
    }

    sendMessage(chatId, text, parseMode = 'Markdown') {
        return this.call('sendMessage', { chat_id: chatId, text, parse_mode: parseMode });
    }

    sendVoice(chatId, mp3Buffer, caption) {
        return new Promise((resolve) => {
            (async () => {
                try {
                    const fd = new FormData();
                    fd.append('chat_id', String(chatId));
                    fd.append('voice', new Blob([mp3Buffer], { type: 'audio/mpeg' }), 'ai-dost.mp3');
                    if (caption) fd.append('caption', String(caption).slice(0, 1024));
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), 45000);
                    const res = await fetch(`${this.api}/sendVoice`, { method: 'POST', body: fd, signal: ctrl.signal });
                    clearTimeout(t);
                    const data = await res.json();
                    if (!data.ok) logger.warn(`⚠️ Telegram sendVoice: ${data.description}`);
                    resolve(data);
                } catch (e) {
                    logger.warn(`⚠️ Telegram sendVoice error: ${e.message}`);
                    resolve({ ok: false });
                }
            })();
        });
    }

    sendPhoto(chatId, url, caption) {
        return this.call('sendPhoto', { chat_id: chatId, photo: url, caption: String(caption || '').slice(0, 1024) }, 60000);
    }

    /** Pollinations se image download karo — render ready hone tak retry (max ~2 min). */
    async fetchImageWithRetry(url, maxAttempts = 8) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 25000);
                const res = await fetch(url, { signal: ctrl.signal });
                clearTimeout(t);
                const type = res.headers.get('content-type') || '';
                const len = res.headers.get('content-length') || '?';
                logger.info(`🖼️ Pollinations attempt ${attempt + 1}: HTTP ${res.status}, type=${type}, len=${len}`);
                if (res.ok && type.startsWith('image/')) {
                    const buf = Buffer.from(await res.arrayBuffer());
                    logger.info(`🖼️ Image downloaded: ${buf.length} bytes`);
                    return buf;
                }
            } catch (e) {
                logger.warn(`🖼️ Pollinations attempt ${attempt + 1} error: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 10000));
        }
        return null;
    }

    async sendPhotoBuffer(chatId, buffer, caption) {
        try {
            const fd = new FormData();
            fd.append('chat_id', String(chatId));
            fd.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'ai-dost.jpg');
            if (caption) fd.append('caption', String(caption).slice(0, 1024));
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 60000);
            const res = await fetch(`${this.api}/sendPhoto`, { method: 'POST', body: fd, signal: ctrl.signal });
            clearTimeout(t);
            const data = await res.json();
            if (!data.ok) logger.warn(`⚠️ TG sendPhotoBuffer: ${data.description}`);
            return data;
        } catch (e) {
            logger.warn(`⚠️ Telegram sendPhoto buffer error: ${e.message}`);
            return { ok: false };
        }
    }

    async sendDocument(chatId, buffer, filename, caption) {
        try {
            const fd = new FormData();
            fd.append('chat_id', String(chatId));
            fd.append('document', new Blob([buffer]), filename);
            if (caption) fd.append('caption', String(caption).slice(0, 1024));
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 60000);
            const res = await fetch(`${this.api}/sendDocument`, { method: 'POST', body: fd, signal: ctrl.signal });
            clearTimeout(t);
            const data = await res.json();
            if (!data.ok) logger.warn(`⚠️ TG sendDocument: ${data.description}`);
            return data;
        } catch (e) {
            logger.warn(`⚠️ Telegram sendDocument error: ${e.message}`);
            return { ok: false };
        }
    }

    typing(chatId) {
        return this.call('sendChatAction', { chat_id: chatId, action: 'typing' }, 10000).catch(() => {});
    }

    isAllowed(chatId) {
        if (!ALLOWED_IDS.length) return true;
        return ALLOWED_IDS.includes(String(chatId));
    }

    // ── Update loop (long polling) ──
    start() {
        if (this.running) return;
        this.running = true;
        logger.info('🤖 Telegram bot starting (long polling)...');
        this.poll();
    }

    async poll() {
        const res = await this.call('getUpdates', { offset: this.offset, timeout: 25, allowed_updates: ['message'] }, 40000);
        if (res && res.ok && Array.isArray(res.result)) {
            for (const u of res.result) {
                this.offset = u.update_id + 1;
                this.handleUpdate(u).catch(e => logger.warn(`⚠️ Telegram update error: ${e.message}`));
            }
        }
        setTimeout(() => this.poll(), 300);
    }

    async handleUpdate(update) {
        const msg = update.message;
        if (!msg || typeof msg.text !== 'string') return;
        const chatId = msg.chat.id;
        logger.info(`🤖 TG update from ${chatId}: "${msg.text.slice(0, 60)}"`);

        if (!this.isAllowed(chatId)) {
            return this.sendMessage(chatId, 'Sorry — ye bot private hai, sirf allowed users ke liye.');
        }
        if (this.busy.has(chatId)) {
            return this.sendMessage(chatId, 'Ek kaam pehle se chal raha hai — thoda ruko aur dobara bhejo 🙂');
        }
        this.busy.add(chatId);
        try {
            await this.route(chatId, msg.text);
        } finally {
            this.busy.delete(chatId);
        }
    }

    // ── Command routing ──
    async route(chatId, text) {
        const t = text.trim();

        if (t === '/start' || t === '/help') {
            return this.sendMessage(chatId,
                `🤖 *AI-Dost Bot* — tumhara personal AI Developer!\n\n` +
                `*/chat <msg>* — AI se baat karo (free cascade)\n` +
                `*/crew <task>* — 3-agent crew files likhega\n` +
                `*/tts <text>* — voice message (Edge TTS)\n` +
                `*/image <desc>* — image banao (Flux, free)\n` +
                `*/doc <type> <topic>* — document banao (pdf|docx|pptx|csv|xlsx)\n` +
                `*/research <query>* — web search with sources (Tavily)\n` +
                `*/correct <correction>* — bot ko correction sikhao\n` +
                `*/status* — servers + quota check\n\n` +
                `_Ya sirf text bhejo — seedha chat hoga. Keywords: pdf, excel, ppt, doc bhi kaam karte hain._`);
        }
        if (t === '/status') return this.statusHandler(chatId);
        if (t.startsWith('/doc')) return this.docExplicitHandler(chatId, t.slice(4).trim());
        if (t.startsWith('/chat')) return this.chatHandler(chatId, t.slice(5).trim());
        if (t.startsWith('/crew')) return this.crewHandler(chatId, t.slice(5).trim());
        if (t.startsWith('/tts')) return this.ttsHandler(chatId, t.slice(4).trim());
        if (t.startsWith('/image')) return this.imageHandler(chatId, t.slice(6).trim());
        if (t.startsWith('/research')) return this.researchHandler(chatId, t.slice(9).trim());
        if (t.startsWith('/correct')) return this.correctHandler(chatId, t.slice(8).trim());
        // Document intent (pdf/docx/pptx/csv) — jo format keyword aaya → wahi file
        const docIntent = detectDocIntent(t);
        if (docIntent) return this.docHandler(chatId, t, docIntent.type);
        return this.chatHandler(chatId, t);
    }

    // ── Handlers ──
    async chatHandler(chatId, prompt) {
        if (!prompt) return this.sendMessage(chatId, 'Format: `/chat <sawaal>`');
        await this.typing(chatId);
        try {
            // Retrieve relevant learnings for this user
            const PythonEngine = require('./pythonEngineService');
            const mem = await PythonEngine.retrieveLearning(String(chatId), prompt, 3);
            let memoryContext = '';
            if (mem.ok && mem.data?.learnings?.length) {
                memoryContext = `\n\n[Relevant past context for this user:\n${mem.data.learnings.join('\n')}\n]`;
            }
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 120000);
            const res = await fetch(`${BACKEND}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt + memoryContext, model: 'auto', mode: 'chat' }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            const data = await res.json();
            const reply = data?.reply || 'Koi jawab nahi mila — backend check karo.';
            const model = data?.model ? `\n\n_(${data.model})_` : '';
            await this.sendMessage(chatId, reply.slice(0, 3500) + model);
            // Auto-learn: save user's question as context
            await PythonEngine.saveLearning(String(chatId), `User asked: ${prompt}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ Chat error: ${e.message}`);
        }
    }

    async crewHandler(chatId, prompt) {
        if (!prompt) return this.sendMessage(chatId, 'Format: `/crew <kaam batao>`\nExample: `/crew ek calculator app banao index.html me`');
        await this.typing(chatId);
        await this.sendMessage(chatId, '🛠️ *Crew chalu!* Researcher → Coder → Reviewer. Files save hongi, 1-3 min lagenge...');
        try {
            const PythonEngine = require('./pythonEngineService');
            const result = await PythonEngine.runCrew(prompt, { mode: 'dev', model: 'nvidia' });
            if (!result.ok) return this.sendMessage(chatId, `⚠️ Crew fail: ${result.error}`);
            const d = result.data;
            const files = (d.files || []).map(f => `• \`${f}\``).join('\n') || '• (koi file nahi)';
            const agents = (d.agents || []).join(' → ');
            await this.sendMessage(chatId,
                `✅ *Crew complete!*\n\n` +
                `*Agents:* ${agents}\n` +
                `*Files saved (${(d.files || []).length}):*\n${files}\n\n` +
                `*Summary:*\n${(d.result || '').slice(0, 1200)}\n\n` +
                `📁 ${d.directory || ''}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ Crew error: ${e.message}`);
        }
    }

    async ttsHandler(chatId, text) {
        if (!text) return this.sendMessage(chatId, 'Format: `/tts <text>`');
        await this.typing(chatId);
        try {
            const PythonEngine = require('./pythonEngineService');
            const voice = /[अ-हा-ॐ]/.test(text) ? 'hi-IN-SwaraNeural' : 'en-IN-PrabhatNeural';
            const result = await PythonEngine.tts(text, voice);
            if (!result.ok) return this.sendMessage(chatId, `⚠️ TTS fail: ${result.error}`);
            await this.sendVoice(chatId, result.data, `🎙️ ${text.slice(0, 100)}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ TTS error: ${e.message}`);
        }
    }

    async imageHandler(chatId, desc) {
        if (!desc) return this.sendMessage(chatId, 'Format: `/image <description>`');
        await this.typing(chatId);
        await this.sendMessage(chatId, '🎨 Image ban rahi hai... (30-90s, wait karo)');
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 180000);
            const res = await fetch(`${BACKEND}/api/image/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: desc }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            const data = await res.json();
            const imageUrl = data?.imageUrl;
            if (!imageUrl) return this.sendMessage(chatId, '⚠️ Image ban nahi paya — dobara try karo.');
            const buf = await this.fetchImageWithRetry(imageUrl, 3);
            if (buf) {
                const r = await this.sendPhotoBuffer(chatId, buf, `🎨 ${desc.slice(0, 200)}`);
                if (r.ok) return;
            }
            await this.sendMessage(chatId, `Image ready hai par yahan bhej nahi paya — ye kholo:\n${imageUrl}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ Image error: ${e.message}`);
        }
    }

    async researchHandler(chatId, query) {
        if (!query) return this.sendMessage(chatId, 'Format: `/research <sawaal>`\nExample: `/research latest AI news 2024`');
        await this.typing(chatId);
        await this.sendMessage(chatId, '🔍 *Web search chalu...* (Tavily se sources ke saath)');
        try {
            const PythonEngine = require('./pythonEngineService');
            const result = await PythonEngine.webSearch(query, { max_results: 5, search_depth: 'basic' });
            if (!result.ok) return this.sendMessage(chatId, `⚠️ Research fail: ${result.error}`);
            const data = result.data;
            const answer = data.answer || 'Koi direct answer nahi mila.';
            const results = data.results || [];
            let msg = `🔍 *Research: ${query}*\n\n`;
            msg += `💡 *Answer:* ${answer.slice(0, 1500)}\n\n`;
            if (results.length > 0) {
                msg += `📚 *Sources:*\n`;
                results.slice(0, 3).forEach((r, i) => {
                    msg += `${i + 1}. [${r.title.slice(0, 80)}](${r.url})\n   ${r.content.slice(0, 120)}...\n\n`;
                });
            }
            msg += `\n_Response time: ${data.response_time?.toFixed(2) || 0}s_`;
            await this.sendMessage(chatId, msg.slice(0, 4000));
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ Research error: ${e.message}`);
        }
    }

    async correctHandler(chatId, correction) {
        if (!correction) return this.sendMessage(chatId, 'Format: `/correct <galat tha, sahi ye hai>`\nExample: `/correct Bihar ki rajdhani Patna hai, Ranchi nahi`');
        await this.typing(chatId);
        try {
            const PythonEngine = require('./pythonEngineService');
            const result = await PythonEngine.saveLearning(String(chatId), `Correction: ${correction}`);
            if (!result.ok) return this.sendMessage(chatId, `⚠️ Correction save fail: ${result.error}`);
            await this.sendMessage(chatId, `✅ *Correction saved!* Main ye yaad rakhunga: ${correction}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ Correction error: ${e.message}`);
        }
    }

    // Explicit /doc command: /doc <type> <topic> — type: pdf|docx|pptx|csv|xlsx
    async docExplicitHandler(chatId, text) {
        if (!text) return this.sendMessage(chatId, 'Format: `/doc <pdf|docx|pptx|csv|xlsx> <topic>`\nExample: `/doc pdf bihar report`');
        const parts = text.trim().split(/\s+/);
        const type = parts[0].toLowerCase();
        const topic = parts.slice(1).join(' ');
        if (!topic) return this.sendMessage(chatId, 'Topic khali hai. Example: `/doc pdf bihar report`');
        const validTypes = ['pdf', 'docx', 'pptx', 'csv', 'xlsx'];
        if (!validTypes.includes(type)) return this.sendMessage(chatId, `Invalid type. Valid: ${validTypes.join(', ')}`);
        await this.docHandler(chatId, topic, type);
    }

    async docHandler(chatId, text, type) {
        const typeLabel = { docx: 'Word', pptx: 'PowerPoint', csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[type] || type.toUpperCase();
        await this.typing(chatId);
        await this.sendMessage(chatId, `📄 *${typeLabel} ban rahi hai...* (thoda wait karo)`);
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 180000);
            const res = await fetch(`${BACKEND}/api/v1/document/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, topic: text, title: text.slice(0, 50) }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            const data = await res.json();
            if (!data.success || !data.downloadUrl) {
                return this.sendMessage(chatId, `⚠️ ${typeLabel} ban nahi paya — dobara try karo.`);
            }
            const downloadUrl = `http://127.0.0.1:${process.env.PORT || 5000}${data.downloadUrl}`;
            // Download the file from backend
            const fileRes = await fetch(downloadUrl);
            if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
            const buf = Buffer.from(await fileRes.arrayBuffer());
            const filename = data.downloadUrl.split('/').pop();
            // Send as document (works for PDF, DOCX, etc.)
            const r = await this.sendDocument(chatId, buf, filename, `📄 ${typeLabel} ready: ${text.slice(0, 100)}`);
            if (r.ok) return;
            // Fallback: send link
            await this.sendMessage(chatId, `${typeLabel} ready hai par file bhej nahi paya — ye kholo:\n${downloadUrl}`);
        } catch (e) {
            await this.sendMessage(chatId, `⚠️ ${typeLabel} error: ${e.message}`);
        }
    }

    async statusHandler(chatId) {
        const PythonEngine = require('./pythonEngineService');
        const h = await PythonEngine.health();
        const engine = h ? `✅ ${h.service} (ollama: ${h.ollama_running ? 'on' : 'off'})` : '❌ AI Engine down';
        try {
            const q = await fetch(`${BACKEND}/api/agent/quota-status`, { signal: AbortSignal.timeout(8000) });
            const qd = await q.json();
            const states = Object.entries(qd.circuitBreakers || {})
                .map(([k, v]) => `${k}: ${v.state}`).join('\n');
            await this.sendMessage(chatId, `📊 *AI-Dost Status*\n\n_Engine:_ ${engine}\n\n_Circuit breakers:_\n${states}`);
        } catch (e) {
            await this.sendMessage(chatId, `📊 *AI-Dost Status*\n\n_Engine:_ ${engine}\n\nQuota fetch fail: ${e.message}`);
        }
    }
}

/** Start bot — only if TELEGRAM_BOT_TOKEN set. */
function startTelegramBot() {
    if (!TOKEN) {
        logger.info('🤖 Telegram bot disabled — TELEGRAM_BOT_TOKEN set nahi hai (.env me daalo)');
        return null;
    }
    const bot = new TelegramBot(TOKEN);
    bot.start();
    return bot;
}

module.exports = { startTelegramBot, TelegramBot };