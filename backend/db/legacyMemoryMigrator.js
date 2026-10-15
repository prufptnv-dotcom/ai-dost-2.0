const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const MemoryService = require('../services/memoryService');

const MEMORY_FILE = path.join(__dirname, '../data/personal_brain_memory.json');
const MIGRATED_FLAG = path.join(__dirname, '../data/personal_brain_memory_migrated.flag');

function migrateLegacyMemory(db) {
  if (!fs.existsSync(MEMORY_FILE)) return;
  if (fs.existsSync(MIGRATED_FLAG)) return;

  try {
    const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const legacyData = JSON.parse(raw);
    const memoryService = new MemoryService(db);
    const DEFAULT_PROJECT_ID = 'default';

    if (Array.isArray(legacyData.learnedRules)) {
      for (const rule of legacyData.learnedRules) {
        const existingRules = memoryService.nodeDAO.listByProject(DEFAULT_PROJECT_ID, 'LEARNING_RULE');
        if (!existingRules.find(r => r.content_summary === rule)) {
          memoryService.addLearnedRule(DEFAULT_PROJECT_ID, rule);
        }
      }
    }

    if (Array.isArray(legacyData.scannedFiles)) {
      for (const file of legacyData.scannedFiles) {
        const existingFiles = memoryService.nodeDAO.listByProject(DEFAULT_PROJECT_ID, 'SCANNED_FILE_LOG');
        if (!existingFiles.find(f => f.content_summary === file)) {
          memoryService.addScannedFile(DEFAULT_PROJECT_ID, file);
        }
      }
    }

    if (Array.isArray(legacyData.feedbackLogs)) {
      const logs = [...legacyData.feedbackLogs].reverse();
      for (const log of logs) {
        const existingLogs = memoryService.nodeDAO.listByProject(DEFAULT_PROJECT_ID, 'FEEDBACK_LOG');
        const isDupe = existingLogs.find(n => {
          if (!n.raw_ref) return false;
          try {
             const ref = JSON.parse(n.raw_ref);
             return ref.message === log.message && ref.timestamp === log.timestamp;
          } catch(e) { return false; }
        });

        if (!isDupe) {
          memoryService.nodeDAO.create({
            id: require('uuid').v4(),
            projectId: DEFAULT_PROJECT_ID,
            nodeType: 'FEEDBACK_LOG',
            title: `User Feedback: ${log.type}`,
            contentSummary: log.message || log.correction || 'Feedback recorded',
            rawRef: JSON.stringify({
              type: log.type,
              category: log.category,
              message: log.message,
              aiReply: log.aiReply,
              correction: log.correction,
              timestamp: log.timestamp || new Date().toISOString()
            })
          });
        }
      }
    }

    fs.writeFileSync(MIGRATED_FLAG, new Date().toISOString());
    logger.info('Legacy memory migration completed successfully.');
  } catch (err) {
    logger.error('Failed to migrate legacy memory:', err);
  }
}

module.exports = { migrateLegacyMemory };
