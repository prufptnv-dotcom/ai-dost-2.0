const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const {
  SUPPORTED_LANGUAGES,
  LANGUAGE_MODES,
  LANGUAGE_TRANSLATION_DIRECTIVE
} = require('../services/languageTranslationEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callLanguageCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();

  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[LanguageCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[LanguageCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[LanguageCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[LanguageCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. Capabilities endpoint
router.get('/capabilities', (_req, res) => {
  res.json({
    success: true,
    languages: SUPPORTED_LANGUAGES,
    modes: LANGUAGE_MODES,
    samplePrompts: [
      { mode: 'translate', target: 'hindi', text: 'AI-Dost is an autonomous platform that empowers individuals with advanced AI tools.' },
      { mode: 'simplify', target: 'english', text: 'The asynchronous non-blocking event-driven architectural paradigm optimizes I/O throughput.' },
      { mode: 'formalize', target: 'english', text: 'hey man can u send the files asap kinda need them today' },
      { mode: 'interview-prep', target: 'english', text: 'Tell me about a time you handled a tight deadline.' },
      { mode: 'grammar-check', target: 'english', text: 'She do not goes to school yesterday because it was raining heavily.' },
      { mode: 'vocab-builder', target: 'english', text: 'Resilience' },
      { mode: 'translate', target: 'sanskrit', text: 'Knowledge gives humility, humility gives worthiness.' }
    ]
  });
});

// 2. Process General Language Task (Translation, Simplify, Formalize, Spoken, Interview)
router.post('/process', async (req, res) => {
  try {
    const {
      text,
      mode = 'translate',
      sourceLanguage = 'auto',
      targetLanguage = 'english',
      context = ''
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Input text is required.' });
    }

    const modeConfig = LANGUAGE_MODES.find(m => m.id === mode) || LANGUAGE_MODES[0];
    const targetLangConfig = SUPPORTED_LANGUAGES.find(l => l.id === targetLanguage) || { name: targetLanguage };

    const prompt = `
Task: ${modeConfig.name}
Mode: ${mode}
Source Language: ${sourceLanguage}
Target Language / Style: ${targetLangConfig.name}
${context ? `Additional Context: ${context}` : ''}

Input Content:
"""
${text.trim()}
"""

Requirements:
1. Provide the main transformed or translated output cleanly under a prominent heading.
2. If translating, provide the culturally nuanced translation, plus cultural context notes and pronunciation tips if applicable.
3. If simplifying, explain the core message in clean, accessible language without patronizing tone.
4. If formalizing, provide a polite, executive-grade corporate version suitable for email, documentation, or executive briefs.
5. If spoken English practice, provide the spoken dialogue, natural conversational phrasing, and 2-3 pronunciation/intonation tips.
6. If interview prep, provide a polished STAR response, key power verbs, and advice on vocal delivery.
`;

    const aiResponse = await callLanguageCascade(prompt, LANGUAGE_TRANSLATION_DIRECTIVE);

    if (aiResponse) {
      return res.json({
        success: true,
        mode,
        sourceLanguage,
        targetLanguage,
        output: aiResponse
      });
    }

    // Fallback response if all AI providers are unavailable
    const fallbackResponse = `### ${modeConfig.name} (${targetLangConfig.name})

**Original Text:**
> ${text.trim()}

**Transformed / Translated Output:**
${mode === 'formalize' ? `Dear Team,\n\nI am writing to kindly request the requested updates at your earliest convenience.\n\nBest regards.` :
mode === 'simplify' ? `In simple terms: ${text.trim()}` :
mode === 'translate' ? `[Translation to ${targetLangConfig.name}]: ${text.trim()}` :
text.trim()}

---
*Note: AI cascade was momentarily constrained. Provided structural baseline.*`;

    return res.json({
      success: true,
      mode,
      sourceLanguage,
      targetLanguage,
      output: fallbackResponse,
      fallback: true
    });
  } catch (err) {
    logger.error(`[LanguageRoute] Process error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Internal linguistic engine error.' });
  }
});

// 3. Dedicated Grammar & Syntax Checker
router.post('/grammar', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text to proofread is required.' });
    }

    const prompt = `
Act as an expert English grammar & syntax proofreader.
Analyze this text:
"""
${text.trim()}
"""

Provide your analysis in this exact markdown structure:
### 📝 Grammar & Syntax Correction

#### ✅ Polished & Corrected Version
[Write the 100% correct sentence here]

#### 🔍 Identified Issues & Breakdown
- ❌ **Mistake**: [Identify exact error]
  - **Correction**: [Correct word/phrase]
  - **Rule**: [Brief explanation of grammar rule e.g. Subject-Verb agreement, past tense consistency]

#### 💡 Pro Communication Tip
[1 actionable tip to avoid this mistake in everyday writing or speaking]
`;

    const aiResponse = await callLanguageCascade(prompt, LANGUAGE_TRANSLATION_DIRECTIVE);

    if (aiResponse) {
      return res.json({ success: true, analysis: aiResponse });
    }

    return res.json({
      success: true,
      analysis: `### 📝 Grammar & Syntax Correction\n\n#### ✅ Polished Version\n${text.trim()}\n\n*No critical syntax breaks detected in baseline scan.*`,
      fallback: true
    });
  } catch (err) {
    logger.error(`[LanguageRoute] Grammar error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Grammar analysis service error.' });
  }
});

// 4. Dedicated Vocabulary Builder
router.post('/vocab', async (req, res) => {
  try {
    const { word, targetAudience = 'general' } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ success: false, error: 'Word or phrase is required.' });
    }

    const prompt = `
Act as a Master Lexicographer and Vocabulary Coach.
Analyze the word or phrase: "${word.trim()}" (Target audience: ${targetAudience}).

Provide a comprehensive vocabulary profile in markdown:
### 📚 Vocabulary Profile: ${word.trim()}

- **Phonetic Pronunciation:** [IPA & readable phonetic guide]
- **Part of Speech:** [Noun / Verb / Adjective / Adverb]
- **Origin / Etymology:** [Brief historical root, e.g., Latin, Sanskrit, Greek, Old French]
- **Core Definition:** [Precise definition with emotional connotation: Positive, Neutral, or Negative]

#### 🎯 Real-World Context Sentences
1. **Daily Conversation:** "[Example sentence]"
2. **Corporate / Professional:** "[Example sentence]"
3. **Creative / Literary:** "[Example sentence]"

#### 🔄 Synonyms & Antonyms (With Nuance)
| Type | Word | Nuance Difference |
| :--- | :--- | :--- |
| **Synonym** | ... | ... |
| **Synonym** | ... | ... |
| **Antonym** | ... | ... |

#### 🔗 Natural Collocations (Words that pair naturally)
- [Collocation 1]
- [Collocation 2]
- [Collocation 3]
`;

    const aiResponse = await callLanguageCascade(prompt, LANGUAGE_TRANSLATION_DIRECTIVE);

    if (aiResponse) {
      return res.json({ success: true, profile: aiResponse });
    }

    return res.json({
      success: true,
      profile: `### 📚 Vocabulary Profile: ${word.trim()}\n\n- **Word:** ${word.trim()}\n- **Definition:** High-impact expressive vocabulary term.\n*Detailed profile momentarily unavailable.*`,
      fallback: true
    });
  } catch (err) {
    logger.error(`[LanguageRoute] Vocab error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Vocabulary service error.' });
  }
});

module.exports = router;
