require('dotenv').config();

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('Testing OpenRouter with model meta-llama/llama-3.1-8b-instruct...');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: 'Respond with JSON: {"status": "ok"}' }]
    })
  });

  console.log('OpenRouter status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data));
}

testOpenRouter().catch(console.error);
