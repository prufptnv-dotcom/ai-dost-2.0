const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

router.post('/generate', async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    try {
        const fileId = crypto.randomUUID();
        const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${fileId.substring(0, 8)}.pdf`;
        
        // Define paths
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const jsonPath = path.join(tempDir, `${fileId}.json`);
        // We write to frontend/public/downloads so Next.js can serve it statically
        const downloadsDir = path.join(__dirname, '../../frontend/public/downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }
        const outputPdfPath = path.join(downloadsDir, filename);
        
        // Write title and content to JSON file safely
        fs.writeFileSync(jsonPath, JSON.stringify({ title, content }, null, 2), 'utf-8');
        
        // Locate python executable in venv or fall back to system python
        let pythonCmd = path.join(__dirname, '../../.venv/Scripts/python.exe');
        if (!fs.existsSync(pythonCmd)) {
            pythonCmd = 'python';
        }
        const scriptPath = path.join(__dirname, '../services/pdfGenerator.py');
        
        // Run python script to build PDF
        exec(`"${pythonCmd}" "${scriptPath}" "${jsonPath}" "${outputPdfPath}"`, (err, stdout, stderr) => {
            // Clean up temp JSON file asynchronously
            try {
                fs.unlinkSync(jsonPath);
            } catch (e) {
                logger.error('Temp file clean up warning:', e.message);
            }
            
            if (err) {
                logger.error('PDF Generation execution error:', stderr);
                return res.status(500).json({ success: false, error: 'Failed to compile PDF', details: stderr });
            }
            
            logger.info(`PDF compiled successfully: ${filename}`);
            
            // Return public static URL (statically served by Next.js from /public/downloads/)
            const downloadUrl = `/downloads/${filename}`;
            
            res.json({
                success: true,
                downloadUrl: downloadUrl,
                filename: filename,
                message: 'PDF compiled and ready for download!'
            });
        });
        
    } catch (error) {
        logger.error('PDF route error:', error);
        res.status(500).json({ success: false, error: 'Server error during PDF compilation', details: error.message });
    }
});

module.exports = router;
