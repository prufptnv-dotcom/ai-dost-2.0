'use strict';

/**
 * Process-start production boundary hardening.
 *
 * Loaded before server.js so the existing monolithic server can keep its
 * runtime behavior while security-sensitive defaults are enforced centrally.
 */

const DEFAULT_PRODUCTION_JSON_MB = 20;
const CORS_CACHE_KEY = Symbol.for('ai-dost.production-boundary-hardening.cors');
const JSON_CACHE_KEY = Symbol.for('ai-dost.production-boundary-hardening.json');
const RESPONSE_CACHE_KEY = Symbol.for('ai-dost.production-boundary-hardening.response');

function parsePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseOriginList(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function installCorsBoundary() {
  const resolved = require.resolve('cors');
  const cached = require.cache[resolved];
  if (!cached?.exports || cached.exports[CORS_CACHE_KEY]) return;

  const corsFactory = cached.exports;
  const production = process.env.NODE_ENV === 'production';
  const configuredOrigins = parseOriginList(
    process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || ''
  );

  function hardenedCors(options = {}) {
    const next = { ...options };

    if (production || configuredOrigins.size > 0) {
      next.origin = (origin, callback) => {
        if (!origin || configuredOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
      };
    }

    return corsFactory(next);
  }

  Object.setPrototypeOf(hardenedCors, Object.getPrototypeOf(corsFactory));
  Object.defineProperty(hardenedCors, CORS_CACHE_KEY, { value: true });
  cached.exports = hardenedCors;
}

function installJsonBoundary() {
  const express = require('express');
  if (express.json[JSON_CACHE_KEY]) return;

  const originalJson = express.json;
  const production = process.env.NODE_ENV === 'production';
  const configuredMb = parsePositiveInteger(
    process.env.MAX_JSON_BODY_MB,
    DEFAULT_PRODUCTION_JSON_MB,
    { min: 1, max: 100 }
  );
  const configuredBytes = configuredMb * 1024 * 1024;

  const hardenedJson = function hardenedJson(options = {}) {
    const next = { ...options };

    if (production) {
      // Never allow a caller to raise the global parser ceiling above the
      // configured production envelope. Smaller route-specific limits remain.
      next.limit = Math.min(parseBodyLimitBytes(next.limit, configuredBytes), configuredBytes);
    }

    return originalJson(next);
  };

  Object.defineProperty(hardenedJson, JSON_CACHE_KEY, { value: true });
  express.json = hardenedJson;
}

function parseBodyLimitBytes(limit, fallback) {
  if (typeof limit === 'number' && Number.isFinite(limit)) return Math.max(1, limit);
  if (typeof limit !== 'string') return fallback;

  const match = limit.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return fallback;

  const value = Number(match[1]);
  const unit = match[2] || 'b';
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.max(1, Math.floor(value * multiplier));
}

function installTerminalEventGuard() {
  const http = require('http');
  const proto = http.ServerResponse.prototype;
  if (proto.on[RESPONSE_CACHE_KEY]) return;

  const originalOn = proto.on;
  const stateByResponse = new WeakMap();

  proto.on = function hardenedResponseOn(eventName, listener, ...args) {
    if (
      process.env.NODE_ENV === 'production' &&
      (eventName === 'finish' || eventName === 'close') &&
      typeof listener === 'function'
    ) {
      let state = stateByResponse.get(this);
      if (!state) {
        state = new WeakMap();
        stateByResponse.set(this, state);
      }

      let guard = state.get(listener);
      if (!guard) {
        let fired = false;
        guard = (...eventArgs) => {
          if (fired) return;
          fired = true;
          return listener.apply(this, eventArgs);
        };
        state.set(listener, guard);
      }

      return originalOn.call(this, eventName, guard, ...args);
    }

    return originalOn.call(this, eventName, listener, ...args);
  };

  Object.defineProperty(proto.on, RESPONSE_CACHE_KEY, { value: true });
}

installCorsBoundary();
installJsonBoundary();
installTerminalEventGuard();

module.exports = {
  parseBodyLimitBytes,
  parseOriginList,
};
