require('dotenv').config();

async function verifyKeys() {
  console.log('--- 🔑 VERIFYING NEW API KEYS ---');

  // 1. Verify Groq
  console.log('\n1. Verifying Groq API Key...');
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10
      })
    });
    const groqData = await groqRes.json();
    if (groqRes.ok) {
      console.log('✅ GROQ API KEY VALID:', groqData.choices[0].message.content.trim());
    } else {
      console.error('❌ GROQ API KEY FAILED:', groqRes.status, groqData);
    }
  } catch (e) {
    console.error('❌ Groq network error:', e.message);
  }

  // 2. Verify Together AI
  console.log('\n2. Verifying Together AI API Key...');
  try {
    const togetherRes = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3-8b-chat-hf',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10
      })
    });
    const togetherData = await togetherRes.json();
    if (togetherRes.ok) {
      console.log('✅ TOGETHER API KEY VALID:', togetherData.choices[0].message.content.trim());
    } else {
      console.error('❌ TOGETHER API KEY FAILED:', togetherRes.status, togetherData);
    }
  } catch (e) {
    console.error('❌ Together network error:', e.message);
  }

  // 3. Verify HuggingFace
  console.log('\n3. Verifying HuggingFace API Key...');
  try {
    const hfRes = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: 'Hello' })
    });
    const hfData = await hfRes.json();
    if (hfRes.ok) {
      console.log('✅ HUGGINGFACE API KEY VALID:', Array.isArray(hfData) ? hfData[0].generated_text : hfData);
    } else {
      console.error('❌ HUGGINGFACE API KEY FAILED:', hfRes.status, hfData);
    }
  } catch (e) {
    console.error('❌ HuggingFace network error:', e.message);
  }
}

verifyKeys().catch(console.error);
