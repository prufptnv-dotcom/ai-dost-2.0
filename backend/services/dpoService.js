const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * dpoService.js
 * 
 * Direct Preference Optimization (DPO) and RLHF data pipeline.
 * Formats user feedback into { prompt, chosen, rejected } JSONL format
 * required for PyTorch/JAX fine-tuning of local models.
 */

class DPOService {
    constructor() {
        this.datasetPath = path.join(__dirname, '..', 'data', 'dpo_dataset.jsonl');
        
        // Ensure data directory exists
        const dataDir = path.dirname(this.datasetPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Logs preference data for future fine-tuning
     * @param {string} prompt - The user's query
     * @param {string} chosen - The preferred response (from correction or positive feedback)
     * @param {string} rejected - The rejected response (the original AI output that was downvoted)
     */
    logPreference(prompt, chosen, rejected) {
        try {
            if (!prompt || !chosen) return false;

            const entry = {
                prompt: prompt,
                chosen: chosen,
                rejected: rejected || "", // Sometimes we just have positive feedback without a rejected alternative
                timestamp: new Date().toISOString()
            };

            fs.appendFileSync(this.datasetPath, JSON.stringify(entry) + '\n');
            logger.info('✅ [DPO Service] Preference data logged for fine-tuning.');
            return true;
        } catch (error) {
            logger.error('Failed to log DPO preference data:', error);
            return false;
        }
    }

    /**
     * Gets stats of the current DPO dataset
     */
    getStats() {
        try {
            if (!fs.existsSync(this.datasetPath)) return { count: 0, sizeBytes: 0 };
            const stats = fs.statSync(this.datasetPath);
            const content = fs.readFileSync(this.datasetPath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            return {
                count: lines.length,
                sizeBytes: stats.size
            };
        } catch (e) {
            return { count: 0, sizeBytes: 0 };
        }
    }
}

module.exports = new DPOService();
