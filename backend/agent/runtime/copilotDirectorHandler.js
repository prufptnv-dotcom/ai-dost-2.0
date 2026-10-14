'use strict';

const projectAuthorization = require('../../services/projectAuthorization');
const { getCopilotDirectorRuntime } = require('./createChatTaskGateway');
const { getActiveTask } = require('../../taskCancellation');
const { capabilityDiscovery } = require('../../agent/registry/CapabilityDiscovery');
const { capabilityGatekeeper } = require('../../agent/policy/CapabilityGatekeeper');
const logger = require('../../logger');
const { buildAppSpecification, formatAppSpecificationForPrompt } = require('../../services/appSpecificationService');

const PERMISSION_LEVELS = ['ask', 'auto', 'turbo'];

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

async function handleCopilotDirectorRequest(req, res, next, dependencies = {}) {
  const body = req.body || {};
  if (!body.copilotDirector) return next();

  const projectId = resolveProjectId(body);
  const taskId = String(req.get('x-ai-dost-task-id') || body.taskId || `copilot-${Date.now().toString(36)}`);
  const runId = `director-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-AI-Dost-Task-Id', taskId);
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Keep-alive heartbeat: emit comment frame every 10 seconds to prevent
  // proxy timeouts and connection drops during long LLM reasoning/planning.
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
  // P12.3: the approved token must be forwarded into the run context so the
  // per-step CapabilityGatekeeper can validate it (previously it was read for
  // the ask-mode probe and then dropped — even an approved run died at its
  // first gated tool). Auto/turbo pass body.approvalToken straight through.
  let runApprovalToken = body.approvalToken || req.headers?.['x-approval-token'] || null;
  if (permissionLevel === 'ask') {
    let capabilities;
    try {
      capabilities = (dependencies.capabilityDiscovery || capabilityDiscovery).discover(request);
    } catch (_) {
      // Approval mode must fail closed: a discovery outage must not silently
      // turn a protected request into an ungated execution.
      writeSse(res, {
        type: 'gate_blocked',
        message: 'Ask mode cannot verify the required capabilities right now. Execution is blocked for safety.',
      });
      writeSse(res, {
        type: 'done',
        message: '❌ Execution blocked because capability discovery failed.',
        steps: [],
      });
      return res.end();
    }
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
      // P12.3: the request-level token was consumed above (single-use replay
      // protection) — mint a fresh run-scoped token so per-step gates can
      // validate without dying at the first gated tool of the approved run.
      runApprovalToken = capabilityGatekeeper._createApprovalToken({
        requestId: taskId,
        capabilityIds,
        planId: null,
      }).token;
    }
  }

  // ── P12.1 honest-completion accounting ──────────────────────────────────
  // deterministicCodeGuard refuses full-file rewrites of EXISTING files; before
  // P12 the completion line still said "🎉 completed ... with final
  // verification" even when every write was refused and ZERO files changed.
  // Observe the event stream: count write TOOL steps vs actual file_written
  // events, then report exactly what happened. Declared BEFORE the try so the
  // error/paused paths report the same truth (P12.3).
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
  const baseDirectorRequest = contextFiles.length
    ? `${request}\n\nUser @-mentioned files (prioritize reading/editing these): ${contextFiles.join(', ')}`
    : request;

  // Phase 1: build a validated requirement/acceptance contract before the
  // director creates tasks. Keep the raw request above for permission checks;
  // only the execution/planning context receives the additional spec.
  const appSpecification = buildAppSpecification(request);
  const specificationContext = appSpecification ? formatAppSpecificationForPrompt(appSpecification) : '';
  const directorRequest = [baseDirectorRequest, specificationContext].filter(Boolean).join('\n\n');
  if (appSpecification) {
    writeSse(res, {
      type: 'thinking',
      message: '🧩 Mapped ' + appSpecification.requirements.length + ' requirement(s) to ' + appSpecification.acceptanceCriteria.length + ' acceptance checks before planning.',
    });
  }

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

    const taskCount = result?.summary?.match(/(\d+)\s+adaptive/)?.[1] || result?.taskCount || '?';
    const filesWritten = writtenPaths.size;
    const changedPaths = [...writtenPaths].slice(0, 50);
    const canceled = result?.status === 'CANCELLED';

    // Say the truth: files changed / writes rejected / analysis-only / canceled.
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
    // P12.3: say when tasks could not be delegated (worker cap / blocked deps)
    // instead of silently implying every plan task ran.
    if (tasksSkipped > 0) {
      message += ` (${tasksSkipped} plan task(s) were skipped — worker/dependency limits)`;
    }

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
