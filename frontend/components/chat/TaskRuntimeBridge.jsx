import { useEffect } from 'react';
import { createTaskId, normalizeServerEvent, parseSseLines, TASK_EVENT_TYPES } from './taskRuntime';
import { buildUploadedDocsContext, readSharedContext } from './sharedChatContext';

const STREAM_PATH = '/api/chat/stream';

function isChatStreamRequest(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return false;
  try {
    return new URL(url, window.location.origin).pathname === STREAM_PATH;
  } catch (_) {
    return String(url).includes(STREAM_PATH);
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

    const patchedFetch = async (...args) => {
      const input = args[0];
      if (!isChatStreamRequest(input)) return originalFetch(...args);

      const taskId = createTaskId('chat');
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

      const response = await originalFetch(...augmentStreamRequest(args));
      if (!response?.body) return response;

      try {
        const cloned = response.clone();
        const reader = cloned.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const emit = (payload) => {
          const event = normalizeServerEvent(taskId, payload);
          if (event) {
            window.dispatchEvent(new CustomEvent('ai_dost_task_event', { detail: event }));
          }
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
            window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
              detail: normalizeServerEvent(taskId, { error: error?.message || 'Task stream interrupted' }),
            }));
          }
        };

        void pump();
      } catch (error) {
        window.dispatchEvent(new CustomEvent('ai_dost_task_event', {
          detail: normalizeServerEvent(taskId, { error: error?.message || 'Unable to inspect task stream' }),
        }));
      }

      return response;
    };

    window.fetch = patchedFetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
