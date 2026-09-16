const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const { generatePdfFile } = require('../services/nodePdfService');

router.post('/generate', async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    try {
        const fileId = crypto.randomUUID();
        const filename = `${title.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '_')}_${fileId.substring(0, 8)}.pdf`;
        
        // We write to frontend/public/downloads so Next.js can serve it statically
        const downloadsDir = path.join(__dirname, '../../frontend/public/downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        const outputPdfPath = path.join(downloadsDir, filename);

        await generatePdfFile(content, title, outputPdfPath);
        logger.info(`PDF compiled successfully: ${filename}`);

        // Return public static URL (statically served by Next.js from /public/downloads/)
        const downloadUrl = `/downloads/${filename}`;

        res.json({
            success: true,
            downloadUrl: downloadUrl,
            filename: filename,
            message: 'PDF compiled and ready for download!'
        });
    } catch (error) {
        logger.error('PDF route error:', error);
        res.status(500).json({ success: false, error: 'Server error during PDF compilation', details: error.message });
    }
});

// Serve generated PDFs from the downloads dir (standalone deployment friendly)
router.get('/download/:name', (req, res) => {
    const downloadsDir = path.join(__dirname, '../../frontend/public/downloads');
    const name = path.basename(req.params.name || '');
    if (!name || !name.endsWith('.pdf')) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
    }
    const filePath = path.join(downloadsDir, name);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'PDF not found' });
    }
    res.download(filePath, name);
});

module.exports = router;
