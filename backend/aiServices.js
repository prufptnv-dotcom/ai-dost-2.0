class AIDost {
    
    // 1. Groq API Call
    async callGroq(message) {
        const response = await fetch('https://api.groq.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mixtral-8x7b-32768', // Fast and free model
                messages: [{ role: 'user', content: message }],
                temperature: 0.7
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    // 2. Google Gemini API Call
    async callGemini(message) {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: message }] }]
            })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // 3. OpenRouter API Call (Multiple free models support)
    async callOpenRouter(message) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3000', // OpenRouter ke liye zaroori
                'X-Title': 'AIDost', // Aapke project ka naam
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // OpenRouter par free models hote hain, jaise Llama 3 free
                model: 'meta-llama/llama-3-8b-instruct:free', 
                messages: [{ role: 'user', content: message }]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    // 4. Smart Routing (Kaun sa AI use karna hai?)
    async processMessage(message, aiChoice) {
        try {
            // Frontend se jo AI select hoga, uska function chalega
            if (aiChoice === 'gemini') {
                return await this.callGemini(message);
            } 
            else if (aiChoice === 'openrouter') {
                return await this.callOpenRouter(message);
            } 
            else {
                // Default me hum Groq use karenge kyunki wo fast hai
                return await this.callGroq(message);
            }
        } catch (error) {
            console.error("AI Calling Error: ", error);
            return "Sorry bhai, API call me koi dikkat aayi hai. .env file me API keys check kar lo!";
        }
    }
}

module.exports = new AIDost();