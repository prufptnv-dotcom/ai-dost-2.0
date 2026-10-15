const test = require('node:test');
const assert = require('node:assert');
const {
    detectResponseLanguage,
    detectSingleMessageLanguage,
    inferLanguageFromHistory,
    isCodeOrTechnicalInput
} = require('../services/languageDetector');

test('Response-Language Matching - Automated Test Suite', async (t) => {

    await t.test('1. English input -> English response instruction', () => {
        const queries = [
            'Please explain the authentication flow in microservices architecture.',
            'How do I fix a memory leak in Node.js?',
            'What is the difference between processes and threads in operating systems?',
            'Can you help me design a RESTful API for a library management system?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'en', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'English');
            assert.strictEqual(result.isExplicitOverride, false);
            assert.ok(result.instruction.includes('Target Language: English'));
            assert.ok(result.instruction.includes('Do NOT reply in Hinglish or Hindi'));
        }
    });

    await t.test('2. Hindi Devanagari input -> Hindi response instruction', () => {
        const queries = [
            'कृपया मुझे प्रमाणीकरण प्रवाह समझाइए।',
            'कंप्यूटर नेटवर्किंग में ओएसआई मॉडल की सात परतें कौन-कौन सी हैं?',
            'मुझे लॉगिन करने में समस्या आ रही है, क्या आप मेरी सहायता कर सकते हैं?',
            'प्रक्रिया और थ्रेड में क्या मुख्य अंतर होता है?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'hi', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Hindi');
            assert.strictEqual(result.script, 'Devanagari');
            assert.ok(result.instruction.includes('Target Language: Hindi'));
            assert.ok(result.instruction.includes('देवनागरी लिपि'));
        }
    });

    await t.test('3. Hinglish input -> Hinglish response instruction', () => {
        const queries = [
            'Mujhe login issue aa raha hai, please help karo',
            'Mujhe authentication flow samjhao detail me',
            'Bhai next.js me routing kaise kaam karti hai batao',
            'Docker container build fail ho gaya hai, logs check kaise karein?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'hinglish', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Hinglish');
            assert.ok(result.instruction.includes('Target Language: Hinglish'));
            assert.ok(result.instruction.includes('Do NOT force Devanagari script'));
        }
    });

    await t.test('4. Bengali input -> Bengali response instruction', () => {
        const queries = [
            'আমাকে প্রমাণীকরণ প্রবাহ বিস্তারিতভাবে বুঝিয়ে দিন।',
            'অপারেটিং সিস্টেমে প্রসেস এবং থ্রেডের মধ্যে মূল পার্থক্য কী?',
            'আমি কীভাবে রিঅ্যাক্ট অ্যাপ্লিকেশনে স্টেট ম্যানেজমেন্ট করব?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'bn', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Bengali');
            assert.ok(result.instruction.includes('Target Language: Bengali'));
        }
    });

    await t.test('5. Tamil input -> Tamil response instruction', () => {
        const queries = [
            'அங்கீகார ஓட்டத்தை விரிவாக விளக்குங்கள்.',
            'செயல்முறை மற்றும் த்ரெட் இடையே உள்ள வேறுபாடு என்ன?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'ta', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Tamil');
            assert.ok(result.instruction.includes('Target Language: Tamil'));
        }
    });

    await t.test('6. Telugu input -> Telugu response instruction', () => {
        const queries = [
            'ప్రామాణీకరణ ప్రవాహాన్ని నాకు వివరంగా వివరించండి.',
            'ఆపరేటింగ్ సిస్టమ్‌లో ప్రాసెస్ మరియు థ్రెడ్ మధ్య తేడా ఏమిటి?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'te', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Telugu');
            assert.ok(result.instruction.includes('Target Language: Telugu'));
        }
    });

    await t.test('7. Marathi input (Devanagari) -> Marathi response instruction', () => {
        const queries = [
            'मला प्रमाणीकरण प्रवाह समजावून सांगा, कसा आहे ते.',
            'ऑपरेटिंग सिस्टीममध्ये प्रोसेस आणि थ्रेडमध्ये काय फरक आहे?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'mr', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Marathi');
            assert.ok(result.instruction.includes('Target Language: Marathi'));
        }
    });

    await t.test('8. Gujarati input -> Gujarati response instruction', () => {
        const queries = [
            'મને પ્રમાણીકરણ પ્રવાહ વિગતવાર સમજાવો.',
            'પ્રોસેસ અને થ્રેડ વચ્ચે શું તફાવત છે?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'gu', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Gujarati');
            assert.ok(result.instruction.includes('Target Language: Gujarati'));
        }
    });

    await t.test('9. Punjabi input -> Punjabi response instruction', () => {
        const queries = [
            'ਮੈਨੂੰ ਪ੍ਰਮਾਣੀਕਰਨ ਪ੍ਰਵਾਹ ਬਾਰੇ ਵਿਸਥਾਰ ਨਾਲ ਦੱਸੋ.',
            'ਪ੍ਰੋਸੈਸ ਅਤੇ ਥਰਿੱਡ ਵਿਚਕਾਰ ਕੀ ਅੰਤਰ ਹੈ?'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'pa', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Punjabi');
            assert.ok(result.instruction.includes('Target Language: Punjabi'));
        }
    });

    await t.test('10. Urdu input -> Urdu response instruction', () => {
        const queries = [
            'مجھے تصدیق کا بہاؤ تفصیل سے سمجھائیں.',
            'آپریٹنگ سسٹم میں عمل اور تھریڈ کے درمیان کیا فرق ہے؟'
        ];

        for (const q of queries) {
            const result = detectResponseLanguage(q);
            assert.strictEqual(result.detectedResponseLanguage, 'ur', `Failed for query: ${q}`);
            assert.strictEqual(result.languageName, 'Urdu');
            assert.ok(result.instruction.includes('Target Language: Urdu'));
        }
    });

    await t.test('11. Explicit language overrides take precedence (Priority 2a)', () => {
        const testCases = [
            { query: 'Explain processes and threads, but answer in English please', expected: 'en' },
            { query: 'Explain processes and threads, Hindi me batao', expected: 'hi' },
            { query: 'How does React work? Respond in Bengali', expected: 'bn' },
            { query: 'What is an operating system? Answer in Tamil', expected: 'ta' },
            { query: 'Ye topic bahut difficult hai, hinglish me samjhao please', expected: 'hinglish' },
            { query: 'Explain Docker architecture. Marathi madhe sanga', expected: 'mr' }
        ];

        for (const tc of testCases) {
            const result = detectResponseLanguage(tc.query);
            assert.strictEqual(result.detectedResponseLanguage, tc.expected, `Failed for query: ${tc.query}`);
            assert.strictEqual(result.isExplicitOverride, true);
            assert.strictEqual(result.languageConfidence, 1.0);
        }
    });

    await t.test('12. Translation requests are identified accurately (Requirement 3)', () => {
        const q = 'Translate this text: "The server encountered an unexpected error" to Hindi';
        const result = detectResponseLanguage(q);
        assert.strictEqual(result.isTranslationRequest, true);
        assert.ok(result.instruction.includes('TRANSLATION MANDATE'));
    });

    await t.test('13. Code-only and URL-only input', () => {
        const codeInput = `
const express = require('express');
const app = express();
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(3000);
        `;
        const codeResult = detectResponseLanguage(codeInput);
        assert.strictEqual(codeResult.isCodeOrUrl, true);
        assert.strictEqual(codeResult.detectedResponseLanguage, 'en');

        const urlInput = 'https://github.com/facebook/react/issues/12345';
        const urlResult = detectResponseLanguage(urlInput);
        assert.strictEqual(urlResult.isCodeOrUrl, true);
        assert.strictEqual(urlResult.detectedResponseLanguage, 'en');
    });

    await t.test('14. Mixed-language input with technical English terms inside Hindi syntax', () => {
        // Technical English words inside Hindi grammar -> MUST be Hinglish, NOT English!
        const query = 'Main React component me useEffect hook use kar raha hoon lekin dependency array me error aa raha hai';
        const result = detectResponseLanguage(query);
        assert.strictEqual(result.detectedResponseLanguage, 'hinglish');
        assert.strictEqual(result.languageName, 'Hinglish');
    });

    await t.test('15. Short ambiguous input infers from history, defaults to English if empty', () => {
        // Without history: "Hi" or "Ok" -> English (never accidental forced Hinglish)
        const emptyResult = detectResponseLanguage('Hi');
        assert.strictEqual(emptyResult.detectedResponseLanguage, 'en');
        assert.strictEqual(emptyResult.inferredFromHistory, false);

        // With previous Hindi history: "Ok" -> infers Hindi
        const hindiHistory = [
            { role: 'user', content: 'मुझे जावास्क्रिप्ट में प्रॉमिस कैसे काम करते हैं समझाइए' },
            { role: 'assistant', content: 'जावास्क्रिप्ट में प्रॉमिस असिंक्रोनस ऑपरेशन्स को हैंडल करने का तरीका है...' }
        ];
        const inferredHindi = detectResponseLanguage('Ok', hindiHistory);
        assert.strictEqual(inferredHindi.detectedResponseLanguage, 'hi');
        assert.strictEqual(inferredHindi.inferredFromHistory, true);

        // With previous English history: "Why?" -> infers English
        const englishHistory = [
            { role: 'user', content: 'Why should we avoid mutating state directly in React?' },
            { role: 'assistant', content: 'Mutating state directly bypasses React re-render cycle...' }
        ];
        const inferredEnglish = detectResponseLanguage('Why?', englishHistory);
        assert.strictEqual(inferredEnglish.detectedResponseLanguage, 'en');
        assert.strictEqual(inferredEnglish.inferredFromHistory, true);
    });

    await t.test('16. Structured context contract for streaming and API responses', () => {
        const result = detectResponseLanguage('Please explain how Docker containers work');
        assert.ok(result.structuredContext);
        assert.strictEqual(result.structuredContext.detectedResponseLanguage, 'en');
        assert.ok(typeof result.structuredContext.languageConfidence === 'number');
        assert.strictEqual(result.structuredContext.script, 'Latin');
    });

    await t.test('17. Kannada, Malayalam, Odia, and Assamese inputs', () => {
        // Kannada
        const kn = detectResponseLanguage('ಪ್ರಾಮಾಣೀಕರಣ ಪ್ರಕ್ರಿಯೆಯನ್ನು ವಿವರಿಸಿ');
        assert.strictEqual(kn.detectedResponseLanguage, 'kn');
        assert.strictEqual(kn.languageName, 'Kannada');

        // Malayalam
        const ml = detectResponseLanguage('പ്രമാണീകരണ പ്രക്രിയ വിശദീകരിക്കുക');
        assert.strictEqual(ml.detectedResponseLanguage, 'ml');
        assert.strictEqual(ml.languageName, 'Malayalam');

        // Odia
        const od = detectResponseLanguage('ପ୍ରମାଣୀକରଣ ପ୍ରକ୍ରିୟା ବୁଝାନ୍ତୁ');
        assert.strictEqual(od.detectedResponseLanguage, 'or');
        assert.strictEqual(od.languageName, 'Odia');

        // Assamese
        const as = detectResponseLanguage('প্ৰমাণীকৰণ প্ৰক্ৰিয়াটো বুজাই দিয়ক');
        assert.strictEqual(as.detectedResponseLanguage, 'as');
        assert.strictEqual(as.languageName, 'Assamese');
    });

    await t.test('18. Consecutive message language switching maintains latest message priority', () => {
        // Step 1: User asks in English
        const r1 = detectResponseLanguage('Explain binary search trees');
        assert.strictEqual(r1.detectedResponseLanguage, 'en');

        // Step 2: In the same conversation, user switches to Hindi
        const history1 = [
            { role: 'user', content: 'Explain binary search trees' },
            { role: 'assistant', content: 'A binary search tree is a node-based binary tree data structure...' }
        ];
        const r2 = detectResponseLanguage('बाइनरी सर्च ट्री कैसे काम करता है?', history1);
        assert.strictEqual(r2.detectedResponseLanguage, 'hi', 'Must prioritize latest user message in Hindi over previous English');

        // Step 3: User then switches to Hinglish
        const history2 = [
            ...history1,
            { role: 'user', content: 'बाइनरी सर्च ट्री कैसे काम करता है?' },
            { role: 'assistant', content: 'बाइनरी सर्च ट्री एक डेटा स्ट्रक्चर है...' }
        ];
        const r3 = detectResponseLanguage('Bhai iska time complexity bhi samjha do', history2);
        assert.strictEqual(r3.detectedResponseLanguage, 'hinglish', 'Must switch to Hinglish when latest message is Hinglish');

        // Step 4: User switches back to English with explicit instruction
        const r4 = detectResponseLanguage('Give me the C++ implementation, answer in English', history2);
        assert.strictEqual(r4.detectedResponseLanguage, 'en');
        assert.strictEqual(r4.isExplicitOverride, true);
    });

    await t.test('19. Streaming language lock contract', () => {
        const query = 'অপারেটিং সিস্টেমে মেমরি ম্যানেজমেন্ট কীভাবে কাজ করে?';
        const langInfo = detectResponseLanguage(query);
        assert.strictEqual(langInfo.detectedResponseLanguage, 'bn');

        // Simulating the SSE lock payload emitted before streaming tokens
        const lockPayload = {
            type: 'language_lock',
            detectedResponseLanguage: langInfo.detectedResponseLanguage,
            languageName: langInfo.languageName,
            languageConfidence: langInfo.languageConfidence,
            script: langInfo.script,
            explicitLanguageOverride: langInfo.isExplicitOverride
        };

        assert.strictEqual(lockPayload.type, 'language_lock');
        assert.strictEqual(lockPayload.detectedResponseLanguage, 'bn');
        assert.strictEqual(lockPayload.languageName, 'Bengali');
        assert.ok(lockPayload.languageConfidence >= 0.95);
    });

    await t.test('20. No accidental forced Hinglish for standard English technical prompts', () => {
        const englishPrompts = [
            'Create a full stack todo app with Node.js and MongoDB',
            'Write a unit test with Jest for authentication middleware',
            'Refactor this function to reduce cyclomatic complexity',
            'What is the event loop in Node.js runtime?'
        ];

        for (const prompt of englishPrompts) {
            const res = detectResponseLanguage(prompt);
            assert.strictEqual(res.detectedResponseLanguage, 'en', `Falsely classified as ${res.detectedResponseLanguage} for: ${prompt}`);
            assert.ok(res.instruction.includes('Target Language: English'), 'Instruction must target English');
            assert.ok(res.instruction.includes('Do NOT reply in Hinglish'), 'Instruction must prohibit Hinglish for pure English queries');
        }
    });

});

