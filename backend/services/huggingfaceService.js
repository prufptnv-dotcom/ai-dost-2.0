class HuggingFaceService {
    static async chat(message) {
        // Multiple free models available
        const models = [
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
            'https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf',
            'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct'
        ];
        
        const randomModel = models[Math.floor(Math.random() * models.length)];
        
        try {
            const API_KEY = process.env.HUGGINGFACE_API_KEY;
            const headers = { 'Content-Type': 'application/json' };
            
            if (API_KEY && API_KEY !== 'hf_your_key_here') {
                headers['Authorization'] = `Bearer ${API_KEY}`;
            }

            console.log(`🔄 Calling Hugging Face API with model: ${randomModel}...`);
            const response = await fetch(randomModel, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    inputs: `<|user|>\n${message}\n<|assistant|>\n`,
                    parameters: {
                        max_new_tokens: 500,
                        temperature: 0.7
                    }
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Hugging Face API Error:', response.status, errorText);
                return `Hugging Face API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            console.log('✅ Hugging Face response received');

            if (Array.isArray(data) && data[0] && data[0].generated_text) {
                return data[0].generated_text.split('<|assistant|>')[1] || data[0].generated_text;
            } else if (data.error) {
                console.error('❌ Hugging Face returned error:', data.error);
                return `Hugging Face model error: ${data.error}`;
            } else {
                console.error('❌ Unexpected Hugging Face API response structure:', data);
                return 'Hugging Face returned an unexpected response.';
            }
        } catch (error) {
            console.error('❌ Hugging Face Service Error:', error.message);
            return 'Hugging Face service me error: ' + error.message;
        }
    }
}

module.exports = HuggingFaceService;
