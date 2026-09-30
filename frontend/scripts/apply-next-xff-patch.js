#!/usr/bin/env node
/**
 * AI-Dost: forward the REAL client IP through the Next.js rewrite proxy.
 *
 * Why: Next's rewrite proxy (dist/server/lib/router-utils/proxy-request.js)
 * forwards a client-supplied `x-forwarded-for` VERBATIM and adds nothing itself
 * (verified empirically on next@16.2.12). The backend therefore sees every
 * proxied request as loopback (or as whatever IP the client forged), which is
 * the root cause of BUG_REPORT #11 (rate-limit bypass), #12/#13 (identity /
 * conversation ownership spoof) and a spoof path around the P0 execGuard.
 *
 * Fix: overwrite `x-forwarded-for` with the TCP peer address right before the
 * request is proxied to the backend, so Express `trust proxy` can resolve the
 * true client IP (direct LAN clients are already handled correctly by Express,
 * which ignores X-Forwarded-For from untrusted sockets).
 *
 * This script is idempotent and safe to run on every `npm install`
 * (frontend/package.json -> postinstall). If the anchor code is not found
 * (e.g. a future Next.js upgrade restructured the file) it prints a loud
 * warning instead of breaking the install.
 *
 * Marker: AI-DOST:XFF-FORWARD
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  '..',
  'node_modules',
  'next',
  'dist',
  'server',
  'lib',
  'router-utils',
  'proxy-request.js'
);

const MARKER = 'AI-DOST:XFF-FORWARD';

const ANCHOR = 'const HttpProxy = require(\'next/dist/compiled/http-proxy\');';

const SNIPPET = [
  `    // ${MARKER}: Next rewrite proxy drops the real client IP and forwards any`,
  '    // client-supplied X-Forwarded-For verbatim. Overwrite it with the TCP peer so',
  '    // the backend can trust req.ip for rate limiting and identity (BUG_REPORT #11-#14).',
  '    try {',
  '        const __adXff = (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || \'\';',
  '        if (__adXff) req.headers[\'x-forwarded-for\'] = __adXff;',
  '    } catch (_) {}',
  ANCHOR,
].join('\n');

function main() {
  if (!fs.existsSync(TARGET)) {
    // Next not installed (e.g. backend-only checkout or Docker stage) -> nothing to do.
    console.log('[ai-dost-xff-patch] next not installed, skipping.');
    return;
  }
  const src = fs.readFileSync(TARGET, 'utf8');
  if (src.includes(MARKER)) {
    console.log('[ai-dost-xff-patch] already applied.');
    return;
  }
  if (!src.includes(ANCHOR)) {
    console.warn(
      '[ai-dost-xff-patch] WARNING: anchor not found in proxy-request.js ' +
        '(Next.js internals changed?). The real client IP will NOT be forwarded ' +
        'to the backend through rewrites — proxied requests will appear local. ' +
        'Re-check node_modules/next/dist/server/lib/router-utils/proxy-request.js'
    );
    process.exitCode = 0;
    return;
  }
  fs.writeFileSync(TARGET, src.replace(ANCHOR, SNIPPET), 'utf8');
  console.log('[ai-dost-xff-patch] applied to proxy-request.js');
}

main();
