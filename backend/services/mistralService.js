const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

class MistralService {
    static async chat(message, history = [], customKey = null) {
        const apiKey = customKey || process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return "Mistral API key set nahi hai. Kripya Header Settings mein API key enter karein.";
        }

        try {
            const formattedHistory = (history || []).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

            const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [
                        { role: "system", content: "You are Ai-Dost, a friendly and intelligent AI assistant." },
                        ...formattedHistory,
                        { role: "user", content: message }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Mistral API Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "Mistral se koi reply nahi mila.";
        } catch (error) {
            console.error("Mistral Service Error:", error);
            return `Mistral Service Error: ${error.message}`;
        }
    }
}

module.exports = MistralService;
