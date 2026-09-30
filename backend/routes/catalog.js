/**
 * routes/catalog.js
 * REST API for AI-Dost 3.0 Master 50-Domain Capability Catalog
 */

const express = require('express');
const router = express.Router();
const {
    CAPABILITY_CLUSTERS,
    getAllCapabilities,
    getCapabilityById,
    getCapabilityBySlug,
    detectMasterCapability
} = require('../services/masterCapabilityCatalog');

// GET /api/catalog/capabilities - List all 50 capabilities
router.get('/capabilities', (req, res) => {
    try {
        const capabilities = getAllCapabilities();
        res.json({
            success: true,
            total: capabilities.length,
            clusters: Object.values(CAPABILITY_CLUSTERS),
            capabilities
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/catalog/clusters - Summary by clusters
router.get('/clusters', (req, res) => {
    try {
        const capabilities = getAllCapabilities();
        const clusterMap = {};
        for (const clusterName of Object.values(CAPABILITY_CLUSTERS)) {
            clusterMap[clusterName] = [];
        }
        for (const cap of capabilities) {
            if (clusterMap[cap.cluster]) {
                clusterMap[cap.cluster].push(cap);
            }
        }
        res.json({
            success: true,
            totalCapabilities: capabilities.length,
            clusters: clusterMap
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/catalog/capabilities/:idOrSlug - Get single capability
router.get('/capabilities/:idOrSlug', (req, res) => {
    try {
        const { idOrSlug } = req.params;
        let cap = null;
        if (/^\d+$/.test(idOrSlug)) {
            cap = getCapabilityById(parseInt(idOrSlug, 10));
        } else {
            cap = getCapabilityBySlug(idOrSlug);
        }

        if (!cap) {
            return res.status(404).json({ success: false, error: 'Capability not found' });
        }

        res.json({
            success: true,
            capability: {
                id: cap.id,
                slug: cap.slug,
                title: cap.title,
                icon: cap.icon,
                cluster: cap.cluster,
                description: cap.description,
                tags: cap.tags,
                samplePrompts: cap.samplePrompts,
                directiveSummary: cap.directive ? cap.directive.slice(0, 200) + '...' : ''
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/catalog/detect - Detect capability from message
router.post('/detect', (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const detection = detectMasterCapability(message);
        if (!detection.isMatch) {
            return res.json({
                success: true,
                isMatch: false,
                message: 'No specific capability matched, falls back to general intelligence.'
            });
        }

        res.json({
            success: true,
            isMatch: true,
            matchedDomain: detection.matchedDomain,
            capability: {
                id: detection.capability.id,
                slug: detection.capability.slug,
                title: detection.capability.title,
                icon: detection.capability.icon,
                cluster: detection.capability.cluster,
                description: detection.capability.description,
                tags: detection.capability.tags
            },
            directive: detection.directive
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
