'use strict';

const projectAuthorization = require('../../services/projectAuthorization');
const { getCopilotDirectorRuntime } = require('./createChatTaskGateway');
const { getActiveTask } = require('../../taskCancellation');

function writeSse(res, event) {
  if (res.writableEnded) return;
  res.write(`event: ${String(event.type || 'director_event')}\ndata: ${JSON.stringify(event)}\n\n`);
}

function resolveProjectId(body) {
  const value = body?.projectId || body?.project_id;
  return typeof value === 'string' && value.trim() ? value.trim() : 'default';
}

async function handleCopilotDirectorRequest(req, res, next, dependencies = {}) {
  const body = req.body || {};
  if (!body.copilotDirector) return next();

  const projectId = resolveProjectId(body);
  const taskId = String(req.get('x-ai-dost-task-id') || body.taskId || `copilot-${Date.now().toString(36)}`);
  const request = String(body.userPrompt || body.prompt || '').trim();
  if (!request) return res.status(400).json({ success: false, error: 'Director request is required', taskId });

  const authorization = (dependencies.projectAuthorization || projectAuthorization).authorize(projectId, req, {
    autoCreateIfMissing: true,
  });
  if (!authorization.authorized) {
    return res.status(authorization.status || 403).json({ success: false, error: authorization.error || 'Project access denied', taskId });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-AI-Dost-Task-Id', taskId);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const activeTask = getActiveTask(taskId);
  const signal = activeTask?.controller?.signal;
  writeSse(res, { type: 'director_start', phase: 'queued', taskId, status: 'Copilot Director accepted the outcome request' });

  try {
    const runtime = dependencies.runtime || await getCopilotDirectorRuntime({
      aiService: dependencies.aiService,
      db: dependencies.db,
      runtime: dependencies.runtime,
    });
    const result = await runtime.director.run({
      userId: authorization.user.id,
      projectId: authorization.project.id,
      request,
      signal,
      maxRepairs: 3,
      onEvent: (event) => writeSse(res, { ...event, taskId }),
    });

    writeSse(res, {
      type: result?.status === 'CANCELLED' ? 'director_canceled' : 'director_complete',
      taskId,
      status: result?.status || 'FAILED',
      result,
    });
    return res.end();
  } catch (error) {
    const canceled = Boolean(signal?.aborted) || error?.code === 'TASK_CANCELED';
    writeSse(res, {
      type: canceled ? 'director_canceled' : 'director_error',
      taskId,
      status: canceled ? 'CANCELLED' : 'FAILED',
      error: canceled ? 'Director run canceled by user' : (error?.message || 'Copilot Director failed'),
    });
    return res.end();
  }
}

module.exports = { handleCopilotDirectorRequest };
