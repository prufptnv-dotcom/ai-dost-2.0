/**
 * Assessment Agent Tool
 * AI-Dost v2.0 - Agent Tool for Quiz and Assessment Generation
 */

const { generateAssessment } = require('../../services/assessmentGeneratorService');
const { sanitizeAssessmentForClient } = require('../../services/assessmentSchema');
const assessmentDAO = require('../../db/dao/AssessmentDAO');
const logger = require('../../logger');

const AssessmentTool = {
  name: 'create_assessment',
  description: 'Generates structured assessments, interactive quizzes, mock exams, or technical interview assessments for a given topic or document context.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Primary topic or subject (e.g. Python, Computer Networks, React, System Design)'
      },
      mode: {
        type: 'string',
        enum: ['practice', 'mock', 'interview', 'adaptive'],
        description: 'Assessment mode: practice (learning), mock (strict exam), interview (technical viva), adaptive (weak topics)'
      },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced', 'mixed'],
        description: 'Target difficulty level'
      },
      questionCount: {
        type: 'number',
        description: 'Number of questions to generate (default: 5, max: 30)'
      },
      docContent: {
        type: 'string',
        description: 'Optional document or PDF text content for grounded question generation'
      }
    },
    required: ['topic']
  },

  async execute(params = {}, context = {}) {
    try {
      const topic = params.topic || 'General Technical Knowledge';
      const mode = params.mode || 'practice';
      const difficulty = params.difficulty || 'intermediate';
      const questionCount = params.questionCount || 5;
      const docContent = params.docContent || context.fileContent || null;

      logger.info(`[AssessmentTool] Generating ${mode} assessment for "${topic}" (${questionCount} questions)`);

      const masterAssessment = await generateAssessment({
        topic,
        subject: params.subject || topic,
        mode,
        difficulty,
        questionCount,
        docContent
      });

      // Save to SQLite
      const userId = context.userId || 'default';
      assessmentDAO.saveAssessment(masterAssessment, userId);

      // Return client-safe version
      const clientSafe = sanitizeAssessmentForClient(masterAssessment);

      return {
        success: true,
        assessmentId: masterAssessment.id,
        assessment: clientSafe,
        summary: `Created ${clientSafe.mode} assessment "${clientSafe.title}" with ${clientSafe.questionCount} questions.`
      };
    } catch (err) {
      logger.error('[AssessmentTool] Execution error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }
};

module.exports = AssessmentTool;
