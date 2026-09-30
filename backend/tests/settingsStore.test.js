'use strict';

// P1 #101-#103 — server-side secret store unit tests (no network, no express).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Isolate the store file before the module loads (it reads lazily, but be safe).
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const settingsStore = require('../services/settingsStore');
const STORE_FILE = path.join(__dirname, '..', 'data', 'local-settings.json');

function clearStoreFile() {
  try { fs.unlinkSync(STORE_FILE); } catch (_) {}
}

test('settingsStore: set/get/clear round-trip with alias normalization', () => {
  clearStoreFile();
  const r1 = settingsStore.setSecret('gemini', '  AIzaFAKEKEY123456789  ');
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(settingsStore.getSecret('gemini'), 'AIzaFAKEKEY123456789');
  assert.strictEqual(settingsStore.getSecret('GEMINI_API_KEY'), 'AIzaFAKEKEY123456789');

  const r2 = settingsStore.setSecret('GROQ_API_KEY', 'gsk_fake');
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(settingsStore.getSecret('groq'), 'gsk_fake');

  const r3 = settingsStore.setSecret('gemini', '');
  assert.strictEqual(r3.ok, true);
  assert.strictEqual(settingsStore.getSecret('gemini'), '');
  clearStoreFile();
});

test('settingsStore: unknown provider is rejected, nothing persisted', () => {
  clearStoreFile();
  const r = settingsStore.setSecret('evil-provider', 'x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'unknown provider');
  assert.deepStrictEqual(settingsStore.getSecrets(), {});
  clearStoreFile();
});

test('settingsStore: maskSecret never exposes raw key', () => {
  const m = settingsStore.maskSecret('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
  assert.ok(!m.includes('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345'));
  assert.ok(m.startsWith('AIza'));
  assert.ok(m.endsWith('45'));
  // short values are fully masked
  assert.strictEqual(settingsStore.maskSecret('short'), '••••••');
  assert.strictEqual(settingsStore.maskSecret(''), '');
});

test('settingsStore: status() returns masks only, never raw values', () => {
  clearStoreFile();
  settingsStore.setSecret('gemini', 'AIzaSySECRETVALUE1234567890');
  settingsStore.setSecret('vercel', 'vc_fake_token_value');
  const status = settingsStore.status();
  const blob = JSON.stringify(status);
  assert.ok(!blob.includes('AIzaSySECRETVALUE1234567890'), 'raw gemini key leaked in status');
  assert.ok(!blob.includes('vc_fake_token_value'), 'raw vercel token leaked in status');
  assert.strictEqual(status.gemini.configured, true);
  assert.strictEqual(status.gemini.masked.length > 0, true);
  assert.strictEqual(status.groq.configured, false);
  clearStoreFile();
});

test('settingsStore: mergeCustomKeys — body wins, store fills gaps', () => {
  clearStoreFile();
  settingsStore.setSecret('gemini', 'STORED_GEMINI');
  settingsStore.setSecret('groq', 'STORED_GROQ');

  const merged = settingsStore.mergeCustomKeys({ gemini: 'BODY_KEY', deepseek: 'BODY_DS' });
  assert.strictEqual(merged.gemini, 'BODY_KEY', 'request body must override store');
  assert.strictEqual(merged.groq, 'STORED_GROQ', 'store fills empty field');
  assert.strictEqual(merged.deepseek, 'BODY_DS');

  const merged2 = settingsStore.mergeCustomKeys(undefined);
  assert.strictEqual(merged2.gemini, 'STORED_GEMINI');
  assert.strictEqual(merged2.groq, 'STORED_GROQ');
  assert.strictEqual(merged2.openrouter, undefined);
  clearStoreFile();
});

test('settingsStore: persistence across module reload (file-backed)', () => {
  clearStoreFile();
  settingsStore.setSecret('nvidia', 'nvapi_FAKE');
  // simulate restart: drop require cache and re-require
  delete require.cache[require.resolve('../services/settingsStore')];
  const fresh = require('../services/settingsStore');
  assert.strictEqual(fresh.getSecret('nvidia'), 'nvapi_FAKE');
  clearStoreFile();
  delete require.cache[require.resolve('../services/settingsStore')];
});
