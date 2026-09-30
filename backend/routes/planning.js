const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const { PLANNING_DOMAINS, PLANNING_PRODUCTIVITY_DIRECTIVE } = require('../services/planningProductivityEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callPlanningCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();

  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 30 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[PlanningCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 30 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[PlanningCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 30) {
      return res;
    }
  } catch (e) {
    logger.warn(`[PlanningCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 30) {
      return res;
    }
  } catch (e) {
    logger.warn(`[PlanningCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. List Planning Domains
router.get('/domains', (req, res) => {
  res.json({ success: true, domains: PLANNING_DOMAINS });
});

// 2. Universal Planning Generator
router.post('/generate', async (req, res) => {
  try {
    const { 
      domain = 'daily-timetable', 
      goal = 'General Productivity', 
      availableHours = 6, 
      targetDate = '', 
      currentLevel = 'Intermediate', 
      constraints = '', 
      language = 'en' 
    } = req.body;

    const domainDef = PLANNING_DOMAINS[domain] || PLANNING_DOMAINS['daily-timetable'];

    const prompt = `You are AI-Dost's Principal Life Architect and Productivity Director.
Task: Construct a world-class, scientifically calibrated "${domainDef.name}".

Specifications:
- Primary Goal: ${goal}
- Available Daily Time: ${availableHours} hours/day
${targetDate ? `- Target Deadline / Horizon: ${targetDate}` : ''}
- Current Skill / Preparation Level: ${currentLevel}
${constraints ? `- Constraints / Commitments: ${constraints}` : ''}
- Preferred Language: ${language === 'hi' ? 'Hindi' : (language === 'hinglish' ? 'Hinglish' : 'English')}
- Framework Guidelines: ${domainDef.guidelines}
- Key Milestones to Include: ${domainDef.sections.join(' -> ')}

Requirements:
1. Provide a clean, practical, and non-burnout schedule with built-in buffers (15-20%).
2. Use formatted Markdown tables, time blocks (e.g. 09:00 AM - 11:30 AM), and actionable task checkboxes \`- [ ]\`.
3. Include specific milestones, active recall intervals, or core resource suggestions.
4. Conclude with a motivational "2-Minute Habit Rule" to start immediately today.`;

    const aiOutput = await callPlanningCascade(prompt, PLANNING_PRODUCTIVITY_DIRECTIVE);

    if (aiOutput) {
      return res.json({
        success: true,
        domain,
        goal,
        plan: aiOutput
      });
    }

    // Deterministic fallback if offline
    const fallbackPlan = `## 📅 ${domainDef.name}: ${goal}

**Daily Commitment:** ${availableHours} hrs/day | **Level:** ${currentLevel}

---

### ⏰ Daily / Weekly Structure
| Time Slot / Phase | Focus Activity | Key Deliverables |
|:---|:---|:---|
| **08:00 AM - 08:30 AM** | Morning Priming & Planning | Daily Top-3 Priorities Identified |
| **08:30 AM - 11:00 AM** | **Deep Work Block 1** (Peak Energy) | ${goal} - Core Execution & Heavy Problem Solving |
| **11:00 AM - 11:30 AM** | Active Recovery Walk & Hydration | Physical recharge, zero screen |
| **11:30 AM - 01:30 PM** | **Deep Work Block 2** (Skill Lab) | Applied Projects, Practice & Implementation |
| **01:30 PM - 02:30 PM** | Lunch & Power Rest | Complete mental break |
| **03:00 PM - 04:30 PM** | Revision & Active Recall | Spaced repetition drill & self-test |
| **08:00 PM - 08:30 PM** | Retrospective & Habit Log | Review day's output, set tomorrow's triggers |

### 🎯 Key Action Checklists
- [ ] Complete core foundational concepts
- [ ] Solve 2-3 target problems without looking at solutions
- [ ] Document notes and review in 3-day spaced repetition loop
- [ ] Never miss twice: if one session slips, complete at least 10 minutes

---
*Generated via AI-Dost Life Architecture & Productivity Suite.*
`;

    res.json({
      success: true,
      domain,
      goal,
      plan: fallbackPlan,
      fallback: true
    });
  } catch (err) {
    logger.error(`[PlanningRoute] generate error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Quick Habit Tracker Generator
router.post('/habit-tracker', async (req, res) => {
  try {
    const { habits = ['Deep Work (2 hrs)', 'DSA / Coding (1 hr)', 'Reading / Study (30 mins)', 'Exercise / Walk (30 mins)'], frequency = 'daily' } = req.body;

    const markdown = `## 🏆 Atomic Habit Tracker Grid

**Frequency:** ${frequency.toUpperCase()} | **Core Principle:** Never Miss Twice

| Habit Identity | Mon | Tue | Wed | Thu | Fri | Sat | Sun | Weekly Streak |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
${habits.map(h => `| **${h}** | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | 0 / 7 |`).join('\n')}

### 💡 The 2-Minute Rule
Jab mann na kare ya time kam ho, habit ko 2 minute ke version me convert karo (e.g. 10 leetcode problems nahi, toh sirf 1 question read karke approach socho). Consistent identity matters more than intensity on bad days.
`;

    res.json({
      success: true,
      habits,
      trackerMarkdown: markdown
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Quick Skill-Gap Audit
router.post('/skill-gap', async (req, res) => {
  try {
    const { targetRole = 'Senior Full Stack Engineer', currentSkills = [], targetSkills = [] } = req.body;

    const prompt = `Perform an executive Skill-Gap Analysis:
Target Role: "${targetRole}"
Current Candidate Skills: ${currentSkills.join(', ') || 'React, JavaScript, Node.js basics'}
Target Industry Benchmark Skills: ${targetSkills.join(', ') || 'System Design, Microservices, CI/CD, Redis, Docker, Testing'}

Provide:
1. Skills Matrix (Current vs Target, Proficient/Familiar/Missing)
2. Gap Severity Hierarchy (Critical blockers vs Nice-to-haves)
3. 60-Day Concrete Learning Bridge Roadmap
4. Proof-of-Work Project to demonstrate gap closure`;

    const aiOutput = await callPlanningCascade(prompt, PLANNING_PRODUCTIVITY_DIRECTIVE);

    res.json({
      success: true,
      targetRole,
      analysis: aiOutput || 'Analysis generated.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
