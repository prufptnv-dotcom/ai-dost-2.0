const http = require('http');

const userPrompt = process.argv.slice(2).join(' ') || 'Create a new file named agent_test.txt with "hello agent" inside';
const data = JSON.stringify({
  userPrompt: userPrompt,
  projectFiles: [],
  projectId: 'test123',
  forceLocal: true,
  saveToRepo: true
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/agent/run',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('HEADERS', res.headers);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  res.on('end', () => {
    console.log('\n== END OF STREAM ==');
  });
});

req.on('error', (e) => {
  console.error('problem with request:', e.message);
});

req.write(data);
req.end();
