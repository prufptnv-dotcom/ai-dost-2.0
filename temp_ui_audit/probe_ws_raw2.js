// Raw ws probe WITH the vite-hmr subprotocol (the gate my earlier probes missed).
const net = require('net');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || 58228);
const TOKEN = process.argv[3] || 'YkEUAAi9veFE';

function probe(label, pathAndHeaders) {
  return new Promise((resolve) => {
    const sock = net.connect(PORT, '127.0.0.1', () => sock.write(pathAndHeaders));
    let buf = '';
    const t = setTimeout(() => { sock.destroy(); resolve(`${label.padEnd(30)} -> HANG (no response3s)`); }, 3000);
    sock.on('data', (d) => {
      buf += d.toString('latin1');
      if (buf.includes('\r\n\r\n') && !t._c) {
        t._c = true; clearTimeout(t);
        resolve(`${label.padEnd(30)} -> ${buf.split('\r\n')[0]}`);
        sock.destroy();
      }
    });
    sock.on('error', (e) => { clearTimeout(t); resolve(`${label.padEnd(30)} -> ERR ${e.message}`); });
    sock.on('close', () => { if (!t._c) { t._c = true; clearTimeout(t); resolve(`${label.padEnd(30)} -> closed w/o response`); } });
  });
}

const key = crypto.randomBytes(16).toString('base64');
const mk = (pathq, extra) =>
  `GET ${pathq} HTTP/1.1\r\nHost: localhost:${PORT}\r\n${extra}` +
  `Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\n` +
  `Sec-WebSocket-Version: 13\r\n\r\n`;

(async () => {
  console.log(`probing 127.0.0.1:${PORT}`);
  const out = [];
  out.push(await probe('vite-hmr + token + origin', mk(`/?token=${TOKEN}`,
    `Origin: http://localhost:5000\r\nSec-WebSocket-Protocol: vite-hmr\r\n`)));
  out.push(await probe('vite-hmr + token, no origin', mk(`/?token=${TOKEN}`,
    `Sec-WebSocket-Protocol: vite-hmr\r\n`)));
  out.push(await probe('vite-hmr + BAD token', mk('/?token=WRONG',
    `Origin: http://localhost:5000\r\nSec-WebSocket-Protocol: vite-hmr\r\n`)));
  out.push(await probe('no protocol + token + origin', mk(`/?token=${TOKEN}`,
    `Origin: http://localhost:5000\r\n`)));
  out.forEach((l) => console.log('  ' + l));
})();
