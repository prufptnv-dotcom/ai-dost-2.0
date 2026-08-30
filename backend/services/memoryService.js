const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const ContextNodeDAO = require('../db/dao/ContextNodeDAO');
const ContextEdgeDAO = require('../db/dao/ContextEdgeDAO');

class MemoryService {
  constructor(db) {
    this.nodeDAO = new ContextNodeDAO(db);
    this.edgeDAO = new ContextEdgeDAO(db);
  }

  addLearnedRule(projectId, rule, sourceId = null) {
    if (!projectId || !rule) throw new Error("projectId and rule are required");
    return this.nodeDAO.create({
      id: uuidv4(),
      projectId,
      nodeType: 'LEARNING_RULE',
      title: 'User Correction / Rule',
      contentSummary: rule,
      rawRef: JSON.stringify({ sourceId, timestamp: new Date().toISOString() })
    });
  }

  addFeedbackLog(projectId, { type, category, message, aiReply, correction }) {
    if (!projectId) throw new Error("projectId is required");
    const id = uuidv4();
    const rawRef = JSON.stringify({ type, category, message, aiReply, correction, timestamp: new Date().toISOString() });
    
    const node = this.nodeDAO.create({
      id,
      projectId,
      nodeType: 'FEEDBACK_LOG',
      title: `User Feedback: ${type}`,
      contentSummary: message || correction || 'Feedback recorded',
      rawRef
    });

    if (correction) {
      this.addLearnedRule(projectId, correction, id);
    }
    return node;
  }

  addScannedFile(projectId, filePath) {
    if (!projectId || !filePath) throw new Error("projectId and filePath are required");
    return this.nodeDAO.create({
      id: uuidv4(),
      projectId,
      nodeType: 'SCANNED_FILE_LOG',
      title: `Scanned File: ${filePath}`,
      contentSummary: filePath,
      rawRef: null
    });
  }

  getProjectStats(projectId) {
    if (!projectId) throw new Error("projectId is required");
    
    const feedbackNodes = this.nodeDAO.listByProject(projectId, 'FEEDBACK_LOG');
    const ruleNodes = this.nodeDAO.listByProject(projectId, 'LEARNING_RULE');
    const fileNodes = this.nodeDAO.listByProject(projectId, 'SCANNED_FILE_LOG');

    let positiveCount = 0;
    let negativeCount = 0;
    const recentLogs = [];
    
    feedbackNodes.forEach(node => {
      try {
        const ref = node.raw_ref ? JSON.parse(node.raw_ref) : {};
        if (ref.type === 'up' || ref.type === 'positive') positiveCount++;
        if (ref.type === 'down' || ref.type === 'negative') negativeCount++;
        
        if (recentLogs.length < 5) {
          recentLogs.push({
            id: node.id,
            type: ref.type,
            category: ref.category || 'general',
            message: ref.message || node.content_summary,
            aiReply: ref.aiReply || '',
            correction: ref.correction || '',
            timestamp: node.created_at
          });
        }
      } catch(e) {}
    });

    return {
      totalFeedback: feedbackNodes.length,
      positiveCount,
      negativeCount,
      rulesCount: ruleNodes.length,
      learnedRules: ruleNodes.slice(0, 10).map(n => n.content_summary),
      scannedFilesCount: fileNodes.length,
      scannedFiles: fileNodes.map(n => n.content_summary),
      recentLogs
    };
  }

  getProjectLearnedContext(projectId) {
    const rules = this.nodeDAO.listByProject(projectId, 'LEARNING_RULE');
    return rules.slice(0, 10).map((rule, i) => `${i + 1}. ${rule.content_summary}`).join('\n');
  }
}

module.exports = MemoryService;
