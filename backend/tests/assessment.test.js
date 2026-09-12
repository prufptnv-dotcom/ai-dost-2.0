/**
 * Assessment & Quiz Capability Test Suite
 * AI-Dost v2.0 - Automated Unit & Integration Tests
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  validateQuestion,
  validateAssessment,
  sanitizeAssessmentForClient
} = require('../services/assessmentSchema');
const {
  classifyAssessmentIntent,
  INTENTS
} = require('../services/assessmentIntentClassifier');
const {
  evaluateAssessment,
  evaluateShortAnswerWithAi
} = require('../services/assessmentEvaluatorService');
const { generateAssessment, FALLBACK_QUESTION_BANKS } = require('../services/assessmentGeneratorService');
const assessmentDAO = require('../db/dao/AssessmentDAO');
const AssessmentTool = require('../agent/tools/AssessmentTool');

describe('📋 1. Assessment Schema Validation & Security Sanitization', () => {
  const sampleAssessment = {
    id: 'asmt_test_001',
    title: 'Python Core Assessment',
    subject: 'Computer Science',
    topic: 'Python',
    mode: 'practice',
    difficulty: 'intermediate',
    timeLimit: 600,
    negativeMarks: 0,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        prompt: 'What is the output of type([]) in Python?',
        options: ["<class 'list'>", "<class 'tuple'>", "<class 'dict'>", "<class 'set'>"],
        correctAnswer: 0,
        explanation: 'In Python, [] denotes a list.',
        marks: 1,
        negativeMarks: 0,
        hint: 'Square brackets denote lists.'
      },
      {
        id: 'q2',
        type: 'multiple-select',
        prompt: 'Which of the following are immutable in Python?',
        options: ['tuple', 'string', 'list', 'dict'],
        correctAnswer: [0, 1],
        explanation: 'Tuples and strings are immutable.',
        marks: 2,
        negativeMarks: 0.5
      },
      {
        id: 'q3',
        type: 'short-answer',
        prompt: 'Explain what a generator is in Python and how it differs from a regular function.',
        options: [],
        correctAnswer: 'A generator produces items lazily using yield without storing entire sequence in memory.',
        explanation: 'Generators return iterators using yield.',
        marks: 2,
        negativeMarks: 0
      }
    ]
  };

  test('valid assessment passes validation', () => {
    const val = validateAssessment(sampleAssessment);
    assert.equal(val.valid, true);
    assert.equal(val.errors.length, 0);
  });

  test('rejects assessment with missing title or invalid mode', () => {
    const bad = { ...sampleAssessment, mode: 'invalid-mode', title: '' };
    const val = validateAssessment(bad);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('mode')));
  });

  test('rejects MCQ question with fewer than 2 options', () => {
    const badQ = {
      id: 'q_bad',
      type: 'mcq',
      prompt: 'Is this valid?',
      options: ['Only one option'],
      correctAnswer: 0
    };
    const val = validateQuestion(badQ);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('at least 2 options')));
  });

  test('🛡️ CLIENT SANITIZATION: strictly strips correctAnswer in practice and mock modes', () => {
    const sanitizedPractice = sanitizeAssessmentForClient(sampleAssessment);
    assert.equal(sanitizedPractice.questions[0].correctAnswer, undefined);
    assert.equal(sanitizedPractice.questions[1].correctAnswer, undefined);
    assert.equal(sanitizedPractice.questions[2].correctAnswer, undefined);

    const mockAssessment = { ...sampleAssessment, mode: 'mock' };
    const sanitizedMock = sanitizeAssessmentForClient(mockAssessment);
    assert.equal(sanitizedMock.questions[0].correctAnswer, undefined);
    assert.equal(sanitizedMock.questions[0].explanation, undefined);
    assert.equal(sanitizedMock.questions[0].hint, undefined);
  });
});

describe('🧠 2. Natural Language Assessment Intent Detection', () => {
  test('classifies Python quiz with 20 questions', () => {
    const res = classifyAssessmentIntent('Mujhe Python ka 20-question quiz karao.');
    assert.equal(res.isAssessment, true);
    assert.equal(res.intent, INTENTS.QUIZ_START);
    assert.equal(res.mode, 'practice');
    assert.equal(res.questionCount, 20);
    assert.ok(res.topic.toLowerCase().includes('python'));
  });

  test('classifies Network Security 50-question mock test with negative marking', () => {
    const res = classifyAssessmentIntent('Computer Network Security ka 50-question mock test lo.');
    assert.equal(res.isAssessment, true);
    assert.equal(res.intent, INTENTS.MOCK_TEST_START);
    assert.equal(res.mode, 'mock');
    assert.equal(res.questionCount, 50);
    assert.ok(res.negativeMarks > 0);
  });

  test('classifies Interview Mode request', () => {
    const res = classifyAssessmentIntent('Mera technical interview quiz lo for React Developer');
    assert.equal(res.isAssessment, true);
    assert.equal(res.intent, INTENTS.INTERVIEW_MODE);
    assert.equal(res.mode, 'interview');
  });

  test('classifies Adaptive / Weak Topic quiz', () => {
    const res = classifyAssessmentIntent('Mujhe weak topics par adaptive quiz karao');
    assert.equal(res.isAssessment, true);
    assert.equal(res.intent, INTENTS.ADAPTIVE_QUIZ);
    assert.equal(res.mode, 'adaptive');
  });

  test('classifies PDF / Document grounded test intent', () => {
    const res = classifyAssessmentIntent('Is uploaded PDF se 10 questions ka test banao');
    assert.equal(res.isAssessment, true);
    assert.equal(res.intent, INTENTS.PDF_GROUNDED_TEST);
    assert.equal(res.questionCount, 10);
  });

  test('suppresses assessment intent for regular chat or code generation requests', () => {
    const res1 = classifyAssessmentIntent('Write a binary search function in Python');
    assert.equal(res1.isAssessment, false);
    const res2 = classifyAssessmentIntent('What is the weather today in Mumbai?');
    assert.equal(res2.isAssessment, false);
  });
});

describe('📊 3. Deterministic & Rubric-Based Scoring Engine', () => {
  const testAssessment = {
    id: 'asmt_eval_test',
    title: 'Networking Basics',
    mode: 'mock',
    topic: 'Computer Networks',
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        prompt: 'Which layer is Layer 4 in OSI?',
        options: ['Network', 'Transport', 'Session', 'Application'],
        correctAnswer: 1,
        marks: 2,
        negativeMarks: 0.5,
        topic: 'OSI Model',
        explanation: 'Layer 4 is Transport.'
      },
      {
        id: 'q2',
        type: 'mcq',
        prompt: 'HTTP operates on which port by default?',
        options: ['80', '443', '21', '22'],
        correctAnswer: 0,
        marks: 1,
        negativeMarks: 0.25,
        topic: 'Protocols',
        explanation: 'HTTP is 80.'
      },
      {
        id: 'q3',
        type: 'multiple-select',
        prompt: 'Which protocols belong to Transport Layer?',
        options: ['TCP', 'UDP', 'IP', 'BGP'],
        correctAnswer: [0, 1],
        marks: 2,
        negativeMarks: 0.5,
        topic: 'Protocols',
        explanation: 'TCP and UDP are Transport.'
      }
    ]
  };

  test('evaluates 100% correct answers with Grade A+', async () => {
    const answers = {
      q1: 1,
      q2: 0,
      q3: [0, 1]
    };
    const result = await evaluateAssessment(testAssessment, answers);
    assert.equal(result.correctCount, 3);
    assert.equal(result.incorrectCount, 0);
    assert.equal(result.netScore, 5);
    assert.equal(result.percentage, 100);
    assert.equal(result.accuracy, 100);
    assert.ok(result.grade.includes('A+'));
  });

  test('applies negative marking penalty for incorrect choices in mock mode', async () => {
    const answers = {
      q1: 0, // incorrect: -0.5 penalty
      q2: 0, // correct: +1 mark
      q3: [2] // incorrect: -0.5 penalty
    };
    const result = await evaluateAssessment(testAssessment, answers);
    assert.equal(result.correctCount, 1);
    assert.equal(result.incorrectCount, 2);
    assert.equal(result.penaltyMarks, 1.0);
    assert.equal(result.netScore, 0); // 1 - 1.0 = 0
  });

  test('unattempted questions do not incur negative penalties', async () => {
    const answers = {
      q1: 1 // only 1 attempted, 2 left blank
    };
    const result = await evaluateAssessment(testAssessment, answers);
    assert.equal(result.correctCount, 1);
    assert.equal(result.unattemptedCount, 2);
    assert.equal(result.penaltyMarks, 0);
    assert.equal(result.netScore, 2);
  });

  test('generates topic-wise breakdown and identifies weak topics', async () => {
    const answers = {
      q1: 1, // OSI Model: 100%
      q2: 1, // Protocols: 0%
      q3: [2] // Protocols: 0%
    };
    const result = await evaluateAssessment(testAssessment, answers);
    assert.ok(result.topicAnalysis['OSI Model']);
    assert.ok(result.topicAnalysis['Protocols']);
    assert.equal(result.topicAnalysis['OSI Model'].status, 'STRONG');
    assert.equal(result.topicAnalysis['Protocols'].status, 'WEAK');
    assert.ok(result.weakTopics.includes('Protocols'));
  });
});

describe('💾 4. SQLite Database Persistence & Refresh Recovery', () => {
  const asmtData = {
    id: `asmt_db_${Date.now()}`,
    title: 'Database Test Quiz',
    subject: 'Computer Science',
    topic: 'Databases',
    mode: 'practice',
    difficulty: 'beginner',
    timeLimit: 300,
    negativeMarks: 0,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        prompt: 'What does SQL stand for?',
        options: ['Structured Query Language', 'Simple Query Logic'],
        correctAnswer: 0,
        marks: 1
      }
    ]
  };

  test('saves assessment and retrieves it from SQLite', () => {
    assessmentDAO.saveAssessment(asmtData, 'test_user');
    const retrieved = assessmentDAO.getAssessmentById(asmtData.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, asmtData.id);
    assert.equal(retrieved.title, asmtData.title);
    assert.equal(retrieved.questions.length, 1);
  });

  test('starts attempt and preserves session progress for refresh recovery', () => {
    const attId = `att_${Date.now()}`;
    assessmentDAO.startAttempt(attId, asmtData.id, 'test_user', 'practice');

    // Simulate saving ongoing answers
    assessmentDAO.saveAttemptProgress(attId, { q1: 0 }, 45);

    const att = assessmentDAO.getAttemptById(attId);
    assert.ok(att);
    assert.equal(att.status, 'in_progress');
    assert.equal(att.answers.q1, 0);
    assert.equal(att.timeSpentSeconds, 45);
  });

  test('submits attempt and stores final evaluation result', () => {
    const attId = `att_sub_${Date.now()}`;
    assessmentDAO.startAttempt(attId, asmtData.id, 'test_user', 'practice');

    const fakeResult = { netScore: 1, totalMarks: 1, percentage: 100, grade: 'A+' };
    assessmentDAO.submitAttempt(attId, fakeResult, { q1: 0 }, 60);

    const att = assessmentDAO.getAttemptById(attId);
    assert.equal(att.status, 'submitted');
    assert.equal(att.result.percentage, 100);
  });
});

describe('🤖 5. Agent Tool Integration', () => {
  test('AssessmentTool schema has required properties', () => {
    assert.equal(AssessmentTool.name, 'create_assessment');
    assert.ok(AssessmentTool.parameters.properties.topic);
    assert.ok(AssessmentTool.parameters.properties.mode);
  });

  test('AssessmentTool executes and generates client-safe assessment', async () => {
    const res = await AssessmentTool.execute({
      topic: 'Python',
      mode: 'practice',
      questionCount: 3
    }, { userId: 'agent_user' });

    assert.equal(res.success, true);
    assert.ok(res.assessmentId);
    assert.ok(res.assessment);
    assert.equal(res.assessment.questions[0].correctAnswer, undefined); // verified security
  });
});
