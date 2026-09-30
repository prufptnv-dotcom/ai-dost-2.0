const express = require('express');
const router = express.Router();
const bharatService = require('../services/bharatApis');

// 1. Pincode Lookup
router.get('/pincode/:code', async (req, res) => {
  try {
    const result = await bharatService.lookupPincode(req.params.code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 2. IFSC Bank Branch Lookup
router.get('/ifsc/:code', async (req, res) => {
  try {
    const result = await bharatService.lookupIFSC(req.params.code);
    res.json(result);
  } catch (err) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 3. Mandi Bhav / Agricultural Commodity Rates
router.get('/mandi', async (req, res) => {
  try {
    const { commodity, state } = req.query;
    const result = await bharatService.getMandiBhav(commodity, state);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. Indian Gazetted & National Holidays
router.get('/holidays', (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || 2026;
    const result = bharatService.getIndianHolidays(year);
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. ISRO Open Space Missions & Bhuvan Geo-Portal Directory
router.get('/isro', (req, res) => {
  try {
    const result = bharatService.getIsroData();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 6. Bhashini / Indic Language Translation
router.post('/translate', (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Text field is required' });
    }
    const result = bharatService.translateIndic(text, targetLang || 'hi');
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 7. Aadhaar Verification
router.post('/aadhaar', (req, res) => {
  try {
    const { aadhaar } = req.body;
    if (!aadhaar) return res.status(400).json({ status: 'error', message: 'Aadhaar number is required' });
    res.json(bharatService.validateAadhaar(aadhaar));
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 8. GSTIN Verification
router.post('/gstin', (req, res) => {
  try {
    const { gstin } = req.body;
    if (!gstin) return res.status(400).json({ status: 'error', message: 'GSTIN is required' });
    res.json(bharatService.validateGSTIN(gstin));
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 9. UPI Link Generator
router.post('/upi', (req, res) => {
  try {
    const { vpa, name, amount, note } = req.body;
    if (!vpa) return res.status(400).json({ status: 'error', message: 'VPA (UPI ID) is required' });
    res.json(bharatService.generateUPILink(vpa, name, amount, note));
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
