/**
 * Assessment Intent Classifier & Parameter Extractor
 * AI-Dost v2.0 - Natural Language Assessment Recognition
 */

const INTENTS = {
  QUIZ_START: 'QUIZ_START',
  MOCK_TEST_START: 'MOCK_TEST_START',
  INTERVIEW_MODE: 'INTERVIEW_MODE',
  ADAPTIVE_QUIZ: 'ADAPTIVE_QUIZ',
  PDF_GROUNDED_TEST: 'PDF_GROUNDED_TEST',
  QUIZ_RESUME: 'QUIZ_RESUME',
  QUIZ_RESULT: 'QUIZ_RESULT',
  QUIZ_RETRY: 'QUIZ_RETRY',
  QUIZ_EXPLAIN: 'QUIZ_EXPLAIN',
  NOT_ASSESSMENT: 'NOT_ASSESSMENT',
};

/**
 * Classifies a user query and extracts assessment metadata
 */
function classifyAssessmentIntent(query = '', context = {}) {
  if (!query || typeof query !== 'string') {
    return { isAssessment: false, intent: INTENTS.NOT_ASSESSMENT };
  }

  const text = query.toLowerCase().trim();

  // 1. PDF / Document grounded test intent
  if (
    context.hasPdf ||
    context.uploadedDocs?.length > 0 ||
    /\b(pdf|document|doc|file|is uploaded|is document|uploaded pdf)\b.*\b(test|quiz|question|questions|mock)\b/i.test(text) ||
    /\b(test|quiz|questions?)\b.*\b(from this pdf|from this document|from file|is pdf se|doc se)\b/i.test(text)
  ) {
    const params = extractParams(text, 'practice');
    return {
      isAssessment: true,
      intent: INTENTS.PDF_GROUNDED_TEST,
      mode: 'practice',
      ...params,
    };
  }

  // 2. Adaptive / Weak topic quiz intent
  if (
    /\b(adaptive|weak topics?|weak areas?|kamzor topics?|galatiyan|mistakes?|past mistakes?)\b.*\b(quiz|test|questions?|practice)\b/i.test(text) ||
    /\b(weak topics? par|galatiyon par|adaptive quiz)\b/i.test(text)
  ) {
    const params = extractParams(text, 'adaptive');
    return {
      isAssessment: true,
      intent: INTENTS.ADAPTIVE_QUIZ,
      mode: 'adaptive',
      ...params,
    };
  }

  // 3. Technical Interview mode intent
  if (
    /\b(interview|mock interview|tech interview|technical interview)\b.*\b(quiz|test|questions?|assessment|lo|karao|round)\b/i.test(text) ||
    /\b(mera interview|interview quiz|interview lo)\b/i.test(text)
  ) {
    const params = extractParams(text, 'interview');
    return {
      isAssessment: true,
      intent: INTENTS.INTERVIEW_MODE,
      mode: 'interview',
      ...params,
    };
  }

  // 4. Full Mock test intent (timed, formal, negative marking)
  if (
    /\b(mock test|timed test|exam simulation|mock exam|negative marking)\b/i.test(text) ||
    /\b(\d+\s*questions?|\d+\s*sawal)\b.*\b(mock test|mock lo|mock karao)\b/i.test(text) ||
    /\b(mock test lo|mock test karao|full test lo)\b/i.test(text)
  ) {
    const params = extractParams(text, 'mock');
    return {
      isAssessment: true,
      intent: INTENTS.MOCK_TEST_START,
      mode: 'mock',
      ...params,
      negativeMarks: params.negativeMarks !== undefined ? params.negativeMarks : 0.25,
    };
  }

  // 5. General Quiz intent (Practice mode)
  if (
    /\b(quiz|test|mcq|mcqs|assessment)\b.*\b(lo|karao|kijiye|start|chalu|banao|generate|take|give|do)\b/i.test(text) ||
    /\b(mujhe|mera|humein)\b.*\b(quiz|test|mcq)\b.*\b(karao|chahiye|lo)\b/i.test(text) ||
    /\b(practice test|quick quiz|knowledge check)\b/i.test(text) ||
    /^(python|javascript|react|java|c\+\+|dsa|networking|sql|history|science)\s+(ka\s+)?(quiz|test)$/i.test(text)
  ) {
    const params = extractParams(text, 'practice');
    return {
      isAssessment: true,
      intent: INTENTS.QUIZ_START,
      mode: 'practice',
      ...params,
    };
  }

  // 6. Resume ongoing test
  if (/\b(resume|continue|wapas)\b.*\b(quiz|test|assessment)\b/i.test(text)) {
    return { isAssessment: true, intent: INTENTS.QUIZ_RESUME };
  }

  // 7. Results lookup
  if (/\b(result|score|report|marks|performance)\b.*\b(quiz|test|assessment|dikhao)\b/i.test(text)) {
    return { isAssessment: true, intent: INTENTS.QUIZ_RESULT };
  }

  // 8. Retry test
  if (/\b(retry|retake|dobara|phir se)\b.*\b(quiz|test|assessment)\b/i.test(text)) {
    return { isAssessment: true, intent: INTENTS.QUIZ_RETRY };
  }

  // 9. Explain question
  if (/\b(explain|explanation|samjhao|solution)\b.*\b(question|sawal|q\s*\d+)\b/i.test(text)) {
    return { isAssessment: true, intent: INTENTS.QUIZ_EXPLAIN };
  }

  return { isAssessment: false, intent: INTENTS.NOT_ASSESSMENT };
}

/**
 * Helper to extract topic, questionCount, difficulty, timeLimit, etc.
 */
function extractParams(text, defaultMode = 'practice') {
  // Extract question count (e.g., "20 question", "50-question", "10 sawal")
  let questionCount = 5; // sensible default for chat
  const countMatch = text.match(/(\d+)\s*[-_]?\s*(?:questions?|sawal|mcqs?|items?|problems?)/i);
  if (countMatch) {
    const parsed = parseInt(countMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      questionCount = Math.min(parsed, 50); // cap safely at 50 to prevent timeout/abuse
    }
  } else if (defaultMode === 'mock') {
    questionCount = 10;
  }

  // Extract topic/subject
  let topic = 'General Knowledge';
  const clean = text
    .replace(/\b(mujhe|mera|humein|apna|please|plz|can you|take|start|give|lo|karao|chahiye|ka|ki|ke|par|se|ek|do|banao|generate|create)\b/gi, ' ')
    .replace(/\b(\d+\s*[-_]?\s*(?:questions?|sawal|mcqs?|items?))\b/gi, ' ')
    .replace(/\b(quiz|test|mock test|mock|assessment|interview|adaptive|practice)\b/gi, ' ')
    .replace(/\b(beginner|intermediate|advanced|easy|hard|medium)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length >= 2) {
    topic = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // Detect difficulty
  let difficulty = 'intermediate';
  if (/\b(beginner|easy|basic|aasan|introductory)\b/i.test(text)) {
    difficulty = 'beginner';
  } else if (/\b(advanced|hard|expert|mushkil|tough)\b/i.test(text)) {
    difficulty = 'advanced';
  } else if (/\b(mixed|all levels?|comprehensive)\b/i.test(text)) {
    difficulty = 'mixed';
  }

  // Calculate time limit in seconds
  let timeLimit = 0;
  const timeMatch = text.match(/(\d+)\s*(?:min|minute|minutes|m\b)/i);
  if (timeMatch) {
    timeLimit = parseInt(timeMatch[1], 10) * 60;
  } else if (defaultMode === 'mock') {
    // Standard mock allocation: 60-90 seconds per question
    timeLimit = Math.max(questionCount * 75, 300);
  } else if (defaultMode === 'interview') {
    timeLimit = Math.max(questionCount * 120, 300);
  }

  // Negative marking
  let negativeMarks = 0;
  if (defaultMode === 'mock') {
    negativeMarks = 0.25;
    const negMatch = text.match(/(?:negative\s*marking|negative\s*mark)\s*[:=]?\s*(\d*\.?\d+)/i);
    if (negMatch) {
      const parsed = parseFloat(negMatch[1]);
      if (!isNaN(parsed) && parsed >= 0) negativeMarks = parsed;
    }
  }

  return {
    topic,
    subject: topic,
    questionCount,
    difficulty,
    timeLimit,
    negativeMarks,
  };
}

module.exports = {
  INTENTS,
  classifyAssessmentIntent,
};
