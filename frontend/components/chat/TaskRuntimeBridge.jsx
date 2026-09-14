import { useEffect } from 'react';
import { createTaskId, normalizeServerEvent, parseSseLines, TASK_EVENT_TYPES } from './taskRuntime';
import { buildUploadedDocsContext, readSharedContext } from './sharedChatContext';

const STREAM_PATH = '/api/chat/stream';
const CANCELED_KEY = '__aiDostCanceledTasks';
const ACTIVE_KEY = '__aiDostActiveTask';
const BLOCK_FALLBACK_KEY = '__aiDostBlockNextChatFallback';

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

function getCanceledTasks() {
  if (typeof window === 'undefined') return new Set();
  const ids = window[CANCELED_KEY];
  return ids instanceof Set ? ids : new Set();
}

function markCanceled(taskId) {
  const canceled = getCanceledTasks();
  canceled.add(taskId);
  if (typeof window !== 'undefined') window[CANCELED_KEY] = canceled;
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
    const controllers = new Map();

    const cancelTask = (taskId) => {
      if (!taskId) return false;
      markCanceled(taskId);
      window[BLOCK_FALLBACK_KEY] = true;
      const controller = controllers.get(taskId);
      controller?.abort();
      controllers.delete(taskId);
      if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: normalizeServerEvent(taskId, { error: 'Task canceled by user' }),
      }));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', {
        detail: { type: 'warning', message: 'AI-Dost task canceled.' },
      }));
      return true;
    };

    window.aiDostCancelTask = cancelTask;

    const patchedFetch = async (...args) => {
      const input = args[0];
      if (isChatFallbackRequest(input) && window[BLOCK_FALLBACK_KEY]) {
        delete window[BLOCK_FALLBACK_KEY];
        throw new DOMException('Chat task canceled', 'AbortError');
      }
      if (!isChatStreamRequest(input)) return originalFetch(...args);

      const taskId = createTaskId('chat');
      const controller = new AbortController();
      controllers.set(taskId, controller);
      window[ACTIVE_KEY] = taskId;

      const [, init] = args;
      const requestArgs = augmentStreamRequest(args);
      const nextInit = { ...(requestArgs[1] || init || {}), signal: controller.signal };
      window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
        detail: {
          id: `${taskId}:start`,
          taskId,
          ts: Date.now(),
          type: TASK_EVENT_TYPES.START,
          phase: 'understanding',
          label: 'Understanding',
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
            if (event) window.dispatchEvent(new CustomEvent('ai_dost_task_event', { detail: event }));
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
              window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
                detail: normalizeServerEvent(taskId, { error: error?.message || 'Task stream interrupted' }),
              }));
            }
          };
          void pump();
        } catch (error) {
          if (!controller.signal.aborted) {
            window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
              detail: normalizeServerEvent(taskId, { error: error?.message || 'Unable to inspect task stream' }),
            }));
          }
        }
        return response;
      } finally {
        if (controllers.get(taskId) === controller) controllers.delete(taskId);
        if (window[ACTIVE_KEY] === taskId) delete window[ACTIVE_KEY];
      }
    };

    window.fetch = patchedFetch;
    return () => {
      window.fetch = originalFetch;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      delete window[BLOCK_FALLBACK_KEY];
      if (window.aiDostCancelTask === cancelTask) delete window.aiDostCancelTask;
      if (window[ACTIVE_KEY]) delete window[ACTIVE_KEY];
    };
  }, []);

  return null;
}
