const dotenv = require('dotenv');
const logger = require('../logger');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

class MistralService {
    static async chat(message, history = [], customKey = null, mode = 'project') {
        const apiKey = customKey || process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return "Mistral API key set nahi hai. Kripya Header Settings mein API key enter karein.";
        }

        try {
            const formattedHistory = (history || []).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

            const messages = [];
            if (mode !== 'agent') {
                messages.push({ role: "system", content: "You are Ai-Dost, a friendly and intelligent AI assistant." });
            }
            messages.push(...formattedHistory);
            messages.push({ role: "user", content: message });

            const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: messages,
                    temperature: 0.1
                }),
                signal: AbortSignal.timeout(10000) // 10 second fast timeout
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Mistral API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "Mistral se koi reply nahi mila.";
        } catch (error) {
            logger.error("Mistral Service Error:", error);
            return `Mistral Service Error: ${error.message}`;
        }
    }
}

module.exports = MistralService;
