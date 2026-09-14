'use strict';

/**
 * Thin compatibility adapter between the universal chat task contract and
 * the existing autonomous agent runtime. It deliberately does not execute
 * tools itself; it converts a chat plan into the canonical agent-plan shape
 * and validates its tool references against the supplied ToolRegistry.
 */
class ChatTaskAdapter {
  constructor({ toolRegistry, resultValidator } = {}) {
    if (!toolRegistry || typeof toolRegistry.get !== 'function') {
      throw new Error('ChatTaskAdapter requires a ToolRegistry');
    }
    this.toolRegistry = toolRegistry;
    this.resultValidator = resultValidator || null;
  }

  toAgentPlan(taskPlan, context = {}) {
    if (!taskPlan || typeof taskPlan !== 'object') {
      throw new Error('Chat task plan must be an object');
    }

    const intent = taskPlan.intent || {};
    const sourceSteps = Array.isArray(taskPlan.steps) ? taskPlan.steps : [];
    const toolSteps = sourceSteps
      .filter((step) => step && step.kind === 'tool')
      .map((step, index) => ({
        id: String(step.id || `chat-tool-${index + 1}`),
        tool: this.resolveTool(step.action, step.target),
        description: `${step.action || 'execute'} ${step.target || 'task'}`.trim(),
        input: {
          ...(context.toolInput || {}),
          action: step.action || null,
          target: step.target || null,
          message: taskPlan.intent?.originalMessage || '',
        },
      }));

    return {
      version: 1,
      goal: String(intent.originalMessage || taskPlan.goal || 'Complete chat task'),
      source: 'universal-chat',
      intent,
      steps: toolSteps,
    };
  }

  resolveTool(action, target) {
    const candidates = [
      `${action}_${target}`,
      `${action}:${target}`,
      action,
      target,
    ].filter(Boolean);

    for (const name of candidates) {
      if (this.toolRegistry.get(name)) return name;
    }

    // A chat task can be planning-only; return the first deterministic
    // candidate so the caller can surface an explicit unavailable-tool error.
    return candidates[0] || 'unknown';
  }

  validateAgentPlan(agentPlan) {
    if (!agentPlan || typeof agentPlan !== 'object' || typeof agentPlan.goal !== 'string') {
      throw new Error('Invalid adapted agent plan');
    }
    if (!Array.isArray(agentPlan.steps)) {
      throw new Error('Invalid adapted agent plan steps');
    }

    for (const step of agentPlan.steps) {
      if (!this.toolRegistry.get(step.tool)) {
        throw new Error(`Chat task requires unavailable tool '${step.tool}'`);
      }
      const tool = this.toolRegistry.get(step.tool);
      if (typeof tool.validateInput === 'function') tool.validateInput(step.input);
    }

    return agentPlan;
  }

  validateResult(result) {
    if (!this.resultValidator || typeof this.resultValidator.validate !== 'function') {
      return result;
    }
    return this.resultValidator.validate(result);
  }
}

module.exports = ChatTaskAdapter;
