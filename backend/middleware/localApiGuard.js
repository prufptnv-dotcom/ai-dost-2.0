'use strict';

/**
 * Shared API access guard for AI-Dost local backend.
 *
 * Tier A (default / "apiGuard"):
 *   - Blocks cross-site browser requests (Sec-Fetch-Site: cross-site)
 *   - Blocks non-local Origin headers (when present and not local)
 *   - Blocks public (non-private) remote IPs unless ALLOW_PUBLIC_API=1
 *
 * Tier B ("execGuard") — for code-exec / filesystem-dangerous endpoints:
 *   - Everything in Tier A
 *   - Additionally the raw TCP PEER must be loopback or a Docker bridge
 *     network (10/8, 172.16-31/12). Home LAN 192.168.x is BLOCKED for
 *     Tier B unless ALLOW_REMOTE_EXEC=1.
 *   - P3 #10: 192.168/16 is no longer treated as a Docker network here —
 *     the old code allowed exactly the range this comment forbids.
 *   - P3 #31: the Tier B decision reads the socket peer, never the
 *     X-Forwarded-For-derived req.ip, so a local proxy cannot promote a
 *     remote caller to exec-tier.
 *
 * Escape hatches (local dev / custom deployments):
 *   - ALLOW_PUBLIC_API=1  → skip public-IP block (Tier A)
 *   - ALLOW_REMOTE_EXEC=1 → skip Tier B local-network restriction
 */

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', '0.0.0.0', '::']);

function normalizeIp(ip) {
  if (!ip) return '';
  // strip IPv4-mapped IPv6 prefix
  return String(ip).replace(/^::ffff:/i, '');
}

function isLoopback(ip) {
  const v = normalizeIp(ip);
  return v === '127.0.0.1' || v === '::1' || v.startsWith('127.');
}

function isPrivateIp(ip) {
  const v = normalizeIp(ip);
  if (!v) return false;
  if (isLoopback(v)) return true;
  // 10.0.0.0/8
  if (/^10\./.test(v)) return true;
  // 172.16.0.0/12
  const m172 = v.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  // 192.168.0.0/16
  if (/^192\.168\./.test(v)) return true;
  // IPv6 link-local / ULA
  if (/^f[cd]/i.test(v)) return true;
  return false;
}

function isDockerNetwork(ip) {
  const v = normalizeIp(ip);
  if (!v) return false;
  const m172 = v.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^10\./.test(v)) return true;
  // P3 #10: 192.168/16 is home-LAN, NOT a Docker bridge — exec tier must
  // block it (Tier A still allows it via isPrivateIp). Override with
  // ALLOW_REMOTE_EXEC=1 for compose stacks that use a custom 192.168 subnet.
  if (/^f[cd]/i.test(v)) return true;
  return false;
}

function localOrigin(origin) {
  if (!origin) return true; // non-browser client
  try {
    const u = new URL(origin);
    const host = u.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.localhost') ||
      isPrivateIp(host)
    );
  } catch (_) {
    return false;
  }
}

function clientIp(req) {
  // With app.set('trust proxy', 'loopback') Express gives the real client
  // for proxied requests; fall back to socket address.
  const raw = (req.ip || req.socket?.remoteAddress || '').trim();
  return normalizeIp(raw);
}

/**
 * Raw TCP peer of the connection (never derived from X-Forwarded-For).
 * P3 #31: exec-tier policy must be decided on the peer, otherwise any local
 * process that proxies with a forged `X-Forwarded-For: 127.0.0.1` could
 * promote itself to loopback/exec-tier.
 */
function peerIp(req) {
  const raw = (req.socket && req.socket.remoteAddress) || '';
  return normalizeIp(raw.trim());
}

function isCrossSiteBrowser(req) {
  const sfs = (req.get && req.get('sec-fetch-site')) || '';
  if (String(sfs).toLowerCase() === 'cross-site') return true;
  // Foreign Origin on a state-changing/sensitive request
  const origin = (req.get && req.get('origin')) || '';
  if (origin && !localOrigin(origin)) return true;
  return false;
}

function deny(res, message) {
  return res.status(403).json({ error: message, code: 'LOCAL_ONLY' });
}

/** Tier A — applied broadly to /api */
function apiGuard(req, res, next) {
  try {
    if (isCrossSiteBrowser(req)) {
      return deny(res, 'Cross-site API request blocked');
    }
    const ip = clientIp(req);
    if (!isPrivateIp(ip) && process.env.ALLOW_PUBLIC_API !== '1') {
      return deny(res, 'Non-local API access blocked (set ALLOW_PUBLIC_API=1 to override)');
    }
    return next();
  } catch (_) {
    // Fail closed on guard errors
    return deny(res, 'Access guard error');
  }
}

/** Tier B — code execution / dangerous filesystem endpoints */
function execGuard(req, res, next) {
  try {
    if (isCrossSiteBrowser(req)) {
      return deny(res, 'Cross-site API request blocked');
    }
    const ip = clientIp(req);
    if (process.env.ALLOW_PUBLIC_API !== '1' && !isPrivateIp(ip)) {
      return deny(res, 'Non-local API access blocked');
    }
    if (process.env.ALLOW_REMOTE_EXEC === '1') return next();
    // P3 #31: the exec-tier decision uses the raw TCP peer only — XFF-derived
    // req.ip (influenced by any local proxy) can never grant exec-tier.
    const peer = peerIp(req) || ip;
    if (isLoopback(peer) || isDockerNetwork(peer)) return next();
    return deny(res, 'Code-execution endpoints are local/Docker-only (set ALLOW_REMOTE_EXEC=1 to override)');
  } catch (_) {
    return deny(res, 'Access guard error');
  }
}

/**
 * Shared gate for HTTP upgrade (raw WebSocket) requests.
 *
 * Raw `server.on('upgrade')` handlers bypass Express middleware entirely —
 * apiGuard/execGuard never see them. Every raw WS server (sandbox, LSP,
 * terminal, …) must call this BEFORE `wss.handleUpgrade(...)` so upgrades
 * get the same origin/IP bar as their HTTP counterparts.
 *
 * tier 'api'  → local Origin + private (RFC1918/loopback/ULA) peer  [apiGuard bar]
 * tier 'exec' → tier 'api' + loopback/Docker bridge only            [execGuard bar]
 *
 * Fails closed: any unexpected error denies the upgrade.
 * Returns { allowed: boolean, reason: string|null }.
 */
function upgradeGuard(request, tier = 'api') {
  try {
    const origin = (request && request.headers && request.headers.origin) || '';
    if (origin && !localOrigin(origin)) {
      return { allowed: false, reason: 'cross-origin' };
    }
    const ip = normalizeIp((request && request.socket && request.socket.remoteAddress) || '');
    if (!ip) return { allowed: false, reason: 'unknown-peer' };
    if (!isPrivateIp(ip) && process.env.ALLOW_PUBLIC_API !== '1') {
      return { allowed: false, reason: 'public-peer' };
    }
    if (tier === 'exec' && process.env.ALLOW_REMOTE_EXEC !== '1') {
      if (!(isLoopback(ip) || isDockerNetwork(ip))) {
        return { allowed: false, reason: 'exec-tier-peer' };
      }
    }
    return { allowed: true, reason: null };
  } catch (_) {
    return { allowed: false, reason: 'guard-error' };
  }
}

module.exports = {
  apiGuard,
  execGuard,
  upgradeGuard,
  isLoopback,
  isPrivateIp,
  isDockerNetwork,
  localOrigin,
  clientIp,
  peerIp,
};
