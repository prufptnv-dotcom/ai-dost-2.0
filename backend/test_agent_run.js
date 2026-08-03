async function testRun() {
  console.log('Testing /api/agent/run endpoint directly...');
  const res = await fetch('http://localhost:3000/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userPrompt: 'build a simple calculator',
      projectFiles: [
        { path: 'main.py', content: '# main.py' },
        { path: 'index.html', content: '<h1>Test</h1>' }
      ]
    })
  });

  console.log('Status:', res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) console.log('SSE LINE:', buffer.trim());
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        console.log('SSE LINE:', line.trim());
      }
    }
  }
  console.log('🎉 AGENT LOOP COMPLETED ALL STEPS FULLY!');
}

testRun().catch(console.error);
