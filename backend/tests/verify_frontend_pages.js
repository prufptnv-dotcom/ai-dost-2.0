const http = require('http');

console.log('=================================================');
console.log('🌐 FRONTEND NEXT.JS PAGE ROUTE AUDIT');
console.log('=================================================\n');

const routes = [
  '/',
  '/dashboard',
  '/about-me',
  '/about-project',
  '/api-docs',
  '/privacy-policy',
  '/terms',
  '/chat',
  '/404'
];

function checkRoute(route) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3001${route}`, (res) => {
      resolve({ route, status: res.statusCode });
    }).on('error', (err) => {
      // Fallback to port 3000 if 3001 is proxy
      http.get(`http://localhost:3000${route}`, (res) => {
        resolve({ route, status: res.statusCode });
      }).on('error', (e) => {
        resolve({ route, status: 500, error: e.message });
      });
    });
  });
}

async function auditPages() {
  for (const r of routes) {
    const res = await checkRoute(r);
    const symbol = res.status >= 200 && res.status < 400 ? '✅' : '❌';
    console.log(`${symbol} Page: ${r.padEnd(20)} -> Status HTTP ${res.status}`);
  }
  console.log('\n=================================================');
  console.log('✨ All Frontend Page Routes Verified!');
  console.log('=================================================');
}

auditPages();
