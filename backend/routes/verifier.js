const express = require('express');
const router = express.Router();
const verifierService = require('../services/verifierService');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    engine: 'ActionVerifier',
    capabilities: ['syntax_check', 'secret_shield', 'dependency_check', 'document_integrity']
  });
});

router.post('/code', (req, res) => {
  try {
    const { filePath, options } = req.body;
    const content = req.body.content !== undefined ? req.body.content : req.body.code;
    if (content === undefined) {
      return res.status(400).json({ success: false, error: 'content or code is required' });
    }
    const report = verifierService.verifyCode(filePath, content, options);
    res.json({ success: true, report, result: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/document', (req, res) => {
  try {
    const filePath = req.body.filePath || req.body.fileName;
    const type = req.body.type || req.body.fileType;
    let content = req.body.content;
    if (req.body.contentBase64) {
      content = Buffer.from(req.body.contentBase64, 'base64');
    }
    if (!content && !filePath) {
      return res.status(400).json({ success: false, error: 'filePath, content, or contentBase64 required' });
    }
    const report = verifierService.verifyDocument(filePath, content, type);
    res.json({ success: true, report, result: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/action', (req, res) => {
  try {
    const { actionType, payload } = req.body;
    if (!actionType) {
      return res.status(400).json({ success: false, error: 'actionType is required' });
    }
    const report = verifierService.verifyAction(actionType, payload || {});
    res.json({ success: true, report, result: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

