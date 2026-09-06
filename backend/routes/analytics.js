const express = require('express');
const logger = require('../logger');
const multer = require('multer');
const Papa = require('papaparse');
const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const BASE = `http://127.0.0.1:${process.env.PORT || 5000}`;

// 1. Upload & Parse Dataset
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const ext = req.file.originalname.split('.').pop().toLowerCase();

    let data = [];
    if (ext === 'csv') {
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      data = parsed.data;
    } else if (ext === 'json') {
      data = JSON.parse(fileContent);
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, error: 'JSON file must contain an array of objects.' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format. Please upload CSV or JSON.' });
    }

    if (data.length === 0) {
      return res.status(400).json({ success: false, error: 'The dataset is empty.' });
    }

    // Extract columns from the first object
    const columns = Object.keys(data[0]);
    // Send only first 10 rows as preview to the LLM to save tokens
    const preview = data.slice(0, 10);
    
    res.json({
      success: true,
      filename: req.file.originalname,
      totalRows: data.length,
      columns,
      preview
    });

  } catch (error) {
    logger.error('Error in /analytics/upload:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to parse file' });
  }
});

// 2. Query Analytics Agent
router.post('/query', async (req, res) => {
  try {
    const { query, columns, preview, totalRows } = req.body;
    if (!query || !columns || !preview) {
      return res.status(400).json({ success: false, error: 'Missing query, columns, or preview data.' });
    }

    const prompt = `You are an expert Data Analyst Agent. 
The user has uploaded a dataset. 
Columns: ${columns.join(', ')}
Total Rows: ${totalRows}
Sample Data (first 10 rows):
${JSON.stringify(preview, null, 2)}

User Question: "${query}"

Based on the data provided, answer the user's question. 
Output your response STRICTLY as a JSON object with the following structure:
{
  "narrative": "A helpful text explanation of the insights.",
  "chartType": "bar" | "line" | "pie" | "none",
  "chartData": [
    { "name": "Category A", "value": 100 },
    { "name": "Category B", "value": 200 }
  ]
}
For 'chartData', map the most relevant data to 'name' (string) and 'value' (number). If the user asks for a specific chart type, use it, otherwise pick the best one. Do not wrap the JSON in markdown formatting or backticks, just output raw JSON.`;

    // Fetch from our existing chat endpoint
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers['x-privacy-mode']) {
        headers['x-privacy-mode'] = req.headers['x-privacy-mode'];
    }

    const aiRes = await fetch(`${BASE}/api/v1/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            message: prompt,
            model: 'auto',
            mode: 'chat',
            section: 'analytics'
        }),
        signal: AbortSignal.timeout(60000)
    });

    const aiData = await aiRes.json();
    let content = aiData.reply || aiData.message || '';

    // Clean up potential markdown formatting from LLM
    content = content.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();

    let resultObj;
    try {
      resultObj = JSON.parse(content);
    } catch (e) {
      logger.warn('Failed to parse analytics JSON, falling back to regex. Raw content:', content);
      // Attempt to extract JSON block if there's surrounding text
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        resultObj = JSON.parse(match[0]);
      } else {
        throw new Error('LLM did not return valid JSON.');
      }
    }

    res.json({ success: true, result: resultObj });
  } catch (error) {
    logger.error('Error in /analytics/query:', error);
    res.status(500).json({ success: false, error: error.message || 'Analytics query failed.' });
  }
});

module.exports = router;
