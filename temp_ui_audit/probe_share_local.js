// Isolate: does the share server itself accept the key? (no tunnel involved)
const http = require('http');

const PORT = Number(process.argv[2] || 55313);
const KEY = process.argv[3] || '_HEeBxq4XYGcZ53a-i4U7G-T';

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: body.slice(0, 400) })
      );
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const cases = [
    ['/', `/?key=${KEY}`],
    ['/api/preview/p5-live/', `/api/preview/p5-live/?key=${KEY}`],
    ['no key', '/'],
  ];
  for (const [label, p] of cases) {
    try {
      const r = await get(p);
      console.log(`[${label}] ${p} -> ${r.status} set-cookie=${JSON.stringify(r.headers['set-cookie'] || null)}`);
      if (r.status >= 400) console.log('   body:', r.body.replace(/\s+/g, ' ').slice(0, 200));
    } catch (e) {
      console.log(`[${label}] ${p} -> ERROR ${e.message}`);
    }
  }
})();
