const express = require('express');
const router = express.Router();
const ProjectGraphService = require('../services/projectGraphService');

let graphService = null;
function getGraphService() {
  if (!graphService) graphService = new ProjectGraphService();
  return graphService;
}

/**
 * GET /api/v1/projects/:id/graph
 * Retrieve complete unified workspace graph for a project
 */
router.get('/:id/graph', async (req, res) => {
  try {
    const { id } = req.params;
    const service = getGraphService();
    const graph = await service.getProjectGraph(id);
    res.json({ success: true, graph });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/projects/:id/nodes
 * Add a new context node to the project graph
 */
router.post('/:id/nodes', async (req, res) => {
  try {
    const { id } = req.params;
    const { nodeType, title, contentSummary, rawRef } = req.body || {};
    if (!title) {
      return res.status(400).json({ success: false, error: 'Node title is required' });
    }
    const service = getGraphService();
    const node = await service.addContextNode(id, { nodeType, title, contentSummary, rawRef });
    res.json({ success: true, node });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/projects/:id/nodes/:nodeId
 * Delete a context node from the graph
 */
router.delete('/:id/nodes/:nodeId', async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const service = getGraphService();
    const deleted = await service.deleteContextNode(id, nodeId);
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/projects/:id/edges
 * Add a relationship edge between two nodes
 */
router.post('/:id/edges', async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceNodeId, targetNodeId, relationType, weight } = req.body || {};
    if (!sourceNodeId || !targetNodeId) {
      return res.status(400).json({ success: false, error: 'sourceNodeId and targetNodeId are required' });
    }
    const service = getGraphService();
    const edge = await service.addContextEdge(id, { sourceNodeId, targetNodeId, relationType, weight });
    res.json({ success: true, edge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/projects/:id/edges/:edgeId
 * Delete an edge from the graph
 */
router.delete('/:id/edges/:edgeId', async (req, res) => {
  try {
    const { id, edgeId } = req.params;
    const service = getGraphService();
    const deleted = await service.deleteContextEdge(id, edgeId);
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/projects/:id/bind
 * Bind an external asset (document, code, research, image) to the project
 */
router.post('/:id/bind', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, mimeType, storagePath, sizeBytes, metadata } = req.body || {};
    if (!name || !storagePath) {
      return res.status(400).json({ success: false, error: 'Asset name and storagePath are required' });
    }
    const service = getGraphService();
    const artifact = await service.bindAsset(id, { name, type, mimeType, storagePath, sizeBytes, metadata });
    res.json({ success: true, artifact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
