'use strict';

// P3 #66 — one helper for backend-to-itself HTTP calls.
// The old pattern `http://127.0.0.1:${process.env.PORT || 5000}` (4 call
// sites: research, documents, telegram x2) broke when the server binds a
// different interface (Docker 0.0.0.0 mapping, IPv6-only, HOST env) — the
// loopback fallback could miss the actual listener. Resolution order:
//   1. BACKEND_SELF_URL  — explicit override (e.g. http://[::1]:5000)
//   2. HOST env          — if it is a concrete address (not 0.0.0.0/::)
//   3. http://127.0.0.1:<port> — historical default
function selfBaseUrl() {
  const explicit = process.env.BACKEND_SELF_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().replace(/\/+$/, '');
  }
  const port = process.env.PORT || 5000;
  const host = (process.env.HOST || '').trim();
  if (host && !['0.0.0.0', '::', '::0', '*'].includes(host)) {
    const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
    return `http://${urlHost}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

module.exports = { selfBaseUrl };
