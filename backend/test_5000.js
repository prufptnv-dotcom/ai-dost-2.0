const req = fetch('http://localhost:5000/api/agent/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userPrompt: 'Can you write a simple hello world in python?', projectFiles: [], projectPath: '', projectId: 'test1' })
});

req.then(async res => {
  console.log('Status:', res.status);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(new TextDecoder().decode(value).trim());
  }
}).catch(console.error);
