const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');
const ContextNodeDAO = require('../db/dao/ContextNodeDAO');
const ContextEdgeDAO = require('../db/dao/ContextEdgeDAO');
const { getDatabase } = require('../db');

class MemoryService {
  constructor() {
    this.db = getDatabase();
    this.nodeDAO = new ContextNodeDAO(this.db);
    this.edgeDAO = new ContextEdgeDAO(this.db);
    this.initDb();
  }

  async initDb() {
    try {
      this.db.prepare(`
          CREATE TABLE IF NOT EXISTS semantic_memory (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              projectId TEXT,
              key TEXT,
              value TEXT,
              category TEXT,
              updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(projectId, key)
          )
      `).run();

      this.db.prepare(`
          CREATE TABLE IF NOT EXISTS episodic_memory (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              projectId TEXT,
              task_description TEXT,
              action_taken TEXT,
              outcome TEXT,
              lesson_learned TEXT,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
      `).run();
    } catch (e) {
      logger.error(`❌ [MemoryService] DB Init Error: ${e.message}`);
    }
  }

  savePreference(projectId, key, value) {
    if (!projectId || !key) throw new Error("projectId and key are required");
    return this.nodeDAO.create({
      id: uuidv4(),
      projectId,
      nodeType: 'USER_PREFERENCE',
      title: `Preference: ${key}`,
      contentSummary: value,
      rawRef: JSON.stringify({ key, timestamp: new Date().toISOString() })
    });
  }

  saveExperience(projectId, { task, action, outcome, lesson }) {
    if (!projectId || !task) throw new Error("projectId and task are required");
    return this.nodeDAO.create({
      id: uuidv4(),
      projectId,
      nodeType: 'EXPERIENCE_LOG',
      title: `Experience: ${task}`,
      contentSummary: lesson,
      rawRef: JSON.stringify({ action, outcome, timestamp: new Date().toISOString() })
    });
  }

  recallSimilarExperiences(projectId, currentTask) {
    if (!projectId) return '';
    const logs = this.nodeDAO.listByProject(projectId, 'EXPERIENCE_LOG');
    const relevant = logs.filter(log => {
        const content = (log.title + ' ' + log.content_summary).toLowerCase();
        const query = currentTask.toLowerCase();
        const queryWords = query.split(/\s+/).filter(w => w.length > 3);
        return queryWords.some(word => content.includes(word));
    });
    return relevant.slice(0, 5).map((e, i) => `Experience ${i+1}: ${e.title}\n- Lesson: ${e.content_summary}`).join('\n\n');
  }

  getPreferences(projectId) {
    if (!projectId) return '';
    const prefs = this.nodeDAO.listByProject(projectId, 'USER_PREFERENCE');
    return prefs.map(p => `${p.title}: ${p.content_summary}`).join('\n');
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
    const experienceNodes = this.nodeDAO.listByProject(projectId, 'EXPERIENCE_LOG');
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
      experienceCount: experienceNodes.length,
      recentLogs
    };
  }

  getProjectLearnedContext(projectId) {
    const rules = this.nodeDAO.listByProject(projectId, 'LEARNING_RULE');
    return rules.slice(0, 10).map((rule, i) => `${i + 1}. ${rule.content_summary}`).join('\n');
  }
}

module.exports = new MemoryService();
