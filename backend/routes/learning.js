const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const GroqService = require('../services/groqService');

const MEMORY_FILE = path.join(__dirname, '../data/personal_brain_memory.json');

// Helper to read learning brain memory
function getBrainMemory() {
    try {
        if (!fs.existsSync(path.dirname(MEMORY_FILE))) {
            fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
        }
        if (!fs.existsSync(MEMORY_FILE)) {
            const initialData = {
                totalFeedback: 0,
                positiveCount: 0,
                negativeCount: 0,
                feedbackLogs: [],
                learnedRules: [
                    "Always write production-ready code with flawless grammar.",
                    "Match user's language (Hindi/Hinglish/English) precisely.",
                    "Avoid self-deprecating disclaimers or imaginary system bug lists."
                ],
                scannedFiles: ["main.py", "index.html", "style.css", "server.js", "AICompanion.jsx"]
            };
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return {
            totalFeedback: 0,
            positiveCount: 0,
            negativeCount: 0,
            feedbackLogs: [],
            learnedRules: [],
            scannedFiles: []
        };
    }
}

// Helper to write learning brain memory
function saveBrainMemory(data) {
    try {
        if (!fs.existsSync(path.dirname(MEMORY_FILE))) {
            fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
        }
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to save personal brain memory:", e.message);
    }
}

// 1. Submit Feedback (Thumbs Up / Down + Correction)
router.post('/feedback', async (req, res) => {
    try {
        const { type, message, aiReply, correction, category } = req.body;
        const memory = getBrainMemory();
        
        memory.totalFeedback += 1;
        if (type === 'up') {
            memory.positiveCount += 1;
        } else {
            memory.negativeCount += 1;
            if (correction) {
                memory.learnedRules.push(`Correction from User: ${correction}`);
            }
        }

        const logEntry = {
            id: Date.now().toString(),
            type,
            category: category || 'general',
            message: message ? message.substring(0, 500) : '',
            aiReply: aiReply ? aiReply.substring(0, 500) : '',
            correction: correction || '',
            timestamp: new Date().toISOString()
        };

        memory.feedbackLogs.unshift(logEntry);
        // Keep max 100 logs
        if (memory.feedbackLogs.length > 100) {
            memory.feedbackLogs = memory.feedbackLogs.slice(0, 100);
        }

        saveBrainMemory(memory);

        res.json({
            success: true,
            message: type === 'up' ? 'Positive feedback recorded! Personal Brain learning updated.' : 'Correction recorded! Personal Brain has self-corrected.',
            stats: {
                totalFeedback: memory.totalFeedback,
                positiveCount: memory.positiveCount,
                negativeCount: memory.negativeCount,
                rulesCount: memory.learnedRules.length
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Get Learning Stats for Secret Personal Brain Console
router.get('/stats', (req, res) => {
    try {
        const memory = getBrainMemory();
        res.json({
            success: true,
            totalFeedback: memory.totalFeedback,
            positiveCount: memory.positiveCount,
            negativeCount: memory.negativeCount,
            learnedRules: memory.learnedRules.slice(-10),
            scannedFilesCount: memory.scannedFiles.length,
            scannedFiles: memory.scannedFiles,
            recentLogs: memory.feedbackLogs.slice(0, 5)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Chat with Personal Autonomous Model in Secret Console
router.post('/chat', async (req, res) => {
    try {
        const { prompt, history } = req.body;
        const memory = getBrainMemory();
        
        const learnedContext = memory.learnedRules.slice(-10).map((rule, i) => `${i + 1}. ${rule}`).join('\n');
        
        const personalSystemPrompt = `You are AI-Dost Personal Brain, an autonomous self-learning AI model running inside the user's secret developer inspector console.
You have "Aakh" (Vision/File Scanning capabilities) and continuously analyze user feedback, project files, and chat quality.

Current Learning Memory Summary:
- Total User Feedbacks Logged: ${memory.totalFeedback} (${memory.positiveCount} Thumbs Up 👍, ${memory.negativeCount} Thumbs Down 👎)
- Scanned Workspace Files: ${memory.scannedFiles.join(', ')}
- Accumulated Learned Rules & Corrections:
${learnedContext || "No custom corrections logged yet."}

Your Task:
Answer the user's questions candidly about what you have learned, how much progress you have made, what mistakes you have self-corrected, and how the workspace models are performing. Speak confidently, professionally, and in the user's preferred language (Hindi/Hinglish/English).`;

        const reply = await GroqService.chat(prompt, history || [], 'chat', process.env.GROQ_API_KEY);
        
        res.json({
            success: true,
            reply: reply || "Personal Brain is active and continuously scanning your workspace!"
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
