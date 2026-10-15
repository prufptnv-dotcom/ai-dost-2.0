const crypto = require('crypto');

/**
 * P1 FIX (#12): stable anonymous identity for non-local callers.
 *
 * Runs before every route so the identity is known on the FIRST request —
 * we mint the id server-side and hand it back via Set-Cookie (no
 * chicken-and-egg: the response that triggers the cookie already knows the id).
 *
 * - Value is a UUID and is format-validated on every read, so a client can
 *   never squat a privileged id such as `local-user`.
 * - HttpOnly + SameSite=Lax: scripts can't read it, cross-site POSTs don't
 *   carry it (same-site XHR from the Next origin does).
 * - Cookie is appended with res.cookie() so any other Set-Cookie
 *   (e.g. auth refresh tokens) on the response is preserved.
 */

const COOKIE_NAME = 'ad_uid';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string' || !header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch (_) {
      out[k] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

function isValidUid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function anonIdentity(req, res, next) {
  try {
    if (!isValidUid(req.adUid)) {
      let uid = null;
      const raw = parseCookies(req.headers && req.headers.cookie)[COOKIE_NAME];
      if (isValidUid(raw)) {
        uid = raw;
      } else {
        uid = crypto.randomUUID();
        res.cookie(COOKIE_NAME, uid, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 365 * 24 * 60 * 60 * 1000,
          secure: process.env.NODE_ENV === 'production',
        });
      }
      req.adUid = uid;
    }
  } catch (_) {
    // Identity must never break a request; resolveUser falls back to an
    // IP-derived id when req.adUid is missing.
  }
  next();
}

anonIdentity.COOKIE_NAME = COOKIE_NAME;
anonIdentity.isValidUid = isValidUid;
anonIdentity.parseCookies = parseCookies;

module.exports = anonIdentity;
