// Probe free SSH tunnel providers: which variant actually prints a URL?
const { spawn } = require('child_process');

const PORT = process.argv[2] || 55313;

const VARIANTS = [
  {
    name: 'serveo -R0:0:host:port (HTTP subdomain mode)',
    args: ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=8', '-T',
      '-R', `0:0:localhost:${PORT}`, 'serveo.net'],
  },
  {
    name: 'serveo -R0:host:port (TCP mode, fallback)',
    args: ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=NUL', '-o', 'ConnectTimeout=8', '-T',
      '-R', `0:localhost:${PORT}`, 'serveo.net'],
  },
];

function run({ name, args }, ms) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn('ssh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const finish = () => {
      try { child.kill(); } catch (_) {}
      const urls = (out.match(/https:\/\/[^\s'"<>]+/g) || []);
      console.log(`\n===== ${name} =====`);
      console.log(out.trim().split('\n').map((l) => '  | ' + l).join('\n'));
      console.log(`  URLS: ${urls.length ? urls.join(' , ') : '(none)'}`);
      resolve();
    };
    setTimeout(finish, ms);
    child.on('exit', () => setTimeout(finish, 200));
  });
}

(async () => {
  for (const v of VARIANTS) await run(v, 11000);
  process.exit(0);
})();
