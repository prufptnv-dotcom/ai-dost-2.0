class TaskPlanner {
  constructor({ toolRegistry, aiService, limits = {} }) {
    this.toolRegistry = toolRegistry;
    this.aiService = aiService;
    this.limits = {
      maxSteps: Number.isInteger(limits.maxSteps) ? limits.maxSteps : 20,
      maxGoalChars: Number.isInteger(limits.maxGoalChars) ? limits.maxGoalChars : 4000,
      maxDescriptionChars: Number.isInteger(limits.maxDescriptionChars) ? limits.maxDescriptionChars : 2000,
      maxInputKeys: Number.isInteger(limits.maxInputKeys) ? limits.maxInputKeys : 40,
      maxInputStringChars: Number.isInteger(limits.maxInputStringChars) ? limits.maxInputStringChars : 12000,
    };
    if (!this.toolRegistry || typeof this.toolRegistry.get !== 'function') {
      throw new Error('TaskPlanner requires a valid ToolRegistry');
    }
  }

  async generatePlan(intent, context) {
    if (!intent || typeof intent !== 'string') throw new Error('TaskPlanner requires a valid intent string');
    return this.validateAndSanitizePlan(await this._generate('generateStructuredPlan', intent, context));
  }

  async generateRepairPlan(failedStep, errorInfo, context) {
    return this.validateAndSanitizePlan(await this._generate('generateRepairPlan', failedStep, errorInfo, context));
  }

  async generateVerificationPlan(goal, context) {
    const plan = this.validateAndSanitizePlan(await this._generate('generateVerificationPlan', goal, context));
    for (const step of plan.steps) {
      const tool = this.toolRegistry.get(step.tool);
      if (tool?.mutates === true || tool?.sideEffect === true || tool?.permissions?.includes?.('write')) {
        throw new Error(`Invalid verification plan: mutating tool '${step.tool}' is not allowed`);
      }
      if (!/^(read|list|search|fetch|get|inspect|status|verify|check|test)/i.test(step.tool)) {
        throw new Error(`Invalid verification plan: tool '${step.tool}' is not classified as read-only`);
      }
    }
    return plan;
  }

  async _generate(method, ...args) {
    if (!this.aiService || typeof this.aiService[method] !== 'function') {
      throw new Error(`AI Service missing planner method '${method}'`);
    }
    return this.aiService[method](...args);
  }

  _validateValue(value, path, depth = 0) {
    if (depth > 5) throw new Error(`Invalid plan: input nesting too deep at '${path}'`);
    if (typeof value === 'string') {
      if (value.length > this.limits.maxInputStringChars) throw new Error(`Invalid plan: input string too large at '${path}'`);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > this.limits.maxInputKeys) throw new Error(`Invalid plan: input array too large at '${path}'`);
      value.forEach((item, index) => this._validateValue(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > this.limits.maxInputKeys) throw new Error(`Invalid plan: too many input keys at '${path}'`);
      for (const key of keys) {
        if (key.length > 200) throw new Error(`Invalid plan: input key too long at '${path}'`);
        this._validateValue(value[key], `${path}.${key}`, depth + 1);
      }
    }
  }

  validateAndSanitizePlan(rawPlan) {
    if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) throw new Error('Invalid plan structure: Plan must be an object');
    if (typeof rawPlan.goal !== 'string' || !rawPlan.goal.trim()) throw new Error('Invalid plan structure: Missing or invalid goal string');
    if (rawPlan.goal.length > this.limits.maxGoalChars) throw new Error('Invalid plan: goal exceeds maximum length');
    if (!Array.isArray(rawPlan.steps) || rawPlan.steps.length === 0) throw new Error('Invalid plan structure: Steps must be a non-empty array');
    if (rawPlan.steps.length > this.limits.maxSteps) throw new Error(`Invalid plan: step count exceeds maximum of ${this.limits.maxSteps}`);

    const stepIds = new Set();
    for (const step of rawPlan.steps) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error('Invalid plan structure: Each step must be an object');
      if (typeof step.id !== 'string' || !step.id.trim() || typeof step.tool !== 'string' || !step.tool.trim() || typeof step.description !== 'string' || !step.description.trim() || !step.input || typeof step.input !== 'object' || Array.isArray(step.input)) {
        throw new Error('Invalid plan structure: Step must contain string id, tool, description, and an object input');
      }
      if (step.id.length > 200) throw new Error(`Invalid plan: step ID '${step.id}' is too long`);
      if (step.description.length > this.limits.maxDescriptionChars) throw new Error(`Invalid plan: step '${step.id}' description exceeds maximum length`);
      if (stepIds.has(step.id)) throw new Error(`Invalid plan: Duplicate step ID '${step.id}'`);
      stepIds.add(step.id);

      const tool = this.toolRegistry.get(step.tool);
      if (!tool) throw new Error(`Invalid plan: Unknown tool '${step.tool}' requested`);
      this._validateValue(step.input, `step.${step.id}.input`);
      try { tool.validateInput(step.input); }
      catch (err) { throw new Error(`Invalid plan: Step '${step.id}' provided invalid input for tool '${step.tool}': ${err.message}`); }
    }

    return {
      goal: rawPlan.goal.trim(),
      steps: rawPlan.steps.map((step) => ({
        id: step.id.trim(),
        tool: step.tool.trim(),
        description: step.description.trim(),
        input: step.input,
      })),
    };
  }
}

module.exports = TaskPlanner;
