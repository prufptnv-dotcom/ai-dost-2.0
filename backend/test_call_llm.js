const GroqService = require('./services/groqService');
const NvidiaService = require('./services/nvidiaService');
const GeminiService = require('./services/geminiService');
const MistralService = require('./services/mistralService');

async function testAll() {
  const prompt = "You are an AI Agent. Respond ONLY in JSON format: {\"thought\":\"test\", \"action\":\"FINAL_ANSWER\", \"answer\":\"Hello\"}";
  
  console.log('1. Testing Groq...');
  try {
    const start = Date.now();
    const res = await GroqService.chat(prompt, [], 'project', null);
    console.log('Groq result (ms:', Date.now() - start, '):', res ? res.substring(0, 150) : 'null');
  } catch (e) {
    console.log('Groq error:', e.message);
  }

  console.log('\n2. Testing Nvidia...');
  try {
    const start = Date.now();
    const res = await NvidiaService.chat(prompt, [], null);
    console.log('Nvidia result (ms:', Date.now() - start, '):', res ? res.substring(0, 150) : 'null');
  } catch (e) {
    console.log('Nvidia error:', e.message);
  }

  console.log('\n3. Testing Gemini...');
  try {
    const start = Date.now();
    const res = await GeminiService.chat(prompt, [], null, 'project', null);
    console.log('Gemini result (ms:', Date.now() - start, '):', res ? res.substring(0, 150) : 'null');
  } catch (e) {
    console.log('Gemini error:', e.message);
  }
}

testAll().catch(console.error);
