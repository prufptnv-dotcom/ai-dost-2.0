require('dotenv').config();
const GroqService = require('./services/groqService');

async function testNewGroq() {
  console.log('Testing Groq with new key...');
  const res = await GroqService.chat('Say "Groq new API key working perfectly!"', [], 'chat');
  console.log('GROQ RESPONSE:', res);
}

testNewGroq().catch(console.error);
