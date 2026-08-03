require('dotenv').config();

async function testHFWhoAmI() {
  const res = await fetch('https://huggingface.co/api/whoami-v2', {
    headers: { 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}` }
  });
  console.log('HF WhoAmI Status:', res.status);
  const data = await res.json();
  console.log('HF WhoAmI Data:', JSON.stringify(data));
}

testHFWhoAmI().catch(console.error);
