/**
 * Copilot self-learning memory API (user-level, durable notes).
 *
 * POST   /learn          — save notes (auto-learn from runs or manual)
 * GET    /list           — panel view (?q, ?projectId, ?limit)
 * GET    /retrieve       — ranked retrieval for a prompt (?prompt, ?projectId)
 * GET    /count          — badge count
 * DELETE /clear          — wipe all (or body.projectId only)
 * DELETE /:id            — remove one note
 *
 * Notes are keyed by user_id and have NO FK to projects — deleting a project
 * never deletes its lessons.
 */
const express = require('express');
const logger = require('../logger');
const { getDatabase } = require('../db');
const CopilotNoteDAO = require('../db/dao/CopilotNoteDAO');
const { learnNotes, retrieveNotes, formatNotes } = require('../services/copilotMemory');

const router = express.Router();
const userIdOf = (req) => String((req.user && req.user.id) || req.headers['x-user-id'] || 'local-user');

function strip(row) {
  let tags = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch (_) { tags = []; }
  return {
    id: row.id,
    kind: row.kind,
    content: row.content,
    tags,
    projectId: row.project_id || null,
    source: row.source,
    successCount: row.success_count || 1,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

router.post('/learn', (req, res) => {
  try {
    const body = req.body || {};
    const list = Array.isArray(body.notes) ? body.notes : (body.notes ? [body.notes] : []);
    if (list.length === 0) {
      return res.status(400).json({ success: false, error: 'notes array required' });
    }
    const result = learnNotes(list, {
      userId: userIdOf(req),
      projectId: body.projectId || null,
      source: body.source || 'manual',
    });
    return res.json({ success: true, ...result });
  } catch (e) {
    logger.error('[CopilotMemory] learn failed:', e.message || e);
    return res.status(500).json({ success: false, error: 'Failed to save notes' });
  }
});

router.get('/list', (req, res) => {
  try {
    const db = getDatabase();
    const dao = new CopilotNoteDAO(db);
    const userId = userIdOf(req);
    const projectId = String(req.query.projectId || '').trim() || null;
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const rows = dao.listVisible({ userId, projectId, q, limit });
    return res.json({ success: true, notes: rows.map(strip), total: dao.count(userId, projectId) });
  } catch (e) {
    logger.error('[CopilotMemory] list failed:', e.message || e);
    return res.status(500).json({ success: false, error: 'Failed to list notes', notes: [] });
  }
});

router.get('/retrieve', (req, res) => {
  try {
    const projectId = String(req.query.projectId || '').trim() || null;
    const prompt = String(req.query.prompt || '');
    const notes = retrieveNotes({ userId: userIdOf(req), projectId, prompt, limit: 5 });
    return res.json({ success: true, notes: notes.map(strip), formatted: formatNotes(notes) });
  } catch (e) {
    logger.error('[CopilotMemory] retrieve failed:', e.message || e);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notes' });
  }
});

router.get('/count', (req, res) => {
  try {
    const db = getDatabase();
    const dao = new CopilotNoteDAO(db);
    const projectId = String(req.query.projectId || '').trim() || null;
    return res.json({ success: true, count: dao.count(userIdOf(req), projectId) });
  } catch (e) {
    return res.status(500).json({ success: false, count: 0 });
  }
});

router.delete('/clear', (req, res) => {
  try {
    const db = getDatabase();
    const dao = new CopilotNoteDAO(db);
    const projectId = (req.body && req.body.projectId) || String(req.query.projectId || '').trim() || null;
    const removed = dao.clear(userIdOf(req), projectId);
    return res.json({ success: true, removed });
  } catch (e) {
    logger.error('[CopilotMemory] clear failed:', e.message || e);
    return res.status(500).json({ success: false, error: 'Failed to clear notes' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const dao = new CopilotNoteDAO(db);
    const ok = dao.remove(String(req.params.id || ''), userIdOf(req));
    if (!ok) return res.status(404).json({ success: false, error: 'Note not found' });
    return res.json({ success: true });
  } catch (e) {
    logger.error('[CopilotMemory] delete failed:', e.message || e);
    return res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

module.exports = router;
