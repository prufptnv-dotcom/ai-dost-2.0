/**
 * Production-Grade Response-Language Matching Service
 * AI-Dost 2.0
 * 
 * Accurately detects the language, script, and intent of the latest user message
 * and generates strict directives to enforce matching AI response language.
 * 
 * Supported Languages:
 * - English (en)
 * - Hindi (hi - Devanagari script)
 * - Hinglish (hinglish - Natural Roman-script Hindi/English mixture)
 * - Bengali (bn - Bengali script)
 * - Tamil (ta - Tamil script)
 * - Telugu (te - Telugu script)
 * - Marathi (mr - Devanagari script)
 * - Gujarati (gu - Gujarati script)
 * - Punjabi (pa - Gurmukhi script)
 * - Urdu (ur - Perso-Arabic script)
 * - Kannada (kn - Kannada script)
 * - Malayalam (ml - Malayalam script)
 * - Odia (or - Odia script)
 * - Assamese (as - Bengali/Assamese script)
 */

// ── Unicode Script Range Definitions ────────────────────────────────────────
const SCRIPT_RANGES = {
    devanagari: /[\u0900-\u097F]/g,
    bengali: /[\u0980-\u09FF]/g,
    tamil: /[\u0B80-\u0BFF]/g,
    telugu: /[\u0C00-\u0C7F]/g,
    kannada: /[\u0C80-\u0CFF]/g,
    malayalam: /[\u0D00-\u0D7F]/g,
    gujarati: /[\u0A80-\u0AFF]/g,
    gurmukhi: /[\u0A00-\u0A7F]/g,
    odia: /[\u0B00-\u0B7F]/g,
    arabic: /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g,
    latin: /[a-zA-Z]/g
};

// ── Lexical Markers ─────────────────────────────────────────────────────────

// Distinct Marathi lexical markers in Devanagari (to distinguish from Hindi)
const MARATHI_DEVANAGARI_WORDS = new Set([
    'आहे', 'आहेत', 'नाही', 'कसा', 'कशी', 'काय', 'करणार', 'होते',
    'आम्ही', 'तुम्ही', 'मला', 'त्याला', 'तिला', 'त्यांना', 'करा', 'सांगा', 'मध्ये',
    'बद्दल', 'झाले', 'झाला', 'झाली', 'पाहिजे', 'करायचे', 'येथे'
]);

// Distinct Hindi lexical markers in Devanagari
const HINDI_DEVANAGARI_WORDS = new Set([
    'है', 'हैं', 'हूँ', 'था', 'थी', 'थे', 'होता', 'होती', 'होते', 'होगा', 'होगी',
    'और', 'में', 'से', 'को', 'का', 'की', 'के', 'क्या', 'क्यों', 'कैसे', 'कहाँ', 'कब',
    'चाहिए', 'रहा', 'रही', 'रहे', 'नहीं', 'करना', 'करो', 'कीजिए', 'बताइए', 'बताओ',
    'समझाओ', 'मुख्य', 'कृपया', 'अंतर', 'प्रवाह'
]);

// Unambiguous Roman Hindi / Hinglish Markers (Zero false collision with English)
const UNAMBIGUOUS_HINGLISH_MARKERS = new Set([
    // Auxiliary verbs / copulas
    'hai', 'hain', 'hoon', 'hu', 'tha', 'thi', 'thay', 'hoga', 'hogi', 'hoge',
    'raha', 'rahi', 'rahe', 'chahiye', 'sakta', 'sakti', 'sakte', 'hona', 'honi',
    // Pronouns
    'mujhe', 'mera', 'meri', 'mere', 'tumhara', 'tumhari', 'tumhare', 'tumhe',
    'aapka', 'aapki', 'aapke', 'aapko', 'hamara', 'hamari', 'hamare',
    'uska', 'uski', 'uske', 'unka', 'unki', 'unke', 'kisko', 'kisiko', 'apna', 'apni',
    // Question words
    'kya', 'kyun', 'kyu', 'kaise', 'kahan', 'kaha', 'kab', 'kitna', 'kitni', 'kitne', 'kaun',
    // Core action verbs
    'karo', 'karna', 'karein', 'karta', 'karti', 'karte', 'kiya', 'diya', 'liya',
    'batao', 'bataiye', 'samjhao', 'samjha', 'banao', 'bana', 'likho', 'likha', 'dekho',
    'suno', 'bolo', 'aaya', 'aayi', 'gaya', 'gayi', 'gaye', 'chalo', 'chal',
    'dekhna', 'sikhna', 'samajh', 'samajhna', 'milega', 'rakho', 'rakha',
    // Postpositions / conjunctions / adverbs
    'lekin', 'magar', 'saath', 'wale', 'wali', 'wala', 'paas', 'upar', 'niche',
    'agar', 'kabhi', 'sirf', 'toh', 'mein',
    // Colloquial / sentiment
    'yaar', 'bhai', 'dost', 'arre', 'acha', 'theek', 'thik', 'nahi', 'nahin',
    'zaroor', 'bilkul', 'shukriya', 'dhanyavad'
]);

// Ambiguous particles (only count towards Hinglish if accompanied by other Hindi context)
const CONTEXTUAL_HINGLISH_MARKERS = new Set([
    'me', 'se', 'ko', 'ka', 'ki', 'ke', 'aur', 'par', 'pe', 'bhi', 'ab', 'bhi', 'tum', 'hum', 'aap'
]);

// Common English function words (for pure English syntax confirmation)
const ENGLISH_FUNCTION_WORDS = new Set([
    'the', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'which', 'what', 'where', 'when', 'who', 'whom', 'whose', 'why', 'how',
    'please', 'explain', 'difference', 'between', 'build', 'create', 'generate', 'implement', 'fix',
    'improve', 'help', 'with', 'about', 'from', 'into', 'through', 'under', 'above', 'while',
    'because', 'since', 'although', 'therefore', 'however', 'component', 'application', 'function',
    'system', 'process', 'thread', 'server', 'database', 'project', 'client', 'error', 'code',
    'flow', 'architecture', 'microservices', 'management'
]);

// Short ambiguous / conversational tokens
const SHORT_NEUTRAL_TOKENS = new Set([
    'hi', 'hello', 'hey', 'ok', 'okay', 'k', 'cool', 'thanks', 'thank you', 'thx',
    'why', 'why?', 'yes', 'no', 'yep', 'nope', 'sure', 'fine', 'great', 'hmm', 'good'
]);

// ── Explicit Language Override Patterns (Priority 2a) ───────────────────────
const EXPLICIT_OVERRIDE_PATTERNS = [
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain|speak)\s+(?:only\s+)?in\s+english\b)|(?:\bin\s+english(?:\s+(?:please|only))?\b)|(?:\benglish\s+me(?:in)?\s+(?:batao|bataiye|bolo|samjhao|likho|answer\s+do|reply\s+karo)\b)/i,
        lang: 'en',
        name: 'English'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain|speak)\s+(?:only\s+)?in\s+hindi\b)|(?:\bhindi\s+me(?:in)?\s+(?:batao|bataiye|bolo|samjhao|likho|answer\s+do|reply\s+karo)\b)|(?:हिंदी\s+में\s+(?:बताओ|बताइए|लिखो|जवाब\s+दो|समझाओ))/i,
        lang: 'hi',
        name: 'Hindi'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain|speak)\s+(?:only\s+)?in\s+hinglish\b)|(?:\bhinglish\s+me(?:in)?\s+(?:batao|bataiye|bolo|samjhao|likho|answer\s+do|reply\s+karo)\b)/i,
        lang: 'hinglish',
        name: 'Hinglish'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+bengali\b)|(?:\bbangla(?:y|te)?\s+(?:bolo|bolun|likhun|batao)\b)|(?:বাংলায়\s+(?:বলুন|লিখুন|উত্তর\s+দিন))/i,
        lang: 'bn',
        name: 'Bengali'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+tamil\b)|(?:\btamil\s+il\s+(?:sollunga|ezhudhunga)\b)|(?:தமிழில்\s+(?:பதில்\s+அளியுங்கள்|விளக்குங்கள்|சொல்லுங்கள்))/i,
        lang: 'ta',
        name: 'Tamil'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+telugu\b)|(?:\btelugu\s+lo\s+(?:cheppandi|rayandi)\b)|(?:తెలుగులో\s+(?:చెప్పండి|రాయండి|సమాధానం\s+ఇవ్వండి))/i,
        lang: 'te',
        name: 'Telugu'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+marathi\b)|(?:\bmarathi\s+t\s+(?:sanga|liha)\b)|(?:\bmarathi\s+madhe\s+(?:sanga|liha)\b)|(?:मराठीत\s+(?:सांगा|सांगावे|उत्तर\s+द्या))/i,
        lang: 'mr',
        name: 'Marathi'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+gujarati\b)|(?:\bgujarati\s+ma\s+(?:bolo|lakho)\b)|(?:ગુજરાતીમાં\s+(?:કહો|લખો|જવાબ\s+આપો))/i,
        lang: 'gu',
        name: 'Gujarati'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+punjabi\b)|(?:\bpunjabi\s+(?:vich|ch)\s+(?:daso|likho)\b)|(?:ਪੰਜਾਬੀ\s+ਵਿੱਚ\s+(?:ਦੱਸੋ|ਲਿਖੋ))/i,
        lang: 'pa',
        name: 'Punjabi'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+urdu\b)|(?:\burdu\s+me(?:in)?\s+(?:batao|likho)\b)|(?:اردو\s+میں\s+(?:بتائیں|جواب\s+دیں|وضاحت\s+کریں))/i,
        lang: 'ur',
        name: 'Urdu'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+kannada\b)|(?:\bkannada\s+dalli\s+heli\b)|(?:ಕನ್ನಡದಲ್ಲಿ\s+(?:ಹೇಳಿ|ಬರೆಯಿರಿ))/i,
        lang: 'kn',
        name: 'Kannada'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+malayalam\b)|(?:\bmalayalam\s+il\s+parayuk\b)|(?:മലയാളത്തിൽ\s+(?:പറയുക|എഴുതുക))/i,
        lang: 'ml',
        name: 'Malayalam'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+odia\b)|(?:ଓଡ଼ିଆରେ\s+(?:କୁହନ୍ତୁ|ଲେଖନ୍ତୁ))/i,
        lang: 'or',
        name: 'Odia'
    },
    {
        pattern: /(?:\b(?:answer|reply|respond|write|explain)\s+in\s+assamese\b)|(?:অসমীয়াত\s+(?:কওক|লিখক))/i,
        lang: 'as',
        name: 'Assamese'
    }
];

// ── Translation Request Patterns (Requirement 3) ────────────────────────────
const TRANSLATION_REQUEST_PATTERNS = [
    /(?:translate|convert|anuvad)\s*(?:this\s*)?(?:text\s*)?[:\s]*["'“]([\s\S]+?)["'”]\s*(?:to|into|in)\s*([a-zA-Z]+)/i,
    /(?:translate|convert)\s+(?:to|into|in)\s+([a-zA-Z]+)[:\s]+([\s\S]+)/i,
    /(?:isko|isse|yeh|ye|is text ko)\s+([a-zA-Z]+)\s+(?:me|mein)\s+(?:translate|convert|anuvad)\s+karo/i,
    /(?:anuvad|translate)\s+karo[:\s]+([\s\S]+)/i
];

/**
 * Checks if input is code-only or URL-only
 */
function isCodeOrTechnicalInput(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    
    // URL only
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
        return { isCodeOrUrl: true, type: 'url' };
    }

    // Pure numbers / symbols
    if (/^[\d\s+\-*/%=.,:;!?'"()[\]{}<>]+$/.test(trimmed)) {
        return { isCodeOrUrl: true, type: 'symbols' };
    }

    // Multi-line code block or distinct programming keywords
    const codeIndicatorPatterns = [
        /^```[\s\S]*```$/m,
        /^(?:import\s+.*from\s+['"].*['"]|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/m,
        /^(?:def\s+\w+\(.*\):|class\s+\w+[\s:(]|function\s+\w+\(.*\)\s*\{)/m,
        /^(?:SELECT\s+.*\s+FROM\s+.*|INSERT\s+INTO\s+.*|CREATE\s+TABLE\s+.*)/i,
        /^(?:<\?php|<!DOCTYPE\s+html|<html|<div|<script)/i
    ];

    for (const p of codeIndicatorPatterns) {
        if (p.test(trimmed)) {
            return { isCodeOrUrl: true, type: 'code' };
        }
    }

    return { isCodeOrUrl: false, type: null };
}

/**
 * Detects language from conversation history when current message is short/ambiguous
 */
function inferLanguageFromHistory(history = []) {
    if (!Array.isArray(history) || history.length === 0) {
        return null;
    }

    // Inspect user messages in reverse chronological order
    for (let i = history.length - 1; i >= 0; i--) {
        const item = history[i];
        const content = item.content || item.message || '';
        if (item.role === 'user' && content && content.trim().length > 3) {
            const detected = detectSingleMessageLanguage(content, false);
            if (detected && detected.confidence >= 0.75 && !detected.isAmbiguous) {
                return detected;
            }
        }
    }

    return null;
}

/**
 * Core Language Detection for a Single String
 */
function detectSingleMessageLanguage(rawText, allowHistoryCheck = true) {
    if (!rawText || typeof rawText !== 'string') {
        return {
            language: 'en',
            languageName: 'English',
            script: 'Latin',
            confidence: 0.5,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: true
        };
    }

    const text = rawText.trim();

    // 1. Code / URL Detection
    const codeCheck = isCodeOrTechnicalInput(text);
    if (codeCheck.isCodeOrUrl) {
        return {
            language: 'en',
            languageName: 'English',
            script: 'Technical / Code',
            confidence: 0.9,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: true,
            isAmbiguous: false
        };
    }

    // 2. Explicit Language Override Detection (Priority 2a)
    for (const override of EXPLICIT_OVERRIDE_PATTERNS) {
        if (override.pattern.test(text)) {
            return {
                language: override.lang,
                languageName: override.name,
                script: override.lang === 'hi' || override.lang === 'mr' ? 'Devanagari' : (override.lang === 'hinglish' ? 'Latin (Romanized)' : 'Native Script'),
                confidence: 1.0,
                isExplicitOverride: true,
                explicitLanguageOverride: override.lang,
                isTranslationRequest: false,
                isCodeOrUrl: false,
                isAmbiguous: false
            };
        }
    }

    // 3. Translation Request Detection (Requirement 3)
    for (const pattern of TRANSLATION_REQUEST_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            return {
                language: 'translation_request',
                languageName: 'Translation Request',
                script: 'Multilingual',
                confidence: 0.95,
                isExplicitOverride: false,
                isTranslationRequest: true,
                targetLanguageText: match[1] || match[2] || '',
                isCodeOrUrl: false,
                isAmbiguous: false
            };
        }
    }

    // 4. Non-Latin Script Detection (Unicode blocks)
    // Strip code blocks and URLs first to isolate human conversational text
    const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/https?:\/\/\S+/g, '');

    const scriptCounts = {};
    for (const [scriptName, regex] of Object.entries(SCRIPT_RANGES)) {
        const matches = cleanText.match(regex);
        scriptCounts[scriptName] = matches ? matches.length : 0;
    }

    // Check Indic / Non-Latin scripts first
    if (scriptCounts.devanagari > 3) {
        // Distinguish Marathi vs Hindi in Devanagari
        const words = cleanText.split(/\s+/).map(w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()।?]/g, ''));
        let marathiHits = 0;
        let hindiHits = 0;
        for (const w of words) {
            if (MARATHI_DEVANAGARI_WORDS.has(w)) marathiHits++;
            if (HINDI_DEVANAGARI_WORDS.has(w)) hindiHits++;
        }
        
        if (marathiHits > hindiHits && marathiHits >= 1) {
            return {
                language: 'mr',
                languageName: 'Marathi',
                script: 'Devanagari',
                confidence: 0.96,
                isExplicitOverride: false,
                isTranslationRequest: false,
                isCodeOrUrl: false,
                isAmbiguous: false
            };
        }

        return {
            language: 'hi',
            languageName: 'Hindi',
            script: 'Devanagari',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.bengali > 3) {
        // Check for Assamese unique characters: ৰ (\u09F0), ৱ (\u09F1)
        const isAssamese = /[\u09F0\u09F1]/.test(cleanText);
        return {
            language: isAssamese ? 'as' : 'bn',
            languageName: isAssamese ? 'Assamese' : 'Bengali',
            script: isAssamese ? 'Assamese' : 'Bengali',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.tamil > 3) {
        return {
            language: 'ta',
            languageName: 'Tamil',
            script: 'Tamil',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.telugu > 3) {
        return {
            language: 'te',
            languageName: 'Telugu',
            script: 'Telugu',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.gujarati > 3) {
        return {
            language: 'gu',
            languageName: 'Gujarati',
            script: 'Gujarati',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.gurmukhi > 3) {
        return {
            language: 'pa',
            languageName: 'Punjabi',
            script: 'Gurmukhi',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.kannada > 3) {
        return {
            language: 'kn',
            languageName: 'Kannada',
            script: 'Kannada',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.malayalam > 3) {
        return {
            language: 'ml',
            languageName: 'Malayalam',
            script: 'Malayalam',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.odia > 3) {
        return {
            language: 'or',
            languageName: 'Odia',
            script: 'Odia',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    if (scriptCounts.arabic > 3) {
        return {
            language: 'ur',
            languageName: 'Urdu',
            script: 'Perso-Arabic',
            confidence: 0.98,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    // 5. Short / Ambiguous Message Check
    const tokens = cleanText.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length <= 2 && tokens.every(t => SHORT_NEUTRAL_TOKENS.has(t))) {
        return {
            language: 'en',
            languageName: 'English',
            script: 'Latin',
            confidence: 0.5,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: true
        };
    }

    // 6. Latin Script Analysis: Pure English vs Hinglish vs Romanized Regional
    const cleanWords = cleanText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0);

    if (cleanWords.length === 0) {
        return {
            language: 'en',
            languageName: 'English',
            script: 'Latin',
            confidence: 0.7,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: true
        };
    }

    let unambiguousHinglishHits = 0;
    let contextualHinglishHits = 0;
    let englishGrammarHits = 0;

    for (const word of cleanWords) {
        if (UNAMBIGUOUS_HINGLISH_MARKERS.has(word)) {
            unambiguousHinglishHits++;
        } else if (CONTEXTUAL_HINGLISH_MARKERS.has(word)) {
            contextualHinglishHits++;
        }
        if (ENGLISH_FUNCTION_WORDS.has(word)) {
            englishGrammarHits++;
        }
    }

    // Multi-word phrase matching for Roman Hinglish patterns
    const lowerText = cleanText.toLowerCase();
    const hinglishPhrases = [
        'aa raha hai', 'aa rahi hai', 'ho raha hai', 'ho rahi hai', 'kaise karein',
        'kaise kare', 'kya hai', 'bata do', 'bana do', 'samjha do', 'kaise kaam karta hai',
        'kaise use kare', 'me problem aa rahi', 'error aa raha hai', 'issue aa raha hai',
        'karna chahta hoon', 'karna chahti hoon', 'samajh nahi aa raha', 'mujhe lagta hai',
        'ek baar', 'bana kar do', 'likh kar do'
    ];

    for (const phrase of hinglishPhrases) {
        if (lowerText.includes(phrase)) {
            unambiguousHinglishHits += 3;
        }
    }

    // Hinglish Decision Logic:
    // User message is Hinglish if it contains genuine unambiguous Roman Hindi markers,
    // OR contextual markers without predominant English syntax.
    const isHinglish = unambiguousHinglishHits >= 1 || (contextualHinglishHits >= 2 && englishGrammarHits <= 1);

    if (isHinglish) {
        const totalHits = unambiguousHinglishHits + (contextualHinglishHits * 0.5);
        const confidence = Math.min(0.98, 0.75 + (totalHits * 0.08));
        return {
            language: 'hinglish',
            languageName: 'Hinglish',
            script: 'Latin (Romanized Hindi-English)',
            confidence,
            isExplicitOverride: false,
            isTranslationRequest: false,
            isCodeOrUrl: false,
            isAmbiguous: false
        };
    }

    // Default for Latin text without Hinglish markers is pure English
    return {
        language: 'en',
        languageName: 'English',
        script: 'Latin',
        confidence: Math.min(0.98, 0.85 + (englishGrammarHits * 0.02)),
        isExplicitOverride: false,
        isTranslationRequest: false,
        isCodeOrUrl: false,
        isAmbiguous: false
    };
}

/**
 * Generates an authoritative, structured prompt directive based on detected language
 */
function buildSystemDirective(langInfo) {
    const { language, languageName, script, isExplicitOverride, isTranslationRequest } = langInfo;

    if (isTranslationRequest) {
        return [
            `## TRANSLATION MANDATE:`,
            `The user has explicitly requested translation of text. Translate the requested text accurately into the target language requested.`,
            `Preserve all programming code, variable names, URLs, and proper nouns without altering them.`
        ].join('\n');
    }

    switch (language) {
        case 'en':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: ENGLISH):`,
                `- Target Language: English (Script: Latin).`,
                `- Instruction: Respond strictly in natural, grammatically clean English.`,
                `- MANDATE: Do NOT reply in Hinglish or Hindi unless the user explicitly asks.`,
                `- Technical terms, code blocks, URLs, and shell commands must remain in standard English format.`
            ].join('\n');

        case 'hi':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: HINDI):`,
                `- Target Language: Hindi (लिपि: देवनागरी).`,
                `- Instruction: उत्तर शुद्ध, स्पष्ट और प्राकृतिक हिंदी (देवनागरी लिपि) में दीजिए।`,
                `- MANDATE: तकनीकी शब्द (जैसे APIs, React, Function, Variable names, Code, Shell commands, URLs) को अंग्रेजी/मानक रूप में ही रखिए, उनका अनावश्यक अनुवाद न करें।`,
                `- अनावश्यक रूप से उत्तर को रोमन (Hinglish) या अंग्रेजी में न बदलें।`
            ].join('\n');

        case 'hinglish':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: HINGLISH):`,
                `- Target Language: Hinglish (Hindi written in Roman script, naturally mixed with English).`,
                `- Instruction: Respond in clean, natural, modern Hinglish (Roman script). Friendly, confident, and technically accurate.`,
                `- MANDATE: Keep code blocks, technical terms, package names, functions, and commands in standard English format. Do NOT force Devanagari script.`
            ].join('\n');

        case 'bn':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: BENGALI):`,
                `- Target Language: Bengali (বাংলা).`,
                `- Instruction: ব্যবহারকারীর প্রশ্নের উত্তর প্রমিত, সাবলীল এবং নির্ভুল বাংলায় দিন।`,
                `- MANDATE: কোড, টেকনিক্যাল টার্মস, ভেরিয়েবল এবং ইউআরএল ইংরেজিতে অপরিবর্তিত রাখুন।`
            ].join('\n');

        case 'ta':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: TAMIL):`,
                `- Target Language: Tamil (தமிழ்).`,
                `- Instruction: பயனரின் கேள்விக்கு தெளிவான, இயல்பான மற்றும் பிழையற்ற தமிழில் பதிலளிக்கவும்.`,
                `- MANDATE: நிரலாக்க குறியீடு, தொழில்நுட்ப சொற்கள் மற்றும் URL-களை ஆங்கிலத்திலேயே வைத்திருங்கள்.`
            ].join('\n');

        case 'te':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: TELUGU):`,
                `- Target Language: Telugu (తెలుగు).`,
                `- Instruction: వినియోగదారు అడిగిన ప్రశ్నకు స్పష్టమైన, సహజమైన మరియు వ్యాకరణ దోషాలు లేని తెలుగులో సమాధానం ఇవ్వండి.`,
                `- MANDATE: కోడ్, సాంకేతిక పదాలు మరియు URLలను ఆంగ్లంలోనే ఉంచండి.`
            ].join('\n');

        case 'mr':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: MARATHI):`,
                `- Target Language: Marathi (मराठी - देवनागरी).`,
                `- Instruction: युजरच्या प्रश्नाचे उत्तर शुद्ध, स्पष्ट आणि नैसर्गिक मराठी भाषेत द्या.`,
                `- MANDATE: तांत्रिक संज्ञा, कोड आणि URLs इंग्रजीतच ठेवा, विनाकारण त्यांचे भाषांतर करू नका.`
            ].join('\n');

        case 'gu':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: GUJARATI):`,
                `- Target Language: Gujarati (ગુજરાતી).`,
                `- Instruction: વપરાશકર્તાના પ્રશ્નનો ઉત્તર સરળ, સ્પષ્ટ અને કુદરતી ગુજરાતીમાં આપો.`,
                `- MANDATE: તકનીકી શબ્દો, કોડ અને URL ને અંગ્રેજીમાં યથાવત રાખો.`
            ].join('\n');

        case 'pa':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: PUNJABI):`,
                `- Target Language: Punjabi (ਪੰਜਾਬੀ - ਗੁਰਮੁਖੀ).`,
                `- Instruction: ਉਪਭੋਗਤਾ ਦੇ ਸਵਾਲ ਦਾ ਜਵਾਬ ਸਪੱਸ਼ਟ, ਸਰਲ ਅਤੇ ਕੁਦਰਤੀ ਪੰਜਾਬੀ (ਗੁਰਮੁਖੀ) ਵਿੱਚ ਦਿਓ।`,
                `- MANDATE: ਤਕਨੀਕੀ ਸ਼ਬਦ, ਕੋਡ ਅਤੇ URLs ਨੂੰ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਹੀ ਰੱਖੋ.`
            ].join('\n');

        case 'ur':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: URDU):`,
                `- Target Language: Urdu (اردو).`,
                `- Instruction: صارف کے سوال کا جواب شستہ، واضح اور معیاری اردو میں دیں۔`,
                `- MANDATE: تکنیکی اصطلاحات، کوڈ اور یو آر ایل کو انگریزی میں ہی رکھیں۔`
            ].join('\n');

        case 'kn':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: KANNADA):`,
                `- Target Language: Kannada (ಕನ್ನಡ).`,
                `- Instruction: ಬಳಕೆದಾರರ ಪ್ರಶ್ನೆಗೆ ಸ್ಪಷ್ಟ ಮತ್ತು ನಿಖರವಾದ ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ.`,
                `- MANDATE: ಕೋಡ್ ಮತ್ತು ತಾಂತ್ರಿಕ ಪದಗಳನ್ನು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿಯೇ ಇರಿಸಿ.`
            ].join('\n');

        case 'ml':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: MALAYALAM):`,
                `- Target Language: Malayalam (മലയാളം).`,
                `- Instruction: ഉപയോക്താവിന്റെ ചോദ്യത്തിന് വ്യക്തവും സ്വാഭാവികവുമായ മലയാളത്തിൽ മറുപടി നൽകുക.`,
                `- MANDATE: കോഡും സാങ്കേതിക പദങ്ങളും ഇംഗ്ലീഷിൽ നിലനിർത്തുക.`
            ].join('\n');

        case 'or':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: ODIA):`,
                `- Target Language: Odia (ଓଡ଼ିଆ).`,
                `- Instruction: ଉପଭୋକ୍ତାଙ୍କ ପ୍ରଶ୍ନର ଉତ୍ତର ସ୍ପଷ୍ଟ ଏବଂ ପ୍ରାକୃତିକ ଓଡ଼ିଆରେ ପ୍ରଦାନ କରନ୍ତୁ।`,
                `- MANDATE: କୋଡ୍ ଏବଂ ବୈଷୟିକ ଶବ୍ଦଗୁଡ଼ିକୁ ଇଂରାଜୀରେ ରଖନ୍ତୁ।`
            ].join('\n');

        case 'as':
            return [
                `## LANGUAGE POLICY (STRICT - DETECTED: ASSAMESE):`,
                `- Target Language: Assamese (অসমীয়া).`,
                `- Instruction: ব্যৱহাৰকাৰীৰ প্ৰশ্নৰ উত্তৰ শুদ্ধ আৰু স্পষ্ট অসমীয়াত দিয়ক।`,
                `- MANDATE: ক’ড আৰু কাৰিকৰী শব্দবোৰ ইংৰাজীত ৰাখক।`
            ].join('\n');

        default:
            return [
                `## LANGUAGE POLICY:`,
                `- Instruction: Respond in the exact language used by the user in their latest message (${languageName}).`,
                `- Keep technical terms and code in standard format.`
            ].join('\n');
    }
}

/**
 * Main Entry Point: Detects response language with prioritized fallback order
 * 
 * Order:
 * 1. Explicit user instruction in latest message
 * 2. Detected language of latest user message
 * 3. Inferred language from conversation history (if message is short/ambiguous)
 * 4. Neutral default: English (never accidental forced Hinglish)
 * 
 * @param {string} message Latest user prompt
 * @param {Array} history Conversation history array
 * @param {Object} options Optional config (e.g. persona override)
 * @returns {Object} Complete language determination metadata
 */
function detectResponseLanguage(message, history = [], options = {}) {
    const rawResult = detectSingleMessageLanguage(message, true);

    // If latest message was ambiguous or very short, attempt inference from history
    let finalResult = rawResult;
    let inferredFromHistory = false;

    if (rawResult.isAmbiguous && Array.isArray(history) && history.length > 0) {
        const historyInference = inferLanguageFromHistory(history);
        if (historyInference) {
            finalResult = {
                ...historyInference,
                confidence: 0.85,
                isAmbiguous: false
            };
            inferredFromHistory = true;
        }
    }

    // Persona override handling (only if explicitly set to a specific non-auto persona)
    const persona = options.persona;
    if (persona && persona !== 'auto' && persona !== 'match_user' && !rawResult.isExplicitOverride) {
        if (persona === 'english') {
            finalResult = {
                language: 'en',
                languageName: 'English',
                script: 'Latin',
                confidence: 0.95,
                isExplicitOverride: true,
                explicitLanguageOverride: 'english',
                isTranslationRequest: false,
                isCodeOrUrl: false,
                isAmbiguous: false
            };
        } else if (persona === 'hinglish' && rawResult.language === 'hinglish') {
            // Only honor hinglish persona if user actually used Hinglish or didn't write pure English
            finalResult = {
                language: 'hinglish',
                languageName: 'Hinglish',
                script: 'Latin (Romanized Hindi-English)',
                confidence: 0.95,
                isExplicitOverride: true,
                explicitLanguageOverride: 'hinglish',
                isTranslationRequest: false,
                isCodeOrUrl: false,
                isAmbiguous: false
            };
        }
    }

    // Build the system prompt directive
    const instruction = buildSystemDirective(finalResult);

    return {
        detectedResponseLanguage: finalResult.language,
        languageName: finalResult.languageName,
        script: finalResult.script,
        languageConfidence: finalResult.confidence,
        isExplicitOverride: finalResult.isExplicitOverride || false,
        explicitLanguageOverride: finalResult.explicitLanguageOverride || null,
        isTranslationRequest: finalResult.isTranslationRequest || false,
        isCodeOrUrl: finalResult.isCodeOrUrl || false,
        inferredFromHistory,
        instruction,
        structuredContext: {
            detectedResponseLanguage: finalResult.language,
            languageConfidence: finalResult.confidence,
            explicitLanguageOverride: finalResult.explicitLanguageOverride || null,
            script: finalResult.script
        }
    };
}

module.exports = {
    detectResponseLanguage,
    detectSingleMessageLanguage,
    inferLanguageFromHistory,
    isCodeOrTechnicalInput,
    buildSystemDirective,
    SCRIPT_RANGES,
    UNAMBIGUOUS_HINGLISH_MARKERS
};
