'use strict';

/**
 * Secret settings API (#101-#103).
 *
 * GET    /api/settings/keys          → configured/masked status (never raw)
 * PUT    /api/settings/keys          → { provider, key }  ('' clears)
 * DELETE /api/settings/keys/:provider
 *
 * Mounted behind execGuard (loopback/Docker peers only) in server.js —
 * keys never travel to the browser again after the initial save.
 */

const express = require('express');
const router = express.Router();
const settingsStore = require('../services/settingsStore');
const logger = require('../logger');

router.get('/keys', (_req, res) => {
  return res.json({ success: true, keys: settingsStore.status() });
});

router.put('/keys', (req, res) => {
  const { provider, key } = req.body || {};
  const name = settingsStore.normalizeName(provider);
  if (!name) {
    return res.status(400).json({
      success: false,
      error: `Unknown provider. Valid: ${settingsStore.SECRET_NAMES.join(', ')}`,
      code: 'UNKNOWN_PROVIDER',
    });
  }
  const result = settingsStore.setSecret(name, typeof key === 'string' ? key : '');
  if (!result.ok) {
    return res.status(500).json({ success: false, error: 'Failed to persist secret', code: 'STORE_WRITE_FAILED' });
  }
  logger.info(`[Settings] '${name}' ${key ? 'updated' : 'cleared'} via API`);
  return res.json({ success: true, keys: settingsStore.status() });
});

router.delete('/keys/:provider', (req, res) => {
  const name = settingsStore.normalizeName(req.params.provider);
  if (!name) {
    return res.status(400).json({ success: false, error: 'Unknown provider', code: 'UNKNOWN_PROVIDER' });
  }
  settingsStore.deleteSecret(name);
  return res.json({ success: true, keys: settingsStore.status() });
});

module.exports = router;
