const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fixMemory = require('../services/fixMemory');

/**
 * P5 — Persistent runtime + learning memory.
 *
 * The invariants under test:
 *   1. Two runs of the SAME underlying error produce the SAME signature, so a
 *      known fix is found — even across different workspaces/projects.
 *   2. A learned fix is durable (delete-proof store) and retrievable.
 *   3. The live-preview path is wired so a verified run ends with a real dev
 *      server, not a fake page.
 */

function makeDb() {
  const { DatabaseSync } = require('node:sqlite');
  const migration010 = require('../db/migrations/010_copilot_memory');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT)');
  migration010.up(db);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('fixMemory.errorSignature — same error, different noise, same key', () => {
  it('collapses absolute paths so two workspaces match', () => {
    const a = fixMemory.errorSignature("ERROR C:\\Users\\vikash kumar\\AppData\\Local\\Temp\\agent-ws-aaa\\src\\App.jsx:12:3: Unexpected token");
    const b = fixMemory.errorSignature("ERROR C:\\Users\\vikash kumar\\AppData\\Local\\Temp\\agent-ws-bbb\\src\\App.jsx:12:3: Unexpected token");
    assert.strictEqual(a, b, 'different workspaces must not change the signature');
  });

  it('collapses line/column numbers and hashes', () => {
    const a = fixMemory.errorSignature('src/index-C6G_3qQV.css 47:12 Module not found');
    const b = fixMemory.errorSignature('src/index-B7U2q2GY.css 89:4 Module not found');
    assert.strictEqual(a, b);
  });

  it('collapses volatile numbers (ports, sizes, durations)', () => {
    const a = fixMemory.errorSignature('Build failed in 348ms on port 5173');
    const b = fixMemory.errorSignature('Build failed in 512ms on port 61000');
    assert.strictEqual(a, b);
  });

  it('keeps the identifying words (the error type)', () => {
    const sig = fixMemory.errorSignature("[vite:html-inline-proxy] Could not load <path>/index.html?html-proxy&inline-css");
    assert.match(sig, /html-inline-proxy/);
    assert.match(sig, /Could not load/);
  });

  it('handles empty/degenerate input without throwing', () => {
    for (const bad of [null, undefined, '', 123, {}]) {
      assert.strictEqual(fixMemory.errorSignature(bad), '');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('fixMemory — learn a fix, find it next time', () => {
  it('round-trips a learned fix for the same error signature', () => {
    const db = makeDb();
    const err = "[vite:html-inline-proxy] Could not load C:/Users/x/ws/index.html?html-proxy&inline-css";

    fixMemory.learnFix({
      error: err,
      files: ['src/index.css'],
      summary: 'moved inline <style> out of index.html into the stylesheet',
      projectId: 'p1',
      db,
    });

    // A fresh run in a DIFFERENT project, same underlying error, new paths.
    const err2 = "[vite:html-inline-proxy] Could not load C:/Users/y/another-ws/index.html?html-proxy&inline-css";
    const found = fixMemory.knownFixesFor({ error: err2, projectId: 'p2', db });

    assert.ok(found.length > 0, 'the same error in a different project must find the known fix');
    assert.match(found[0].content, /inline/);
    assert.strictEqual(found[0].kind, 'fix');
    db.close();
  });

  it('dedupes the same signature (success_count grows, no duplicates)', () => {
    const db = makeDb();
    const err = 'Module not found: @fortawesome/react-fontawesome';
    for (let i = 0; i < 3; i++) {
      fixMemory.learnFix({ error: err, files: ['package.json'], summary: 'add @fortawesome/react-fontawesome to dependencies', db });
    }
    const found = fixMemory.knownFixesFor({ error: err, db });
    assert.ok(found.length >= 1);
    assert.ok(found[0].success_count >= 3, 'repeat fixes should bump the count, not duplicate');
    db.close();
  });

  it('does NOT learn when the error is unusable', () => {
    const db = makeDb();
    const res = fixMemory.learnFix({ error: '', summary: 'nothing', db });
    assert.strictEqual(res.saved, 0);
    assert.match(res.reason, /no usable/);
    db.close();
  });

  it('knownFixesFor returns nothing for a genuinely novel error', () => {
    const db = makeDb();
    fixMemory.learnFix({
      error: 'vite build failed',
      summary: 'install vite',
      db,
    });
    const found = fixMemory.knownFixesFor({ error: 'kubernetes etcd quorum lost zzz unique', db });
    assert.deepStrictEqual(found, []);
    db.close();
  });

  it('formatKnownFixes renders the prompt block with the success count', () => {
    const db = makeDb();
    const err = 'cors middleware missing';
    fixMemory.learnFix({ error: err, summary: 'add cors import', db });
    fixMemory.learnFix({ error: err, summary: 'add cors import', db });
    const found = fixMemory.knownFixesFor({ error: err, db });
    const block = fixMemory.formatKnownFixes(found);
    assert.match(block, /KNOWN FIXES FOR THIS ERROR/);
    assert.match(block, /worked \d+×/);
    db.close();
  });

  it('formatKnownFixes returns empty string when there is nothing', () => {
    assert.strictEqual(fixMemory.formatKnownFixes([]), '');
    assert.strictEqual(fixMemory.formatKnownFixes(null), '');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P5 — live preview wiring (static source audit)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'agent.js'), 'utf8');

  it('a verified scaffold leaves a live dev server running', () => {
    assert.match(src, /ensureLivePreview\(\{/, 'scaffold must start the live preview');
    assert.match(src, /livePreviewUrl: live\.ok \? live\.url : null/);
  });

  it('the evidence gate starts the live server on a verified modification', () => {
    const gate = src.slice(src.indexOf('async function verifyRunOutcome'));
    assert.match(gate, /ensureLivePreview\(\{ dir, projectId, send, onProgress \}\)/);
    assert.match(gate, /livePreviewUrl: live\?\.ok \? live\.url : null/);
  });

  it('an already-running server is reused, not restarted', () => {
    const fn = src.slice(src.indexOf('async function ensureLivePreview'));
    assert.match(fn, /existing\.state === 'READY'/, 'must reuse a live server instead of leaking a second process');
    assert.match(fn, /reused: true/);
  });

  it('a failed dev server is reported, never thrown', () => {
    const fn = src.slice(src.indexOf('async function ensureLivePreview'));
    assert.match(fn, /state: 'FAILED'/);
    assert.match(fn, /preview falls back to the built output/);
  });

  it('the repair loop learns a successful fix', () => {
    const loop = src.slice(src.indexOf('async function runRepairLoop'));
    assert.match(loop, /fixMemory\.learnFix\(/);
    assert.match(loop, /outcome\.ok/, 'must only learn from a genuinely successful repair');
  });

  it('the repair prompt injects known fixes before asking the model', () => {
    const loop = src.slice(src.indexOf('async function runRepairLoop'));
    const retrieveIdx = loop.indexOf('knownFixesFor');
    const requestIdx = loop.indexOf('requestRepair');
    assert.ok(retrieveIdx > -1 && requestIdx > -1);
    assert.ok(retrieveIdx < requestIdx, 'memory must be consulted BEFORE the LLM is asked');
    assert.match(loop, /formatKnownFixes/);
  });

  it('REGRESSION: the greenfield preview block never references out-of-scope targetDir', () => {
    // `targetDir` is declared inside executeTool's switch case. Referring to it
    // from the ReAct loop threw a ReferenceError, which the loop's catch turned
    // into a step failure — the run broke AFTER a passing verification, and the
    // live preview never started. Slice the greenfield branch and prove the
    // only workspace reference is the in-scope `workspacePath`.
    const branch = src.slice(src.indexOf('// Greenfield Full-Stack Project Generator'), src.indexOf('// Not verified. Hand the real failure'));
    assert.match(branch, /dir: workspacePath/, 'must pass the in-scope workspace');
    assert.ok(
      !/dir:\s*targetDir/.test(branch),
      'targetDir is not in scope here — this exact line broke a verified run'
    );
    assert.match(branch, /catch \(previewErr\)/, 'a preview problem must never fail a verified run');
  });

  it('REGRESSION: auto-learn calls the synchronous learnNotes without .catch', () => {
    const learnBlock = src.slice(src.indexOf('const autoLearn = (status, message)'));
    assert.ok(!/learnNotes\([\s\S]{0,300}\}\)\.catch/.test(learnBlock), '.catch on a sync fn silently disabled auto-learn');
    assert.match(learnBlock, /learnNotes\(notes, \{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P5 — proxied preview URL rewriting', () => {
  const preview = require('../routes/preview');
  const rewrite = preview.rewriteProxiedUrls;
  const isRewritable = preview.isRewritableType;
  const P = '/api/preview/demo-app';

  it('is exported and rewrites root-absolute module URLs in HTML', () => {
    assert.strictEqual(typeof rewrite, 'function');
    const html = `<script type="module" src="/src/main.jsx"></script>
<script type="module" src="/@vite/client"></script>
<script>import { x } from "/@react-refresh";</script>`;
    const out = rewrite(html, P);
    assert.match(out, new RegExp(`src="${P}/src/main\\.jsx"`));
    assert.match(out, new RegExp(`src="${P}/@vite/client"`));
    assert.match(out, new RegExp(`from "${P}/@react-refresh"`));
  });

  it('rewrites bare-import specifiers and CSS urls inside JS/CSS responses', () => {
    const js = `import r from "/node_modules/.vite/deps/react.js?v=abc123";\nconst u = "/src/logo.png";`;
    const out = rewrite(js, P);
    assert.match(out, /\/node_modules\/\.vite\/deps\/react\.js\?v=abc123/);
    assert.ok(out.includes(`"${P}/node_modules/.vite/deps/react.js?v=abc123"`));
    assert.ok(out.includes(`"${P}/src/logo.png"`));

    const css = `.logo { background: url(/src/logo.png); } .cdn { background: url('/x.png'); }`;
    const cssOut = rewrite(css, P);
    assert.ok(cssOut.includes(`url(${P}/src/logo.png)`));
    assert.ok(cssOut.includes(`url('${P}/x.png')`));
  });

  it('LEAVES backend routes, protocol-relative and empty paths alone', () => {
    const input = `fetch("/api/tasks"); location = "/api/v1/x"; io("/socket.io"); const a = "//cdn.x/y.js"; const b = "/";`;
    const out = rewrite(input, P);
    assert.ok(out.includes('fetch("/api/tasks")'), '/api must stay origin-rooted');
    assert.ok(out.includes('"/socket.io"'), 'socket.io must stay origin-rooted');
    assert.ok(out.includes('"//cdn.x/y.js"'), 'protocol-relative URL must not be touched');
    assert.ok(out.includes('const b = "/"'), 'an empty path is not a path');
    assert.ok(!out.includes(`${P}/api/`), 'must never double-prefix /api');
  });

  it('REGRESSION: never corrupts regex literals or /* comments */ in JS', () => {
    // Both live behind `(` — a `(quote-or-paren)/` rule rewrote
    // `.render(/* @__PURE__ */ jsxDEV(…))` into a broken
    // `.render(/api/preview/…/* @__PURE__ */ …)` (invalid JS, blank preview).
    const js = [
      'el.render(/* @__PURE__ */ jsxDEV(App, {}, void 0));',
      'str.replace(/\\/src\\/main\\.jsx/, "x");',
      'if (/^\\/api\\//.test(p)) return;',
      'const ok = render(/*! keep */ App);',
      // A quote inside a REGEX BODY followed by `/`: `.replace(/"/g, …)` got
      // rewritten to `.replace(/"/api/preview/…/g, …)` → "Invalid regular
      // expression flags" the moment the browser parsed the dep bundle.
      'esc(str.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"));',
      'const re = /["\']\\/x/;',   // quote chars inside a character class
    ].join('\n');
    const out = rewrite(js, P);
    assert.strictEqual(out, js, 'code context outside string literals must be byte-identical');
  });

  it('handles null/empty prefix without throwing', () => {
    assert.strictEqual(rewrite('', P), '');
    assert.strictEqual(rewrite(null, P), null);
    assert.strictEqual(rewrite('/x.js', ''), '/x.js');
    assert.strictEqual(rewrite('/x.js', null), '/x.js');
  });

  it('classifies rewritable content types (text only)', () => {
    for (const t of ['text/html; charset=utf-8', 'text/javascript', 'application/javascript', 'application/x-javascript; charset=utf-8', 'text/css']) {
      assert.strictEqual(isRewritable(t), true, t);
    }
    for (const t of ['application/json', 'image/png', 'font/woff2', '', undefined]) {
      assert.strictEqual(isRewritable(t), false, String(t));
    }
  });

  it('REGRESSION: CORS allowlist always contains the backend own origin', () => {
    // Chromium sends `Origin` on same-origin module-script fetches too. With
    // only :3000 allow-listed, every proxied sub-module loaded straight from
    // :5000 was500'd ("CORS origin is not allowed") → blank live preview.
    const sec = fs.readFileSync(path.join(__dirname, '..', 'security-hardening.js'), 'utf8');
    assert.match(sec, /function selfOrigins\(\)/);
    assert.match(sec, /`http:\/\/localhost:\$\{port\}`/);
    assert.match(sec, /\.\.\.selfOrigins\(\)/, 'self origins must be unioned into the final list');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P5 — AST-based JS rewriting (regex corruption regression)', () => {
  const preview = require('../routes/preview');
  const rewriteJs = preview.rewriteJsModule;
  const P = '/api/preview/demo-app';

  it('is exported and prefixes ONLY genuine string literals', () => {
    assert.strictEqual(typeof rewriteJs, 'function');
    const js = [
      'import App from "/src/App.jsx";',
      'import "./src/index.css";',
      'const base = "/node_modules/.vite/deps/react.js?v=abc";',
      'const tpl = `/src/main.jsx`;',
      'export { App as default };',
    ].join('\n');
    const out = rewriteJs(js, P);
    assert.ok(out.includes(`"${P}/src/App.jsx"`), 'import source must be prefixed');
    assert.ok(out.includes(`"./src/index.css"`), 'relative specifiers stay untouched');
    assert.ok(out.includes(`"${P}/node_modules/.vite/deps/react.js?v=abc"`), 'bare-import rewrite must be prefixed');
    assert.ok(out.includes('`' + P + '/src/main.jsx`'), 'expression-less template literal must be prefixed');
  });

  it('REGRESSION: real corruptions from live dep bundles are now impossible', async () => {
    const acorn = require('acorn');
    // These three corrupted actual served bundles:
    const js = [
      'var duotonePathRe = [/path d="([^"]+)".*path d="([^"]+)"/g, { wrap: 1 }];',
      'esc(str.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"));',
      'el.render(/* @__PURE__ */ jsxDEV(App, {}, void 0));',
      'function guard(p){ if (/^\\/api\\//.test(p)) return "/api/keep"; }',
      'const x = fetch("/api/tasks") + "//cdn.x/y.js" + "/";',
    ].join('\n');
    const out = rewriteJs(js, P);
    assert.strictEqual(out, js, 'regexes/comments/backend paths must be byte-identical');
    acorn.parse(out, { ecmaVersion: 'latest', sourceType: 'module' });  // must parse
  });

  it('serves an unparseable response UNREWRITTEN (never half-rewritten)', () => {
    const broken = 'const x = {::/not-js/;;';
    assert.strictEqual(rewriteJs(broken, P), broken);
  });

  it('handles empty input and missing prefix without throwing', () => {
    assert.strictEqual(rewriteJs('', P), '');
    assert.strictEqual(rewriteJs(null, P), null);
    assert.strictEqual(rewriteJs('/x.js', ''), '/x.js');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P5 — HMR WebSocket upgrade routing (token → project)', () => {
  const fs2 = require('fs');
  const path2 = require('path');
  const devServerManager = require('../sandbox/devServerManager');

  it('registerHmrToken/getProjectByHmrToken round-trip + falsy guards', () => {
    assert.strictEqual(devServerManager.registerHmrToken('', 'tokA'), false);
    assert.strictEqual(devServerManager.registerHmrToken('projA', ''), false);
    assert.strictEqual(devServerManager.getProjectByHmrToken(''), null);
    assert.strictEqual(devServerManager.getProjectByHmrToken('never-registered'), null);

    assert.strictEqual(devServerManager.registerHmrToken('hmr-proj-1', 'tokHmr1'), true);
    assert.strictEqual(devServerManager.getProjectByHmrToken('tokHmr1'), 'hmr-proj-1');
    // re-register (vite restart → new token) overwrites/adds, never throws
    devServerManager.registerHmrToken('hmr-proj-1', 'tokHmr1b');
    assert.strictEqual(devServerManager.getProjectByHmrToken('tokHmr1b'), 'hmr-proj-1');
  });

  it('wires the token: preview proxy registers it, server.js upgrade resolves it', () => {
    const previewSrc = fs2.readFileSync(path2.join(__dirname, '..', 'routes', 'preview.js'), 'utf8');
    assert.match(previewSrc, /targetPath\.includes\('\/@vite\/client'\)/,
      'proxy must only trust the token from /@vite/client responses');
    assert.ok(previewSrc.includes('text.match(/const\\s+wsToken'),
      'proxy must extract vite\'s wsToken literal');
    assert.match(previewSrc, /registerHmrToken\(server\.projectId \|\| firstSegment/,
      'proxy must index the token under the project being proxied');

    const serverSrc = fs2.readFileSync(path2.join(__dirname, '..', 'server.js'), 'utf8');
    const upgradeIdx = serverSrc.indexOf('server.on(\'upgrade\'');
    assert.ok(upgradeIdx > 0, 'server.js must register an upgrade handler');
    const upgradeBlock = serverSrc.slice(upgradeIdx, upgradeIdx + 4000);
    assert.match(upgradeBlock, /getProjectByHmrToken\(decodeURIComponent\(tok\)\)/,
      'upgrade handler must resolve the project from ?token=');
    // Scope to the preview/HMR section: P8's /yws/ claim sits ABOVE it on
    // purpose (a collab socket must never fall into preview referer-guessing),
    // so measure the claim that guards THIS path, not the first one overall.
    const previewStart = upgradeBlock.indexOf('const previewMatch =');
    assert.ok(previewStart > 0, 'preview matching must follow the yws claim');
    const previewBlock = upgradeBlock.slice(previewStart);
    assert.ok(previewBlock.indexOf('getProjectByHmrToken') < previewBlock.indexOf('__upgradeHandled'),
      'token lookup must happen BEFORE the socket is claimed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P5 — Windows 8.3 path fix (vite fs.allow mismatch)', () => {
  const mgrSrc = fs.readFileSync(path.join(__dirname, '..', 'sandbox', 'devServerManager.js'), 'utf8');

  it('REGRESSION: dev server spawns from the NATIVE realpath (long name)', () => {
    // os.tmpdir() can be the 8.3 short form (VIKASH~1) while vite resolves ids
    // through realpathSync.native → LONG. fs.allow (built from the short root)
    // then rejects every module: "Does the file exist?" → raw JSX shipped to the
    // browser → "Unexpected token '<'".
    const spawnRegion = mgrSrc.slice(mgrSrc.indexOf('let wsDir = rawWsDir'), mgrSrc.indexOf('serverInfo.childProcess'));
    assert.match(spawnRegion, /realpathSync\.native\(rawWsDir\)/, 'must expand 8.3 short names before spawning vite');
    assert.ok(!/[^.]realpathSync\(/.test(spawnRegion.replace(/realpathSync\.native/g, '')), 'plain realpathSync does NOT expand 8.3 names');
  });

  it('keeps the containment check on the un-expanded path (order matters)', () => {
    // The escape check compares rawWsDir against wsRoot — both short — so it
    // must run BEFORE expansion, otherwise short vs long would fail the prefix
    // test and reject legitimate workspaces.
    const checkIdx = mgrSrc.indexOf('projectPath escapes workspace');
    const expandIdx = mgrSrc.indexOf('realpathSync.native(rawWsDir)');
    assert.ok(checkIdx > -1 && expandIdx > -1);
    assert.ok(checkIdx < expandIdx, 'containment check must run before path expansion');
  });
});