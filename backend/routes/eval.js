const express = require('express');
const router = express.Router();
const { runAllScenarios, runScenario, EVAL_SCENARIOS } = require('../tests/eval_harness');

/**
 * POST /api/eval - Run eval harness scenarios
 */
router.post('/', async (req, res) => {
  try {
    const { scenarios } = req.body;

    let results;

    if (scenarios && Array.isArray(scenarios)) {
      // Resolve string IDs to scenario objects; unknown IDs -> 400
      const targets = [];
      for (const id of scenarios) {
        const sc = EVAL_SCENARIOS.find(s => s.id === String(id));
        if (!sc) {
          return res.status(400).json({ success: false, error: `Unknown scenario id: ${id} (available: ${EVAL_SCENARIOS.map(s => s.id).join(', ')})` });
        }
        targets.push(sc);
      }
      results = [];
      for (const sc of targets) {
        results.push(await runScenario(sc)); // sequential — avoids LLM rate-limit hammering
      }
    } else {
      results = await runAllScenarios();
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Eval harness error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/eval/status - Check eval system status
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    scenariosAvailable: 5,
    description: 'AI-Dost Agent Eval Harness - Tests agent capabilities across project creation, document generation, data export, and self-correction'
  });
});

module.exports = router;