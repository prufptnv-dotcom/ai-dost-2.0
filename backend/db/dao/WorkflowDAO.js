const crypto = require('crypto');

class WorkflowDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id || typeof id !== 'string') return null;
    const row = this.db.prepare('SELECT * FROM workflows WHERE id = ?').get(id);
    return row ? this._formatRow(row) : null;
  }

  listAll(projectId = null) {
    let rows;
    if (projectId) {
      rows = this.db.prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    } else {
      rows = this.db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all();
    }
    return rows.map((r) => this._formatRow(r));
  }

  findDueWorkflows(nowIso = new Date().toISOString()) {
    const rows = this.db.prepare(`
      SELECT * FROM workflows
      WHERE status = 'active'
        AND trigger_type = 'schedule'
        AND (next_run_at IS NULL OR next_run_at <= ?)
      ORDER BY next_run_at ASC
    `).all(nowIso);
    return rows.map((r) => this._formatRow(r));
  }

  findEventWorkflows(eventName, projectId = null) {
    let rows;
    if (projectId) {
      rows = this.db.prepare(`
        SELECT * FROM workflows
        WHERE status = 'active'
          AND trigger_type = 'event'
          AND (project_id = ? OR project_id = 'default')
      `).all(projectId);
    } else {
      rows = this.db.prepare(`
        SELECT * FROM workflows
        WHERE status = 'active'
          AND trigger_type = 'event'
      `).all();
    }

    return rows
      .map((r) => this._formatRow(r))
      .filter((w) => {
        try {
          const cfg = typeof w.trigger_config === 'object' ? w.trigger_config : JSON.parse(w.trigger_config || '{}');
          return cfg.event === eventName;
        } catch (_) {
          return false;
        }
      });
  }

  create({
    id = null,
    projectId = 'default',
    name,
    description = '',
    triggerType = 'schedule',
    triggerConfig = {},
    actionType,
    actionConfig = {},
    notifyChannels = ['in_app'],
    status = 'active',
    nextRunAt = null,
  }) {
    if (!name || !actionType) {
      throw new Error('Workflow name and actionType are required');
    }

    const finalId = id || `wf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const triggerConfigStr = typeof triggerConfig === 'string' ? triggerConfig : JSON.stringify(triggerConfig);
    const actionConfigStr = typeof actionConfig === 'string' ? actionConfig : JSON.stringify(actionConfig);
    const notifyChannelsStr = typeof notifyChannels === 'string' ? notifyChannels : JSON.stringify(notifyChannels);

    this.db.prepare(`
      INSERT INTO workflows (
        id, project_id, name, description, trigger_type, trigger_config,
        action_type, action_config, notify_channels, status, next_run_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      finalId,
      projectId,
      name,
      description,
      triggerType,
      triggerConfigStr,
      actionType,
      actionConfigStr,
      notifyChannelsStr,
      status,
      nextRunAt
    );

    return this.getById(finalId);
  }

  update(id, fields = {}) {
    if (!id) throw new Error('Workflow id is required');
    const updates = [];
    const params = [];

    if (fields.name !== undefined) { updates.push('name = ?'); params.push(fields.name); }
    if (fields.description !== undefined) { updates.push('description = ?'); params.push(fields.description); }
    if (fields.trigger_type !== undefined) { updates.push('trigger_type = ?'); params.push(fields.trigger_type); }
    if (fields.trigger_config !== undefined) {
      updates.push('trigger_config = ?');
      params.push(typeof fields.trigger_config === 'string' ? fields.trigger_config : JSON.stringify(fields.trigger_config));
    }
    if (fields.action_type !== undefined) { updates.push('action_type = ?'); params.push(fields.action_type); }
    if (fields.action_config !== undefined) {
      updates.push('action_config = ?');
      params.push(typeof fields.action_config === 'string' ? fields.action_config : JSON.stringify(fields.action_config));
    }
    if (fields.notify_channels !== undefined) {
      updates.push('notify_channels = ?');
      params.push(typeof fields.notify_channels === 'string' ? fields.notify_channels : JSON.stringify(fields.notify_channels));
    }
    if (fields.status !== undefined) { updates.push('status = ?'); params.push(fields.status); }
    if (fields.next_run_at !== undefined) { updates.push('next_run_at = ?'); params.push(fields.next_run_at); }
    if (fields.last_run_at !== undefined) { updates.push('last_run_at = ?'); params.push(fields.last_run_at); }

    if (updates.length === 0) return this.getById(id);

    updates.push("updated_at = datetime('now')");
    params.push(id);

    this.db.prepare(`UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  updateRunTimes(id, { lastRunAt, nextRunAt, incrementCount = true }) {
    if (!id) return;
    const stmt = incrementCount
      ? this.db.prepare(`
          UPDATE workflows
          SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, updated_at = datetime('now')
          WHERE id = ?
        `)
      : this.db.prepare(`
          UPDATE workflows
          SET last_run_at = ?, next_run_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `);
    stmt.run(lastRunAt, nextRunAt, id);
  }

  delete(id) {
    if (!id) return false;
    const res = this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return res.changes > 0;
  }

  _formatRow(row) {
    if (!row) return null;
    return {
      ...row,
      trigger_config: this._parseJson(row.trigger_config),
      action_config: this._parseJson(row.action_config),
      notify_channels: this._parseJson(row.notify_channels, ['in_app']),
    };
  }

  _parseJson(val, fallback = {}) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (_) {
      return fallback;
    }
  }
}

module.exports = WorkflowDAO;
