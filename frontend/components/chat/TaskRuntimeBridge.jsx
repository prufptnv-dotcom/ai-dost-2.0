import { useEffect } from 'react';
import { BLOCK_FALLBACK_KEY, createTaskId, normalizeServerEvent, parseSseLines, TASK_EVENT_TYPES } from './taskRuntime';
import { buildUploadedDocsContext, readSharedContext } from './sharedChatContext';
import { createTaskPlan } from './taskPlanner';
import { clearComposerAttachments, getComposerAttachments } from './UnifiedChatAttachments';

const STREAM_PATH = '/api/chat/stream';
const AGENT_RUN_PATH = '/api/agent/run';
const ACTIVE_KEY = '__aiDostActiveTask';
const RECOVERY_KEY = '__aiDostInterruptedTask';
const FALLBACK_BLOCK_TTL_MS = 2000;
const AGENT_MARKER_TTL_MS = 30 * 60 * 1000;

function settleAgentMarker(marker, reply) {
  if (!marker || marker.settled) return;
  marker.settled = true;
  marker.reply = typeof reply === 'string' ? reply : '';
  try { marker._settle(marker.reply); } catch (_) {}
}

function isChatStreamRequest(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return false;
  try {
    return new URL(url, window.location.origin).pathname === STREAM_PATH;
  } catch (_) {
    return String(url).includes(STREAM_PATH);
  }
}

function isChatFallbackRequest(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return false;
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    // axios baseURL can be /api or /api/v1 — both must match or the
    // cancel-marker block silently misses the REST fallback.
    return /\/api\/chat\/?$/.test(pathname) || /\/api\/v1\/chat\/?$/.test(pathname);
  } catch (_) {
    return /\/api\/chat\/?(?:\?|$)/.test(String(url)) || /\/api\/v1\/chat\/?(?:\?|$)/.test(String(url));
  }
}

function getRequestInit(args) {
  return args[1] || (args[0] && typeof args[0] === 'object' ? args[0] : null) || {};
}

function getChatRequestKey(args) {
  try {
    const init = getRequestInit(args);
    if (typeof init.body !== 'string') return null;
    const body = JSON.parse(init.body);
    return JSON.stringify([
      body.message || '',
      body.model || '',
      body.section || '',
      body.mode || '',
      body.persona || '',
      Array.isArray(body.history) ? body.history : [],
    ]);
  } catch (_) {
    return null;
  }
}

function writeRecoveryTask(task) {
  if (typeof window === 'undefined' || !task?.message) return;
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({
      taskId: task.taskId,
      message: String(task.message).slice(0, 12000),
      startedAt: task.startedAt,
      sessionId: task.sessionId || null,
    }));
  } catch (_) {}
}

function clearRecoveryTask(taskId = null) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) {
      window.dispatchEvent(new CustomEvent('ai_dost_clear_recovery'));
      return;
    }
    const saved = JSON.parse(raw);
    if (!taskId || saved?.taskId === taskId) {
      localStorage.removeItem(RECOVERY_KEY);
      window.dispatchEvent(new CustomEvent('ai_dost_clear_recovery'));
    }
  } catch (_) {
    localStorage.removeItem(RECOVERY_KEY);
    window.dispatchEvent(new CustomEvent('ai_dost_clear_recovery'));
  }
}

function augmentStreamRequest(args) {
  const [input, init] = args;
  if (!init || typeof init.body !== 'string') return args;
  try {
    const body = JSON.parse(init.body);
    const sharedDocs = buildUploadedDocsContext(readSharedContext());
    const composerDocs = getComposerAttachments();
    const existingDocs = Array.isArray(body.uploadedDocs) ? body.uploadedDocs : [];
    const knownNames = new Set(existingDocs.map((doc) => String(doc?.name || '')));
    const runtimeDocs = [
      ...existingDocs,
      ...composerDocs.filter((doc) => !knownNames.has(String(doc?.name || ''))),
      ...sharedDocs.filter((doc) => !knownNames.has(String(doc?.name || ''))),
    ];
    if (!runtimeDocs.length) return args;
    return [input, { ...init, body: JSON.stringify({ ...body, uploadedDocs: runtimeDocs.slice(0, 15) }) }];
  } catch (_) {
    return args;
  }
}

let _agentTaskSeq = 0;

function agentTaskEvent(taskId, phase, status, type = TASK_EVENT_TYPES.PHASE) {
  _agentTaskSeq = (_agentTaskSeq + 1) % 100000;
  return {
    id: `${taskId}:${type}:${Date.now()}:${_agentTaskSeq}:${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    ts: Date.now(),
    type,
    phase,
    label: status,
    status,
  };
}

function toAgentRunBody(task, plan, requestBody) {
  const currentSessionId = task.sessionId || (typeof window !== 'undefined' ? localStorage.getItem('ai_dost_session_id') : null) || 'default';
  return {
    userPrompt: task.message,
    projectId: requestBody?.projectId || requestBody?.project_id || currentSessionId,
    projectPath: requestBody?.projectPath,
    projectFiles: requestBody?.projectFiles,
    customKeys: requestBody?.customKeys,
    // NOTE: deliberately NOT `chatTaskPlan` — that key makes chatAgentRouteBridge
    // intercept /api/agent/run into the canonical gateway, which has NO
    // capability-gate/approval flow. The main handler (deterministic plan +
    // CapabilityGatekeeper approval + scaffold cascade) is what we want.
    clientTaskPlan: plan,
    taskId: task.taskId,
    sessionId: currentSessionId,
  };
}

export default function TaskRuntimeBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalFetch = window.fetch.bind(window);
    const tasks = new Map();

    const cancelTask = (taskId, reason = 'Task canceled by user') => {
      if (!taskId) return false;
      const task = tasks.get(taskId);
      if (!task) return false;

      task.canceled = true;
      task.controller.abort();
      tasks.delete(taskId);
      clearRecoveryTask(taskId);
      settleAgentMarker(task.agentMarker, `⛔ ${reason}`);

      if (task.requestKey) {
        const marker = { requestKey: task.requestKey, expiresAt: Date.now() + FALLBACK_BLOCK_TTL_MS };
        window[BLOCK_FALLBACK_KEY] = marker;
        window.setTimeout(() => {
          if (window[BLOCK_FALLBACK_KEY] === marker) delete window[BLOCK_FALLBACK_KEY];
        }, FALLBACK_BLOCK_TTL_MS);
      }

      if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: normalizeServerEvent(taskId, { canceled: true, error: reason }),
      }));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'AI-Dost task canceled.' },
      }));
      return true;
    };

    window.aiDostCancelTask = cancelTask;

    // Devin-style inline approval: resume a gate-paused agent run with the token.
    const approveTask = (taskId) => {
      const task = tasks.get(taskId);
      if (!task || !task.approvalPending || typeof task.startAgentRun !== 'function') return false;
      const token = task.approvalToken;
      task.approvalPending = false;
      task.paused = false;
      try { task.controller.abort(); } catch (_) {}
      task.controller = new AbortController();
      task.agentBody = { ...task.agentBody, approvalToken: token || null };
      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: normalizeServerEvent(taskId, { type: 'gate_approved', message: 'Approval mil gayi — task resume ho raha hai' }),
      }));
      void task.startAgentRun().catch(() => {});
      return true;
    };

    const rejectTask = (taskId) => cancelTask(taskId, 'Approval rejected — task rok diya');

    window.aiDostApproveTask = approveTask;
    window.aiDostRejectTask = rejectTask;

    const patchedFetch = async (...args) => {
      const input = args[0];
      if (isChatFallbackRequest(input)) {
        const marker = window[BLOCK_FALLBACK_KEY];
        const requestKey = getChatRequestKey(args);
        if (marker && marker.kind !== 'agent' && marker.expiresAt > Date.now() && marker.requestKey === requestKey) {
          delete window[BLOCK_FALLBACK_KEY];
          throw new DOMException('Chat task canceled', 'AbortError');
        }
        if (marker && marker.expiresAt <= Date.now()) delete window[BLOCK_FALLBACK_KEY];
        const response = await originalFetch(...args);
        if (response?.ok) clearRecoveryTask();
        return response;
      }
      if (!isChatStreamRequest(input)) return originalFetch(...args);

      const taskId = createTaskId('chat');
      const controller = new AbortController();
      const requestInit = getRequestInit(args);
      // Propagate the CALLER's abort signal (e.g. Stop button / Esc in chat) —
      // the bridge replaces init.signal with its own controller below, so a
      // caller abort must forward or the real fetch would never cancel.
      const callerSignal = requestInit && requestInit.signal;
      if (callerSignal) {
        if (callerSignal.aborted) controller.abort();
        else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      let requestBody = null;
      try {
        requestBody = typeof requestInit.body === 'string' ? JSON.parse(requestInit.body) : null;
      } catch (_) {}

      const composerDocs = getComposerAttachments();
      const task = {
        taskId,
        controller,
        requestKey: getChatRequestKey(args),
        canceled: false,
        startedAt: Date.now(),
        message: requestBody?.message || '',
        sessionId: requestBody?.sessionId || requestBody?.session_id || (typeof window !== 'undefined' ? localStorage.getItem('ai_dost_session_id') : null) || 'default',
        attachmentCount: Math.min(15, composerDocs.length),
      };
      tasks.set(taskId, task);
      window[ACTIVE_KEY] = taskId;

      // Cleanup must NOT run in a finally around the fetch — the stream pump is
      // still consuming the response after we return. finishTask() is idempotent
      // and runs on every terminal path (body missing, pump done/fail, error).
      let taskFinished = false;
      const finishTask = () => {
        if (taskFinished) return;
        taskFinished = true;
        if (tasks.get(taskId) === task) tasks.delete(taskId);
        if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
        settleAgentMarker(task.agentMarker, '⚠️ Task unexpectedly ended.');
      };

      const requestArgs = augmentStreamRequest(args);
      const effectiveBody = (() => {
        try {
          return typeof requestArgs[1]?.body === 'string' ? JSON.parse(requestArgs[1].body) : requestBody || {};
        } catch (_) {
          return requestBody || {};
        }
      })();

      if (composerDocs.length > 0) clearComposerAttachments();

      const sharedContext = readSharedContext();
      const plan = createTaskPlan(task.message, {
        hasFiles: task.attachmentCount > 0 || Array.isArray(effectiveBody.uploadedDocs),
        fileCount: task.attachmentCount || (Array.isArray(effectiveBody.uploadedDocs) ? effectiveBody.uploadedDocs.length : 0),
        hasSharedContext: sharedContext.length > 0,
      });
      task.plan = plan;
      window.dispatchEvent(new CustomEvent('ai_dost_intent_plan', {
        detail: { taskId, plan },
      }));

      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: agentTaskEvent(taskId, plan.intent.type === 'task' ? 'planning' : 'understanding', plan.intent.type === 'task' ? 'Planning' : 'Understanding'),
      }));

      try {
        // Autonomous tool-bearing chat commands use the existing agent runtime.
        // Regular conversation keeps the established /api/chat/stream pipeline.
        if (plan.intent.action === 'open-preview') {
          const [, init] = args;
          return originalFetch(augmentStreamRequest(args)[0], { ...(augmentStreamRequest(args)[1] || init || {}), signal: controller.signal });
        }
        if (plan.intent.type === 'task' && plan.intent.requiresTool) {
          const [, init] = args;
          task.agentBody = toAgentRunBody(task, plan, effectiveBody);
          task.agentHeaders = { 'Content-Type': 'application/json', 'X-AI-Dost-Task-Id': taskId, ...(init?.headers || {}) };
          task.approvalPending = false;
          task.paused = false;
          task.approvalToken = null;

          // Agent SSE carries phase/tool events, not chat chunks — useChatStream
          // would see an empty reply and fire the REST cascade ("provider busy"
          // duplicate). Park a marker it awaits until the run's terminal event.
          const agentMarker = {
            kind: 'agent',
            taskId,
            requestKey: getChatRequestKey(args),
            expiresAt: Date.now() + AGENT_MARKER_TTL_MS,
            settled: false,
            reply: '',
            _settle: null,
          };
          agentMarker.done = new Promise((resolve) => { agentMarker._settle = resolve; });
          task.agentMarker = agentMarker;
          window[BLOCK_FALLBACK_KEY] = agentMarker;

          // One SSE run against /api/agent/run — used for the initial run AND for
          // the approval-resume run (fresh AbortController, body + approvalToken).
          task.startAgentRun = async () => {
            const agentInit = {
              ...(init || {}),
              method: 'POST',
              headers: task.agentHeaders,
              body: JSON.stringify(task.agentBody),
              signal: task.controller.signal,
            };
            const response = await originalFetch(AGENT_RUN_PATH, agentInit);
            if (!response?.body) {
              finishTask();
              return response;
            }

            const cloned = response.clone();
            const reader = cloned.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let terminalEmitted = false;
            const emit = (payload) => {
              const event = normalizeServerEvent(taskId, payload);
              if (!event) return;
              // Plan snapshots live on the marker so useChatStream (which
              // attaches its listener only after the body drains) can render
              // the checklist in the chat bubble without missing early events.
              if (Array.isArray(event.tasks) && event.tasks.length && task.agentMarker) {
                task.agentMarker.agentPlan = event.tasks;
              }
              if (event.type === TASK_EVENT_TYPES.APPROVAL) {
                task.approvalPending = true;
                task.paused = false;
                task.approvalToken = event.approval?.token || null;
              }
              if (event.type === TASK_EVENT_TYPES.COMPLETE) {
                if (terminalEmitted) return; // e.g. gate_blocked/invalid error already terminal
                if (task.approvalPending && /\b(?:paused|awaiting)\b/i.test(String(payload.message || ''))) {
                  // Gate pause sends a synthetic "done" — hold the task open awaiting approval
                  task.paused = true;
                  return;
                }
                task.approvalPending = false;
                // Full done text (project summary) becomes the chat bubble reply.
                settleAgentMarker(task.agentMarker, String(payload.message || payload.summary || 'Task complete ho gaya.'));
              }
              if (event.type === TASK_EVENT_TYPES.CANCELED) {
                settleAgentMarker(task.agentMarker, `⛔ ${event.label || 'Task canceled'}`);
              }
              if (event.type === TASK_EVENT_TYPES.ERROR) {
                settleAgentMarker(task.agentMarker, `⚠️ ${event.label || 'Task failed'}`);
              }
              if (event.type === TASK_EVENT_TYPES.COMPLETE || event.type === TASK_EVENT_TYPES.CANCELED || event.type === TASK_EVENT_TYPES.ERROR) {
                terminalEmitted = true;
              }
              window.dispatchEvent(new CustomEvent('ai_dost_task_event', { detail: event }));
            };
            const pump = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  buffer = parseSseLines(buffer, emit);
                }
                buffer += decoder.decode();
                if (buffer.trim()) parseSseLines(`${buffer}\n`, emit);
                clearRecoveryTask(taskId);
              } catch (error) {
                if (!task.controller.signal.aborted) {
                  writeRecoveryTask(task);
                  emit({ error: error?.message || 'Agent task stream interrupted' });
                }
              } finally {
                if (task.controller.signal.aborted) {
                  settleAgentMarker(task.agentMarker, '⏹️ Task stop kar diya gaya.');
                }
                const awaitingApproval = task.approvalPending && task.paused;
                if (!terminalEmitted && !awaitingApproval && !task.controller.signal.aborted) {
                  emit({ error: 'Task stream ended unexpectedly' });
                }
                // Paused-for-approval keeps the task alive so Approve/Reject can resume it.
                if (!awaitingApproval) finishTask();
              }
            };
            void pump();
            return response;
          };

          window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
            detail: agentTaskEvent(taskId, 'executing', 'Executing task'),
          }));

          return await task.startAgentRun();
        }

        const [, init] = args;
        const nextInit = { ...(augmentStreamRequest(args)[1] || init || {}), signal: controller.signal };
        const response = await originalFetch(augmentStreamRequest(args)[0], nextInit);
        if (!response?.body) {
          finishTask();
          return response;
        }

        try {
          const cloned = response.clone();
          const reader = cloned.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          let terminalEmitted = false;
          const emit = (payload) => {
            const event = normalizeServerEvent(taskId, payload);
            if (!event) return;
            if (event.type === TASK_EVENT_TYPES.COMPLETE || event.type === TASK_EVENT_TYPES.CANCELED || event.type === TASK_EVENT_TYPES.ERROR) {
              clearRecoveryTask(taskId);
              terminalEmitted = true;
            }
            if (event.type === TASK_EVENT_TYPES.ERROR && !task.canceled) {
              writeRecoveryTask(task);
            }
            window.dispatchEvent(new CustomEvent('ai_dost_task_event', { detail: event }));
          };

          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                buffer = parseSseLines(buffer, emit);
              }
              buffer += decoder.decode();
              if (buffer.trim()) parseSseLines(`${buffer}\n`, emit);
              clearRecoveryTask(taskId);
            } catch (error) {
              if (!controller.signal.aborted) {
                writeRecoveryTask(task);
                window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
                  detail: normalizeServerEvent(taskId, { error: error?.message || 'Task stream interrupted' }),
                }));
              }
            } finally {
              if (!terminalEmitted) {
                window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
                  detail: normalizeServerEvent(taskId, { error: 'Task stream ended unexpectedly' }),
                }));
              }
              finishTask();
            }
          };
          void pump();
        } catch (error) {
          if (!controller.signal.aborted) {
            writeRecoveryTask(task);
            window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
              detail: normalizeServerEvent(taskId, { error: error?.message || 'Unable to inspect task stream' }),
            }));
          }
          // pump never started (throw happened during reader setup) — clean up here
          finishTask();
        }
        return response;
      } catch (error) {
        if (!controller.signal.aborted) writeRecoveryTask(task);
        finishTask();
        throw error;
      }
    };

    window.fetch = patchedFetch;
    return () => {
      window.fetch = originalFetch;
      tasks.forEach((task) => {
        settleAgentMarker(task.agentMarker, '⏹️ Task stop kar diya gaya.');
        task.controller.abort();
      });
      tasks.clear();
      delete window[BLOCK_FALLBACK_KEY];
      if (window.aiDostCancelTask === cancelTask) delete window.aiDostCancelTask;
      if (window.aiDostApproveTask === approveTask) delete window.aiDostApproveTask;
      if (window.aiDostRejectTask === rejectTask) delete window.aiDostRejectTask;
      if (window[ACTIVE_KEY]) delete window[ACTIVE_KEY];
    };
  }, []);

  return null;
}
