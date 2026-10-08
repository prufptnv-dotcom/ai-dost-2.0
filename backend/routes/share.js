'use strict';
/**
 * P7 — Share URL API.
 *   POST   /api/share/:projectId  → open a public tunnel for this project's preview
 *   GET    /api/share/:projectId  → current share status
 *   GET    /api/share             → all active shares
 *   DELETE /api/share/:projectId  → close tunnel + scoped server
 */
const express = require('express');
const router = express.Router();
const shareTunnel = require('../services/shareTunnel');

function cleanId(v) {
  return String(v || '').trim().slice(0, 80);
}

router.get('/', (_req, res) => {
  res.json({ success: true, shares: shareTunnel.listShares() });
});

router.post('/:projectId', async (req, res) => {
  const projectId = cleanId(req.params.projectId);
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' });
  try {
    const result = await shareTunnel.startShare(projectId, {
      // tests / explicit opt-out can skip the SSH leg
      tunnel: req.body?.tunnel !== false,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'share failed' });
  }
});

router.get('/:projectId', (req, res) => {
  const projectId = cleanId(req.params.projectId);
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' });
  res.json(shareTunnel.getShare(projectId));
});

router.delete('/:projectId', async (req, res) => {
  const projectId = cleanId(req.params.projectId);
  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' });
  res.json(await shareTunnel.stopShare(projectId));
});

module.exports = router;
