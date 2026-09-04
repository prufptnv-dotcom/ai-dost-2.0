const express = require('express');
const router = express.Router();
const WorkflowDAO = require('../db/dao/WorkflowDAO');
const WorkflowRunDAO = require('../db/dao/WorkflowRunDAO');
const { getWorkflowEngine } = require('../services/workflowEngine');
const logger = require('../logger');

function initWorkflowRoutes(db) {
  const workflowDao = new WorkflowDAO(db);
  const runDao = new WorkflowRunDAO(db);
  const engine = getWorkflowEngine(db);

  // GET /api/workflows - list all workflows
  router.get('/', (req, res) => {
    try {
      const { projectId, status } = req.query;
      let workflows = workflowDao.listAll(projectId || null);
      if (status) {
        workflows = workflows.filter((w) => w.status === status);
      }
      return res.json({ success: true, workflows });
    } catch (err) {
      logger.error('[WorkflowsRoute] List error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/workflows/recent-runs - get recent runs across all workflows
  router.get('/recent-runs', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const runs = runDao.getRecentRuns(limit);
      return res.json({ success: true, runs });
    } catch (err) {
      logger.error('[WorkflowsRoute] Recent runs error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/workflows - create a new workflow
  router.post('/', (req, res) => {
    try {
      const {
        name,
        description,
        triggerType,
        triggerConfig,
        actionType,
        actionConfig,
        notifyChannels,
        projectId,
        status,
      } = req.body;

      if (!name || !actionType) {
        return res.status(400).json({ success: false, error: 'Name and actionType are required' });
      }

      let nextRunAt = null;
      if ((triggerType || 'schedule') === 'schedule') {
        const intervalMinutes = (triggerConfig && triggerConfig.intervalMinutes) || 1440;
        nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
      }

      const created = workflowDao.create({
        name,
        description: description || '',
        triggerType: triggerType || 'schedule',
        triggerConfig: triggerConfig || {},
        actionType,
        actionConfig: actionConfig || {},
        notifyChannels: notifyChannels || ['in_app'],
        projectId: projectId || 'default',
        status: status || 'active',
        nextRunAt,
      });

      return res.status(201).json({ success: true, workflow: created });
    } catch (err) {
      logger.error('[WorkflowsRoute] Create error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/workflows/:id - get workflow details and recent runs
  router.get('/:id', (req, res) => {
    try {
      const workflow = workflowDao.getById(req.params.id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
      const runs = runDao.listByWorkflow(workflow.id, 20);
      return res.json({ success: true, workflow, runs });
    } catch (err) {
      logger.error('[WorkflowsRoute] Get error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/workflows/:id - update workflow
  router.put('/:id', (req, res) => {
    try {
      const existing = workflowDao.getById(req.params.id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      const updated = workflowDao.update(req.params.id, req.body);
      return res.json({ success: true, workflow: updated });
    } catch (err) {
      logger.error('[WorkflowsRoute] Update error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/workflows/:id - delete workflow
  router.delete('/:id', (req, res) => {
    try {
      const deleted = workflowDao.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
      return res.json({ success: true, message: 'Workflow deleted' });
    } catch (err) {
      logger.error('[WorkflowsRoute] Delete error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/workflows/:id/run - trigger manual execution immediately
  router.post('/:id/run', async (req, res) => {
    try {
      const workflow = workflowDao.getById(req.params.id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      const run = await engine.runWorkflowNow(workflow.id);
      return res.json({ success: true, run });
    } catch (err) {
      logger.error('[WorkflowsRoute] Run error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/workflows/:id/runs - get execution history
  router.get('/:id/runs', (req, res) => {
    try {
      const runs = runDao.listByWorkflow(req.params.id, 50);
      return res.json({ success: true, runs });
    } catch (err) {
      logger.error('[WorkflowsRoute] Runs error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = initWorkflowRoutes;
