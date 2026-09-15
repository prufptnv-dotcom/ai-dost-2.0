'use strict';

const projectAuthorization = require('../../services/projectAuthorization');
const { getChatTaskGateway } = require('./createChatTaskGateway');
const { getActiveTask } = require('../../taskCancellation');

function writeSse(res, event) {
  if (res.writableEnded) return;
  res.write(`event: ${String(event.type || 'task_event')}\ndata: ${JSON.stringify(event)}\n\n`);
}

function resolveProjectId(body) {
  const projectId = body?.projectId || body?.project_id;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : 'default';
}

async function handleChatTaskRequest(req, res, next, dependencies = {}) {
  const body = req.body || {};
  if (!body.chatTaskPlan) return next();

  const projectId = resolveProjectId(body);
  const taskId = String(req.get('x-ai-dost-task-id') || body.taskId || `chat-${Date.now().toString(36)}`);
  const authorization = (dependencies.projectAuthorization || projectAuthorization).authorize(projectId, req, {
    autoCreateIfMissing: true,
  });

  if (!authorization.authorized) {
    return res.status(authorization.status || 403).json({
      success: false,
      error: authorization.error || 'Project access denied',
      taskId,
    });
  }

  const plan = body.chatTaskPlan;
  if (plan.intent?.type !== 'task' || !plan.intent?.requiresTool) {
    return next();
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-AI-Dost-Task-Id', taskId);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const activeTask = getActiveTask(taskId);
  const signal = activeTask?.controller?.signal;
  writeSse(res, { type: 'task_start', phase: 'queued', taskId, status: 'Canonical agent task accepted' });

  try {
    const gateway = dependencies.gateway || await getChatTaskGateway({
      aiService: dependencies.aiService,
      db: dependencies.db,
      runtime: dependencies.runtime,
    });

    const result = await gateway.run({
      projectId,
      userId: authorization.user.id,
      taskPlan: plan,
      context: {
        userPrompt: body.userPrompt || plan.intent.originalMessage || '',
        projectPath: body.projectPath || null,
        projectFiles: Array.isArray(body.projectFiles) ? body.projectFiles.slice(0, 200) : [],
        sessionId: body.sessionId || null,
      },
      signal,
      maxRepairs: 2,
      onEvent: (event) => writeSse(res, { ...event, taskId }),
    });

    writeSse(res, {
      type: result?.status === 'CANCELLED' ? 'task_canceled' : 'task_complete',
      taskId,
      status: result?.status || 'FAILED',
      result,
    });
    return res.end();
  } catch (error) {
    const canceled = Boolean(signal?.aborted) || error?.code === 'TASK_CANCELED';
    writeSse(res, {
      type: canceled ? 'task_canceled' : 'task_error',
      taskId,
      status: canceled ? 'CANCELLED' : 'FAILED',
      error: canceled ? 'Task canceled by user' : (error?.message || 'Agent task failed'),
    });
    return res.end();
  }
}

module.exports = {
  handleChatTaskRequest,
};