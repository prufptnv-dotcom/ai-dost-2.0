/**
 * Assessment Routes
 * AI-Dost v2.0 - Production-grade interactive Quiz, Mock Test & Assessment API
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../logger');
const router = express.Router();
const assessmentDAO = require('../db/dao/AssessmentDAO');
const { generateAssessment } = require('../services/assessmentGeneratorService');
const { evaluateAssessment, evaluateShortAnswerWithAi } = require('../services/assessmentEvaluatorService');
const { sanitizeAssessmentForClient } = require('../services/assessmentSchema');

/**
 * POST /api/assessment/create
 * Generates a new assessment and stores the master copy in SQLite
 */
router.post('/create', async (req, res) => {
  try {
    const {
      topic = 'General Programming',
      subject = 'Computer Science',
      mode = 'practice',
      difficulty = 'intermediate',
      questionCount = 5,
      timeLimit = 0,
      negativeMarks = 0,
      docContent = null,
      docName = null,
      userId = 'default'
    } = req.body;

    logger.info(`[AssessmentRoute] Creating ${mode} assessment for "${topic}"`);

    // Fetch weak topics if adaptive mode requested
    let weakTopics = [];
    if (mode === 'adaptive') {
      const userWeak = assessmentDAO.getUserWeakTopics(userId);
      weakTopics = userWeak.map(w => w.topic);
    }

    const masterAssessment = await generateAssessment({
      topic,
      subject,
      mode,
      difficulty,
      questionCount,
      timeLimit,
      negativeMarks,
      docContent,
      docName,
      weakTopics
    });

    // Persist to database
    assessmentDAO.saveAssessment(masterAssessment, userId);

    // Return client-sanitized representation (answers and mock explanations stripped)
    const clientSafe = sanitizeAssessmentForClient(masterAssessment);

    return res.json({
      success: true,
      assessment: clientSafe
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /create error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create assessment: ' + err.message
    });
  }
});

/**
 * GET /api/assessment/history
 * Retrieve user's previous attempt history and identified weak topics
 */
router.get('/history', (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const attempts = assessmentDAO.getUserAttempts(userId, 20);
    const weakTopics = assessmentDAO.getUserWeakTopics(userId);

    return res.json({
      success: true,
      attempts,
      weakTopics
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/assessment/attempt/:attemptId
 * Retrieve detailed attempt record with result
 */
router.get('/attempt/:attemptId', (req, res) => {
  try {
    const attempt = assessmentDAO.getAttemptById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }

    const assessment = assessmentDAO.getAssessmentById(attempt.assessmentId);
    const sanitized = sanitizeAssessmentForClient(assessment, {
      includeExplanation: attempt.status === 'submitted'
    });

    return res.json({
      success: true,
      attempt,
      assessment: sanitized
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /attempt/:attemptId error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/assessment/:id
 * Retrieve client-sanitized assessment
 */
router.get('/:id', (req, res) => {
  try {
    const assessment = assessmentDAO.getAssessmentById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const clientSafe = sanitizeAssessmentForClient(assessment);
    return res.json({
      success: true,
      assessment: clientSafe
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/assessment/:id/start
 * Starts an assessment attempt session
 */
router.post('/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'default', mode } = req.body;

    const assessment = assessmentDAO.getAssessmentById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    const attemptId = `asmt_att_${crypto.randomUUID().slice(0, 10)}`;
    const attempt = assessmentDAO.startAttempt(attemptId, id, userId, mode || assessment.mode);

    return res.json({
      success: true,
      attemptId,
      assessmentId: id,
      startedAt: attempt.startedAt,
      timeLimit: assessment.timeLimit || 0
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /:id/start error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/assessment/:id/save-progress
 * Incremental answer saving to support browser refresh recovery
 */
router.post('/:id/save-progress', (req, res) => {
  try {
    const { attemptId, answers = {}, timeSpentSeconds = 0 } = req.body;
    if (!attemptId) {
      return res.status(400).json({ success: false, error: 'attemptId is required' });
    }

    const saved = assessmentDAO.saveAttemptProgress(attemptId, answers, timeSpentSeconds);
    return res.json({ success: saved });
  } catch (err) {
    logger.error('[AssessmentRoute] /:id/save-progress error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/assessment/:id/submit
 * Submits answers, runs deterministic & rubric-based grading, calculates scores
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { attemptId, answers = {}, timeSpentSeconds = 0, isAutoSubmit = false } = req.body;

    const assessment = assessmentDAO.getAssessmentById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    let attempt = null;
    if (attemptId) {
      attempt = assessmentDAO.getAttemptById(attemptId);
    }

    // Verify time limit adherence for mock mode
    let wasExpired = isAutoSubmit;
    if (attempt && assessment.mode === 'mock' && assessment.timeLimit > 0) {
      const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
      if (elapsed > assessment.timeLimit + 30) {
        wasExpired = true;
      }
    }

    logger.info(`[AssessmentRoute] Grading submission for assessment ${id} (${attemptId || 'no-attempt'}, expired: ${wasExpired})`);

    // Perform evaluation
    const result = await evaluateAssessment(assessment, answers);
    result.isAutoSubmit = wasExpired;
    result.timeSpentSeconds = timeSpentSeconds;

    // Persist evaluation result to attempt record
    if (attemptId) {
      assessmentDAO.submitAttempt(attemptId, result, answers, timeSpentSeconds);
    }

    return res.json({
      success: true,
      result,
      attemptId
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /:id/submit error:', err);
    return res.status(500).json({ success: false, error: 'Evaluation failed: ' + err.message });
  }
});



/**
 * POST /api/assessment/evaluate-short-answer
 * Instant evaluation of a single short answer
 */
router.post('/evaluate-short-answer', async (req, res) => {
  try {
    const { question, userAnswer } = req.body;
    if (!question || userAnswer === undefined) {
      return res.status(400).json({ success: false, error: 'question and userAnswer are required' });
    }

    const evaluation = await evaluateShortAnswerWithAi(question, String(userAnswer));
    return res.json({
      success: true,
      evaluation
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /evaluate-short-answer error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
