// Full chain: start cloudflared quick tunnel → Node HTTP fetch with key → report.
// Usage: node probe_share_tunnel.js [sharePort] [key]
const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const SHARE_PORT = process.argv[2] || '55313';
const KEY = process.argv[3] || '_HEeBxq4XYGcZ53a-i4U7G-T';
const CF = path.join(__dirname, '..', 'backend', 'data', 'bin', 'cloudflared.exe');

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        host: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 aidost-share-probe', ...(opts.headers || {}) },
        timeout: 20000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: body.slice(0, 500) })
        );
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function resolveDns(host) {
  try {
    execSync(`nslookup ${host}`, { timeout: 8000, stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

(async () => {
  const child = spawn(CF, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${SHARE_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let out = '';
  const collect = (d) => (out += d);
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  // wait for URL
  let url = null;
  for (let i = 0; i < 45 && !url; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const m = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) url = m[0];
  }
  if (!url) {
    console.log('NO TUNNEL URL. output:\n' + out.slice(0, 1500));
    child.kill();
    process.exit(1);
  }
  console.log('tunnel:', url);

  // DNS propagation wait (trycloudflare subdomains take a few seconds)
  const host = new URL(url).host;
  let dnsOk = false;
  for (let i = 0; i < 15 && !dnsOk; i++) {
    dnsOk = resolveDns(host);
    if (!dnsOk) await new Promise((r) => setTimeout(r, 2000));
  }
  console.log('dns ok:', dnsOk);

  const results = [];
  for (const [label, u] of [
    ['root +key', `${url}/?key=${KEY}`],
    ['preview deep +key', `${url}/api/preview/p5-live/?key=${KEY}`],
    ['no key', `${url}/`],
    ['wrong key', `${url}/?key=nope`],
  ]) {
    try {
      const r = await get(u);
      results.push(`[${label}] ${r.status} set-cookie=${JSON.stringify((r.headers['set-cookie'] || []).map((c) => c.split(';')[0]))}`);
      if (r.status >= 400) results.push(`   body: ${r.body.replace(/\s+/g, ' ').slice(0, 180)}`);
      if (r.status < 400 && r.body.includes('root')) results.push('   (body has #root shell)');
    } catch (e) {
      results.push(`[${label}] ERROR ${e.message}`);
    }
  }
  console.log(results.join('\n'));

  // final: follow root redirect manually with cookie like a browser
  try {
    const first = await get(`${url}/?key=${KEY}`);
    const setc = (first.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
    const second = await get(`${url}/`, { headers: { Cookie: setc } });
    console.log(`[browser flow]302 -> ${second.status} set-cookie=${JSON.stringify(setc)}`);
    console.log('   body:', second.body.replace(/\s+/g, ' ').slice(0, 220));
  } catch (e) {
    console.log('[browser flow] ERROR', e.message);
  }

  child.kill();
  setTimeout(() => process.exit(0), 500);
})();
