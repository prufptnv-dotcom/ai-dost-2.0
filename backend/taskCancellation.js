'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { URL } = require('url');
const http = require('http');
const Module = require('module');

const STREAM_PATH = '/api/chat/stream';
const CANCEL_PATH_PREFIX = '/api/chat/tasks/';
const storage = new AsyncLocalStorage();
const activeTasks = new Map();
const PATCHED = Symbol('aiDostTaskCancellationPatched');

function combineSignals(first, second) {
  if (!first) return second || undefined;
  if (!second) return first;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([first, second]);

  const controller = new AbortController();
  const abortFrom = (signal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
  };
  if (first.aborted) abortFrom(first);
  else first.addEventListener('abort', () => abortFrom(first), { once: true });
  if (second.aborted) abortFrom(second);
  else second.addEventListener('abort', () => abortFrom(second), { once: true });
  return controller.signal;
}

function cancelTask(task, reason = 'client disconnected') {
  if (!task || task.controller.signal.aborted) return false;
  task.canceled = true;
  task.controller.abort(new Error(reason));
  return true;
}

function registerTask(taskId, req, res) {
  const controller = new AbortController();
  const task = {
    taskId,
    controller,
    req,
    res,
    startedAt: Date.now(),
    canceled: false,
  };
  activeTasks.set(taskId, task);

  let completed = false;
  const cleanup = () => {
    if (completed) return;
    completed = true;
    activeTasks.delete(taskId);
  };

  res.on('finish', cleanup);
  res.on('close', () => {
    if (!res.writableFinished) cancelTask(task, 'chat client disconnected');
    cleanup();
  });

  return task;
}

function wrapStreamHandler(handler) {
  return function taskAwareStreamHandler(req, res, next) {
    const taskId = String(req.get('x-ai-dost-task-id') || req.body?.taskId || `server-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    const task = registerTask(taskId, req, res);
    res.setHeader('X-AI-Dost-Task-Id', taskId);

    return storage.run(task, () => Promise.resolve(handler(req, res, next)).finally(() => {
      if (!res.writableEnded) cleanupTask(taskId);
    }));
  };
}

function cleanupTask(taskId) {
  activeTasks.delete(taskId);
}

function installExpressRouterHook(expressFactory) {
  if (!expressFactory || typeof expressFactory.Router !== 'function') return expressFactory;
  if (expressFactory.Router[PATCHED]) return expressFactory;

  const originalRouter = expressFactory.Router;
  const wrappedRouter = function aiDostRouterFactory(...args) {
    const router = originalRouter(...args);
    if (router?.post && !router.post[PATCHED]) {
      const originalPost = router.post.bind(router);
      router.post = (path, ...handlers) => {
        if (path === '/stream') {
          handlers = handlers.map((handler) => (typeof handler === 'function' ? wrapStreamHandler(handler) : handler));
        }
        return originalPost(path, ...handlers);
      };
      router.post[PATCHED] = true;
    }
    return router;
  };

  Object.setPrototypeOf(wrappedRouter, Object.getPrototypeOf(originalRouter));
  Object.assign(wrappedRouter, originalRouter);
  wrappedRouter[PATCHED] = true;
  expressFactory.Router = wrappedRouter;
  return expressFactory;
}

function installCancellationEndpoint() {
  const originalEmit = http.Server.prototype.emit;
  if (originalEmit[PATCHED]) return;

  const patchedEmit = function aiDostTaskCancellationEmit(event, ...args) {
    if (event === 'request' && args[0] && args[1]) {
      const req = args[0];
      const res = args[1];
      const method = String(req.method || '').toUpperCase();
      const pathname = String(req.url || '').split('?')[0];
      if ((method === 'POST' || method === 'DELETE') && pathname.startsWith(CANCEL_PATH_PREFIX)) {
        const taskId = decodeURIComponent(pathname.slice(CANCEL_PATH_PREFIX.length).replace(/\/cancel$/, ''));
        if (taskId && pathname.endsWith('/cancel')) {
          const canceled = cancelActiveTask(taskId, 'task canceled by user');
          res.statusCode = canceled ? 200 : 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ success: canceled, taskId, canceled }));
          return true;
        }
      }
    }
    return originalEmit.call(this, event, ...args);
  };
  patchedEmit[PATCHED] = true;
  http.Server.prototype.emit = patchedEmit;
}

const originalLoad = Module._load;
Module._load = function taskCancellationModuleLoad(request, parent, isMain) {
  const loaded = originalLoad.call(this, request, parent, isMain);
  if (request === 'express') return installExpressRouterHook(loaded);
  return loaded;
};

const originalFetch = global.fetch;
if (typeof originalFetch === 'function' && !originalFetch[PATCHED]) {
  const wrappedFetch = function aiDostTaskAwareFetch(input, init = {}) {
    const task = storage.getStore();
    if (!task) return originalFetch(input, init);
    return originalFetch(input, { ...init, signal: combineSignals(task.controller.signal, init.signal) });
  };
  wrappedFetch[PATCHED] = true;
  global.fetch = wrappedFetch;
}

installCancellationEndpoint();

function getActiveTask(taskId) {
  return activeTasks.get(String(taskId || '')) || null;
}

function cancelActiveTask(taskId, reason) {
  return cancelTask(getActiveTask(taskId), reason || 'task canceled');
}

module.exports = {
  activeTasks,
  getActiveTask,
  cancelActiveTask,
  combineSignals,
  registerTask,
};
