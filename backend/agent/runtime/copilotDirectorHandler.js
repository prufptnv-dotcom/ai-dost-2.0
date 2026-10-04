'use strict';

const projectAuthorization = require('../../services/projectAuthorization');
const { getCopilotDirectorRuntime } = require('./createChatTaskGateway');
const { getActiveTask } = require('../../taskCancellation');
const { capabilityDiscovery } = require('../../agent/registry/CapabilityDiscovery');
const { capabilityGatekeeper } = require('../../agent/policy/CapabilityGatekeeper');

const PERMISSION_LEVELS = ['ask', 'auto', 'turbo'];

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
  const runId = `director-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const activeTask = getActiveTask(taskId);
  const signal = activeTask?.controller?.signal;

  // Emit run_started so CopilotIDE can track the runId
  writeSse(res, { type: 'run_started', runId, taskId });
  writeSse(res, { type: 'director_start', phase: 'queued', taskId, runId, status: 'Copilot Director accepted the outcome request' });
  writeSse(res, { type: 'thinking', message: '🎯 Director inspecting workspace and selecting optimal execution path...' });

  // ── Devin-style permission levels (ask / auto / turbo) ──
  // 'ask': pause BEFORE any workspace mutation until the user approves with a
  // single-use gatekeeper token. The resume re-POSTs the same run with
  // body.approvalToken (capability set + requestId must match — deterministic).
  const permissionLevel = PERMISSION_LEVELS.includes(String(body.permissionLevel || '').toLowerCase())
    ? String(body.permissionLevel).toLowerCase()
    : 'auto';
  if (permissionLevel === 'ask') {
    let capabilities = null;
    try { capabilities = capabilityDiscovery.discover(request); } catch (_) { /* fail-open: no caps → no gate */ }
    const probe = capabilityGatekeeper.evaluateWithLevel(
      capabilities,
      { requestId: taskId, source: 'copilot_director' },
      'ask'
    );
    const capabilityIds = (probe.capabilities || []).map(c => c.capability_id);
    if (probe.decision === 'BLOCK') {
      // Hard policy block — no approval token can unlock it (fail-closed).
      writeSse(res, {
        type: 'gate_blocked',
        message: 'Ask mode: execution blocked by CapabilityGatekeeper policy.',
        gate: probe,
      });
      writeSse(res, {
        type: 'done',
        message: '❌ Execution blocked by CapabilityGatekeeper policy.',
        steps: [],
      });
      return res.end();
    }
    if (capabilityIds.length > 0 && probe.requires_user_action && probe.approval_token) {
      const approvalToken = body.approvalToken || req.headers?.['x-approval-token'] || null;
      if (!approvalToken) {
        writeSse(res, {
          type: 'gate_approval_required',
          message: `Ask mode: user approval required before this run (${capabilityIds.length} ${capabilityIds.length === 1 ? 'capability' : 'capabilities'}).`,
          gate: probe,
        });
        writeSse(res, {
          type: 'done',
          message: '⏸️ Ask mode: run paused — press Approve in the chat to start.',
          steps: [],
        });
        return res.end();
      }
      const validation = capabilityGatekeeper.validateApproval({
        token: String(approvalToken),
        requestId: taskId,
        capabilityIds,
        context: { prompt: request },
      });
      if (!validation.valid) {
        writeSse(res, {
          type: 'gate_approval_invalid',
          message: `Approval validation failed: ${validation.reason}`,
          validation,
          gate: probe,
        });
        writeSse(res, {
          type: 'done',
          message: `❌ Ask mode approval invalid: ${validation.reason}`,
          steps: [],
        });
        return res.end();
      }
      writeSse(res, {
        type: 'gate_approved',
        message: 'Ask mode approval verified and consumed.',
        tokenId: validation.token_id,
        gate: probe,
      });
    }
  }

  try {
    const runtime = dependencies.runtime || await getCopilotDirectorRuntime({
      aiService: dependencies.aiService,
      db: dependencies.db,
      runtime: dependencies.runtime,
    });

    writeSse(res, { type: 'thinking', message: '📋 Creating adaptive specialist plan...' });

  // User-approved plan from Plan mode (possibly hand-edited) overrides the
  // director's own LLM plan — CopilotDirector normalizes/validates it.
  const presetPlan = body.plan && typeof body.plan === 'object' && Array.isArray(body.plan.tasks) && body.plan.tasks.length
    ? body.plan
    : null;

  // @file mentions: validated priority list appended to the request so the
  // director plans around the files the user actually pointed at.
  const contextFiles = (Array.isArray(body.contextFiles) ? body.contextFiles : [])
    .filter(p => typeof p === 'string' && p.trim() && !p.includes('..') && p.length < 400)
    .slice(0, 20);
  const directorRequest = contextFiles.length
    ? `${request}\n\nUser @-mentioned files (prioritize reading/editing these): ${contextFiles.join(', ')}`
    : request;

  const result = await runtime.director.run({
    userId: authorization.user.id,
    projectId: authorization.project.id,
    request: directorRequest,
    signal,
    maxRepairs: 3,
    ...(presetPlan ? { plan: presetPlan } : {}),
    onEvent: (event) => writeSse(res, { ...event, taskId }),
  });

    const taskCount = result?.summary?.match(/(\d+)\s+adaptive/)?.[1] || result?.taskCount || '?';
    writeSse(res, {
      type: result?.status === 'CANCELLED' ? 'director_canceled' : 'director_complete',
      taskId,
      runId,
      status: result?.status || 'SUCCEEDED',
      taskCount,
      message: `🎉 Copilot Director completed ${taskCount} autonomous specialist task(s) with final verification.`,
      result,
    });
    return res.end();
  } catch (error) {
    const canceled = Boolean(signal?.aborted) || error?.code === 'TASK_CANCELED';
    writeSse(res, {
      type: canceled ? 'director_canceled' : 'director_error',
      taskId,
      runId,
      status: canceled ? 'CANCELLED' : 'FAILED',
      error: canceled ? 'Director run canceled by user' : (error?.message || 'Copilot Director failed'),
    });
    return res.end();
  }
}

module.exports = { handleCopilotDirectorRequest };
