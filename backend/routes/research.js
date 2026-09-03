const express = require('express');
const router = express.Router();
const logger = require('../logger');
const researchService = require('../services/researchService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// POST /api/research/run
router.post('/run', async (req, res) => {
  const { topic, depth = 'deep', maxSources = 5 } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  try {
    const result = await researchService.conductResearch(topic, { depth, maxSources });
    res.json({
      success: true,
      data: result,
      message: 'Research synthesized successfully'
    });
  } catch (err) {
    logger.error('Research execution error:', err);
    res.status(500).json({ success: false, error: 'Failed to conduct research', details: err.message });
  }
});

// POST /api/research/export -> 1-Click Deliverable Export (PDF, DOCX, PPTX)
router.post('/export', async (req, res) => {
  const { topic, markdownReport, format = 'pdf' } = req.body;

  if (!topic || !markdownReport) {
    return res.status(400).json({ success: false, error: 'Topic and markdownReport are required' });
  }

  try {
    const cleanFormat = (format || 'pdf').toLowerCase();
    const port = process.env.PORT || 5000;
    const base = `http://127.0.0.1:${port}`;

    let exportRes;
    if (cleanFormat === 'pdf') {
      exportRes = await fetch(`${base}/api/pdf/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${topic} Research Report`,
          content: markdownReport
        })
      });
    } else {
      // DOCX / PPTX / CSV via document engine
      exportRes = await fetch(`${base}/api/document/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: cleanFormat,
          topic: `${topic} research analysis`,
          title: `${topic} - Research Deliverable`
        })
      });
    }

    if (!exportRes.ok) {
      throw new Error(`Export service responded with status ${exportRes.status}`);
    }

    const data = await exportRes.json();
    res.json({
      success: true,
      downloadUrl: data.downloadUrl || data.url,
      filename: data.filename,
      format: cleanFormat,
      message: `Research deliverable compiled as ${cleanFormat.toUpperCase()}`
    });
  } catch (err) {
    logger.error('Research deliverable export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export deliverable', details: err.message });
  }
});

module.exports = router;
