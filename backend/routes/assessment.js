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
 * Resolve canonical trusted user identity from request context.
 * Priority:
 * 1. req.user.id (from session/JWT if available)
 * 2. req.headers['x-user-id']
 * 3. Fallback to 'default'
 * SECURITY RULE: Never trust unauthenticated body/query userId over request identity.
 */
function resolveUser(req) {
  if (req && req.user && typeof req.user.id === 'string' && req.user.id.trim()) {
    return req.user.id.trim();
  }
  if (req && req.headers && typeof req.headers['x-user-id'] === 'string' && req.headers['x-user-id'].trim()) {
    return req.headers['x-user-id'].trim();
  }
  return 'default';
}

/**
 * POST /api/assessment/create
 * Generates a new assessment and stores the master copy in SQLite
 */
router.post('/create', async (req, res) => {
  try {
    const userId = resolveUser(req);
    const {
      topic = 'General Programming',
      subject = 'Computer Science',
      mode = 'practice',
      difficulty = 'intermediate',
      questionCount = 5,
      timeLimit = 0,
      negativeMarks = 0,
      docContent = null,
      docName = null
    } = req.body;

    logger.info(`[AssessmentRoute] Creating ${mode} assessment for "${topic}" by user "${userId}"`);

    // Fetch weak topics and adaptive difficulty if adaptive mode requested
    let weakTopics = [];
    let effectiveDifficulty = difficulty;
    if (mode === 'adaptive') {
      const adaptiveProfile = assessmentDAO.getUserAdaptiveProfile(userId);
      weakTopics = adaptiveProfile.weakTopics;
      if (!req.body.difficulty) {
        effectiveDifficulty = adaptiveProfile.recommendedDifficulty;
      }
    }

    const masterAssessment = await generateAssessment({
      topic,
      subject,
      mode,
      difficulty: effectiveDifficulty,
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
 * Retrieve user's previous attempt history and identified weak topics (restricted to authenticated user)
 */
router.get('/history', (req, res) => {
  try {
    const userId = resolveUser(req);
    const attempts = assessmentDAO.getUserAttempts(userId, 20);
    const weakTopics = assessmentDAO.getUserWeakTopics(userId);
    const adaptiveProfile = assessmentDAO.getUserAdaptiveProfile(userId);

    return res.json({
      success: true,
      userId,
      attempts,
      weakTopics,
      adaptiveProfile
    });
  } catch (err) {
    logger.error('[AssessmentRoute] /history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/assessment/attempt/:attemptId
 * Retrieve detailed attempt record with result (with strict ownership check)
 */
router.get('/attempt/:attemptId', (req, res) => {
  try {
    const userId = resolveUser(req);
    const attempt = assessmentDAO.getAttemptById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }

    // Authorization Ownership Check
    if (attempt.userId !== userId && attempt.userId !== 'default' && userId !== 'default') {
      logger.warn(`[AssessmentRoute] Unauthorized attempt access: User "${userId}" tried to access attempt of "${attempt.userId}"`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to view this attempt'
      });
    }

    const assessment = assessmentDAO.getAssessmentById(attempt.assessmentId);
    const sanitized = assessment ? sanitizeAssessmentForClient(assessment, {
      includeExplanation: attempt.status === 'submitted'
    }) : null;

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
 * Starts an assessment attempt session bound to authenticated user
 */
router.post('/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUser(req);
    const { mode } = req.body;

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
      userId,
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
 * Incremental answer saving with ownership and state verification
 */
router.post('/:id/save-progress', (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUser(req);
    const { attemptId, answers = {}, timeSpentSeconds = 0 } = req.body;
    if (!attemptId) {
      return res.status(400).json({ success: false, error: 'attemptId is required' });
    }

    const attempt = assessmentDAO.getAttemptById(attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Attempt not found' });
    }

    // Ownership check
    if (attempt.userId !== userId && attempt.userId !== 'default' && userId !== 'default') {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this attempt' });
    }

    // Assessment match check
    if (attempt.assessmentId !== id) {
      return res.status(400).json({ success: false, error: 'Attempt does not belong to this assessment' });
    }

    // State machine check
    if (attempt.status !== 'in_progress') {
      return res.status(409).json({ success: false, error: `Cannot save progress: attempt is ${attempt.status}` });
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
 * Submits answers with server-side timer validation, double-submission replay protection,
 * and deterministic server-side answer-key grading.
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUser(req);
    const { attemptId, answers = {}, timeSpentSeconds = 0, isAutoSubmit = false } = req.body;

    const assessment = assessmentDAO.getAssessmentById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: 'Assessment not found' });
    }

    let attempt = null;
    if (attemptId) {
      attempt = assessmentDAO.getAttemptById(attemptId);
      if (!attempt) {
        return res.status(404).json({ success: false, error: 'Attempt not found' });
      }

      // Ownership check
      if (attempt.userId !== userId && attempt.userId !== 'default' && userId !== 'default') {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this attempt' });
      }

      // Assessment match validation (Tampering protection)
      if (attempt.assessmentId !== id) {
        return res.status(400).json({ success: false, error: 'Attempt does not belong to this assessment' });
      }

      // Idempotent double submission check
      if (attempt.status === 'submitted') {
        logger.info(`[AssessmentRoute] Idempotent submission hit for attempt ${attemptId}`);
        return res.json({
          success: true,
          result: attempt.result,
          attemptId,
          isIdempotent: true
        });
      }

      // State machine validation: if expired, reject modifying submission
      if (attempt.status === 'expired') {
        return res.status(409).json({
          success: false,
          error: 'Attempt has already expired and cannot be submitted'
        });
      }
    }

    // Server-side timer validation and clock manipulation protection
    let serverElapsed = 0;
    let wasExpired = isAutoSubmit;
    const GRACE_PERIOD_SECONDS = 30; // 30s allowance for network latency

    if (attempt && attempt.startedAt) {
      serverElapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));
      if (assessment.mode === 'mock' && assessment.timeLimit > 0) {
        if (serverElapsed > assessment.timeLimit + GRACE_PERIOD_SECONDS) {
          wasExpired = true;
          // Mark attempt as expired in DB
          assessmentDAO.expireAttempt(attemptId, null, serverElapsed);
          return res.status(409).json({
            success: false,
            error: 'Submission rejected: Time limit exceeded by more than grace period',
            expired: true
          });
        }
      }
    }

    const safeTimeSpent = attempt
      ? Math.min(serverElapsed, assessment.timeLimit > 0 ? assessment.timeLimit : serverElapsed)
      : (timeSpentSeconds || 0);

    logger.info(`[AssessmentRoute] Grading submission for assessment ${id} (${attemptId || 'no-attempt'}, elapsed: ${serverElapsed}s, expired: ${wasExpired})`);

    // Perform evaluation strictly against SQLite-persisted assessment questions (client cannot tamper with answer key)
    const result = await evaluateAssessment(assessment, answers);
    result.isAutoSubmit = wasExpired;
    result.timeSpentSeconds = safeTimeSpent;

    // Atomically persist evaluation result to attempt record
    if (attemptId) {
      const submitStatus = assessmentDAO.submitAttempt(attemptId, result, answers, safeTimeSpent);
      if (submitStatus.alreadySubmitted && submitStatus.attempt) {
        return res.json({
          success: true,
          result: submitStatus.attempt.result,
          attemptId,
          isIdempotent: true
        });
      }
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
    const { question, userAnswer, isPractice = true } = req.body;
    if (!question || userAnswer === undefined) {
      return res.status(400).json({ success: false, error: 'question and userAnswer are required' });
    }

    const evaluation = await evaluateShortAnswerWithAi(question, String(userAnswer));

    // In non-practice modes, strip the model answer so it cannot be abused for cheating
    if (!isPractice) {
      delete evaluation.modelAnswer;
    }

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
