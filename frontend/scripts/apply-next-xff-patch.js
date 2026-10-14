#!/usr/bin/env node
/**
 * Harden the Next.js rewrite proxy's X-Forwarded-For handling.
 *
 * Next.js passes request headers through its rewrite proxy. If the browser's
 * supplied X-Forwarded-For value is preserved, the backend can make security
 * decisions based on an attacker-controlled IP. Pin the outgoing value to the
 * socket peer observed by this Next.js process.
 *
 * The patch is anchored on the x-forwarded-host entry inside the ProxyServer
 * headers object (not at module scope). It is intentionally idempotent and
 * fails the install if Next.js changes that contract so the security behavior
 * cannot silently disappear after a dependency update.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
const HOST_HEADER_RE = /^([ \t]*)(["']x-forwarded-host["'][ \t]*:[ \t]*req\.headers\.host[ \t]*\|\|[ \t]*["']{2},?)[ \t]*$/m;

function patchSource(source) {
  if (source.includes(MARKER)) return { source, alreadyPatched: true };

  const match = HOST_HEADER_RE.exec(source);
  if (!match) return { source, alreadyPatched: false, error: 'Expected x-forwarded-host header inside Next.js rewrite proxy was not found.' };

  const indent = match[1];
  const hostHeader = match[2];
  const insertedHeaders = [
    `${indent}// ${MARKER}: never trust a caller-supplied X-Forwarded-For value`,
    `${indent}'x-forwarded-for': (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '',`,
    `${indent}${hostHeader}`,
  ].join('\n');

  return {
    source: source.replace(HOST_HEADER_RE, insertedHeaders),
    alreadyPatched: false,
  };
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.log('[ai-dost-xff-patch] Next.js proxy file not present; skipping this non-frontend install.');
    return;
  }

  const original = fs.readFileSync(TARGET, 'utf8');
  const result = patchSource(original);
  if (result.error) {
    console.error(`[ai-dost-xff-patch] ERROR: ${result.error} Target: ${TARGET}`);
    console.error('[ai-dost-xff-patch] Refusing to continue with unverified proxy IP handling.');
    process.exitCode = 1;
    return;
  }
  if (result.alreadyPatched) {
    console.log('[ai-dost-xff-patch] already applied.');
    return;
  }

  fs.writeFileSync(TARGET, result.source, 'utf8');
  const check = fs.readFileSync(TARGET, 'utf8');
  if (!check.includes(MARKER) || !check.includes("'x-forwarded-for':")) {
    console.error('[ai-dost-xff-patch] ERROR: post-write verification failed.');
    process.exitCode = 1;
    return;
  }
  console.log('[ai-dost-xff-patch] applied and verified in ProxyServer headers.');
}

if (require.main === module) main();

module.exports = { patchSource, HOST_HEADER_RE, MARKER };
