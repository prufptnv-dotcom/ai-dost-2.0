const req = fetch('http://localhost:3000/api/agent/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userPrompt: 'test', projectFiles: [], projectPath: '', projectId: 'test1' })
});

req.then(async res => {
  console.log('Status:', res.status);
  console.log('Headers:', res.headers);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('Stream done');
      break;
    }
    console.log(new TextDecoder().decode(value));
  }
}).catch(console.error);
