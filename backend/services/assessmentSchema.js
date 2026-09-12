/**
 * Assessment Schema & Client Sanitization Engine
 * AI-Dost v2.0 - Production-grade Assessment & Quiz System
 */

const VALID_MODES = ['practice', 'mock', 'interview', 'adaptive'];
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'mixed'];
const VALID_QUESTION_TYPES = ['mcq', 'multiple-select', 'true-false', 'short-answer'];

/**
 * Validate a question object against strict requirements
 */
function validateQuestion(q, index = 0) {
  const errors = [];
  if (!q || typeof q !== 'object') {
    return { valid: false, errors: [`Question ${index + 1} must be an object`] };
  }

  if (!q.id || typeof q.id !== 'string') {
    errors.push(`Question ${index + 1} missing 'id' string`);
  }

  if (!VALID_QUESTION_TYPES.includes(q.type)) {
    errors.push(`Question ${index + 1} invalid type: ${q.type}. Allowed: ${VALID_QUESTION_TYPES.join(', ')}`);
  }

  if (!q.prompt || typeof q.prompt !== 'string' || q.prompt.trim().length < 5) {
    errors.push(`Question ${index + 1} prompt must be a string of at least 5 characters`);
  }

  // Options validation for non-short-answer
  if (q.type !== 'short-answer') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`Question ${index + 1} (${q.type}) must have at least 2 options`);
    }
  }

  // Correct answer validation
  if (q.correctAnswer === undefined || q.correctAnswer === null) {
    errors.push(`Question ${index + 1} missing correctAnswer`);
  } else if (q.type === 'mcq' || q.type === 'true-false') {
    if (typeof q.correctAnswer !== 'number' && typeof q.correctAnswer !== 'string') {
      errors.push(`Question ${index + 1} correctAnswer must be an index or option string`);
    }
  } else if (q.type === 'multiple-select') {
    if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0) {
      errors.push(`Question ${index + 1} multiple-select correctAnswer must be a non-empty array`);
    }
  } else if (q.type === 'short-answer') {
    if (typeof q.correctAnswer !== 'string' && typeof q.correctAnswer !== 'object') {
      errors.push(`Question ${index + 1} short-answer correctAnswer must be a string or rubric object`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an entire assessment object
 */
function validateAssessment(assessment) {
  const errors = [];
  if (!assessment || typeof assessment !== 'object') {
    return { valid: false, errors: ['Assessment must be an object'] };
  }

  if (!assessment.id || typeof assessment.id !== 'string') {
    errors.push("Missing or invalid 'id'");
  }
  if (!assessment.title || typeof assessment.title !== 'string') {
    errors.push("Missing or invalid 'title'");
  }
  if (!assessment.subject || typeof assessment.subject !== 'string') {
    errors.push("Missing or invalid 'subject'");
  }
  if (!assessment.topic || typeof assessment.topic !== 'string') {
    errors.push("Missing or invalid 'topic'");
  }
  if (!VALID_MODES.includes(assessment.mode)) {
    errors.push(`Invalid mode: ${assessment.mode}. Allowed: ${VALID_MODES.join(', ')}`);
  }
  if (!VALID_DIFFICULTIES.includes(assessment.difficulty)) {
    errors.push(`Invalid difficulty: ${assessment.difficulty}. Allowed: ${VALID_DIFFICULTIES.join(', ')}`);
  }

  if (!Array.isArray(assessment.questions) || assessment.questions.length === 0) {
    errors.push('Assessment must contain at least 1 question');
  } else {
    assessment.questions.forEach((q, idx) => {
      const qVal = validateQuestion(q, idx);
      if (!qVal.valid) {
        errors.push(...qVal.errors);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize assessment for client-side delivery before test submission.
 * CRITICAL SECURITY INVARIANT:
 * Neither correctAnswer nor full explanations are exposed to the client in mock/test mode.
 */
function sanitizeAssessmentForClient(assessment, options = {}) {
  if (!assessment) return null;
  const isPractice = assessment.mode === 'practice';
  const includeExplanation = options.includeExplanation || false;

  return {
    id: assessment.id,
    title: assessment.title,
    subject: assessment.subject,
    topic: assessment.topic,
    mode: assessment.mode,
    difficulty: assessment.difficulty,
    timeLimit: assessment.timeLimit || 0,
    negativeMarks: assessment.negativeMarks || 0,
    questionCount: assessment.questions?.length || 0,
    created_at: assessment.created_at || new Date().toISOString(),
    questions: (assessment.questions || []).map((q) => {
      const cleanQ = {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options ? [...q.options] : [],
        marks: q.marks !== undefined ? q.marks : 1,
        negativeMarks: q.negativeMarks !== undefined ? q.negativeMarks : 0,
        topic: q.topic || assessment.topic,
        sourceReferences: q.sourceReferences || null,
      };

      // In practice mode, hints may be provided to aid learning
      if (isPractice && q.hint) {
        cleanQ.hint = q.hint;
      }

      // Explanations are ONLY included if explicitly requested (e.g. review mode after submission)
      if (includeExplanation && q.explanation) {
        cleanQ.explanation = q.explanation;
      }

      // Security: correctAnswer is NEVER included in client-safe projection
      return cleanQ;
    }),
  };
}

module.exports = {
  VALID_MODES,
  VALID_DIFFICULTIES,
  VALID_QUESTION_TYPES,
  validateQuestion,
  validateAssessment,
  sanitizeAssessmentForClient,
};
