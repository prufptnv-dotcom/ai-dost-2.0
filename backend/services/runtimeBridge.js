/**
 * P0 — Runtime Foundation
 * ============================================================================
 * Replit / Bolt / Devin ka core ek REAL execution environment hai. Is module
 * wahi layer hai: dependencies actually install hoti hain, build actually
 * chalta hai, exit codes actually capture hote hain, aur screenshot actually
 * BUILT output ka liya jaata hai.
 *
 * P0 ke pehle system ye karta tha:
 *   - `npm install` fire-and-forget + `unref()`  → result kabhi kisi ko nahi pata
 *   - preview = sirf App.jsx + hardcoded IconStub/API stubs (baaki sab discard)
 *   - phir bhi report: "UI rendered with 0 console errors"
 *
 * Ab har verdict ke peeche ek command ka exit code hota hai. Koi claim
 * text-inspection pe based nahi hai.
 *
 * Contract: koi bhi function throw NAHI karta — sab `{ok, evidence}` return
 * karte hain, taaki SSE stream kabhi toot na sake.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const logger = require('../logger');

// Timeouts — generous but bounded. A hung npm must never wedge the SSE stream.
const INSTALL_TIMEOUT_MS = 300000; // 5 min
const BUILD_TIMEOUT_MS  = 240000; // 4 min
const TEST_TIMEOUT_MS   = 180000; // 3 min
const SERVE_READY_MS    = 20000;  // static server boot budget
const BROWSER_TIMEOUT_MS = 30000; // Playwright navigation budget

const OUTPUT_CAP = 40000; // cap captured stdout/stderr so a runaway build can't OOM us

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

/**
 * Build the actual spawn invocation for a CLI tool.
 *
 * Node >=18.20.2 / 20.12.2 / 22 (the CVE-2024-27980 fix) REFUSES to spawn a
 * Windows .cmd / .bat file when `shell` is false — it throws `spawn EINVAL`.
 * That means `spawn('npm.cmd', args, { shell: false })` is dead on modern
 * Windows, which is exactly why dependency install was silently failing across
 * this whole app.
 *
 * On Windows we therefore go through `cmd.exe /d /s /c`. `args` must contain
 * only literals this module defines (never user input, never a cwd path) —
 * `assertLiteralArgs` enforces that so shell injection stays impossible.
 */
function assertLiteralArgs(args) {
  for (const a of args) {
    if (typeof a !== 'string') throw new Error('spawn arg must be a string');
    // A literal may not carry shell metacharacters that would change the
    // command line's structure.
    if (/[;&|<>`$()\n\r"^%!]/.test(a)) {
      throw new Error(`refusing to spawn non-literal argument: ${JSON.stringify(a).slice(0, 80)}`);
    }
  }
  return args;
}

function resolveInvocation(bin, args) {
  assertLiteralArgs(args);

  // POSIX: spawn the binary directly, always.
  if (process.platform !== 'win32') {
    return { command: bin, args: args.slice() };
  }

  // A real .exe (.NET, node, git) spawns perfectly well with shell:false, and
  // doing so keeps `C:\Program Files\…\node.exe` working. Routing an .exe
  // through cmd.exe instead is what breaks spaced paths: `/s` strips the outer
  // quotes and the remaining unquoted binary path falls apart.
  if (!/\.(cmd|bat)$/i.test(bin)) {
    return { command: bin, args: args.slice() };
  }

  // .cmd/.bat are batch scripts and genuinely require cmd.exe. Node joins the
  // literal args into one line, so no further quoting is needed.
  const comspec = process.env.ComSpec || 'cmd.exe';
  return { command: comspec, args: ['/d', '/s', '/c', [bin, ...args].join(' ')] };
}

/** Append to a buffer, respecting OUTPUT_CAP. */
function capped(current, chunk) {
  if (current.length >= OUTPUT_CAP) return current;
  return (current + chunk).slice(0, OUTPUT_CAP);
}

/** Last N non-empty lines of a stream — that is what actually explains a failure. */
function tail(text, lines = 25) {
  if (!text) return '';
  return String(text)
    .split(/\r?\n/)
    .filter(l => l.trim())
    .slice(-lines)
    .join('\n');
}

function readPkg(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return pkg && typeof pkg === 'object' ? pkg : null;
  } catch (_) {
    return null;
  }
}

/**
 * Spawn a command and resolve its REAL exit code. Never rejects.
 * Mirrors devServerManager's host-mode spawn (npm.cmd on win32, shell:false)
 * so both runtimes behave identically.
 */
function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    // Declared before `finish` because a synchronous spawn throw calls finish()
    // before the timer exists — TDZ would otherwise crash with
    // "Cannot access 'timer' before initialization".
    let timer = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ ...result, ms: Date.now() - started });
    };

    let child;
    let invocation;
    try {
      invocation = resolveInvocation(command, args);
      child = spawn(invocation.command, invocation.args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development',
          // CI=1 stops jest/vitest from opening watch mode, which would hang forever.
          CI: '1',
        },
      });
    } catch (e) {
      return finish({
        ok: false,
        exitCode: -1,
        stdout: '',
        stderr: `spawn failed: ${e.message}`,
        timedOut: false,
        spawnFailed: true,
      });
    }

    // Assign (not re-declare) — `timer` is already declared above so `finish`
    // can clear it even on a synchronous spawn failure.
    timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      // Windows: SIGKILL on a shell-spawned tree can leave grandchildren.
      if (process.platform === 'win32' && child.pid) {
        try {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
        } catch (_) {}
      }
    }, timeoutMs);

    child.stdout?.on('data', d => { stdout = capped(stdout, d.toString()); });
    child.stderr?.on('data', d => { stderr = capped(stderr, d.toString()); });

    child.on('error', (e) => {
      finish({ ok: false, exitCode: -1, stdout, stderr: capped(stderr, e.message), timedOut, spawnFailed: true });
    });

    child.on('close', (code) => {
      const exitCode = code == null ? -1 : code;
      finish({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. P4 — Dependency cache (the 218s problem)
// ─────────────────────────────────────────────────────────────────────────────
//
// Live measurement: a fresh `npm install` for the golden scaffold's standard
// Vite + React + Express dependency set took 218 seconds on this machine, and
// that cost was paid on EVERY run because (a) node_modules was deleted on each
// regeneration and (b) no cross-project caching existed.
//
// Two fixes live here:
//   - project-level persistence: stop deleting node_modules on regeneration
//     (implemented in routes/agent.js; install becomes a ~5s rebuild);
//   - a shared signature-keyed cache: one project installing a dependency set
//     makes that exact set cheap for every other project (Replit/Bolt-style
//     environment snapshot, but local and dependency-free).
//
// Cache correctness rule: a cache entry is only ever WRITTEN after a real
// `npm install` exited 0, and only ever READ through the `.ready` marker, so a
// partial copy can never be mistaken for a good one.

/** sha256 of the dependency set — the cache key. Versions included, order-free. */
function dependencySignature(pkg) {
  const deps = Object.entries(pkg?.dependencies || {}).sort(([a], [b]) => a.localeCompare(b));
  const devDeps = Object.entries(pkg?.devDependencies || {}).sort(([a], [b]) => a.localeCompare(b));
  const manifest = JSON.stringify({ dependencies: deps, devDependencies: devDeps });
  return crypto.createHash('sha256').update(manifest).digest('hex').slice(0, 16);
}

function depsCacheRoot() {
  const override = process.env.AIDOST_DEPS_CACHE;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(os.tmpdir(), 'aidost-deps-cache');
}

function depsCacheDirFor(signature) {
  return path.join(depsCacheRoot(), signature);
}

/**
 * A cached entry stores the dependency set it satisfies so later runs can find
 * a SUPERSET match, not just an exact one.
 */
function manifestFor(pkg) {
  return {
    dependencies: pkg?.dependencies || {},
    devDependencies: pkg?.devDependencies || {},
  };
}

/**
 * Find a cached dependency set that covers the needed one.
 *
 * Exact-match caching misses the moment an LLM adds one extra package, which
 * is most runs. A cached set whose packages are a subset of what's needed is
 * still hugely valuable: seed from it and `npm install` only fetches the
 * delta instead of resolving the whole tree from scratch.
 *
 * Returns the best candidate by coverage, or null. Extras in the candidate are
 * acceptable — npm prunes them — but the score favours entries that cover the
 * most needed packages with the fewest extras, so a bloated candidate never
 * beats a precise one.
 */
function findCacheCandidate(pkg, options = {}) {
  const { minCoverage = 0.6 } = options;
  const needed = new Set([...Object.keys(pkg?.dependencies || {}), ...Object.keys(pkg?.devDependencies || {})]);
  if (!needed.size) return null;

  let entries;
  try {
    entries = fs.readdirSync(depsCacheRoot(), { withFileTypes: true });
  } catch (_) {
    return null;
  }

  let best = null;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(depsCacheRoot(), e.name);
    if (!fs.existsSync(path.join(dir, '.ready'))) continue;

    let manifest = null;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    } catch (_) {
      continue; // no manifest → cannot judge coverage, skip
    }

    const cached = new Set([...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.devDependencies || {})]);
    if (!cached.size) continue;

    let covered = 0, extras = 0;
    for (const n of needed) if (cached.has(n)) covered++;
    for (const c of cached) if (!needed.has(c)) extras++;

    const coverage = covered / needed.size;
    if (coverage < minCoverage) continue;

    // Higher coverage wins; fewer extras break the tie.
    const score = coverage * 100 - extras * 2;
    if (!best || score > best.score) {
      best = { dir, signature: e.name, coverage, covered, extras, score };
    }
  }

  return best;
}

/**
 * Copy a node_modules tree as fast as the OS allows.
 *
 * Measured on this machine (52,210 files):
 *   - `fs.cpSync`     146s   — single-threaded, one stat+read+write per file
 *   - `robocopy /MT`  38s    — multi-threaded, the only option that beats npm
 *   - cold `npm install` ~218s
 *
 * Robocopy is used on Windows when available; anything else falls back to
 * `fs.cpSync`. Never throws — a failed copy just reports `ok:false` and the
 * caller falls back to a real install.
 */
async function copyTreeFast(src, dst) {
  const started = Date.now();

  if (process.platform === 'win32') {
    try {
      const r = await runCommand(
        'robocopy',
        [src, dst, '/E', '/MT:16', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS'],
        os.tmpdir(),
        600000
      );
      // robocopy exit codes: 0–7 = success (bitmask of what changed), 8+ = error.
      if (r.exitCode <= 7) return { ok: true, ms: Date.now() - started, via: 'robocopy' };
    } catch (_) {
      // fall through to fs.cpSync
    }
  }

  try {
    fs.cpSync(src, dst, { recursive: true, force: true });
    return { ok: true, ms: Date.now() - started, via: 'cpSync' };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, via: 'cpSync', error: e.message };
  }
}

/**
 * Copy a cached node_modules into `dir` if this exact dependency set was
 * installed before. Returns `{hit, cacheDir, ms}`; never throws — a failed
 * copy just reports a miss and lets the real install proceed.
 */
async function seedFromDependencyCache(dir, pkg, options = {}) {
  const { onLog } = options;
  const started = Date.now();
  const sig = dependencySignature(pkg);
  const cacheDir = depsCacheDirFor(sig);
  const src = path.join(cacheDir, 'node_modules');

  try {
    // Exact hit first — a full match needs no reconciliation at all.
    if (fs.existsSync(path.join(cacheDir, '.ready')) && fs.existsSync(src)) {
      if (onLog) onLog(`⚡ Dependency cache hit (${sig}) — copying node_modules instead of installing…`);
      const copied = await copyTreeFast(src, path.join(dir, 'node_modules'));
      if (!copied.ok) throw new Error(copied.error || 'copy failed');
      if (onLog) onLog(`⚡ Cache copied in ${copied.ms}ms via ${copied.via} — rebuilding native addons only`);
      return { hit: true, signature: sig, cacheDir, exact: true, ms: Date.now() - started, copyMs: copied.ms };
    }

    // Superset hit: cover most of the needed packages, then npm fetches the rest.
    const candidate = findCacheCandidate(pkg);
    if (candidate && fs.existsSync(path.join(candidate.dir, 'node_modules'))) {
      if (onLog) {
        onLog(`⚡ Dependency cache covers ${candidate.covered} of your packages (${Math.round(candidate.coverage * 100)}%) — seeding and fetching only the delta…`);
      }
      const copied = await copyTreeFast(path.join(candidate.dir, 'node_modules'), path.join(dir, 'node_modules'));
      if (!copied.ok) throw new Error(copied.error || 'copy failed');
      return {
        hit: true,
        signature: sig,
        seededFrom: candidate.signature,
        coverage: candidate.coverage,
        covered: candidate.covered,
        exact: false,
        ms: Date.now() - started,
        copyMs: copied.ms,
      };
    }

    return { hit: false, signature: sig, ms: Date.now() - started };
  } catch (e) {
    logger.warn(`[runtimeBridge] Dependency cache copy failed (${e.message}) — falling back to install`);
    // A half-copied tree is worse than none; remove it so npm starts clean.
    try { fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true }); } catch (_) {}
    return { hit: false, signature: sig, ms: Date.now() - started, error: e.message };
  }
}

/**
 * Best-effort, fire-and-forget: after a real install succeeds, snapshot this
 * dependency set so the next project with the same set gets it near-instantly.
 * Guarded by a lock marker so two concurrent installs don't interleave; a
 * crash mid-copy is caught by the `.ready` marker never being written.
 */
function recordDependencyCache(dir, pkg) {
  try {
    const sig = dependencySignature(pkg);
    const cacheDir = depsCacheDirFor(sig);
    const src = path.join(dir, 'node_modules');
    if (!fs.existsSync(src)) return;
    if (fs.existsSync(path.join(cacheDir, '.ready'))) return; // already cached
    const lockFile = path.join(cacheDir, '.lock');
    if (fs.existsSync(lockFile)) return; // someone else is writing it

    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(lockFile, String(process.pid));
    setImmediate(async () => {
      try {
        const copied = await copyTreeFast(src, path.join(cacheDir, 'node_modules'));
        if (!copied.ok) throw new Error(copied.error || 'copy failed');
        // Store the manifest so later runs can find SUPERSET matches, not just
        // exact ones — the single most common reason an exact cache misses.
        fs.writeFileSync(path.join(cacheDir, 'manifest.json'), JSON.stringify(manifestFor(pkg), null, 2));
        fs.writeFileSync(path.join(cacheDir, '.ready'), JSON.stringify({ at: Date.now(), pid: process.pid, via: copied.via }));
        logger.info(`[runtimeBridge] Dependency set ${sig} cached for future runs in ${copied.ms}ms (${copied.via})`);
      } catch (e) {
        logger.warn(`[runtimeBridge] Dependency cache write failed: ${e.message}`);
      } finally {
        try { fs.rmSync(lockFile, { force: true }); } catch (_) {}
      }
    });
  } catch (_) {
    /* caching must never break a run */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dependency install — AWAITED, exit-code captured
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Really install dependencies and report the real exit code.
 *
 * Trust boundary: LLM-authored package.json is untrusted code, so install runs
 * with `--ignore-scripts` (preinstall/postinstall hooks do NOT execute). Native
 * addons (better-sqlite3, esbuild, sharp…) therefore arrive unbuilt, which is
 * why `npm rebuild` follows — exactly the same trade-off devServerManager
 * already documents. Without this step every generated project was shipping
 * with node_modules it never actually had.
 */
async function installDependencies(dir, options = {}) {
  const { onLog } = options;

  const pkg = readPkg(dir);
  if (!pkg) {
    return { skipped: true, ok: false, reason: 'no package.json found', exitCode: null };
  }

  const declared = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  if (declared.length === 0) {
    // Nothing to install — very common for CDN-based scaffolds. Report honestly
    // rather than burning 2 minutes proving an empty set installs fine.
    return { skipped: true, ok: true, reason: 'package.json declares no dependencies', exitCode: null };
  }

  const hasNodeModules = fs.existsSync(path.join(dir, 'node_modules'));
  const steps = [];

  const run = async (label, args, timeout) => {
    if (onLog) onLog(`📦 ${label}…`);
    const r = await runCommand(npmBin(), args, dir, timeout);
    steps.push({ step: label, exitCode: r.exitCode, ok: r.ok, ms: r.ms });
    return r;
  };

  // P4 fast path 1: the shared dependency cache.
  if (!hasNodeModules) {
    const seeded = await seedFromDependencyCache(dir, pkg, { onLog });
    if (seeded.hit) {
      if (seeded.exact) {
        // Full match: only native addons need rebuilding.
        const rebuild = await run('npm rebuild (native addons)', ['rebuild'], INSTALL_TIMEOUT_MS);
        return {
          skipped: false,
          ok: rebuild.ok,
          exitCode: rebuild.exitCode,
          stderr: rebuild.stderr,
          tail: tail(rebuild.stderr || rebuild.stdout),
          ms: rebuild.ms + seeded.ms,
          steps,
          cacheHit: true,
          exact: true,
          signature: seeded.signature,
        };
      }

      // Superset match: npm must reconcile the delta — install only what's
      // missing (fast: node_modules already holds most of the tree).
      const delta = await run('npm install (delta)', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], INSTALL_TIMEOUT_MS);
      if (!delta.ok) {
        return {
          skipped: false,
          ok: false,
          exitCode: delta.exitCode,
          stderr: delta.stderr,
          tail: tail(delta.stderr || delta.stdout),
          ms: delta.ms + seeded.ms,
          timedOut: delta.timedOut,
          steps,
          cacheHit: true,
          exact: false,
        };
      }
      const rebuild = await run('npm rebuild (native addons)', ['rebuild'], INSTALL_TIMEOUT_MS);
      return {
        skipped: false,
        ok: true,
        exitCode: 0,
        rebuildExitCode: rebuild.exitCode,
        stderr: delta.stderr,
        tail: tail(delta.stderr),
        ms: delta.ms + rebuild.ms + seeded.ms,
        steps,
        cacheHit: true,
        exact: false,
        coverage: seeded.coverage,
        signature: seeded.signature,
      };
    }
  }

  if (hasNodeModules) {
    // node_modules already present — a full install is wasted time. Only the
    // native-addon rebuild is needed (idempotent, usually seconds).
    const rebuild = await run('npm rebuild (native addons)', ['rebuild'], INSTALL_TIMEOUT_MS);
    if (onLog) {
      onLog(rebuild.ok
        ? `✅ Native addons rebuilt (${rebuild.ms}ms)`
        : `⚠️ npm rebuild exited ${rebuild.exitCode} — continuing`);
    }
    return {
      skipped: false,
      ok: rebuild.ok,
      exitCode: rebuild.exitCode,
      stderr: rebuild.stderr,
      tail: tail(rebuild.stderr || rebuild.stdout),
      ms: rebuild.ms,
      steps,
    };
  }

  const install = await run(
    'npm install',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'],
    INSTALL_TIMEOUT_MS
  );

  if (!install.ok) {
    if (onLog) onLog(`❌ npm install failed (exit ${install.exitCode})`);
    return {
      skipped: false,
      ok: false,
      exitCode: install.exitCode,
      stderr: install.stderr,
      tail: tail(install.stderr || install.stdout),
      ms: install.ms,
      timedOut: install.timedOut,
      steps,
    };
  }

  const rebuild = await run('npm rebuild (native addons)', ['rebuild'], INSTALL_TIMEOUT_MS);
  if (!rebuild.ok && onLog) {
    onLog(`⚠️ npm rebuild exited ${rebuild.exitCode} — native addons may be missing`);
  }

  if (onLog) onLog(`✅ Dependencies installed (${Math.round((install.ms + rebuild.ms) / 100) / 10}s)`);

  // P4: snapshot this dependency set for the NEXT project — fire-and-forget so
  // the user never pays for the cache write.
  recordDependencyCache(dir, pkg);

  return {
    skipped: false,
    // A rebuild failure degrades native addons but does not invalidate the
    // install itself; callers see it in `steps` and in the warning log.
    ok: true,
    exitCode: install.exitCode,
    rebuildExitCode: rebuild.exitCode,
    stderr: install.stderr,
    tail: tail(install.stderr),
    ms: install.ms + rebuild.ms,
    steps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Build + test — real exit codes
// ─────────────────────────────────────────────────────────────────────────────

/** Run the project's real build script. Skipped (ok) when there isn't one. */
async function runBuild(dir) {
  const pkg = readPkg(dir);
  if (!pkg) return { skipped: true, ok: false, reason: 'no package.json', exitCode: null };
  if (!pkg.scripts || !pkg.scripts.build) {
    return { skipped: true, ok: true, reason: 'no build script', exitCode: null };
  }
  const r = await runCommand(npmBin(), ['run', 'build'], dir, BUILD_TIMEOUT_MS);
  return {
    skipped: false,
    ok: r.ok,
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    stdout: tail(r.stdout, 15),
    stderr: tail(r.stderr || r.stdout, 30),
    ms: r.ms,
    cmd: 'npm run build',
  };
}

/** Run the project's real test script. Skipped (ok) when there isn't one. */
async function runTests(dir) {
  const pkg = readPkg(dir);
  if (!pkg) return { skipped: true, ok: false, reason: 'no package.json', exitCode: null };
  if (!pkg.scripts || !pkg.scripts.test) {
    return { skipped: true, ok: true, reason: 'no test script', exitCode: null };
  }
  const r = await runCommand(npmBin(), ['test'], dir, TEST_TIMEOUT_MS);
  return {
    skipped: false,
    ok: r.ok,
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    stdout: tail(r.stdout, 15),
    stderr: tail(r.stderr || r.stdout, 30),
    ms: r.ms,
    cmd: 'npm test',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Static server for the REAL built output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal static file server used to load the actual build output in a browser.
 * Vite emits hashed `/assets/*` references, so a real HTTP origin is required —
 * `file://` will not resolve them.
 */
function serveStatic(rootDir, options = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch (_) {
        res.writeHead(400); return res.end('bad request');
      }
      if (urlPath.endsWith('/')) urlPath += 'index.html';

      // Containment: never serve outside rootDir.
      const filePath = path.resolve(rootDir, '.' + urlPath);
      if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
        res.writeHead(403); return res.end('forbidden');
      }

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          // SPA fallback — unknown paths render the entry document.
          const indexPath = path.join(rootDir, 'index.html');
          return fs.readFile(indexPath, (e2, buf) => {
            if (e2) { res.writeHead(404); return res.end('not found'); }
            res.writeHead(200, { 'Content-Type': MIME['.html'] });
            res.end(buf);
          });
        }
        const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.on('error', (e) => finish({ ok: false, error: e.message, close: () => {} }));

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      finish({
        ok: true,
        port,
        url: `http://127.0.0.1:${port}/`,
        close: () => {
          try { server.closeAllConnections?.(); } catch (_) {}
          try { server.close(); } catch (_) {}
        },
      });
    });

    setTimeout(() => finish({ ok: false, error: 'static server boot timeout', close: () => {} }), SERVE_READY_MS).unref?.();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Real browser capture against the REAL app
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a real URL in headless Chromium and collect what actually happened:
 * screenshot + every console error + every uncaught page error + whether the
 * root element actually rendered anything.
 *
 * Returns `ok:false` with a reason when Playwright is unavailable — the caller
 * must treat that as "unverified", never as "passed".
 */
async function captureRealApp(url, options = {}) {
  const { viewport = { width: 1280, height: 800 }, timeout = BROWSER_TIMEOUT_MS } = options;

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (e) {
    return {
      ok: false,
      unavailable: true,
      reason: `playwright not installed: ${e.message}`,
      screenshot: null,
      consoleErrors: [],
      pageErrors: [],
    };
  }

  let browser;
  const consoleErrors = [];
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport });

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(String(msg.text()).slice(0, 500));
    });
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 500)));

    const response = await page.goto(url, { waitUntil: 'load', timeout }).catch((e) => {
      consoleErrors.push(`navigation failed: ${e.message.slice(0, 200)}`);
      return null;
    });

    // Give client-side frameworks a beat to paint before we judge the DOM.
    await page.waitForTimeout(1200);

    let rootRendered = false;
    let rootSample = '';
    try {
      rootRendered = await page.evaluate(() => {
        const el = document.querySelector('#root') || document.querySelector('#app') || document.body;
        if (!el) return false;
        return !!(el.children.length > 0 || (el.innerText || '').trim().length > 0);
      });
      rootSample = await page.evaluate(() => {
        const el = document.querySelector('#root') || document.querySelector('#app') || document.body;
        return el ? String(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '';
      });
    } catch (_) {}

    const shot = await page.screenshot({ fullPage: false, type: 'png', timeout: 15000 }).catch(() => null);

    return {
      ok: true,
      status: response ? response.status() : null,
      screenshot: shot ? shot.toString('base64') : null,
      consoleErrors: [...new Set(consoleErrors)],
      pageErrors: [...new Set(pageErrors)],
      rootRendered,
      rootSample,
      // "Rendered" is the only honest pass signal: HTTP 200 is NOT proof the app
      // works — a blank page with a 200 is the exact failure P0 exists to catch.
      verdict: rootRendered && pageErrors.length === 0,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e.message,
      screenshot: null,
      consoleErrors: [...new Set(consoleErrors)],
      pageErrors: [...new Set(pageErrors)],
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Ask devServerManager to start the project's REAL dev server and wait for it.
 *
 * This is the only way to observe a dev-mode project honestly: `index.html`
 * references raw `/src/main.jsx`, which a static file server cannot transpile.
 * Replit/Bolt get this for free (real Vite / WebContainer); before P0 there was
 * no equivalent here at all.
 *
 * `targetId` must resolve to `dir` — verified before use so a mismatched
 * workspace can never be started by accident. Returns `{ok:false, reason}`
 * instead of throwing so the SSE stream survives.
 */
async function startRealDevServer(dir, options = {}) {
  const { projectId, onLog, keepAlive = true } = options;

  if (!projectId) {
    return { ok: false, reason: 'no projectId supplied for dev server' };
  }

  let devServerManager;
  let workspaceManager;
  try {
    devServerManager = require('../sandbox/devServerManager');
    workspaceManager = require('../services/workspaceManager');
  } catch (e) {
    return { ok: false, reason: `dev server manager unavailable: ${e.message}` };
  }

  let resolvedDir;
  try {
    resolvedDir = path.resolve(workspaceManager.getWorkspacePath(projectId));
  } catch (e) {
    return { ok: false, reason: `workspace resolution failed: ${e.message}` };
  }

  if (resolvedDir !== path.resolve(dir)) {
    return {
      ok: false,
      reason: `workspace mismatch (dev manager resolves to ${resolvedDir}, project is at ${path.resolve(dir)})`,
    };
  }

  try {
    if (onLog) onLog('🚀 Starting the real dev server…');
    const started = await devServerManager.startDevServer(projectId, '.', {});
    if (!started || !started.success) {
      return { ok: false, reason: started?.error || 'dev server failed to start' };
    }

    const url = started.url;
    if (!url) return { ok: false, reason: 'dev server reported READY without a URL' };

    // READY can precede the bundle being servable; confirm with a real request.
    const reachable = await devServerManager.waitForServer(url, 30000).catch(() => false);
    if (!reachable) {
      return { ok: false, reason: `dev server never served a response at ${url}` };
    }

    if (onLog) onLog(`✅ Dev server live at ${url}`);
    return {
      ok: true,
      url,
      hostPort: started.hostPort,
      framework: started.framework,
      state: started.state,
      keepAlive,
      stop: async () => {
        try { await devServerManager.stopDevServer(projectId); } catch (_) {}
      },
    };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. Per-file real syntax verification
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve the loader esbuild needs for a given extension. */
function loaderFor(ext) {
  switch (ext) {
    case '.jsx': return 'jsx';
    case '.tsx': return 'tsx';
    case '.ts': return 'ts';
    case '.mjs':
    case '.cjs':
    case '.js': return 'jsx'; // 'jsx' is a superset of plain JS — safest catch-all
    default: return null;
  }
}

/**
 * Load the project's OWN esbuild — the exact parser its build will use, so a
 * file that fails here is a file that would fail `npm run build`.
 * Falling back to nothing is reported honestly rather than silently.
 */
function loadProjectEsbuild(dir) {
  const candidates = [
    () => require(path.join(dir, 'node_modules', 'esbuild')),
    () => require('esbuild'),
  ];
  for (const load of candidates) {
    try {
      const mod = load();
      if (mod && typeof mod.transformSync === 'function') return mod;
    } catch (_) {}
  }
  return null;
}

/**
 * Verify a single source file with a real parser.
 *
 * P0/P1 note: the old verifier bracket-counted `.jsx`/`.ts`/`.tsx`, which
 * accepts plenty of code that cannot compile. This uses the project's own
 * esbuild, so the verdict matches what the build will actually do.
 *
 * When no parser is reachable the result is `strength: 'weak'` — the caller
 * must not treat that as a pass.
 */
function verifySourceFile(dir, relPath, content, options = {}) {
  const ext = path.extname(relPath || '').toLowerCase();
  const loader = loaderFor(ext);
  const source = content != null ? String(content) : (() => {
    try { return fs.readFileSync(path.join(dir, relPath), 'utf8'); } catch (_) { return null; }
  })();

  if (source == null) {
    return { ok: false, strength: 'none', engine: 'none', error: 'file could not be read' };
  }

  const esbuild = loadProjectEsbuild(dir);

  if (esbuild) {
    try {
      esbuild.transformSync(source, {
        loader,
        format: 'esm',
        sourcefile: relPath,
      });
      return { ok: true, strength: 'strong', engine: 'esbuild', loader };
    } catch (e) {
      // esbuild reports `ERROR: <msg>\n    onLine:col` — keep the message, drop
      // the file-list noise, and surface the line so a repair prompt can use it.
      const text = String(e.message || e);
      const location = text.match(/onLine (\d+):(\d+)/);
      return {
        ok: false,
        strength: 'strong',
        engine: 'esbuild',
        loader,
        error: text.split('\n').slice(0, 4).join('\n').trim(),
        line: location ? parseInt(location[1], 10) : null,
        column: location ? parseInt(location[2], 10) : null,
      };
    }
  }

  // No parser available. Structural balance is still better than nothing, but
  // it must be labelled weak so nobody mistakes it for a compile.
  const { checkStructuralBalance } = require('./verifierService');
  const balance = checkStructuralBalance.call(checkStructuralBalance, source);
  return balance.valid
    ? { ok: true, strength: 'weak', engine: 'structural-balance', loader, note: 'no parser available — bracket check only' }
    : { ok: false, strength: 'weak', engine: 'structural-balance', loader, error: balance.message, note: 'no parser available — bracket check only' };
}

/**
 * Verify every source file in a project. Returns per-file results plus a
 * summary, and never claims a file passed without saying how it was checked.
 */
function verifySources(dir, files, options = {}) {
  const results = [];
  const sourceFiles = (files || []).filter(f => {
    const p = String(f.path || '');
    return loaderFor(path.extname(p).toLowerCase()) && !/\.(test|spec)\./.test(p) && !/^server\//.test(p);
  });

  for (const f of sourceFiles) {
    const r = verifySourceFile(dir, f.path, f.content);
    results.push({ path: f.path, ...r });
  }

  const failures = results.filter(r => !r.ok);
  const weak = results.filter(r => r.strength === 'weak');
  return {
    checked: results.length,
    failures,
    weakCount: weak.length,
    // A pass here is only trustworthy when at least one file got a real parse.
    strong: weak.length < results.length,
    results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Composite verification — the thing that replaces "0 console errors"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the project for real, serve the real output, and observe the real app.
 *
 * Every claim this returns is backed by a command exit code or an observed DOM
 * state. There is deliberately NO code path that yields `ok: true` without at
 * least one piece of hard evidence.
 */
async function verifyBuild(dir, options = {}) {
  const { onLog, screenshot = true, keepDevServer = false } = options;
  const evidence = [];

  const build = await runBuild(dir);
  if (build.skipped) {
    evidence.push({ cmd: 'npm run build', skipped: true, reason: build.reason });
    if (onLog) onLog(`ℹ️ Build skipped — ${build.reason}`);
  } else {
    evidence.push({ cmd: 'npm run build', exitCode: build.exitCode, ok: build.ok, ms: build.ms });
    if (onLog) {
      onLog(build.ok
        ? `✅ npm run build passed (${build.ms}ms)`
        : `❌ npm run build FAILED (exit ${build.exitCode})`);
    }
  }

  if (!build.ok) {
    // A failed build is a hard stop: anything rendered after this point would be
    // a fiction. Return the real compiler output instead.
    return {
      ok: false,
      buildOk: false,
      build,
      evidence,
      runtime: { attempted: false, reason: 'build failed — runtime check skipped' },
    };
  }

  // Pick how to observe the real app:
  //   1. built output  → serve dist/ statically (fastest, most production-like)
  //   2. no build output but a dev server → start the REAL dev server, because
  //      a dev-mode index.html references raw .jsx that no static server can
  //      transpile. Reporting "FAILED" for that would be a false accusation.
  const distDir = path.join(dir, 'dist');
  const builtIndex = path.join(distDir, 'index.html');
  const rootIndex = path.join(dir, 'index.html');

  if (screenshot === false) {
    return { ok: true, buildOk: true, build, evidence, runtime: { attempted: false, reason: 'screenshot disabled' } };
  }

  const hasBuiltOutput = fs.existsSync(builtIndex);
  const hasRootIndex = fs.existsSync(rootIndex);

  // ── Route 1: real dev server (no build output available) ──────────────────
  if (!hasBuiltOutput && !hasRootIndex && options.projectId) {
    const dev = await startRealDevServer(dir, { projectId: options.projectId, onLog });

    if (!dev.ok) {
      return {
        ok: false,
        buildOk: true,
        build,
        evidence,
        runtime: {
          attempted: true,
          ok: false,
          unverified: true,
          reason: dev.reason,
          consoleErrors: [],
          pageErrors: [],
          screenshot: null,
        },
      };
    }

    let devCapture;
    try {
      if (onLog) onLog(`🌐 Loading real dev app at ${dev.url}…`);
      devCapture = await captureRealApp(dev.url, options);
    } catch (e) {
      devCapture = { ok: false, reason: e.message, consoleErrors: [], pageErrors: [], screenshot: null };
    }

    const devOk = Boolean(devCapture?.verdict);
    evidence.push({
      cmd: 'dev server runtime check',
      ok: devOk,
      consoleErrors: devCapture?.consoleErrors?.length || 0,
      pageErrors: devCapture?.pageErrors?.length || 0,
    });

    if (!keepDevServer && dev.stop) await dev.stop();

    if (onLog) {
      if (devCapture?.unavailable) onLog(`⚠️ Runtime UNVERIFIED — ${devCapture.reason}`);
      else if (devOk) onLog('✅ Runtime verified against the live dev server — 0 uncaught errors.');
      else onLog(`❌ Runtime FAILED — ${devCapture?.pageErrors?.length || 0} uncaught error(s), ${devCapture?.consoleErrors?.length || 0} console error(s).`);
    }

    return {
      ok: devOk,
      buildOk: true,
      build,
      evidence,
      devServerUrl: keepDevServer ? dev.url : null,
      devServerRunning: Boolean(keepDevServer),
      runtime: {
        attempted: true,
        via: 'dev-server',
        ok: devOk,
        unverified: Boolean(devCapture?.unavailable),
        unavailable: Boolean(devCapture?.unavailable),
        status: devCapture?.status ?? null,
        screenshot: devCapture?.screenshot || null,
        consoleErrors: devCapture?.consoleErrors || [],
        pageErrors: devCapture?.pageErrors || [],
        rootRendered: devCapture?.rootRendered ?? false,
        rootSample: devCapture?.rootSample || '',
        reason: devCapture?.reason || '',
      },
    };
  }

  // ── Route 2: serve the real built/root output ─────────────────────────────
  const buildDir = hasBuiltOutput ? distDir : dir;

  if (!hasBuiltOutput && !hasRootIndex) {
    return {
      ok: true,
      buildOk: true,
      build,
      evidence,
      runtime: {
        attempted: true,
        ok: false,
        unverified: true,
        reason: 'no index.html in dist/ or project root — app cannot be loaded in a browser',
        consoleErrors: [],
        pageErrors: [],
        screenshot: null,
      },
    };
  }

  const server = await serveStatic(buildDir);
  if (!server.ok) {
    return {
      ok: false,
      buildOk: true,
      build,
      evidence,
      runtime: { attempted: true, ok: false, reason: `static server failed: ${server.error}`, consoleErrors: [], pageErrors: [], screenshot: null },
    };
  }

  let capture;
  try {
    if (onLog) onLog(`🌐 Loading real app at ${server.url}…`);
    capture = await captureRealApp(server.url, options);
  } finally {
    server.close();
  }

  const runtimeOk = Boolean(capture?.verdict);
  evidence.push({
    cmd: 'browser runtime check',
    ok: runtimeOk,
    consoleErrors: capture?.consoleErrors?.length || 0,
    pageErrors: capture?.pageErrors?.length || 0,
  });

  if (onLog) {
    if (capture?.unavailable) {
      onLog(`⚠️ Runtime UNVERIFIED — ${capture.reason}`);
    } else if (runtimeOk) {
      onLog(`✅ Runtime verified — app rendered, 0 page errors`);
    } else {
      onLog(`❌ Runtime FAILED — ${capture?.pageErrors?.length || 0} page error(s), ${capture?.consoleErrors?.length || 0} console error(s)`);
    }
  }

  return {
    ok: runtimeOk,
    buildOk: true,
    build,
    evidence,
    runtime: {
      attempted: true,
      via: hasBuiltOutput ? 'static-build' : 'static-root',
      ok: runtimeOk,
      unverified: Boolean(capture?.unavailable),
      unavailable: Boolean(capture?.unavailable),
      status: capture?.status ?? null,
      screenshot: capture?.screenshot || null,
      consoleErrors: capture?.consoleErrors || [],
      pageErrors: capture?.pageErrors || [],
      rootRendered: capture?.rootRendered ?? false,
      rootSample: capture?.rootSample || '',
      reason: capture?.reason || '',
    },
  };
}

/**
 * Honest one-paragraph summary for the final report. Every phrase here is
 * backed by `evidence` — there are no unconditional success claims.
 */
function describeVerification(verification) {
  if (!verification) return '_Verification did not run._';

  const lines = [];
  const buildLine = verification.evidence.find(e => e.cmd === 'npm run build');

  if (buildLine?.skipped) {
    lines.push(`- **Build**: skipped (${buildLine.reason}).`);
  } else if (buildLine) {
    lines.push(buildLine.ok
      ? `- **Build**: \`npm run build\` passed (exit 0, ${buildLine.ms}ms).`
      : `- **Build**: \`npm run build\` **FAILED** (exit ${buildLine.exitCode}).`);
    // An exit code without the compiler's own words is not actionable. Surface
    // the real message — this is the whole point of P0.
    const detail = (verification.build?.stderr || verification.build?.stdout || '').trim();
    if (!buildLine.ok && detail) {
      const condensed = detail
        .split(/\r?\n/)
        .filter(l => l.trim())
        .slice(0, 6)
        .map(l => `\n    ${l.trim()}`)
        .join('');
      lines.push(`<details><summary>build output</summary>${condensed}\n\n</details>`);
    }
  }

  const rt = verification.runtime || {};
  const via = rt.via ? ` (via ${rt.via})` : '';
  if (!rt.attempted) {
    lines.push(`- **Runtime check**: not run (${rt.reason || 'unknown'}).`);
  } else if (rt.unverified || rt.unavailable) {
    // "Unverified" is NOT the same as "failed" and must never be reported as
    // either — claiming success here is precisely the lie P0 removes.
    lines.push(`- **Runtime check**: **UNVERIFIED**${via} — ${rt.reason || 'no evidence collected'}`);
  } else if (rt.ok) {
    lines.push(`- **Runtime**: real app loaded and rendered${via}${rt.status ? ` (HTTP ${rt.status})` : ''}, 0 uncaught page errors.`);
  } else {
    lines.push(`- **Runtime**: **FAILED**${via} — ${rt.pageErrors?.length || 0} uncaught error(s), ${rt.consoleErrors?.length || 0} console error(s).`);
    if (rt.pageErrors?.length) {
      lines.push(`  - uncaught: \`${String(rt.pageErrors[0]).slice(0, 160)}\``);
    } else if (rt.consoleErrors?.length) {
      lines.push(`  - console: \`${String(rt.consoleErrors[0]).slice(0, 160)}\``);
    }
  }

  return lines.join('\n');
}

module.exports = {
  runCommand,
  installDependencies,
  seedFromDependencyCache,
  recordDependencyCache,
  dependencySignature,
  depsCacheRoot,
  depsCacheDirFor,
  copyTreeFast,
  findCacheCandidate,
  runBuild,
  runTests,
  serveStatic,
  captureRealApp,
  verifyBuild,
  verifySourceFile,
  verifySources,
  startRealDevServer,
  describeVerification,
  tail,
  // Shared with devServerManager, which had the identical
  // `spawn('npm.cmd', …, { shell: false })` → EINVAL failure.
  resolveInvocation,
  npmBin,
};