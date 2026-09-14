/*
 * Runtime hardening preloader.
 *
 * server.js is intentionally kept stable while production-only policy is
 * enforced here. Load with:
 *   node -r ./security-hardening.js server.js
 *
 * Policies:
 * - CORS is deny-by-default in production and uses CORS_ORIGINS/FRONTEND_URL.
 * - JSON parsing is small by default, with explicit large-route allowlisting.
 * - AI response finish/close listeners are idempotent for the same callback,
 *   preventing double release of the in-memory concurrency slot.
 */

'use strict';

const Module = require('module');
const http = require('http');

const isProduction = process.env.NODE_ENV === 'production';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCorsOrigins() {
  const configured = parseCsv(process.env.CORS_ORIGINS || process.env.FRONTEND_URL);
  if (configured.length > 0) return configured;
  return isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

const corsOrigins = resolveCorsOrigins();
const largeJsonPrefixes = parseCsv(
  process.env.JSON_LARGE_ROUTE_PREFIXES ||
  '/api/image,/api/v1/image,/api/pdf,/api/v1/pdf'
);
const smallJsonLimit = process.env.JSON_BODY_LIMIT || '2mb';
const largeJsonLimit = process.env.JSON_LARGE_BODY_LIMIT || '50mb';

function isOriginAllowed(origin) {
  if (!origin) return true; // same-origin / non-browser clients
  if (corsOrigins.includes('*')) return !isProduction;
  return corsOrigins.includes(origin);
}

function corsDefaults() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('CORS origin is not allowed'));
    },
    credentials: false,
    optionsSuccessStatus: 204,
  };
}

function wrapCors(originalCors) {
  return function hardenedCors(options) {
    const merged = { ...corsDefaults(), ...(options || {}) };

    // Never allow an accidental wildcard in production.
    if (isProduction && merged.origin === '*') {
      merged.origin = corsDefaults().origin;
    }

    return originalCors(merged);
  };
}

function wrapExpress(expressFactory) {
  const originalJson = expressFactory.json;
  expressFactory.json = function hardenedJson(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, 'limit')) {
      return originalJson.call(this, options);
    }

    const smallParser = originalJson.call(this, {
      ...(options || {}),
      limit: smallJsonLimit,
    });
    const largeParser = originalJson.call(this, {
      ...(options || {}),
      limit: largeJsonLimit,
    });

    return function routeAwareJson(req, res, next) {
      const path = req.path || req.url || '';
      const useLargeParser = largeJsonPrefixes.some((prefix) => path.startsWith(prefix));
      return (useLargeParser ? largeParser : smallParser)(req, res, next);
    };
  };
  return expressFactory;
}

// Patch module loading before server.js requires its middleware dependencies.
const originalLoad = Module._load;
Module._load = function hardenedModuleLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (request === 'cors' && typeof loaded === 'function') return wrapCors(loaded);
  if (request === 'express' && loaded && typeof loaded.json === 'function') return wrapExpress(loaded);
  return loaded;
};

// Guard the specific duplicate finish/close listener pattern used by the AI
// concurrency queue. It only deduplicates the exact same callback identity on
// ServerResponse lifecycle events; unrelated listeners are untouched.
const originalResponseOn = http.ServerResponse.prototype.on;
const RELEASE_GUARD = Symbol('aiDostReleaseGuard');
http.ServerResponse.prototype.on = function hardenedResponseOn(event, listener) {
  if ((event === 'finish' || event === 'close') && typeof listener === 'function') {
    let wrappers = this[RELEASE_GUARD];
    if (!wrappers) {
      wrappers = new Map();
      Object.defineProperty(this, RELEASE_GUARD, { value: wrappers });
    }

    let wrapper = wrappers.get(listener);
    if (!wrapper) {
      let fired = false;
      wrapper = (...args) => {
        if (fired) return undefined;
        fired = true;
        return listener.apply(this, args);
      };
      wrappers.set(listener, wrapper);
    }
    return originalResponseOn.call(this, event, wrapper);
  }

  return originalResponseOn.call(this, event, listener);
};

module.exports = {
  corsOrigins,
  smallJsonLimit,
  largeJsonLimit,
  largeJsonPrefixes,
  isOriginAllowed,
};
