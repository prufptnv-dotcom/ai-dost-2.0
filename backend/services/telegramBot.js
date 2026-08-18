/**
 * AI-Dost Telegram Bot — phone se AI-Dost control karo (100% free).
 * Long polling (no webhook) → local dev + free hosting dono me chalta hai.
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
                `*/status* — servers + quota check\n\n` +
                `_Ya sirf text bhejo — seedha chat hoga._`);
        }
        if (t === '/status') return this.statusHandler(chatId);
        if (t.startsWith('/chat')) return this.chatHandler(chatId, t.slice(5).trim());
        if (t.startsWith('/crew')) return this.crewHandler(chatId, t.slice(5).trim());
        if (t.startsWith('/tts')) return this.ttsHandler(chatId, t.slice(4).trim());
        if (t.startsWith('/image')) return this.imageHandler(chatId, t.slice(6).trim());
        return this.chatHandler(chatId, t);
    }

    // ── Handlers ──
    async chatHandler(chatId, prompt) {
        if (!prompt) return this.sendMessage(chatId, 'Format: `/chat <sawaal>`');
        await this.typing(chatId);
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 120000);
            const res = await fetch(`${BACKEND}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: prompt, model: 'auto', mode: 'chat' }),
                signal: ctrl.signal,
            });
            clearTimeout(t);
            const data = await res.json();
            const reply = data?.reply || 'Koi jawab nahi mila — backend check karo.';
            const model = data?.model ? `\n\n_(${data.model})_` : '';
            await this.sendMessage(chatId, reply.slice(0, 3500) + model);
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