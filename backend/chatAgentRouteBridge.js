'use strict';

const Module = require('module');
const { handleChatTaskRequest } = require('./agent/runtime/chatAgentTaskHandler');

const PATCHED = Symbol('aiDostChatAgentRouteBridgePatched');

function createChatTaskAwareHandler(handler, chatHandler = handleChatTaskRequest) {
  if (typeof handler !== 'function') return handler;
  return function chatTaskAwareAgentRun(req, res, next) {
    if (req?.body?.chatTaskPlan) {
      return chatHandler(req, res, next);
    }
    return handler(req, res, next);
  };
}

function installExpressRouterHook(expressFactory) {
  if (!expressFactory || typeof expressFactory.Router !== 'function' || expressFactory.Router[PATCHED]) {
    return expressFactory;
  }

  const originalRouter = expressFactory.Router;
  const wrappedRouter = function aiDostChatAgentRouterFactory(...args) {
    const router = originalRouter(...args);
    if (!router?.post || router.post[PATCHED]) return router;

    const originalPost = router.post.bind(router);
    router.post = (routePath, ...handlers) => {
      if (routePath !== '/run' || handlers.length === 0) {
        return originalPost(routePath, ...handlers);
      }
      const wrappedHandlers = handlers.map((handler, index) => (
        index === 0 ? createChatTaskAwareHandler(handler) : handler
      ));
      return originalPost(routePath, ...wrappedHandlers);
    };
    router.post[PATCHED] = true;
    return router;
  };

  Object.setPrototypeOf(wrappedRouter, Object.getPrototypeOf(originalRouter));
  Object.assign(wrappedRouter, originalRouter);
  wrappedRouter[PATCHED] = true;
  expressFactory.Router = wrappedRouter;
  return expressFactory;
}

const originalLoad = Module._load;
if (!originalLoad[PATCHED]) {
  const patchedLoad = function chatAgentBridgeModuleLoad(request, parent, isMain) {
    const loaded = originalLoad.call(this, request, parent, isMain);
    if (request === 'express') return installExpressRouterHook(loaded);
    return loaded;
  };
  patchedLoad[PATCHED] = true;
  Module._load = patchedLoad;
}

module.exports = { installExpressRouterHook, createChatTaskAwareHandler };
