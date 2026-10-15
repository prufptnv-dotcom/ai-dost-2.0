class AgentHandoffDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM agent_handoffs WHERE id = ?').get(id) || null;
  }

  create(data) {
    const {
      id,
      taskId,
      sourceRunId,
      targetRunId = null,
      sourceAgent,
      targetAgent,
      objective,
      status = 'PENDING',
      contextRefs = null,
      artifactRefs = null,
      constraints = null,
      expectedOutput = null,
      expiresAt = null,
      errorInfo = null,
      resultJson = null
    } = data;

    this.db.prepare(`
      INSERT INTO agent_handoffs (
        id, task_id, source_run_id, target_run_id, source_agent, target_agent,
        objective, status, context_refs, artifact_refs, constraints, expected_output,
        expires_at, error_info, result_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      taskId,
      sourceRunId,
      targetRunId,
      sourceAgent,
      targetAgent,
      objective,
      status,
      contextRefs ? (typeof contextRefs === 'string' ? contextRefs : JSON.stringify(contextRefs)) : null,
      artifactRefs ? (typeof artifactRefs === 'string' ? artifactRefs : JSON.stringify(artifactRefs)) : null,
      constraints ? (typeof constraints === 'string' ? constraints : JSON.stringify(constraints)) : null,
      expectedOutput ? (typeof expectedOutput === 'string' ? expectedOutput : JSON.stringify(expectedOutput)) : null,
      expiresAt,
      errorInfo ? (typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo)) : null,
      resultJson ? (typeof resultJson === 'string' ? resultJson : JSON.stringify(resultJson)) : null
    );

    return this.getById(id);
  }

  findActiveHandoff(taskId, sourceRunId, targetAgent, objective) {
    return this.db.prepare(`
      SELECT * FROM agent_handoffs 
      WHERE task_id = ? 
        AND source_run_id = ? 
        AND target_agent = ? 
        AND objective = ?
        AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(taskId, sourceRunId, targetAgent, objective) || null;
  }

  updateStatus(id, status, errorInfo = null, acceptedAt = null, completedAt = null) {
    const updates = ['status = ?'];
    const params = [status];

    if (errorInfo !== undefined) {
      updates.push('error_info = ?');
      params.push(errorInfo ? (typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo)) : null);
    }
    if (acceptedAt) {
      updates.push('accepted_at = ?');
      params.push(acceptedAt);
    }
    if (completedAt) {
      updates.push('completed_at = ?');
      params.push(completedAt);
    }

    params.push(id);
    this.db.prepare(`UPDATE agent_handoffs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  updateTargetRun(id, targetRunId, status = 'ACCEPTED', acceptedAt = null) {
    this.db.prepare(`
      UPDATE agent_handoffs 
      SET target_run_id = ?, status = ?, accepted_at = COALESCE(?, datetime('now'))
      WHERE id = ?
    `).run(targetRunId, status, acceptedAt, id);
    return this.getById(id);
  }

  updateResult(id, resultJson, status = 'COMPLETED', completedAt = null) {
    const serialized = typeof resultJson === 'string' ? resultJson : JSON.stringify(resultJson);
    this.db.prepare(`
      UPDATE agent_handoffs 
      SET result_json = ?, status = ?, completed_at = COALESCE(?, datetime('now'))
      WHERE id = ?
    `).run(serialized, status, completedAt, id);
    return this.getById(id);
  }

  listByTask(taskId) {
    return this.db.prepare('SELECT * FROM agent_handoffs WHERE task_id = ? ORDER BY created_at ASC').all(taskId);
  }

  listBySourceRun(sourceRunId) {
    return this.db.prepare('SELECT * FROM agent_handoffs WHERE source_run_id = ? ORDER BY created_at ASC').all(sourceRunId);
  }

  listByTargetRun(targetRunId) {
    return this.db.prepare('SELECT * FROM agent_handoffs WHERE target_run_id = ? ORDER BY created_at ASC').all(targetRunId);
  }
}

module.exports = AgentHandoffDAO;
