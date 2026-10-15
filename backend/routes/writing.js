const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const CerebrasService = require('../services/cerebrasService');
const OpenRouterService = require('../services/openrouterService');
const { WRITING_FORMATS, WRITING_TONES, WRITING_COMMUNICATION_DIRECTIVE } = require('../services/writingCommunicationEngine');

/**
 * Execute AI call with full failover cascade
 */
async function callWritingCascade(prompt, systemInstruction = '') {
  const fullPrompt = `${systemInstruction}\n\n${prompt}`.trim();
  
  // 1. Try Groq
  try {
    const res = await GroqService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[WritingCascade] Groq attempt failed: ${e.message}`);
  }

  // 2. Try Gemini
  try {
    const res = await GeminiService.chat(fullPrompt, [], null, 'general');
    if (res && typeof res === 'string' && res.length > 20 && !res.includes('RATE_LIMIT')) {
      return res;
    }
  } catch (e) {
    logger.warn(`[WritingCascade] Gemini attempt failed: ${e.message}`);
  }

  // 3. Try Cerebras
  try {
    const res = await CerebrasService.chat(fullPrompt, [], 'general');
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[WritingCascade] Cerebras attempt failed: ${e.message}`);
  }

  // 4. Try OpenRouter
  try {
    const res = await OpenRouterService.chat(fullPrompt, []);
    if (res && typeof res === 'string' && res.length > 20) {
      return res;
    }
  } catch (e) {
    logger.warn(`[WritingCascade] OpenRouter attempt failed: ${e.message}`);
  }

  return null;
}

// 1. List Writing Formats
router.get('/formats', (req, res) => {
  res.json({ success: true, formats: WRITING_FORMATS });
});

// 2. List Writing Tones
router.get('/tones', (req, res) => {
  res.json({ success: true, tones: WRITING_TONES });
});

// 3. Generate Structured Content
router.post('/generate', async (req, res) => {
  try {
    const { 
      format = 'formal-email', 
      tone = 'professional', 
      topic = 'General Update', 
      keyPoints = [], 
      recipient = '', 
      sender = '', 
      language = 'en' 
    } = req.body;

    const formatDef = WRITING_FORMATS[format] || WRITING_FORMATS['formal-email'];
    const toneDef = WRITING_TONES[tone] || WRITING_TONES['professional'];

    const prompt = `You are AI-Dost's Principal Copywriter and Communication Specialist.
Task: Write a world-class "${formatDef.name}" in a "${toneDef.name}" tone.

Specifications:
- Topic / Purpose: ${topic}
${recipient ? `- Intended Recipient: ${recipient}` : ''}
${sender ? `- Sender Identity: ${sender}` : ''}
${keyPoints && keyPoints.length > 0 ? `- Core Points to Include:\n${keyPoints.map(p => `  • ${p}`).join('\n')}` : ''}
- Target Language: ${language === 'hi' ? 'Hindi (Devanagari)' : (language === 'hinglish' ? 'Authentic urban Hinglish (Roman script)' : 'English')}
- Tone Guidelines: ${toneDef.description}
- Format Requirements: ${formatDef.guidelines}
- Structure sections to follow: ${formatDef.sections.join(' -> ')}

Deliver ready-to-use, polished, copy-pasteable Markdown without meta-commentary.`;

    const aiOutput = await callWritingCascade(prompt, WRITING_COMMUNICATION_DIRECTIVE);

    if (aiOutput) {
      return res.json({
        success: true,
        format,
        tone,
        language,
        content: aiOutput
      });
    }

    // Deterministic fallback template if offline
    const fallbackContent = `## ${formatDef.name}: ${topic}

**Tone:** ${toneDef.name} | **Language:** ${language.toUpperCase()}

---

Dear ${recipient || 'Sir / Madam'},

I am writing to formally communicate regarding **${topic}**. 

Key Highlights:
${keyPoints && keyPoints.length > 0 ? keyPoints.map(k => `- ${k}`).join('\n') : '- Comprehensive project delivery and implementation updates\n- Aligned milestones ensuring zero bottlenecks\n- Immediate next steps outlined for rapid execution'}

Please feel free to connect if any further clarification or documentation is required. Looking forward to our continued collaboration.

Warm regards,  
**${sender || 'AI-Dost Executive Team'}**
`;

    res.json({
      success: true,
      format,
      tone,
      language,
      content: fallbackContent,
      fallback: true
    });
  } catch (err) {
    logger.error(`[WritingRoute] generate error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Professional Rewriting & Polish
router.post('/rewrite', async (req, res) => {
  try {
    const { text, tone = 'professional', targetLanguage } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const toneDef = WRITING_TONES[tone] || WRITING_TONES['professional'];

    const prompt = `Rewrite and polish the following text into a "${toneDef.name}" tone:
"${toneDef.description}"
${targetLanguage ? `Target Language: ${targetLanguage}` : ''}

Original Text:
"""
${text}
"""

Provide:
1. Polished & Upgraded Rewrite
2. Key Enhancements Made (Action verbs, clarity, tone alignment)`;

    const aiOutput = await callWritingCascade(prompt, WRITING_COMMUNICATION_DIRECTIVE);

    res.json({
      success: true,
      originalText: text,
      tone,
      rewrittenText: aiOutput || text
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Grammar & Syntax Diagnostic
router.post('/grammar', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const prompt = `Analyze and correct all grammatical, spelling, tense, punctuation, and syntax errors in the following text:
"""
${text}
"""

Format your response in structured Markdown:
### ✅ Corrected Version
[The pristine, error-free text]

### 🔍 Error Diagnosis & Fixes
- [Specific error found -> exact fix applied]

### 💡 Vocabulary & Clarity Suggestions
- [Words or phrases that can be elevated for higher impact]`;

    const aiOutput = await callWritingCascade(prompt, WRITING_COMMUNICATION_DIRECTIVE);

    res.json({
      success: true,
      originalText: text,
      analysis: aiOutput || 'Text analyzed.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Nuanced Translation (Hindi ⇄ English / Hinglish)
router.post('/translate', async (req, res) => {
  try {
    const { text, sourceLang = 'auto', targetLang = 'English', tone = 'professional' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}.
Maintain a ${tone} tone.
Ensure natural flow, idiomatic accuracy, and zero robotic translation.

Original Text:
"""
${text}
"""

Format:
### 🌐 Translation (${targetLang})
[Translated content]

### 📝 Nuance & Context Notes
[Any cultural, idiomatic, or tone considerations preserved]`;

    const aiOutput = await callWritingCascade(prompt, WRITING_COMMUNICATION_DIRECTIVE);

    res.json({
      success: true,
      sourceLang,
      targetLang,
      translation: aiOutput || text
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
