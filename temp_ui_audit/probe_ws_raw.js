// Raw ws-upgrade probe against the vite dev server — no browser, exact bytes.
const net = require('net');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || 58228);
const TOKEN = process.argv[3] || 'YkEUAAi9veFE';

function probe(label, headers) {
  return new Promise((resolve) => {
    const sock = net.connect(PORT, '127.0.0.1', () => {
      sock.write(headers);
    });
    let buf = '';
    const t = setTimeout(() => { sock.destroy(); resolve(`${label.padEnd(26)} -> NO RESPONSE in3s (hang)`); }, 3000);
    sock.on('data', (d) => {
      buf += d.toString('latin1');
      if (buf.includes('\r\n\r\n') && !t._called) {
        t._called = true;
        clearTimeout(t);
        const status = buf.split('\r\n')[0];
        resolve(`${label.padEnd(26)} -> ${status}`);
        sock.destroy();
      }
    });
    sock.on('error', (e) => { clearTimeout(t); resolve(`${label.padEnd(26)} -> ERR ${e.message}`); });
    sock.on('close', () => { if (!t._called) { t._called = true; clearTimeout(t); resolve(`${label.padEnd(26)} -> closed w/o response`); } });
  });
}

const key = crypto.randomBytes(16).toString('base64');
const base = (extra) =>
  `GET /?token=${TOKEN} HTTP/1.1\r\n` + extra +
  `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
  `Sec-WebSocket-Version: 13\r\n\r\n`;

(async () => {
  console.log(`probing127.0.0.1:${PORT} ...`);
  const out = [];
  out.push(await probe('ws + origin:5000', base(`Host: localhost:${PORT}\r\nOrigin: http://localhost:5000\r\n`)));
  out.push(await probe('ws no origin', base(`Host: localhost:${PORT}\r\n`)));
  out.push(await probe('ws + origin:own', base(`Host: localhost:${PORT}\r\nOrigin: http://localhost:${PORT}\r\n`)));
  out.push(await probe('ws BAD token', `GET /?token=WRONG HTTP/1.1\r\nHost: localhost:${PORT}\r\nOrigin: http://localhost:5000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
  out.push(await probe('plain GET (sanity)', `GET / HTTP/1.1\r\nHost: localhost:${PORT}\r\nConnection: close\r\n\r\n`));
  out.forEach((l) => console.log('  ' + l));
})();
