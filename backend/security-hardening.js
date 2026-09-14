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
 * - Chat SSE output is enriched with stable runtime task events without
 *   changing the legacy event payloads consumed by existing ChatView code.
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
      const requestPath = req.path || req.url || '';
      const useLargeParser = largeJsonPrefixes.some((prefix) => requestPath.startsWith(prefix));
      return (useLargeParser ? largeParser : smallParser)(req, res, next);
    };
  };
  return expressFactory;
}

const CHAT_STREAM_PATH = '/api/chat/stream';
const TASK_EVENT_WRITE_GUARD = Symbol('aiDostTaskEventWrite');

/**
 * Translate legacy chat SSE payloads into the structured runtime contract.
 * The legacy payload remains untouched; these events are additive.
 */
function buildTaskRuntimeEvents(payload, state = {}) {
  if (!payload || typeof payload !== 'object') return [];

  const events = [];
  const pushPhase = (phase, status, metadata = {}) => {
    events.push({ type: 'task_phase', phase, status, ...metadata });
  };

  switch (payload.type) {
    case 'language_lock':
      pushPhase('understanding', 'Understanding request');
      break;
    case 'assessment_creating':
      pushPhase('planning', payload.status || 'Planning assessment');
      break;
    case 'assessment_created':
      pushPhase('executing', 'Assessment ready');
      break;
    case 'web_search_start':
      pushPhase('searching', payload.status || 'Searching live web', {
        intent: payload.intent,
        query: payload.query,
        url: payload.url,
      });
      break;
    case 'web_search_sources':
      pushPhase('reading', `Reading ${Array.isArray(payload.sources) ? payload.sources.length : 0} sources`);
      break;
    case 'web_search_done':
      pushPhase('reading', `Web research complete (${Number(payload.totalResults || 0)} results)`);
      break;
    case 'web_search_error':
      pushPhase('error', payload.error || 'Web search failed');
      break;
    default:
      break;
  }

  if (payload.chunk && !state.generatingStarted) {
    state.generatingStarted = true;
    pushPhase('generating', 'Writing response');
  }

  if (payload.done) {
    pushPhase('verifying', 'Verifying response', { model: payload.model });
    if (payload.model) {
      events.push({
        type: 'task_tool',
        tool: 'model',
        name: String(payload.model),
        status: 'completed',
      });
    }
  }

  if (payload.error && !payload.done) {
    pushPhase('error', String(payload.error));
  }

  return events;
}

function encodeTaskEvent(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function isChatStreamResponse(response) {
  const requestUrl = String(response?.req?.originalUrl || response?.req?.url || '');
  return requestUrl.split('?')[0] === CHAT_STREAM_PATH;
}

function installChatTaskEventWriter() {
  const originalWrite = http.ServerResponse.prototype.write;
  if (originalWrite[TASK_EVENT_WRITE_GUARD]) return;

  function hardenedResponseWrite(chunk, encoding, callback) {
    if (!isChatStreamResponse(this) || !chunk) {
      return originalWrite.call(this, chunk, encoding, callback);
    }

    const state = this.__aiDostTaskEventState || (this.__aiDostTaskEventState = { generatingStarted: false });
    const text = Buffer.isBuffer(chunk)
      ? chunk.toString(typeof encoding === 'string' ? encoding : 'utf8')
      : String(chunk);

    const matches = text.matchAll(/data:\s*(\{[\s\S]*?\})\n\n/g);
    const inserts = [];
    for (const match of matches) {
      try {
        const payload = JSON.parse(match[1]);
        for (const event of buildTaskRuntimeEvents(payload, state)) {
          inserts.push(encodeTaskEvent(event));
        }
      } catch (_) {
        // Ignore malformed/non-JSON SSE frames and preserve legacy stream output.
      }
    }

    if (inserts.length > 0) {
      originalWrite.call(this, Buffer.from(inserts.join(''), 'utf8'));
    }
    return originalWrite.call(this, chunk, encoding, callback);
  }

  hardenedResponseWrite[TASK_EVENT_WRITE_GUARD] = true;
  http.ServerResponse.prototype.write = hardenedResponseWrite;
}

// Patch module loading before server.js requires its middleware dependencies.
const originalLoad = Module._load;
Module._load = function hardenedModuleLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (request === 'cors' && typeof loaded === 'function') return wrapCors(loaded);
  if (request === 'express' && loaded && typeof loaded.json === 'function') return wrapExpress(loaded);
  return loaded;
};

installChatTaskEventWriter();

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
  buildTaskRuntimeEvents,
};