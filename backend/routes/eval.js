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
 * GET /api/eval/status - Check eval system status
 */
router.get('/status', (req, res) => {
  // P12.2: report the REAL catalog size — this used to hardcode 5 while the
  // harness already shipped 8 (and now 50) scenarios.
  const byCategory = {};
  const byEndpoint = { agent: 0, chat: 0 };
  for (const sc of EVAL_SCENARIOS) {
    const cat = sc.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    if (sc.endpoint === 'chat') byEndpoint.chat += 1;
    else byEndpoint.agent += 1;
  }
  res.json({
    status: 'ok',
    scenariosAvailable: EVAL_SCENARIOS.length,
    byCategory,
    byEndpoint,
    description: 'AI-Dost Agent Eval Harness - Tests agent capabilities across project creation, document generation, data export, chat intents, reasoning, self-correction, and adversarial probes'
  });
});

module.exports = router;