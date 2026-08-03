class GroqService {
    static async chat(message, history = [], mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.GROQ_API_KEY;
            
            if (!API_KEY || API_KEY === 'gsk_your_key_here') {
                console.error('❌ GROQ API Key not found or still default!');
                return 'Groq API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }
            console.log('🔄 Calling Groq API...');
            
            let systemPrompt = '';
            if (mode === 'chat') {
                systemPrompt = `You are AI-Dost, an ultra-intelligent Senior Software Engineer and Multimodal AI Assistant.
Key Response Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Authority: Be confident, professional, concise, and helpful. Never generate generic disclaimers.
3. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: If user asks for an image, drawing, photo, or picture (e.g. "image banao", "photo of sunset"), MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user asks for a report, PDF, resume, or document, format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - EMAIL WRITING: Format email requests with a clear "Subject:" and structured email body.
   - CODE & EXPLANATION: Write production-grade code in markdown codeblocks with clear step-by-step explanations.`;
            } else {
                systemPrompt = `You are AI-Dost, a state-of-the-art Senior Software Engineer and Autonomous Coding Companion in Project Workspace Mode.
Key Response Guidelines:
1. Write clean, optimal, production-grade code snippets wrapped inside markdown code blocks.
2. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: Include \`[GENERATE_IMAGE: detailed English description]\` when images are requested.
   - PDF / DOCUMENT: Format printable documents as \`[GENERATE_PDF: Title] Content [/GENERATE_PDF]\`.
3. Language & Grammar: Respond in clean, natural, grammatically flawless language matching user preference.`;
            }

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: mode === 'project' ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile',
                    messages: [
                        { 
                            role: 'system', 
                            content: systemPrompt 
                        },
                        ...history,
                        { role: 'user', content: message }
                    ],
                    temperature: 0.2,
                    max_tokens: 2500
                })
            });

            if (!response.ok) {
                // Automatic 429 Rate Limit fallback to high-capacity llama-3.1-8b-instant model (131k TPM limit)
                if (response.status === 429) {
                    console.log('⚠️ Groq 70b rate limited, retrying with fast llama-3.1-8b-instant model...');
                    const retryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'llama-3.1-8b-instant',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                ...history,
                                { role: 'user', content: message }
                            ],
                            temperature: 0.2,
                            max_tokens: 2500
                        })
                    });
                    if (retryRes.ok) {
                        const retryData = await retryRes.json();
                        console.log('✅ Groq 8b fallback response received');
                        return retryData.choices[0].message.content;
                    }
                }
                const errorText = await response.text();
                console.error('❌ Groq API Error:', response.status, errorText);
                return `Groq API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            console.log('✅ Groq response received');
            
            return data.choices[0].message.content;
            
        } catch (error) {
            console.error('❌ Groq Service Error:', error.message);
            return 'Groq service me error: ' + error.message;
        }
    }
}
module.exports = GroqService;