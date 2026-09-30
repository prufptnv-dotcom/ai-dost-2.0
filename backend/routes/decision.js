const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const {
  DECISION_DOMAINS,
  DECISION_SUPPORT_DIRECTIVE
} = require('../services/decisionSupportEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callDecisionCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();

  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[DecisionCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[DecisionCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[DecisionCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[DecisionCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. List Domains
router.get('/domains', (_req, res) => {
  res.json({
    success: true,
    domains: DECISION_DOMAINS
  });
});

// 2. Full Multi-Criteria Decision Analysis
router.post('/analyze', async (req, res) => {
  try {
    const {
      domain = 'tech-stack',
      options = [],
      budget = '',
      constraints = '',
      primaryGoal = '',
      userContext = ''
    } = req.body;

    const dConfig = DECISION_DOMAINS.find(d => d.id === domain) || DECISION_DOMAINS[0];
    const optionList = Array.isArray(options) && options.length > 0
      ? options.join(' vs ')
      : 'General top alternatives in market';

    const prompt = `
Decision Domain: ${dConfig.name} (${dConfig.category})
Core Candidate Options: ${optionList}
Primary Goal / Outcome: ${primaryGoal || 'Optimal value, velocity, and performance'}
Budget / Constraints: ${budget ? `Budget: ${budget}. ` : ''}${constraints || 'Standard production parameters'}
User Context: ${userContext || 'Developer / Technical decision maker'}

Evaluation Criteria to Score:
${dConfig.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

MANDATORY OUTPUT REQUIREMENTS:
1. 🏆 **The Verdict & Executive Recommendation**: State clearly which option wins and why under these specific constraints.
2. 📊 **Weighted Multi-Criteria Evaluation Matrix**:
   - Provide a clean Markdown table comparing the candidates across all 5 criteria with scores out of 10 and a **Total / 50**.
3. ⚖️ **Critical Trade-offs & Hidden Catches**:
   - For each candidate, detail 1 major hidden gotcha (e.g. licensing, cold starts, vendor lock-in, battery life, learning curve).
4. 🔄 **Reversibility Assessment**:
   - Is this a Type 1 (Irreversible / Hard to undo) or Type 2 (Reversible / Easy rollback) decision?
   - Outline an escape hatch / migration plan if requirements change.
5. 🗺️ **Immediate Action Plan**: 3 concrete execution steps to take today.
`;

    const aiResponse = await callDecisionCascade(prompt, DECISION_SUPPORT_DIRECTIVE);

    if (aiResponse) {
      return res.json({
        success: true,
        domain,
        analysis: aiResponse
      });
    }

    // Deterministic fallback if external LLMs are unavailable
    const fallbackResponse = `### 🏆 Decision Analysis: ${dConfig.name}

#### Executive Recommendation
Based on the provided constraints, **Option A** is the recommended choice for balance of velocity, reliability, and cost.

#### 📊 Multi-Criteria Evaluation Matrix
| Evaluation Criteria | Option 1 | Option 2 | Option 3 |
| :--- | :---: | :---: | :---: |
${dConfig.criteria.map(c => `| ${c} | 8/10 | 7/10 | 6/10 |`).join('\n')}
| **Total Score** | **40/50** | **35/50** | **30/50** |

#### ⚖️ Trade-offs & Critical Considerations
- **Option 1**: Lowest initial barrier to entry, wide community support, mature tooling.
- **Option 2**: High performance but smaller hiring pool or steeper learning curve.
- **Option 3**: Bleeding-edge features, potential breaking changes across major versions.

#### 🔄 Reversibility Assessment
- **Classification**: **Type 2 (Reversible)**. Can be adopted incrementally via abstraction layers or pilot modules.

---
*Note: Generated via AI-Dost Decision Matrix Engine.*`;

    return res.json({
      success: true,
      domain,
      analysis: fallbackResponse,
      fallback: true
    });
  } catch (err) {
    logger.error(`[DecisionRoute] Analyze error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Decision engine processing failed.' });
  }
});

// 3. RICE Feature Prioritization Calculator
router.post('/rice', (req, res) => {
  try {
    const { features = [] } = req.body;

    if (!Array.isArray(features) || features.length === 0) {
      return res.status(400).json({ success: false, error: 'Features list is required.' });
    }

    // Calculate RICE Score = (Reach * Impact * Confidence) / Effort
    const scoredFeatures = features.map(f => {
      const reach = Number(f.reach) || 100;
      const impact = Number(f.impact) || 2; // 3 = Massive, 2 = High, 1 = Medium, 0.5 = Low
      const confidence = Number(f.confidence) || 80; // percentage e.g. 80%
      const effort = Math.max(Number(f.effort) || 1, 0.5); // person-weeks, min 0.5 to avoid division by zero

      const riceScore = Math.round(((reach * impact * (confidence / 100)) / effort) * 10) / 10;

      // Determine MoSCoW label based on RICE score percentile
      let moscow = 'Could Have';
      if (riceScore > 500) moscow = 'Must Have';
      else if (riceScore > 200) moscow = 'Should Have';
      else if (riceScore < 50) moscow = 'Won\'t Have (Now)';

      return {
        id: f.id || f.name,
        name: f.name || 'Feature',
        reach,
        impact,
        confidence: `${confidence}%`,
        effort: `${effort} wks`,
        riceScore,
        moscow
      };
    });

    // Sort descending by RICE score
    scoredFeatures.sort((a, b) => b.riceScore - a.riceScore);

    return res.json({
      success: true,
      rankedFeatures: scoredFeatures
    });
  } catch (err) {
    logger.error(`[DecisionRoute] RICE error: ${err.message}`);
    res.status(500).json({ success: false, error: 'RICE calculation error.' });
  }
});

module.exports = router;
