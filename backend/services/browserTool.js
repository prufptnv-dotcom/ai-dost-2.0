/**
 * browserTool — P9 headless Chromium session for the ReAct loop.
 *
 * The agent can now LOOK at what it built: navigate → snapshot (visible text +
 * interactive elements) → click/type → screenshot, all on one persistent page
 * so state (SPA routes, form input) carries across calls.
 *
 * SSRF policy (self-hosted tool, but still a fetch-from-user-prompt surface):
 *  - http/https only, no credentials-in-URL;
 *  - loopback (localhost / 127.x / ::1) allowed on ANY port — that's the whole
 *    point (preview verification);
 *  - literal private/link-local/metadata IPs blocked (169.254.169.254 etc.);
 *  - public hostnames are DNS-resolved first and every resolved address must
 *    be loopback-or-public (blocks DNS-rebinding to internal services).
 *
 * `urlPolicy()` + `isPrivateIp()` are pure/exported for unit tests; the
 * Playwright bits are lazy-loaded so requiring this file costs nothing.
 */
const logger = require('../logger');
const dns = require('dns').promises;

// ── Pure policy helpers (unit-tested) ────────────────────────────────────────

function isLoopbackIp(ip) {
  if (!ip) return false;
  const v = String(ip).split('%')[0].toLowerCase();
  if (v === '::1') return true;
  const v4 = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) return Number(v4[1]) === 127;
  return false;
}

/** true = private / link-local / reserved (NOT safe to fetch as a "public" target). */
function isPrivateIp(ip) {
  if (!ip) return true; // unknown = unsafe
  const v = String(ip).split('%')[0].toLowerCase();
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true; // malformed = unsafe
    if (a === 10) return true;                                    // 10/8
    if (a === 127) return true;                                   // loopback (handled as allowed by callers)
    if (a === 169 && b === 254) return true;                      // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16/12
    if (a === 192 && b === 168) return true;                      // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT 100.64/10
    if (a === 0) return true;                                     // 0/8
    return false;
  }
  // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10)
  if (v === '::' || v === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(v)) return true;
  return false;
}

const BLOCKED_HOSTS = new Set(['metadata.google.internal', 'instance-data', 'metadata', 'metadata.google']);

/**
 * Synchronous first gate: protocol / credentials / literal-IP checks.
 * Returns { ok: true, url } or { ok: false, reason }.
 */
function urlPolicy(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return { ok: false, reason: 'URL is required' };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return { ok: false, reason: `Invalid URL: ${raw.slice(0, 120)}` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Only http/https URLs allowed (got ${parsed.protocol})` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Credentials in URL are not allowed' };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.internal') || host === 'metadata.azure.com') {
    return { ok: false, reason: `Blocked internal metadata host: ${host}` };
  }
  if (isLoopbackIp(host) || host === 'localhost' || host.endsWith('.localhost')) {
    return { ok: true, url: parsed.toString(), hostname: host, loopback: true };
  }
  // Literal IP? Apply the private-range rule now (no DNS involved).
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (looksLikeIp) {
    if (isPrivateIp(host)) {
      return { ok: false, reason: `Blocked private/link-local address: ${host}` };
    }
    return { ok: true, url: parsed.toString(), hostname: host, loopback: false };
  }
  return { ok: true, url: parsed.toString(), hostname: host, loopback: false, needsDns: true };
}

/** Async second gate for public hostnames: every resolved address loopback-or-public. */
async function assertResolvesSafe(url) {
  const policy = urlPolicy(url);
  if (!policy.ok) return policy;
  if (!policy.needsDns) return policy;
  let addresses;
  try {
    addresses = await dns.lookup(policy.hostname, { all: true });
  } catch (e) {
    return { ok: false, reason: `DNS lookup failed for ${policy.hostname}: ${e.code || e.message}` };
  }
  if (!addresses.length) return { ok: false, reason: `No DNS records for ${policy.hostname}` };
  const bad = addresses.find((a) => !isLoopbackIp(a.address) && isPrivateIp(a.address));
  if (bad) {
    return { ok: false, reason: `${policy.hostname} resolves to private address ${bad.address} — blocked` };
  }
  return policy;
}

// ── Persistent session ───────────────────────────────────────────────────────

const IDLE_CLOSE_MS = 10 * 60 * 1000; // auto-release chromium when unused
const session = { browser: null, page: null, consoleErrors: [], lastUsed: 0, lastUrl: null };

let idleTimer = null;
function touchIdleTimer() {
  session.lastUsed = Date.now();
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(async () => {
    if (Date.now() - session.lastUsed < IDLE_CLOSE_MS) return;
    clearInterval(idleTimer);
    idleTimer = null;
    try {
      await closeSession();
      logger.info('[BrowserTool] Idle browser session closed');
    } catch (_) { /* already gone */ }
  }, 60 * 1000);
  if (typeof idleTimer.unref === 'function') idleTimer.unref();
}

async function ensureSession() {
  if (session.page && !session.page.isClosed()) {
    touchIdleTimer();
    return session.page;
  }
  const { chromium } = require('playwright');
  session.browser = await chromium.launch({ headless: true });
  const context = await session.browser.newContext({ viewport: { width: 1280, height: 800 } });
  session.page = await context.newPage();
  session.consoleErrors = [];
  session.page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    session.consoleErrors.push(String(msg.text()).slice(0, 300));
    if (session.consoleErrors.length > 30) session.consoleErrors.shift();
  });
  session.page.on('pageerror', (err) => {
    session.consoleErrors.push(`pageerror: ${String(err && err.message ? err.message : err).slice(0, 300)}`);
    if (session.consoleErrors.length > 30) session.consoleErrors.shift();
  });
  touchIdleTimer();
  return session.page;
}

async function closeSession() {
  try { if (session.browser) await session.browser.close(); } catch (_) { /* already dead */ }
  session.browser = null;
  session.page = null;
  session.consoleErrors = [];
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function navigate(rawUrl) {
  const gate = await assertResolvesSafe(rawUrl);
  if (!gate.ok) return { success: false, error: `navigation blocked: ${gate.reason}` };
  const page = await ensureSession();
  const response = await page.goto(gate.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Give SPAs a beat to mount before snapshot/screenshot.
  await page.waitForTimeout(300);
  session.lastUrl = page.url();
  const title = await page.title().catch(() => '');
  let textPreview = '';
  try {
    textPreview = String(await page.evaluate(() => (document.body && document.body.innerText) || '')).slice(0, 1200);
  } catch (_) { /* detached document */ }
  return {
    success: true,
    url: page.url(),
    title,
    status: response ? response.status() : null,
    textPreview,
    message: `Loaded ${page.url()} (HTTP ${response ? response.status() : '?'}) — "${title}"`,
  };
}

async function snapshot() {
  const page = await ensureSession();
  if (!page.url() || page.url() === 'about:blank') {
    return { success: false, error: 'No page loaded — call browser_navigate first.' };
  }
  const info = await page.evaluate(() => {
    const body = document.body || {};
    const text = String(body.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 4000);
    const elements = [];
    const nodes = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"], [onclick]');
    for (let i = 0; i < nodes.length && elements.length < 40; i++) {
      const el = nodes[i];
      const name = String(
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.textContent ||
        ''
      ).trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!name && el.tagName !== 'INPUT') continue;
      let selector = null;
      if (el.id) selector = `#${el.id}`;
      else {
        const tid = el.getAttribute('data-testid');
        if (tid) selector = `[data-testid="${tid}"]`;
        else {
          const aria = el.getAttribute('aria-label');
          if (aria) selector = `[aria-label="${aria}"]`;
        }
      }
      elements.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || undefined, name, selector });
    }
    return { url: location.href, title: document.title, text, elements };
  });
  return {
    success: true,
    url: info.url,
    title: info.title,
    text: info.text,
    elements: info.elements,
    consoleErrors: session.consoleErrors.slice(-10),
    message: `Snapshot of ${info.url} — ${info.elements.length} interactive element(s)`,
  };
}

async function click(selectorOrText) {
  const target = String(selectorOrText || '').trim();
  if (!target) return { success: false, error: 'selector (or visible text) is required for browser_click' };
  const page = await ensureSession();
  try {
    await page.locator(target).first().click({ timeout: 5000 });
  } catch (cssErr) {
    try {
      await page.getByText(target, { exact: false }).first().click({ timeout: 5000 });
    } catch (textErr) {
      return { success: false, error: `click failed — no element for selector or text "${target.slice(0, 80)}" (${textErr.message.split('\n')[0]})` };
    }
  }
  await page.waitForTimeout(250);
  session.lastUrl = page.url();
  return { success: true, url: page.url(), message: `Clicked "${target.slice(0, 80)}" → now at ${page.url()}` };
}

async function typeInto(selector, value) {
  const target = String(selector || '').trim();
  if (!target) return { success: false, error: 'selector is required for browser_type' };
  if (value === undefined || value === null) return { success: false, error: 'value is required for browser_type' };
  const page = await ensureSession();
  const fillValue = String(value);
  try {
    await page.locator(target).first().fill(fillValue, { timeout: 5000 });
  } catch (cssErr) {
    try {
      await page.getByPlaceholder(target, { exact: false }).first().fill(fillValue, { timeout: 5000 });
    } catch (phErr) {
      return { success: false, error: `type failed — no input for selector "${target.slice(0, 80)}" (${phErr.message.split('\n')[0]})` };
    }
  }
  return { success: true, message: `Typed into "${target.slice(0, 80)}"` };
}

async function screenshot() {
  const page = await ensureSession();
  if (!page.url() || page.url() === 'about:blank') {
    return { success: false, error: 'No page loaded — call browser_navigate first.' };
  }
  const buffer = await page.screenshot({ fullPage: true, type: 'png' });
  return {
    success: true,
    screenshot: buffer.toString('base64'),
    mimeType: 'image/png',
    url: page.url(),
    message: `Full-page screenshot of ${page.url()}`,
  };
}

/**
 * Single entry point for the executeTool switch.
 * @param {string} action one of browser_navigate|snapshot|click|type|screenshot|close
 * @param {object} parameters {url} / {selector} / {selector, value}
 */
async function execute(action, parameters = {}) {
  try {
    switch (action) {
      case 'browser_navigate': return navigate(parameters.url);
      case 'browser_snapshot': return snapshot();
      case 'browser_click': return click(parameters.selector || parameters.text || parameters.target);
      case 'browser_type': return typeInto(parameters.selector || parameters.target, parameters.value !== undefined ? parameters.value : parameters.content);
      case 'browser_screenshot': return screenshot();
      case 'browser_close': {
        await closeSession();
        if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
        return { success: true, message: 'Browser session closed.' };
      }
      default:
        return { success: false, error: `browserTool: unknown action ${action}` };
    }
  } catch (e) {
    logger.warn(`[BrowserTool] ${action} failed: ${e.message}`);
    return { success: false, error: `${action} failed: ${e.message}` };
  }
}

module.exports = {
  execute,
  // pure helpers (exported for unit tests + reuse by take_screenshot)
  urlPolicy,
  assertResolvesSafe,
  isPrivateIp,
  isLoopbackIp,
  closeSession,
};
