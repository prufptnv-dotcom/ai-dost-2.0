/**
 * Language & Translation Hub Engine
 * AI-Dost v3.0 - Category 15
 *
 * Provides bidirectional translation across Indic & Global styles:
 * - Hindi ↔ English, Hinglish ↔ English, Sanskrit basics, Marathi, Bengali, Urdu
 * - Technical English, Academic English
 * Beyond Translation:
 * - Simple Language Conversion (Plain English / ELI5)
 * - Formal / Corporate Conversion (Executive polish)
 * - Spoken English Practice (Dialogue & pronunciation)
 * - Interview English (STAR method & confident delivery)
 * - Grammar Correction (Rule breakdown & error explanation)
 * - Vocabulary Building (Collocations, roots, idioms)
 */

const SUPPORTED_LANGUAGES = [
  { id: 'hindi', name: 'Hindi (हिन्दी)', code: 'hi', script: 'Devanagari' },
  { id: 'english', name: 'English', code: 'en', script: 'Latin' },
  { id: 'hinglish', name: 'Hinglish (Conversational)', code: 'hinglish', script: 'Latin/Devanagari' },
  { id: 'sanskrit', name: 'Sanskrit (संस्कृतम्)', code: 'sa', script: 'Devanagari' },
  { id: 'marathi', name: 'Marathi (मराठी)', code: 'mr', script: 'Devanagari' },
  { id: 'bengali', name: 'Bengali (বাংলা)', code: 'bn', script: 'Bengali' },
  { id: 'urdu', name: 'Urdu (اردو)', code: 'ur', script: 'Perso-Arabic' },
  { id: 'technical-english', name: 'Technical English (Docs & Engineering)', code: 'tech-en', script: 'Latin' },
  { id: 'academic-english', name: 'Academic English (Research & Scholarly)', code: 'academic-en', script: 'Latin' }
];

const LANGUAGE_MODES = [
  {
    id: 'translate',
    name: 'Multi-Language Translation',
    description: 'High-fidelity contextual translation preserving nuances across Indic & English styles.',
    badge: 'Core'
  },
  {
    id: 'simplify',
    name: 'Simple Language Conversion',
    description: 'Converts complex technical jargon, legalese, or convoluted text into plain, crystal-clear language.',
    badge: 'Popular'
  },
  {
    id: 'formalize',
    name: 'Formal & Executive Conversion',
    description: 'Transforms casual, colloquial, or rough drafts into polite, executive-level corporate English.',
    badge: 'Corporate'
  },
  {
    id: 'spoken-practice',
    name: 'Spoken English & Dialogue',
    description: 'Interactive conversational scenarios, natural idioms, pronunciation tips, and cadence guide.',
    badge: 'Fluency'
  },
  {
    id: 'interview-prep',
    name: 'Interview English & Articulation',
    description: 'STAR methodology phrasing, confident vocabulary, elimination of filler words for high-stakes interviews.',
    badge: 'Career'
  },
  {
    id: 'grammar-check',
    name: 'Grammar & Syntax Fixer',
    description: 'Identifies grammatical, tense, preposition, and punctuation errors with clear rule explanations.',
    badge: 'Essential'
  },
  {
    id: 'vocab-builder',
    name: 'Vocabulary Builder & Nuance',
    description: 'Expands expressive vocabulary with roots, collocations, connotations, synonyms, and real sentences.',
    badge: 'Mastery'
  }
];

const LANGUAGE_TRANSLATION_DIRECTIVE = `
=== AI-DOST CATEGORY 15: LANGUAGE & TRANSLATION DIRECTIVE (2030 LINGUISTIC SUITE) ===
You are AI-Dost's Master Polyglot, Principal Linguist & Executive Communication Coach.
When the user requests language translation, transformation, or skill improvement:

1. FIDELITY & NUANCE PRESERVATION:
   - Never translate word-for-word mechanically. Capture cultural idioms, colloquial context, and intended emotion.
   - For Sanskrit: Provide the original Devanagari script, Roman transliteration, word-by-word sandhi breakdown, and spiritual/philosophical meaning.
   - For Urdu: Honor polite register (Tehzeeb / Adab), provide Nastaliq script where helpful, Roman Urdu, and English meaning.
   - For Technical/Academic English: Use precise domain terminology, active voice where appropriate, and formal academic rigor.

2. STRUCTURED RESPONSE FORMAT:
   - [Original Text]: Clearly echo the source.
   - [Target Output]: The translated or transformed content in bold/clean presentation.
   - [Nuance & Context Notes]: 2-3 concise bullet points explaining cultural idioms, word choice rationale, or tone shift.
   - [Pronunciation / Reading Tip]: Phonetic guide for difficult words or Devanagari/Urdu pronunciations.

3. FOR GRAMMAR CORRECTION:
   - Provide a clean diff or Side-by-Side comparison:
     ❌ Original: [problematic phrasing]
     ✅ Corrected: [accurate phrasing]
   - Rule Breakdown: Exactly why the change was made (Subject-Verb agreement, tense consistency, preposition use).
   - Pro Tip: How to remember this rule in future conversations.

4. FOR INTERVIEW & SPOKEN ENGLISH:
   - Use the STAR framework (Situation, Task, Action, Result) for behavioral responses.
   - Replace weak passive phrasing ("I had to do it") with confident active verbs ("I spearheaded", "I orchestrated").
   - Eliminate filler words (like, basically, sort of, you know).
   - Include realistic conversational practice dialogues with role-play turn.

5. FOR VOCABULARY BUILDING:
   - Root Word & Etymology.
   - Exact definition with connotation (positive, neutral, negative).
   - 3 real-world sentences across distinct contexts (Daily Life, Corporate, Creative).
   - Synonyms & Antonyms with subtlety differences.
   - Common Collocations (words that naturally pair with it).

6. LANGUAGE CODE & TONE LOCK:
   - Respect user language preference. If user asks in Hindi/Hinglish, explain concepts in friendly, encouraging Hinglish.
   - Never mock grammatical mistakes; be an empowering linguistic mentor.
`;

/**
 * Detect language translation / transformation intent from user message.
 */
function detectLanguageIntent(message) {
  if (!message || typeof message !== 'string') {
    return { isLanguage: false };
  }

  const clean = message.trim();
  const lower = clean.toLowerCase();

  // Mode 1: Grammar Correction
  if (/(?:grammar|grammer|syntax|grammatical|tense mistake|spelling check|proofread|correct my sentence|sentence correct|kya ye sahi hai|isme galti hai)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'grammar-check',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'grammar-check'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 2: Formal / Corporate Conversion
  if (/(?:formal conversion|formalize|make it formal|corporate me|formal me|professional email|polite tone|formal language|casual to formal|office language|formal corporate)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'formalize',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'formalize'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 3: Simple Language Conversion (Simplify / ELI5)
  if (/(?:simple language|simplify|aasan bhasha|saral bhasha|easy words|plain english|layman terms|explain simply|simple words me|complex to simple)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'simplify',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'simplify'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 4: Interview English
  if (/(?:interview english|interview preparation|interview me|job interview|star framework|self introduction|mock interview|weakness.*explain|strength.*explain)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'interview-prep',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'interview-prep'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 5: Spoken English Practice
  if (/(?:spoken english|speaking practice|english bolna sikhe|english conversation|dialogue practice|pronunciation|accent improvement|fluency tips|conversation practice)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'spoken-practice',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'spoken-practice'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 6: Vocabulary Building
  if (/(?:vocabulary|vocab|word meaning|new words|synonyms|antonyms|idioms|phrases|shabd kosh|daily word|vocabulary build)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'vocab-builder',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'vocab-builder'),
      targetLanguage: 'english',
      inputQuery: clean
    };
  }

  // Mode 7: Sanskrit
  if (/(?:sanskrit|shloka|sandhi|sanskrit me|sanskrit translation|sanskrit basics)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'sanskrit',
      inputQuery: clean
    };
  }

  // Mode 8: Marathi
  if (/(?:marathi|marathi me|translate to marathi|marathi bhasha)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'marathi',
      inputQuery: clean
    };
  }

  // Mode 9: Bengali
  if (/(?:bengali|bangla|translate to bengali|bengali me)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'bengali',
      inputQuery: clean
    };
  }

  // Mode 10: Urdu
  if (/(?:urdu|urdu me|translate to urdu|alfaaz|shayari|tehzeeb)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'urdu',
      inputQuery: clean
    };
  }

  // Mode 11: Technical English
  if (/(?:technical english|tech docs english|rfc format|api doc english|software documentation english)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'technical-english',
      inputQuery: clean
    };
  }

  // Mode 12: Academic English
  if (/(?:academic english|research paper english|scholarly english|thesis language|academic tone)/i.test(lower)) {
    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: 'academic-english',
      inputQuery: clean
    };
  }

  // Mode 13: General Translation (Hindi ↔ English ↔ Hinglish)
  const isTranslateAction = /(?:translate|anuvad|tarjuma|meaning in english|meaning in hindi|hindi me batao|english me batao|hinglish me batao|english to hindi|hindi to english|hinglish to english|english to hinglish)/i.test(lower);
  if (isTranslateAction) {
    let target = 'hindi';
    if (/(?:to english|english me|meaning in english)/i.test(lower)) target = 'english';
    if (/(?:to hinglish|hinglish me)/i.test(lower)) target = 'hinglish';
    if (/(?:to sanskrit|sanskrit me)/i.test(lower)) target = 'sanskrit';
    if (/(?:to marathi|marathi me)/i.test(lower)) target = 'marathi';
    if (/(?:to bengali|bengali me|bangla me)/i.test(lower)) target = 'bengali';
    if (/(?:to urdu|urdu me)/i.test(lower)) target = 'urdu';

    return {
      isLanguage: true,
      mode: 'translate',
      modeConfig: LANGUAGE_MODES.find(m => m.id === 'translate'),
      targetLanguage: target,
      inputQuery: clean
    };
  }

  return { isLanguage: false };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  LANGUAGE_MODES,
  LANGUAGE_TRANSLATION_DIRECTIVE,
  detectLanguageIntent
};
