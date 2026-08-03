const dotenv = require('dotenv');
const logger = require('../logger');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

class TogetherService {
    static async chat(message, history = [], customKey = null) {
        const apiKey = customKey || process.env.TOGETHER_API_KEY;
        if (!apiKey) {
            return "Together AI API key set nahi hai.";
        }

        try {
            const formattedHistory = (history || []).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

            const response = await fetch("https://api.together.xyz/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                    messages: [
                        { role: "system", content: "You are Ai-Dost, a helpful AI assistant." },
                        ...formattedHistory,
                        { role: "user", content: message }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Together API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "Together AI se response nahi mila.";
        } catch (error) {
            logger.error("Together Service Error:", error);
            return `Together Service Error: ${error.message}`;
        }
    }
}

module.exports = TogetherService;
