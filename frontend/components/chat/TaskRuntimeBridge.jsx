import { useEffect } from 'react';
import { createTaskId, normalizeServerEvent, parseSseLines, TASK_EVENT_TYPES } from './taskRuntime';
import { buildUploadedDocsContext, readSharedContext } from './sharedChatContext';
import { createTaskPlan } from './taskPlanner';

const STREAM_PATH = '/api/chat/stream';
const ACTIVE_KEY = '__aiDostActiveTask';
const RECOVERY_KEY = '__aiDostInterruptedTask';
const BLOCK_FALLBACK_KEY = '__aiDostBlockNextChatFallback';
const FALLBACK_BLOCK_TTL_MS = 2000;

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
    return /\/api\/chat\/?$/.test(pathname);
  } catch (_) {
    return /\/api\/chat\/?(?:\?|$)/.test(String(url));
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
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!taskId || saved?.taskId === taskId) localStorage.removeItem(RECOVERY_KEY);
  } catch (_) {
    localStorage.removeItem(RECOVERY_KEY);
  }
}

function augmentStreamRequest(args) {
  const [input, init] = args;
  if (!init || typeof init.body !== 'string') return args;
  try {
    const body = JSON.parse(init.body);
    const sharedDocs = buildUploadedDocsContext(readSharedContext());
    if (!sharedDocs.length) return args;

    const existingDocs = Array.isArray(body.uploadedDocs) ? body.uploadedDocs : [];
    const existingNames = new Set(existingDocs.map((doc) => String(doc?.name || '')));
    const mergedDocs = [...existingDocs, ...sharedDocs.filter((doc) => !existingNames.has(doc.name))];
    return [input, { ...init, body: JSON.stringify({ ...body, uploadedDocs: mergedDocs.slice(0, 15) }) }];
  } catch (_) {
    return args;
  }
}

export default function TaskRuntimeBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalFetch = window.fetch.bind(window);
    const tasks = new Map();

    const cancelTask = (taskId) => {
      if (!taskId) return false;
      const task = tasks.get(taskId);
      if (!task) return false;

      task.canceled = true;
      task.controller.abort();
      tasks.delete(taskId);
      clearRecoveryTask(taskId);

      if (task.requestKey) {
        const marker = { requestKey: task.requestKey, expiresAt: Date.now() + FALLBACK_BLOCK_TTL_MS };
        window[BLOCK_FALLBACK_KEY] = marker;
        window.setTimeout(() => {
          if (window[BLOCK_FALLBACK_KEY] === marker) delete window[BLOCK_FALLBACK_KEY];
        }, FALLBACK_BLOCK_TTL_MS);
      }

      if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: normalizeServerEvent(taskId, { canceled: true, error: 'Task canceled by user' }),
      }));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'AI-Dost task canceled.' },
      }));
      return true;
    };

    window.aiDostCancelTask = cancelTask;

    const patchedFetch = async (...args) => {
      const input = args[0];
      if (isChatFallbackRequest(input)) {
        const marker = window[BLOCK_FALLBACK_KEY];
        const requestKey = getChatRequestKey(args);
        if (marker && marker.expiresAt > Date.now() && marker.requestKey === requestKey) {
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
      let requestBody = null;
      try {
        requestBody = typeof requestInit.body === 'string' ? JSON.parse(requestInit.body) : null;
      } catch (_) {}

      const task = {
        taskId,
        controller,
        requestKey: getChatRequestKey(args),
        canceled: false,
        startedAt: Date.now(),
        message: requestBody?.message || '',
        sessionId: requestBody?.sessionId || null,
      };
      tasks.set(taskId, task);
      window[ACTIVE_KEY] = taskId;
      writeRecoveryTask(task);

      const [, init] = args;
      const requestArgs = augmentStreamRequest(args);
      const nextInit = { ...(requestArgs[1] || init || {}), signal: controller.signal };
      const sharedContext = readSharedContext();
      const plan = createTaskPlan(task.message, {
        hasFiles: Array.isArray(requestBody?.uploadedDocs) && requestBody.uploadedDocs.length > 0,
        fileCount: Array.isArray(requestBody?.uploadedDocs) ? requestBody.uploadedDocs.length : 0,
        hasSharedContext: sharedContext.length > 0,
      });
      task.plan = plan;
      window.dispatchEvent(new CustomEvent('ai_dost_intent_plan', {
        detail: { taskId, plan },
      }));

      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: {
          id: `${taskId}:start`,
          taskId,
          ts: Date.now(),
          type: TASK_EVENT_TYPES.START,
          phase: plan.intent.type === 'task' ? 'planning' : 'understanding',
          label: plan.intent.type === 'task' ? 'Planning' : 'Understanding',
        },
      }));

      try {
        const response = await originalFetch(requestArgs[0], nextInit);
        if (!response?.body) return response;

        try {
          const cloned = response.clone();
          const reader = cloned.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          const emit = (payload) => {
            const event = normalizeServerEvent(taskId, payload);
            if (!event) return;
            if (event.type === TASK_EVENT_TYPES.COMPLETE || event.type === TASK_EVENT_TYPES.CANCELED) {
              clearRecoveryTask(taskId);
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
            } catch (error) {
              if (controller.signal.aborted) return;
              writeRecoveryTask(task);
              window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
                detail: normalizeServerEvent(taskId, { error: error?.message || 'Task stream interrupted' }),
              }));
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
        }
        return response;
      } catch (error) {
        if (!controller.signal.aborted) writeRecoveryTask(task);
        throw error;
      } finally {
        if (tasks.get(taskId) === task) tasks.delete(taskId);
        if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
      }
    };

    window.fetch = patchedFetch;
    return () => {
      window.fetch = originalFetch;
      tasks.forEach(({ controller }) => controller.abort());
      tasks.clear();
      delete window[BLOCK_FALLBACK_KEY];
      if (window.aiDostCancelTask === cancelTask) delete window.aiDostCancelTask;
      if (window[ACTIVE_KEY]) delete window[ACTIVE_KEY];
    };
  }, []);

  return null;
}
