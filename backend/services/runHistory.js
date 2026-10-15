'use strict';

/**
 * Devin-style run history for GET /api/agent/tasks.
 * Reads the REAL durable store (agent_tasks + agent_runs via the DAOs) and
 * normalizes rows for both the Kanban board (`column`) and the run-history
 * inspector (status, attempts, errors, timestamps).
 */

const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');

// agent_tasks.status → KanbanBoard STATUS_COLUMNS key.
const STATUS_TO_COLUMN = Object.freeze({
  PENDING: 'planned',
  QUEUED: 'planned',
  RUNNING: 'running',
  WAITING: 'running',
  VERIFYING: 'running',
  COMPLETED: 'done',
  SUCCEEDED: 'done',
  FAILED: 'review',
  CANCELLED: 'backlog',
});

function safeParse(value) {
  if (!value || typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch (_) { return null; }
}

function mapTaskRow(taskRow, runs) {
  const list = Array.isArray(runs) ? runs : [];
  // listByTask orders attempt DESC → runs[0] is the latest attempt.
  const latest = list.length ? list[0] : null;
  const meta = safeParse(latest && latest.runtime_metadata);
  const rawError = latest && latest.error_info ? latest.error_info : null;
  const parsedError = safeParse(rawError);

  return {
    id: taskRow.id,
    projectId: taskRow.project_id,
    title: taskRow.title || taskRow.id,
    column: STATUS_TO_COLUMN[taskRow.status] || 'backlog',
    status: taskRow.status,
    description: (meta && (meta.goal || meta.summary || meta.prompt))
      || taskRow.title
      || '',
    attempt: latest ? latest.attempt : null,
    runStatus: latest ? latest.status : null,
    error: parsedError || rawError || null,
    startedAt: (latest && latest.started_at) || null,
    completedAt: (latest && latest.completed_at) || taskRow.completed_at || null,
    createdAt: taskRow.created_at || null,
    updatedAt: taskRow.updated_at || null,
    runCount: list.length,
  };
}

function listRunHistory({ db, projectId = null, limit = 50 }) {
  if (!db) return [];
  const taskDao = new AgentTaskDAO(db);
  const runDao = new AgentRunDAO(db);
  const rows = taskDao.listRecent(limit, projectId);
  return rows.map((taskRow) => {
    let runs = [];
    try { runs = runDao.listByTask(taskRow.id); } catch (_) { runs = []; }
    return mapTaskRow(taskRow, runs);
  });
}

module.exports = { STATUS_TO_COLUMN, safeParse, mapTaskRow, listRunHistory };
