// P6 spike: can @webcontainer/api boot WITHOUT an API key, from a COOP/COEP
// page served by a plain local server? Serves the vendored dist + a test page.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 3999);
const DIST = path.join(__dirname, '..', '..', 'backend', 'node_modules', '@webcontainer', 'api', 'dist');

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>wc spike</title></head>
<body style="font-family:monospace;background:#0b0d14;color:#e5e7eb">
<h2>WebContainer spike</h2>
<pre id="log">booting...</pre>
<iframe id="prev" style="width:640px;height:300px;border:1px solid #334"></iframe>
<script type="module">
  window.__status = [];
  window.__wcUrl = null;
  window.__bootError = null;
  const logEl = document.getElementById('log');
  const log = (s) => { window.__status.push(String(s)); logEl.textContent += '\\n' + s; };
  log('crossOriginIsolated=' + window.crossOriginIsolated);
  log('SAB=' + (typeof SharedArrayBuffer));
  try {
    const { WebContainer } = await import('/wc/index.js');
    log('imported, booting...');
    const wc = await WebContainer.boot();
    log('BOOTED');
    await wc.mount({
      'index.js': { file: { contents: "const http=require('http');http.createServer((q,r)=>r.end('<h1 id=x>HELLO FROM WEBCONTAINER</h1>')).listen(3000);" } },
      'package.json': { file: { contents: JSON.stringify({ name: 'spike', version: '1.0.0' }) } },
    });
    log('MOUNTED');
    wc.on('server-ready', (port, url) => {
      log('SERVER-READY port=' + port + ' url=' + url);
      window.__wcUrl = url;
      document.getElementById('prev').src = url;
    });
    const proc = await wc.spawn('node', ['index.js']);
    log('spawned node index.js (pid=' + proc.pid + ')');
    proc.output.pipeTo(new WritableStream({ write: (d) => log('proc: ' + d.trim()) })).catch(() => {});
    proc.exit.then((c) => log('node exited ' + c));
  } catch (e) {
    window.__bootError = String((e && e.message) || e);
    log('ERROR: ' + window.__bootError);
  }
</script>
</body></html>`;

http
  .createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cache-Control': 'no-store',
      });
      res.end(HTML);
      return;
    }
    if (url.startsWith('/wc/')) {
      const rel = url.slice('/wc/'.length);
      const file = path.join(DIST, rel);
      if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end('nope');
        return;
      }
      res.writeHead(200, {
        'Content-Type': rel.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(404).end('not found');
  })
  .listen(PORT, '127.0.0.1', () => console.log(`wc spike on http://127.0.0.1:${PORT}`));
