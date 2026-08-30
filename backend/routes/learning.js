const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const { getDatabase } = require('../db');
const MemoryService = require('../services/memoryService');
const projectAuth = require('../services/projectAuthorization');

// 1. Submit Feedback (Thumbs Up / Down + Correction)
router.post('/feedback', async (req, res) => {
    try {
        const { type, message, aiReply, correction, category, projectId } = req.body;

        // M3 Security: Ensure user has access to this project, if provided
        // Legacy frontend doesn't send projectId, so default to 'default' project.
        const targetProjectId = projectId || 'default';
        const userId = req.user?.id || req.headers['x-user-id'] || 'local-user';

        const auth = projectAuth.verifyOwnership(targetProjectId, userId);
        if (!auth.authorized) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const db = getDatabase();
        const memoryService = new MemoryService(db);

        // Record the feedback
        memoryService.addFeedbackLog(targetProjectId, {
            type,
            category: category || 'general',
            message,
            aiReply,
            correction
        });

        // Sync with Python AI Engine Long-Term Vector Memory (ChromaDB)
        if (correction) {
            fetch('http://127.0.0.1:8001/ai/agent/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: `Rule: ${correction}` })
            }).catch(err => console.error("Failed to sync memory with Python AI Engine:", err));
        }

        const stats = memoryService.getProjectStats(targetProjectId);

        res.json({
            success: true,
            message: type === 'up' || type === 'positive' ? 'Positive feedback recorded! Personal Brain learning updated.' : 'Correction recorded! Personal Brain has self-corrected.',
            stats: {
                totalFeedback: stats.totalFeedback,
                positiveCount: stats.positiveCount,
                negativeCount: stats.negativeCount,
                rulesCount: stats.rulesCount
            }
        });
    } catch (e) {
        logger.error("Feedback error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Get Learning Stats for Secret Personal Brain Console
router.get('/stats', (req, res) => {
    try {
        const targetProjectId = req.query.projectId || 'default';
        const userId = req.user?.id || req.headers['x-user-id'] || 'local-user';

        const auth = projectAuth.verifyOwnership(targetProjectId, userId);
        if (!auth.authorized) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const db = getDatabase();
        const memoryService = new MemoryService(db);
        const stats = memoryService.getProjectStats(targetProjectId);

        res.json({
            success: true,
            totalFeedback: stats.totalFeedback,
            positiveCount: stats.positiveCount,
            negativeCount: stats.negativeCount,
            learnedRules: stats.learnedRules,
            scannedFilesCount: stats.scannedFilesCount,
            scannedFiles: stats.scannedFiles,
            recentLogs: stats.recentLogs
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Chat with Personal Autonomous Model in Secret Console
router.post('/chat', async (req, res) => {
    try {
        const { prompt, history, projectId } = req.body;

        const targetProjectId = projectId || 'default';
        const userId = req.user?.id || req.headers['x-user-id'] || 'local-user';

        const auth = projectAuth.verifyOwnership(targetProjectId, userId);
        if (!auth.authorized) {
            return res.status(auth.status).json({ success: false, error: auth.error });
        }

        const db = getDatabase();
        const memoryService = new MemoryService(db);
        const stats = memoryService.getProjectStats(targetProjectId);
        const learnedContext = memoryService.getProjectLearnedContext(targetProjectId);

        const personalSystemPrompt = `You are AI-Dost Personal Brain, an autonomous self-learning AI model running inside the user's secret developer inspector console.
You have "Aakh" (Vision/File Scanning capabilities) and continuously analyze user feedback, project files, and chat quality.

Current Learning Memory Summary for Project "${targetProjectId}":
- Total User Feedbacks Logged: ${stats.totalFeedback} (${stats.positiveCount} Thumbs Up ðŸ‘, ${stats.negativeCount} Thumbs Down ðŸ‘Ž)
- Scanned Workspace Files: ${stats.scannedFiles.join(', ')}
- Accumulated Learned Rules & Corrections:
${learnedContext || "No custom corrections logged yet."}

Your Task:
Answer the user's questions candidly about what you have learned, how much progress you have made, what mistakes you have self-corrected, and how the workspace models are performing. Speak confidently, professionally, and in the user's preferred language (Hindi/Hinglish/English).`;

        const fullPrompt = `${personalSystemPrompt}\n\nUSER QUESTION: ${prompt}`;
        const reply = await GroqService.chat(fullPrompt, history || [], 'chat', null);

        res.json({
            success: true,
            reply: reply || "Personal Brain is active and continuously scanning your workspace!"
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
