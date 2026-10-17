'use strict';

const crypto = require('node:crypto');
const projectAuthorization = require('../../services/projectAuthorization');
const { getCopilotDirectorRuntime } = require('./createChatTaskGateway');
const { getActiveTask } = require('../../taskCancellation');
const { capabilityDiscovery } = require('../../agent/registry/CapabilityDiscovery');
const { capabilityGatekeeper } = require('../../agent/policy/CapabilityGatekeeper');
const logger = require('../../logger');
const { buildAppSpecification, formatAppSpecificationForPrompt } = require('../../services/appSpecificationService');
const { classifyRequest, deriveAlgorithmTaskContract, buildAlgorithmGuidanceBlock } = require('./codeGenerationStrategy');
const { inspectWorkspace, buildPromptDirective } = require('../../services/workspaceFrameworkIntelligence');

const PERMISSION_LEVELS = new Set(['ask', 'auto', 'turbo']);

function writeSse(res, event) {
  // Hardened: a client that aborted mid-run leaves `destroyed` true but
  // `writableEnded` may still be false — writing then can emit an unhandled
  // stream error. Never throw out of the completion path (P12.1).
  if (!res || res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${String(event.type || 'director_event')}\ndata: ${JSON.stringify(event)}\n\n`);
  } catch (_) { /* stream gone — drop the frame */ }
}

function resolveProjectId(body) {
  const value = body?.projectId || body?.project_id;
  return typeof value === 'string' && value.trim() ? value.trim() : 'default';
}

function executeAskPermissionGate({ req, res, body, request, taskId, dependencies, permissionLevel, runApprovalToken }) {
  if (permissionLevel !== 'ask') {
    return { blocked: false, runApprovalToken };
  }

  let capabilities;
  try {
    capabilities = (dependencies.capabilityDiscovery || capabilityDiscovery).discover(request);
  } catch (_) {
    writeSse(res, {
      type: 'gate_blocked',
      message: 'Ask mode cannot verify the required capabilities right now. Execution is blocked for safety.',
    });
    writeSse(res, {
      type: 'done',
      message: '❌ Execution blocked because capability discovery failed.',
      steps: [],
    });
    res.end();
    return { blocked: true, runApprovalToken: null };
  }

  const probe = capabilityGatekeeper.evaluateWithLevel(
    capabilities,
    { requestId: taskId, source: 'copilot_director' },
    'ask'
  );
  const capabilityIds = (probe.capabilities || []).map((c) => c.capability_id);
  if (probe.decision === 'BLOCK') {
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
    res.end();
    return { blocked: true, runApprovalToken: null };
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
      res.end();
      return { blocked: true, runApprovalToken: null };
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
      res.end();
      return { blocked: true, runApprovalToken: null };
    }

    writeSse(res, {
      type: 'gate_approved',
      message: 'Ask mode approval verified and consumed.',
      tokenId: validation.token_id,
      gate: probe,
    });
    const freshToken = capabilityGatekeeper._createApprovalToken({
      requestId: taskId,
      capabilityIds,
      planId: null,
    }).token;
    return { blocked: false, runApprovalToken: freshToken };
  }

  return { blocked: false, runApprovalToken };
}

function buildCompletionMessage({ result, taskCount, filesWritten, changedPaths, writeAttempts, tasksSkipped, canceled }) {
  let message;
  if (canceled) {
    message = `⏹️ Director run canceled — ${taskCount} task(s) processed, ${filesWritten} file(s) had changed before the stop.`;
  } else if (result?.status === 'FAILED') {
    const failureSummary = String(result.summary || result.message || 'The requested plan did not complete successfully.').trim();
    message = `⚠️ Copilot Director did not complete the full plan — ${failureSummary}`;
    if (filesWritten > 0) {
      message += ` ${filesWritten} file(s) changed before completion was marked failed.`;
    }
  } else if (filesWritten > 0) {
    const shown = changedPaths.slice(0, 6).join(', ');
    const more = filesWritten > 6 ? ` +${filesWritten - 6} more` : '';
    message = `🎉 Copilot Director completed ${taskCount} task(s) with verification — ${filesWritten} file(s) changed: ${shown}${more}`;
  } else if (writeAttempts > 0) {
    message = `⚠️ Copilot Director finished ${taskCount} task(s) but saved NO files — ${writeAttempts} write attempt(s) were rejected (existing files require surgical apply_diff / SEARCH-REPLACE edits, not full-file replacement). No changes were persisted; re-run asking for a targeted edit.`;
  } else {
    message = `🎯 Copilot Director completed ${taskCount} task(s) — analysis only, no file changes were requested.`;
  }

  if (tasksSkipped > 0) {
    message += ` (${tasksSkipped} plan task(s) were skipped — worker/dependency limits)`;
  }
  return message;
}

function initSseResponse(res, taskId) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-AI-Dost-Task-Id', taskId);
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const pingInterval = setInterval(() => {
    if (res && !res.writableEnded && !res.destroyed) {
      try {
        res.write(': ping\n\n');
      } catch (_) {}
    }
  }, 10000);
  const stopPing = () => clearInterval(pingInterval);
  if (typeof res.on === 'function') {
    res.on('close', stopPing);
    res.on('finish', stopPing);
  }
}

function resolveWorkspaceIntelligence(dependencies, runtime, authorization, res) {
  try {
    const meta = dependencies.workspaceManager?.getWorkspaceMetadata?.(authorization.project.id, authorization.user.id)
      || runtime?.director?.workspaceManager?.getWorkspaceMetadata?.(authorization.project.id, authorization.user.id);
    if (!meta?.diskPath) return '';
    const workspaceIntelligence = inspectWorkspace(meta.diskPath);
    writeSse(res, {
      type: 'thinking',
      message: `🔍 Discovered workspace framework: ${workspaceIntelligence.effectiveFramework || workspaceIntelligence.frontend?.framework || 'standard'} (endpoints: ${workspaceIntelligence.existingRoutes?.length || 0}, DB: ${workspaceIntelligence.databaseAndOrm?.orm || 'None'}).`,
    });
    return buildPromptDirective(workspaceIntelligence);
  } catch (err) {
    logger.warn('[copilotDirectorHandler] Workspace discovery failed:', err?.message || err);
    writeSse(res, {
      type: 'thinking',
      message: `⚠️ Workspace discovery notice: ${err?.message || 'Failed to inspect workspace'}`,
    });
    return '';
  }
}

function buildEnrichedDirectorRequest({ request, body, dependencies, authorization, runtime, res }) {
  const contextFiles = (Array.isArray(body.contextFiles) ? body.contextFiles : [])
    .filter((p) => typeof p === 'string' && p.trim() && !p.includes('..') && p.length < 400)
    .slice(0, 20);
  const baseDirectorRequest = contextFiles.length
    ? `${request}\n\nUser @-mentioned files (prioritize reading/editing these): ${contextFiles.join(', ')}`
    : request;

  const appSpecification = buildAppSpecification(request);
  const specificationContext = appSpecification ? formatAppSpecificationForPrompt(appSpecification) : '';

  const classification = classifyRequest(request);
  let algorithmContext = '';
  if (classification.category === 'ALGORITHMIC_PROBLEM') {
    const algorithmContract = deriveAlgorithmTaskContract(request, classification);
    algorithmContext = buildAlgorithmGuidanceBlock(algorithmContract);
    writeSse(res, {
      type: 'thinking',
      message: `📌 Formulated algorithm contract for ${algorithmContract.algorithmFamily} (${algorithmContract.selectedAlgorithm?.name || 'Selected'}) with invariant and falsification tests.`,
    });
  }

  const workspaceContext = resolveWorkspaceIntelligence(dependencies, runtime, authorization, res);

  const directorRequest = [baseDirectorRequest, specificationContext, algorithmContext, workspaceContext].filter(Boolean).join('\n\n');
  if (appSpecification) {
    writeSse(res, {
      type: 'thinking',
      message: `🧩 Mapped ${appSpecification.requirements.length} requirement(s) to ${appSpecification.acceptanceCriteria.length} acceptance checks before planning.`,
    });
  }

  return { directorRequest, appSpecification };
}

async function handleCopilotDirectorRequest(req, res, next, dependencies = {}) {
  const body = req.body || {};
  if (!body.copilotDirector) return next();

  const projectId = resolveProjectId(body);
  const taskId = String(req.get('x-ai-dost-task-id') || body.taskId || `copilot-${Date.now().toString(36)}`);
  const runId = `director-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const request = String(body.userPrompt || body.prompt || '').trim();
  const preferredModel = typeof body.preferredModel === 'string' && body.preferredModel.trim()
    ? body.preferredModel.trim()
    : 'auto';
  if (!request) return res.status(400).json({ success: false, error: 'Director request is required', taskId });

  const authorization = (dependencies.projectAuthorization || projectAuthorization).authorize(projectId, req, {
    autoCreateIfMissing: true,
  });
  if (!authorization.authorized) {
    return res.status(authorization.status || 403).json({ success: false, error: authorization.error || 'Project access denied', taskId });
  }

  initSseResponse(res, taskId);

  const activeTask = getActiveTask(taskId);
  const signal = activeTask?.controller?.signal;

  writeSse(res, { type: 'run_started', runId, taskId });
  writeSse(res, { type: 'director_start', phase: 'queued', taskId, runId, status: 'Copilot Director accepted the outcome request' });
  writeSse(res, { type: 'thinking', message: '🎯 Director inspecting workspace and selecting optimal execution path...' });

  const rawLevel = String(body.permissionLevel || '').toLowerCase();
  const permissionLevel = PERMISSION_LEVELS.has(rawLevel) ? rawLevel : 'auto';
  const initialApprovalToken = body.approvalToken || req.headers?.['x-approval-token'] || null;

  const gateResult = executeAskPermissionGate({
    req,
    res,
    body,
    request,
    taskId,
    dependencies,
    permissionLevel,
    runApprovalToken: initialApprovalToken,
  });
  if (gateResult.blocked) return;
  const runApprovalToken = gateResult.runApprovalToken;

  const writtenPaths = new Set();
  let writeAttempts = 0;
  let tasksSkipped = 0;
  let gateRequired = null;
  const countingOnEvent = (event) => {
    if (event && typeof event.type === 'string') {
      if (event.type === 'file_written' || event.type === 'file_changed') {
        const p = event.path || event.file;
        if (typeof p === 'string' && p) writtenPaths.add(p);
      } else if (
        event.type === 'step' &&
        event.status === 'running' &&
        (event.tool === 'write_file' || event.tool === 'apply_diff')
      ) {
        writeAttempts += 1;
      } else if (event.type === 'director_task' && event.status === 'SKIPPED') {
        tasksSkipped += 1;
      } else if (event.type === 'gate_approval_required' && event.gate) {
        gateRequired = event.gate;
      }
    }
    writeSse(res, { ...event, taskId });
  };

  try {
    const runtime = dependencies.runtime || await getCopilotDirectorRuntime({
      aiService: dependencies.aiService,
      db: dependencies.db,
      runtime: dependencies.runtime,
    });

    writeSse(res, { type: 'thinking', message: '📋 Creating adaptive specialist plan...' });

    const presetPlan = body.plan && typeof body.plan === 'object' && Array.isArray(body.plan.tasks) && body.plan.tasks.length
      ? body.plan
      : null;

    const { directorRequest, appSpecification } = buildEnrichedDirectorRequest({
      request,
      body,
      dependencies,
      authorization,
      runtime,
      res,
    });

    const result = await runtime.director.run({
      userId: authorization.user.id,
      projectId: authorization.project.id,
      request: directorRequest,
      signal,
      maxRepairs: 3,
      preferredModel,
      ...(presetPlan ? { plan: presetPlan } : {}),
      onEvent: countingOnEvent,
      permissionLevel,
      approvalToken: runApprovalToken || undefined,
    });

    const taskCountMatch = /\b(\d+)\s+adaptive/.exec(result?.summary || '');
    const taskCount = taskCountMatch?.[1] || result?.taskCount || '?';
    const filesWritten = writtenPaths.size;
    const changedPaths = [...writtenPaths].slice(0, 50);
    const canceled = result?.status === 'CANCELLED';

    const message = buildCompletionMessage({
      result,
      taskCount,
      filesWritten,
      changedPaths,
      writeAttempts,
      tasksSkipped,
      canceled,
    });

    writeSse(res, {
      type: canceled ? 'director_canceled' : 'director_complete',
      taskId,
      runId,
      status: result?.status || 'SUCCEEDED',
      taskCount,
      filesWritten,
      writeAttempts,
      changedPaths,
      tasksSkipped,
      message,
      result,
      specification: appSpecification ? {
        applicationType: appSpecification.applicationType,
        unresolvedAssumptions: appSpecification.unresolvedAssumptions,
        evidenceContract: appSpecification.evidenceContract,
        requirementsCount: appSpecification.requirements.length
      } : null,
      verificationStatus: result?.verificationOutcome || 'UNVERIFIED_STATIC_ANALYSIS'
    });
    return res.end();
  } catch (error) {
    const canceled = Boolean(signal?.aborted) || error?.code === 'TASK_CANCELED';
    const filesWritten = writtenPaths.size;
    const changedPaths = [...writtenPaths].slice(0, 50);

    // P12.3: approval gates are a PAUSE, not a failure. The step-level gate
    // already emitted gate_approval_required (with the minted token) — end the
    // stream as `done` so the amber Approve banner is the last thing the UI
    // sees; Approve re-POSTs the same prompt with body.approvalToken.
    if (!canceled && (error?.code === 'APPROVAL_REQUIRED' || gateRequired)) {
      if (!gateRequired) {
        writeSse(res, {
          type: 'gate_approval_required',
          message: error?.message || 'Approval required to continue this run',
          gate: {
            decision: error?.decision,
            approval_token: error?.approvalToken,
            capabilities: error?.capabilities,
            capabilityId: error?.capabilityId,
          },
        });
      }
      const capLabel = error?.capabilityId || gateRequired?.capabilityId || 'capability';
      writeSse(res, {
        type: 'done',
        message: `⏸️ Run paused — approval required (${capLabel}) — ${filesWritten} file(s) already changed. Press Approve to resume with the same plan.`,
        steps: [],
        filesWritten,
        writeAttempts,
        changedPaths,
        tasksSkipped,
        approvalGate: gateRequired || { decision: error?.decision, approval_token: error?.approvalToken },
      });
      return res.end();
    }

    // P12.3: an error frame must be human-readable (frontend reads `message`)
    // and must carry the P12.1 truth fields + a server-side log line.
    const base = canceled
      ? 'Director run canceled by user'
      : (error?.message || 'Copilot Director failed');
    const message = canceled
      ? base
      : `${base} — ${filesWritten} file(s) had changed before the failure.`;
    logger.error(
      `[CopilotDirector] run ${runId} failed: ${error?.stack || error?.message || 'unknown error'} ` +
      `(filesWritten=${filesWritten}, writeAttempts=${writeAttempts}, tasksSkipped=${tasksSkipped})`
    );
    writeSse(res, {
      type: canceled ? 'director_canceled' : 'director_error',
      taskId,
      runId,
      status: canceled ? 'CANCELLED' : 'FAILED',
      error: message,
      message,
      filesWritten,
      writeAttempts,
      changedPaths,
      tasksSkipped,
    });
    return res.end();
  }
}

module.exports = { handleCopilotDirectorRequest };
