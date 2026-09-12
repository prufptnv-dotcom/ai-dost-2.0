/**
 * Assessment Generator Service
 * AI-Dost v2.0 - High-fidelity question generator with PDF grounding & adaptive learning
 */

const crypto = require('crypto');
const logger = require('../logger');
const { validateAssessment } = require('./assessmentSchema');
const GroqService = require('./groqService');
const GeminiService = require('./geminiService');
const MistralService = require('./mistralService');
const TogetherService = require('./togetherService');
const OpenRouterService = require('./openrouterService');

// Built-in high-quality fallback question banks for offline resilience
const FALLBACK_QUESTION_BANKS = {
  python: [
    {
      id: 'q1',
      type: 'mcq',
      prompt: 'Python mein list aur tuple ke beech primary difference kya hai?',
      options: ['List mutable hai, tuple immutable hai', 'List immutable hai, tuple mutable hai', 'Tuple mein duplicate values nahi ho sakti', 'List memory kam use karta hai'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Data Types',
      explanation: 'Python mein Lists mutable hoti hain (elements change/add/remove ho sakte hain), jabki Tuples immutable hoti hain once created.',
      hint: 'Think about mutability after creation.'
    },
    {
      id: 'q2',
      type: 'mcq',
      prompt: 'What will be the output of `bool([])` in Python?',
      options: ['True', 'False', 'None', 'TypeError'],
      correctAnswer: 1,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Type Casting & Truthiness',
      explanation: 'Python mein empty collections jaise empty list `[]`, dictionary `{}`, string `""` falsy evaluate hote hain.',
      hint: 'Empty containers have falsy values in boolean context.'
    },
    {
      id: 'q3',
      type: 'mcq',
      prompt: 'Python mein `@decorator` syntax kis pattern ko represent karta hai?',
      options: ['Higher-Order Function jo dusre function ko modify/extend karti hai', 'Class Inheritance decorator', 'Memory Garbage collector', 'Multi-threading scheduler'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Functions & Decorators',
      explanation: 'Decorators higher-order functions hote hain jo kisi function ko wrap karke uske behavior ko extend ya modify karte hain bina source code badle.',
      hint: 'It wraps a callable function.'
    },
    {
      id: 'q4',
      type: 'true-false',
      prompt: 'Python dictionary keys immutable objects honi chahiye (must be hashable).',
      options: ['True', 'False'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Dictionaries',
      explanation: 'Dictionaries hash table par based hoti hain, isliye keys hashable aur immutable honi chahiye (jaise strings, numbers, tuples).',
      hint: 'Keys must be hashable.'
    },
    {
      id: 'q5',
      type: 'mcq',
      prompt: '`*args` aur `**kwargs` ka Python functions mein use kya hota hai?',
      options: ['Variable number of positional and keyword arguments pass karna', 'Recursion depth badhana', 'Pointers manipulate karna', 'Memory allocate karna'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Functions',
      explanation: '`*args` arbitrary positional arguments ko tuple ke roop mein receive karta hai aur `**kwargs` arbitrary keyword arguments ko dictionary ke roop mein receive karta hai.',
      hint: 'Used for variable length arguments.'
    }
  ],
  javascript: [
    {
      id: 'q1',
      type: 'mcq',
      prompt: 'JavaScript mein `==` aur `===` ke beech kya difference hai?',
      options: ['`===` type coercion nahi karta (strict equality), jabki `==` coercion karta hai', '`==` strict comparison karta hai', '`===` sirf primitive types compare karta hai', 'Dono identical behave karte hain'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Equality Operators',
      explanation: '`===` strict equality operator hai jo value aur type dono check karta hai bina type coercion kiye.',
      hint: 'One performs type coercion and the other does not.'
    },
    {
      id: 'q2',
      type: 'mcq',
      prompt: 'JavaScript Event Loop mein Microtask queue (Promises) aur Macrotask queue (setTimeout) ka execution order kya hota hai?',
      options: ['Microtasks macrotasks se pehle execute hote hain', 'Macrotasks hamesha microtasks se pehle execute hote hain', 'Dono round-robin alternate order mein chalte hain', 'Order unpredictable hota hai'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Event Loop & Asynchrony',
      explanation: 'Current call stack clear hone ke baad Event Loop pehle Microtask queue (Promise callbacks, queueMicrotask) ko pura drain karta hai, fir agla Macrotask (setTimeout/setInterval) pick karta hai.',
      hint: 'Promises take priority over setTimeout.'
    },
    {
      id: 'q3',
      type: 'true-false',
      prompt: 'JavaScript mein `const` variable ke properties/elements modify kiye ja sakte hain agar wo object ya array ho.',
      options: ['True', 'False'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Variables & Scope',
      explanation: '`const` variable reassignment ko block karta hai, lekin object ke internal properties ko mutate karne se nahi rokta.',
      hint: 'Object mutation is allowed, rebinding is not.'
    },
    {
      id: 'q4',
      type: 'mcq',
      prompt: 'Closure JavaScript mein kya hota hai?',
      options: ['Function jo apne outer lexical scope ke variables ko remember karta hai', 'Function ko memory se free karne ka process', 'Loop ko break karne ka syntax', 'DOM node ko close karne ka method'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Closures & Scope',
      explanation: 'Closure tab banta hai jab koi inner function apne parent function ke lexical scope ke variables ko access karta hai, even after the parent function has finished executing.',
      hint: 'Lexical scoping preservation.'
    },
    {
      id: 'q5',
      type: 'mcq',
      prompt: 'Array method `map()` aur `forEach()` mein core difference kya hai?',
      options: ['`map()` naya array return karta hai, `forEach()` `undefined` return karta hai', '`forEach()` naya array banata hai', '`map()` original array ko mutate karta hai', 'Dono same return karte hain'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Array Methods',
      explanation: '`map()` transform karke har element ke output se naya array return karta hai, jabki `forEach()` side-effects ke liye use hota hai aur `undefined` return karta hai.',
      hint: 'One returns a transformed array.'
    }
  ],
  networking: [
    {
      id: 'q1',
      type: 'mcq',
      prompt: 'OSI Model mein Transport layer par kaun se primary protocols operate karte hain?',
      options: ['TCP aur UDP', 'IP aur ICMP', 'HTTP aur DNS', 'Ethernet aur Wi-Fi'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'OSI Layer & Protocols',
      explanation: 'Transport layer (Layer 4) par Transmission Control Protocol (TCP) aur User Datagram Protocol (UDP) end-to-end communication provide karte hain.',
      hint: 'Connection-oriented and connectionless layer 4 protocols.'
    },
    {
      id: 'q2',
      type: 'mcq',
      prompt: 'TCP 3-Way Handshake ka correct sequence kya hai connection establish karne ke liye?',
      options: ['SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> SYN-ACK', 'SYN -> ACK -> DATA', 'FIN -> ACK -> FIN-ACK'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'TCP Handshake',
      explanation: 'TCP connection initiate karne ke liye client SYN bhejta hai, server SYN-ACK se respond karta hai, aur client ACK bhejta hai.',
      hint: 'Synchronize, Synchronize-Acknowledge, Acknowledge.'
    },
    {
      id: 'q3',
      type: 'mcq',
      prompt: 'DNS (Domain Name System) kis standard port par operate karta hai?',
      options: ['Port 53', 'Port 80', 'Port 443', 'Port 22'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'Standard Ports',
      explanation: 'DNS queries default standard port 53 (UDP & TCP) par listen karti hain.',
      hint: 'Between 50 and 60.'
    },
    {
      id: 'q4',
      type: 'true-false',
      prompt: 'UDP protocol packet delivery guarantee aur retransmission provide karta hai.',
      options: ['True', 'False'],
      correctAnswer: 1,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'UDP Characteristics',
      explanation: 'UDP connectionless protocol hai jo best-effort delivery karta hai bina acknowledgment ya retransmission ke. Reliable delivery TCP provide karta hai.',
      hint: 'UDP is connectionless and does not guarantee delivery.'
    },
    {
      id: 'q5',
      type: 'mcq',
      prompt: 'Subnet Mask `255.255.255.0` ka CIDR notation kya hota hai?',
      options: ['/24', '/16', '/8', '/32'],
      correctAnswer: 0,
      marks: 1,
      negativeMarks: 0.25,
      topic: 'IP Subnetting',
      explanation: '255.255.255.0 mein pehle 3 octets (8 + 8 + 8 = 24 bits) 1s hote hain, isliye CIDR `/24` kehlata hai.',
      hint: '3 octets of 8 bits.'
    }
  ]
};

/**
 * Generate an assessment using AI cascade with fallback
 */
async function generateAssessment(options = {}) {
  const {
    topic = 'Python Programming',
    subject = 'Computer Science',
    mode = 'practice',
    difficulty = 'intermediate',
    questionCount = 5,
    timeLimit = 0,
    negativeMarks = 0,
    docContent = null,
    docName = null,
    weakTopics = []
  } = options;

  const assessmentId = `asmt_${crypto.randomUUID().slice(0, 10)}`;
  const actualCount = Math.min(Math.max(questionCount, 3), 30);

  // If document grounding is requested, construct grounded prompt
  let systemPrompt = '';
  let userPrompt = '';

  if (docContent && docContent.trim().length > 100) {
    const truncatedContent = docContent.slice(0, 12000);
    systemPrompt = `You are an expert academic examiner and psychometrician.
Generate exactly ${actualCount} rigorous, high-quality assessment questions STRICTLY based on the provided document content.
DO NOT fabricate facts or test external knowledge not present in the document.
For each question, provide:
1. Clear, unambiguous prompt
2. Question type: "mcq", "multiple-select", "true-false", or "short-answer"
3. Options array for non-short-answer questions
4. correctAnswer (0-indexed integer for MCQ, array of integers for multiple-select, or detailed model answer for short-answer)
5. Comprehensive explanation
6. sourceReferences: { source: "${docName || 'Document'}", excerpt: "brief verbatim quote from text supporting the answer" }
7. topic/subtopic name
8. hint (for learning)

Output MUST be a single, valid JSON object matching:
{
  "title": "Assessment Title",
  "subject": "${subject}",
  "topic": "${topic}",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "...",
      "hint": "...",
      "topic": "...",
      "sourceReferences": { "source": "${docName || 'Document'}", "excerpt": "..." }
    }
  ]
}`;
    userPrompt = `DOCUMENT CONTENT:\n${truncatedContent}\n\nGenerate ${actualCount} questions based ONLY on this text.`;
  } else if (mode === 'adaptive' && weakTopics.length > 0) {
    systemPrompt = `You are an adaptive tutor. The user has struggled in the following weak topics: ${weakTopics.join(', ')}.
Generate an adaptive assessment of exactly ${actualCount} questions focusing heavily on these weak areas to reinforce foundational concepts and bridge skill gaps.
Difficulty: ${difficulty}.
Output MUST be a single, valid JSON object with: title, subject, topic, and questions array.`;
    userPrompt = `Generate ${actualCount} adaptive questions on: ${topic}. Focus areas: ${weakTopics.join(', ')}.`;
  } else {
    systemPrompt = `You are an expert assessment creator.
Generate an assessment of exactly ${actualCount} questions on the topic "${topic}" (${subject}).
Mode: ${mode}. Difficulty: ${difficulty}.
Questions should test conceptual understanding, problem-solving, and practical knowledge.
Output MUST be a single, valid JSON object matching:
{
  "title": "Assessment Title",
  "subject": "${subject}",
  "topic": "${topic}",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0,
      "marks": 1,
      "negativeMarks": ${negativeMarks},
      "explanation": "...",
      "hint": "...",
      "topic": "subtopic"
    }
  ]
}`;
    userPrompt = `Create ${actualCount} ${difficulty} level questions on "${topic}".`;
  }

  // AI Generation Cascade
  let rawJson = null;
  const providers = [
    { name: 'Groq', fn: () => GroqService.chat(`${systemPrompt}\n\n${userPrompt}\nOutput ONLY pure JSON.`, [], 'chat') },
    { name: 'Gemini', fn: () => GeminiService.chat(`${systemPrompt}\n\n${userPrompt}\nOutput ONLY pure JSON.`, [], 'chat') },
    { name: 'Mistral', fn: () => MistralService.chat(`${systemPrompt}\n\n${userPrompt}\nOutput ONLY pure JSON.`, [], 'chat') },
    { name: 'Together', fn: () => TogetherService.chat(`${systemPrompt}\n\n${userPrompt}\nOutput ONLY pure JSON.`, [], 'chat') },
    { name: 'OpenRouter', fn: () => OpenRouterService.chat(`${systemPrompt}\n\n${userPrompt}\nOutput ONLY pure JSON.`, [], 'chat') }
  ];

  for (const p of providers) {
    try {
      const response = await Promise.race([
        p.fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${p.name} timeout (5s)`)), 5000))
      ]);
      if (response && !response.toLowerCase().includes('error')) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            rawJson = parsed;
            logger.info(`[AssessmentGenerator] Successfully generated via ${p.name}`);
            break;
          }
        }
      }
    } catch (err) {
      logger.warn(`[AssessmentGenerator] Provider ${p.name} failed:`, err.message);
    }
  }

  // Process and sanitize AI output or build fallback
  let assessment;
  if (rawJson && Array.isArray(rawJson.questions)) {
    let processedQuestions = rawJson.questions.map((q, idx) => ({
      id: q.id || `q${idx + 1}`,
      type: q.type || (q.options?.length ? 'mcq' : 'short-answer'),
      prompt: q.prompt || `Question ${idx + 1}`,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0,
      marks: q.marks || 1,
      negativeMarks: q.negativeMarks !== undefined ? q.negativeMarks : (mode === 'mock' ? 0.25 : 0),
      topic: q.topic || topic,
      explanation: q.explanation || 'Refer to standard documentation for this topic.',
      hint: q.hint || 'Review fundamental concepts.',
      sourceReferences: q.sourceReferences || null
    }));

    // If document content provided, rigorously verify citations and eliminate hallucinations
    if (docContent && docContent.trim().length > 100) {
      const lowerDoc = docContent.toLowerCase();
      processedQuestions = processedQuestions.map(q => {
        let ref = q.sourceReferences;
        if (!ref || typeof ref !== 'object') {
          ref = { source: docName || 'Document', excerpt: null };
        }
        if (ref.excerpt) {
          const isVerbatim = lowerDoc.includes(ref.excerpt.toLowerCase().trim());
          ref.verified = isVerbatim;
        } else {
          ref.verified = false;
        }
        return { ...q, sourceReferences: ref };
      });
    }

    assessment = {
      id: assessmentId,
      title: rawJson.title || `${topic} Assessment`,
      subject: rawJson.subject || subject,
      topic: rawJson.topic || topic,
      mode,
      difficulty,
      timeLimit: timeLimit || (mode === 'mock' ? actualCount * 75 : 0),
      negativeMarks: negativeMarks || (mode === 'mock' ? 0.25 : 0),
      created_at: new Date().toISOString(),
      questions: processedQuestions
    };
  } else if (docContent && docContent.trim().length > 100) {
    // Document-grounded deterministic fallback (avoids serving unrelated programming questions)
    const sentences = docContent
      .split(/[.\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 220);

    const questions = [];
    const count = Math.min(sentences.length, actualCount);
    for (let i = 0; i < count; i++) {
      const s = sentences[i];
      questions.push({
        id: `q${i + 1}`,
        type: 'true-false',
        prompt: `According to the document: "${s}"`,
        options: ['True', 'False'],
        correctAnswer: 0,
        marks: 1,
        negativeMarks: mode === 'mock' ? (negativeMarks || 0.25) : 0,
        topic: docName || 'Document Grounding',
        explanation: `Explicitly stated in the document source text: "${s}"`,
        hint: 'Refer to the provided document excerpt.',
        sourceReferences: {
          source: docName || 'Document',
          excerpt: s.slice(0, 160),
          verified: true
        }
      });
    }

    assessment = {
      id: assessmentId,
      title: `${docName || topic} Grounded Assessment`,
      subject,
      topic,
      mode,
      difficulty,
      timeLimit: timeLimit || (mode === 'mock' ? questions.length * 75 : 0),
      negativeMarks: mode === 'mock' ? (negativeMarks || 0.25) : 0,
      created_at: new Date().toISOString(),
      questions
    };
  } else {
    // Robust template fallback
    const key = Object.keys(FALLBACK_QUESTION_BANKS).find(k => topic.toLowerCase().includes(k)) || 'python';
    const bank = FALLBACK_QUESTION_BANKS[key] || FALLBACK_QUESTION_BANKS.python;
    const questions = bank.slice(0, actualCount).map((q, idx) => ({
      ...q,
      id: `q${idx + 1}`,
      negativeMarks: mode === 'mock' ? (negativeMarks || 0.25) : 0
    }));

    assessment = {
      id: assessmentId,
      title: `${topic} ${mode === 'mock' ? 'Mock Test' : 'Quiz'}`,
      subject,
      topic,
      mode,
      difficulty,
      timeLimit: timeLimit || (mode === 'mock' ? questions.length * 75 : 0),
      negativeMarks: mode === 'mock' ? (negativeMarks || 0.25) : 0,
      created_at: new Date().toISOString(),
      questions
    };
  }

  // Schema validation
  const validation = validateAssessment(assessment);
  if (!validation.valid) {
    logger.warn('[AssessmentGenerator] Schema validation issues:', validation.errors);
  }

  return assessment;
}

module.exports = {
  generateAssessment,
  FALLBACK_QUESTION_BANKS
};
