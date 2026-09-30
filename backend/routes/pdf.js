const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const { generatePdfFile } = require('../services/nodePdfService');
const { sweepDownloads } = require('../services/downloadStore');
// P2 #178: shared resolver — hard-coded frontend/public/downloads 404'd in Docker
const { resolveDownloadsDir } = require('../services/downloadsDir');

// P2 #48: sweep expired downloads on every generate request (non-blocking)
router.use((req, res, next) => {
    if (req.method === 'POST') setImmediate(() => sweepDownloads(resolveDownloadsDir()));
    next();
});

router.post('/generate', async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    try {
        const fileId = crypto.randomUUID();
        // P3 #70: full UUID (122 bits) in the filename — the old 8-hex suffix
        // (32 bits) made /download/:name enumerable by local callers.
        const filename = `${title.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '_')}_${fileId}.pdf`;
        
        // Shared downloads dir (P2 #178): env-aware so Docker serves what it writes
        const downloadsDir = resolveDownloadsDir();
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
    const downloadsDir = resolveDownloadsDir();
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
