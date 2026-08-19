const express = require('express');
const router = express.Router();
const deployService = require('../services/deployService');
const logger = require('../logger');

router.post('/deploy', async (req, res) => {
  try {
    const { projectPath, target, options } = req.body;
    if (!projectPath || !target) {
      return res.status(400).json({ success: false, error: 'projectPath and target are required' });
    }

    logger.info(`[Deploy] Starting deployment to ${target} for ${projectPath}`);

    const result = await deployService.deploy(projectPath, target, options || {});
    
    logger.info(`[Deploy] Deployment to ${target} successful: ${result.url}`);
    res.json({ success: true, result });
  } catch (err) {
    logger.error('[Deploy] Deployment failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/targets', async (req, res) => {
  try {
    const targets = deployService.getAvailableTargets();
    res.json({ success: true, targets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const { target, options } = req.body;
    if (!target) {
      return res.status(400).json({ success: false, error: 'target is required' });
    }

    const adapter = deployService.adapters[target];
    if (!adapter) {
      return res.status(400).json({ success: false, error: `Unknown target: ${target}` });
    }

    const valid = await adapter.validateOptions(options || {});
    res.json({ success: true, valid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;