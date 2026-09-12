/**
 * Assessment Data Access Object
 * AI-Dost v2.0 - SQLite persistence for assessments and user attempts
 */

const { initDatabase } = require('../index');
const logger = require('../../logger');

class AssessmentDAO {
  constructor(db = null) {
    this.db = db || initDatabase();
  }

  saveAssessment(assessment, userId = 'default') {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO assessments (
          id, user_id, title, subject, topic, mode, difficulty,
          time_limit, negative_marks, questions_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        assessment.id,
        userId,
        assessment.title || 'Untitled Assessment',
        assessment.subject || 'General',
        assessment.topic || 'General',
        assessment.mode || 'practice',
        assessment.difficulty || 'intermediate',
        assessment.timeLimit || 0,
        assessment.negativeMarks || 0,
        JSON.stringify(assessment.questions || []),
        assessment.created_at || new Date().toISOString()
      );
      return assessment;
    } catch (err) {
      logger.error('[AssessmentDAO] saveAssessment failed:', err.message);
      throw err;
    }
  }

  getAssessmentById(id) {
    try {
      const row = this.db.prepare('SELECT * FROM assessments WHERE id = ?').get(id);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        subject: row.subject,
        topic: row.topic,
        mode: row.mode,
        difficulty: row.difficulty,
        timeLimit: row.time_limit,
        negativeMarks: row.negative_marks,
        questions: JSON.parse(row.questions_json || '[]'),
        created_at: row.created_at
      };
    } catch (err) {
      logger.error('[AssessmentDAO] getAssessmentById failed:', err.message);
      return null;
    }
  }

  startAttempt(attemptId, assessmentId, userId = 'default', mode = 'practice') {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO assessment_attempts (
          id, assessment_id, user_id, mode, started_at, status, time_spent_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, 'in_progress', 0, ?)
      `);
      stmt.run(attemptId, assessmentId, userId, mode, now, now);
      return { attemptId, assessmentId, startedAt: now, status: 'in_progress' };
    } catch (err) {
      logger.error('[AssessmentDAO] startAttempt failed:', err.message);
      throw err;
    }
  }

  saveAttemptProgress(attemptId, answers = {}, timeSpentSeconds = 0) {
    try {
      const stmt = this.db.prepare(`
        UPDATE assessment_attempts
        SET answers_json = ?, time_spent_seconds = ?
        WHERE id = ? AND status = 'in_progress'
      `);
      const info = stmt.run(JSON.stringify(answers), timeSpentSeconds, attemptId);
      return info.changes > 0;
    } catch (err) {
      logger.warn('[AssessmentDAO] saveAttemptProgress error:', err.message);
      return false;
    }
  }

  submitAttempt(attemptId, result = {}, answers = {}, timeSpentSeconds = 0) {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE assessment_attempts
        SET status = 'submitted', submitted_at = ?, result_json = ?, answers_json = ?, time_spent_seconds = ?
        WHERE id = ? AND status = 'in_progress'
      `);
      const info = stmt.run(now, JSON.stringify(result), JSON.stringify(answers), timeSpentSeconds, attemptId);
      
      // If 0 changes, attempt was either not found or already submitted/expired
      if (info.changes === 0) {
        const existing = this.getAttemptById(attemptId);
        if (existing && existing.status === 'submitted') {
          logger.info(`[AssessmentDAO] submitAttempt idempotent hit for already-submitted attempt ${attemptId}`);
          return { success: true, alreadySubmitted: true, attempt: existing };
        }
        return { success: false, error: 'Attempt is not in_progress' };
      }

      return { success: true, alreadySubmitted: false };
    } catch (err) {
      logger.error('[AssessmentDAO] submitAttempt failed:', err.message);
      throw err;
    }
  }

  expireAttempt(attemptId, result = null, timeSpentSeconds = 0) {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE assessment_attempts
        SET status = 'expired', submitted_at = ?, result_json = ?, time_spent_seconds = ?
        WHERE id = ? AND status = 'in_progress'
      `);
      const info = stmt.run(now, result ? JSON.stringify(result) : null, timeSpentSeconds, attemptId);
      return info.changes > 0;
    } catch (err) {
      logger.error('[AssessmentDAO] expireAttempt failed:', err.message);
      return false;
    }
  }

  getAttemptById(attemptId) {
    try {
      const row = this.db.prepare('SELECT * FROM assessment_attempts WHERE id = ?').get(attemptId);
      if (!row) return null;
      return {
        id: row.id,
        assessmentId: row.assessment_id,
        userId: row.user_id,
        mode: row.mode,
        startedAt: row.started_at,
        submittedAt: row.submitted_at,
        status: row.status,
        timeSpentSeconds: row.time_spent_seconds,
        answers: row.answers_json ? JSON.parse(row.answers_json) : {},
        result: row.result_json ? JSON.parse(row.result_json) : null,
        created_at: row.created_at
      };
    } catch (err) {
      logger.error('[AssessmentDAO] getAttemptById failed:', err.message);
      return null;
    }
  }

  getUserAttempts(userId = 'default', limit = 20) {
    try {
      const rows = this.db.prepare(`
        SELECT a.id, a.assessment_id, a.user_id, a.mode, a.started_at, a.submitted_at,
               a.status, a.time_spent_seconds, a.result_json, asm.title, asm.subject, asm.topic
        FROM assessment_attempts a
        LEFT JOIN assessments asm ON a.assessment_id = asm.id
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT ?
      `).all(userId, limit);

      return rows.map(r => ({
        id: r.id,
        assessmentId: r.assessment_id,
        title: r.title || 'Assessment',
        subject: r.subject || 'General',
        topic: r.topic || 'General',
        mode: r.mode,
        startedAt: r.started_at,
        submittedAt: r.submitted_at,
        status: r.status,
        timeSpentSeconds: r.time_spent_seconds,
        result: r.result_json ? JSON.parse(r.result_json) : null
      }));
    } catch (err) {
      logger.error('[AssessmentDAO] getUserAttempts failed:', err.message);
      return [];
    }
  }

  getUserWeakTopics(userId = 'default') {
    try {
      const attempts = this.getUserAttempts(userId, 50);
      const topicStats = {};

      for (const a of attempts) {
        if (a.result && a.result.topicAnalysis) {
          for (const [topic, stats] of Object.entries(a.result.topicAnalysis)) {
            if (!topicStats[topic]) {
              topicStats[topic] = { totalAttempts: 0, totalQuestions: 0, correctQuestions: 0 };
            }
            topicStats[topic].totalAttempts += 1;
            topicStats[topic].totalQuestions += stats.totalQuestions || 0;
            topicStats[topic].correctQuestions += stats.correct || 0;
          }
        }
      }

      const weak = [];
      for (const [topic, stats] of Object.entries(topicStats)) {
        const accuracy = stats.totalQuestions > 0 ? (stats.correctQuestions / stats.totalQuestions) * 100 : 0;
        if (accuracy < 55) {
          weak.push({ topic, accuracy: Math.round(accuracy), questions: stats.totalQuestions });
        }
      }

      return weak.sort((a, b) => a.accuracy - b.accuracy);
    } catch (err) {
      logger.error('[AssessmentDAO] getUserWeakTopics error:', err.message);
      return [];
    }
  }

  /**
   * Computes an adaptive learning profile with dynamic difficulty targeting
   */
  getUserAdaptiveProfile(userId = 'default') {
    try {
      const attempts = this.getUserAttempts(userId, 20);
      const weakTopics = this.getUserWeakTopics(userId);

      if (attempts.length === 0) {
        return {
          recommendedDifficulty: 'intermediate',
          averagePercentage: 0,
          totalAttempts: 0,
          weakTopics: []
        };
      }

      const percentages = attempts
        .filter(a => a.result && typeof a.result.percentage === 'number')
        .map(a => a.result.percentage);

      const avgPct = percentages.length > 0
        ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
        : 50;

      let recommendedDifficulty = 'intermediate';
      if (avgPct < 50) {
        recommendedDifficulty = 'beginner';
      } else if (avgPct >= 78) {
        recommendedDifficulty = 'advanced';
      }

      return {
        recommendedDifficulty,
        averagePercentage: avgPct,
        totalAttempts: attempts.length,
        weakTopics: weakTopics.map(w => w.topic)
      };
    } catch (err) {
      logger.error('[AssessmentDAO] getUserAdaptiveProfile error:', err.message);
      return {
        recommendedDifficulty: 'intermediate',
        averagePercentage: 50,
        totalAttempts: 0,
        weakTopics: []
      };
    }
  }
}

module.exports = new AssessmentDAO();
