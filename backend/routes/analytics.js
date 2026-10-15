const express = require('express');
const logger = require('../logger');
const multer = require('multer');
const Papa = require('papaparse');
const { selfBaseUrl } = require('../services/selfUrl'); // P3 #66
const { computeDatasetProfile, parseExcelBuffer, DATA_ANALYTICS_STUDIO_DIRECTIVE } = require('../services/dataAnalyticsEngine');
const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const BASE = selfBaseUrl(); // P3 #66 — was hardcoded 127.0.0.1

// 1. Upload & Parse Dataset (CSV, JSON, XLSX, XLS)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let data = [];
    let columns = [];

    if (ext === 'csv') {
      const fileContent = req.file.buffer.toString('utf-8');
      const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      data = parsed.data;
      if (data.length > 0) columns = Object.keys(data[0]);
    } else if (ext === 'json') {
      const fileContent = req.file.buffer.toString('utf-8');
      data = JSON.parse(fileContent);
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, error: 'JSON file must contain an array of objects.' });
      }
      if (data.length > 0) columns = Object.keys(data[0]);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const excelParsed = await parseExcelBuffer(req.file.buffer);
      data = excelParsed.rows;
      columns = excelParsed.columns;
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported format. Please upload CSV, JSON, or Excel (.xlsx/.xls).' });
    }

    if (data.length === 0) {
      return res.status(400).json({ success: false, error: 'The dataset is empty.' });
    }

    // Deterministic statistical profile
    const profile = computeDatasetProfile(data, columns);
    const preview = data.slice(0, 15);
    
    res.json({
      success: true,
      filename: req.file.originalname,
      totalRows: data.length,
      columns,
      preview,
      profile,
    });

  } catch (error) {
    logger.error('Error in /analytics/upload:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to parse file' });
  }
});

// 2. Statistical Profile on Demand
router.post('/summary', async (req, res) => {
  try {
    const { rows, columns } = req.body;
    if (!rows || !columns) {
      return res.status(400).json({ success: false, error: 'Rows and columns are required.' });
    }
    const profile = computeDatasetProfile(rows, columns);
    res.json({ success: true, profile });
  } catch (error) {
    logger.error('Error in /analytics/summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Query Analytics Agent (Category 8 Engine)
router.post('/query', async (req, res) => {
  try {
    const { query, columns, preview, totalRows, profile, mode = 'general' } = req.body;
    if (!query || !columns || !preview) {
      return res.status(400).json({ success: false, error: 'Missing query, columns, or preview data.' });
    }

    const prompt = `${DATA_ANALYTICS_STUDIO_DIRECTIVE}

DATASET CONTEXT:
Columns: ${columns.join(', ')}
Total Rows: ${totalRows}
Statistical / Missing Overview:
${profile ? JSON.stringify(profile.columnProfiles, null, 2).slice(0, 3000) : 'Available in sample'}

Sample Data (first 15 rows):
${JSON.stringify(preview, null, 2)}

USER QUESTION / TASK: "${query}" (Requested Mode: ${mode})

INSTRUCTIONS:
Analyze the data thoroughly. Answer with precision, actionable insights, and production code if requested.
Output your response STRICTLY as a JSON object with this schema:
{
  "narrative": "A detailed, structured explanation with key metrics, insights, and recommendations in Markdown.",
  "chartType": "bar" | "line" | "area" | "pie" | "none",
  "chartData": [
    { "name": "Category / Dimension", "value": 123.45 }
  ],
  "suggestedCode": "Optional Python (Pandas/Polars) or SQL snippet if relevant, else null"
}
Do NOT wrap the JSON in outer markdown code fences or backticks. Just output valid raw JSON.`;

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
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        resultObj = JSON.parse(match[0]);
      } else {
        resultObj = {
          narrative: content,
          chartType: 'none',
          chartData: [],
          suggestedCode: null
        };
      }
    }

    res.json({ success: true, result: resultObj });
  } catch (error) {
    logger.error('Error in /analytics/query:', error);
    res.status(500).json({ success: false, error: error.message || 'Analytics query failed.' });
  }
});

module.exports = router;
