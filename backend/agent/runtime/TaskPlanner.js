const logger = require('../../logger');

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
    if (!this.toolRegistry || typeof this.toolRegistry.get !== 'function') throw new Error('TaskPlanner requires a valid ToolRegistry');
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
    const explicitlyReadOnly = new Set([
      'read_file', 'list_directory', 'search_codebase', 'run_tests',
      'take_screenshot', 'inspect_visual_dom', 'web_search', 'fetch_webpage',
      'verify_project', 'sandbox_read', 'sandbox_list', 'sandbox_dev_build'
    ]);
    const obviouslyMutating = /^(write|create|delete|remove|move|rename|apply|edit|update|patch|run_terminal|execute|sandbox_(write|exec|create|destroy|dev_start|dev_stop|expose))/i;
    // P12.7 (E2E run #13): the model once put a write_file step in its
    // verification plan — the old code THREW and failed a run whose execution
    // had already succeeded ("Verification failed: mutating tool 'write_file'").
    // Two problems: (1) evidence gathering destroyed the run instead of the
    // plan, (2) the safety goal was never at risk — a dropped step is never
    // executed. Now mutating / unclassified steps are FILTERED OUT (safety
    // preserved) and the surviving read-only steps run as before. If nothing
    // read-only survives, fall back to a deterministic list_directory so the
    // gate still records REAL evidence instead of passing with zero checks
    // (P12.4 honesty: a silently-empty verification is exactly the lie the
    // honest gate was built to prevent).
    const validSteps = [];
    const dropped = [];
    for (const step of plan.steps) {
      const tool = this.toolRegistry.get(step.tool);
      const permissions = Array.isArray(tool?.permissions) ? tool.permissions : [];
      const mutates = tool?.mutates === true || tool?.sideEffect === true || permissions.some((p) => /write|mutation|destructive/i.test(String(p)));
      const readOnlyClassified = explicitlyReadOnly.has(step.tool) || /^(read|list|search|fetch|get|inspect|status|verify|check|test)/i.test(step.tool);
      if (mutates || obviouslyMutating.test(step.tool) || !readOnlyClassified) {
        dropped.push(step.tool);
        continue;
      }
      validSteps.push(step);
    }
    if (dropped.length) {
      logger.warn(`[TaskPlanner] Verification plan sanitized — dropped ${dropped.length} non-read-only step(s): ${dropped.join(', ')}`);
    }
    if (validSteps.length === 0) {
      logger.warn('[TaskPlanner] No read-only verification steps survived sanitization — falling back to list_directory evidence check');
      return {
        goal: plan.goal,
        steps: [{
          id: 'verify_fallback_list',
          tool: 'list_directory',
          description: 'List the workspace root to confirm the project tree exists',
          input: {}
        }]
      };
    }
    return { goal: plan.goal, steps: validSteps };
  }

  async _generate(method, ...args) {
    if (!this.aiService || typeof this.aiService[method] !== 'function') throw new Error(`AI Service missing planner method '${method}'`);
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
      this._validateObjectKeys(value, path, depth);
    }
  }

  _validateObjectKeys(obj, path, depth) {
    const keys = Object.keys(obj);
    if (keys.length > this.limits.maxInputKeys) throw new Error(`Invalid plan: too many input keys at '${path}'`);
    for (const key of keys) {
      if (key.length > 200) throw new Error(`Invalid plan: input key too long at '${path}'`);
      this._validateValue(obj[key], `${path}.${key}`, depth + 1);
    }
  }

  _normalizeRawPlan(rawPlan) {
    if (!rawPlan) throw new Error('Invalid plan structure: Plan must be an object');

    let plan = rawPlan;
    if (Array.isArray(plan)) {
      plan = { goal: 'Autonomous execution plan', steps: plan };
    }
    if (typeof plan !== 'object') throw new Error('Invalid plan structure: Plan must be an object');

    if (plan.error) {
      const msg = typeof plan.error === 'string' ? plan.error : (plan.error.message || JSON.stringify(plan.error));
      throw new Error(`AI plan generation error: ${msg}`);
    }

    if (!plan.steps && !plan.goal) {
      if (plan.plan && typeof plan.plan === 'object' && !Array.isArray(plan.plan)) plan = plan.plan;
      else if (plan.data && typeof plan.data === 'object' && !Array.isArray(plan.data)) plan = plan.data;
      else if (plan.result && typeof plan.result === 'object' && !Array.isArray(plan.result)) plan = plan.result;
    }

    if (typeof plan.goal !== 'string' || !plan.goal.trim()) {
      const altGoal = plan.objective || plan.summary || plan.task || plan.title || plan.intent;
      if (typeof altGoal === 'string' && altGoal.trim()) {
        plan.goal = altGoal.trim();
      }
    }

    if (!Array.isArray(plan.steps)) {
      const altSteps = plan.tasks || plan.actions || plan.items;
      if (Array.isArray(altSteps)) {
        plan.steps = altSteps;
      }
    }
    return plan;
  }

  _validateSingleStep(step, stepIds) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      throw new Error('Invalid plan structure: Each step must be an object');
    }
    const hasValidFields = typeof step.id === 'string' && step.id.trim() &&
      typeof step.tool === 'string' && step.tool.trim() &&
      typeof step.description === 'string' && step.description.trim() &&
      step.input && typeof step.input === 'object' && !Array.isArray(step.input);
    if (!hasValidFields) {
      throw new Error('Invalid plan structure: Step must contain string id, tool, description, and an object input');
    }
    if (step.id.length > 200) throw new Error(`Invalid plan: step ID '${step.id}' is too long`);
    if (step.description.length > this.limits.maxDescriptionChars) {
      throw new Error(`Invalid plan: step '${step.id}' description exceeds maximum length`);
    }
    if (stepIds.has(step.id)) throw new Error(`Invalid plan: Duplicate step ID '${step.id}'`);
    stepIds.add(step.id);

    const tool = this.toolRegistry.get(step.tool);
    if (!tool) throw new Error(`Invalid plan: Unknown tool '${step.tool}' requested`);
    this._validateValue(step.input, `step.${step.id}.input`);
    try {
      tool.validateInput(step.input);
    } catch (err) {
      throw new Error(`Invalid plan: Step '${step.id}' provided invalid input for tool '${step.tool}': ${err.message}`);
    }
  }

  validateAndSanitizePlan(rawPlan) {
    const plan = this._normalizeRawPlan(rawPlan);

    if (typeof plan.goal !== 'string' || !plan.goal.trim()) {
      throw new Error('Invalid plan structure: Missing or invalid goal string');
    }
    if (plan.goal.length > this.limits.maxGoalChars) {
      throw new Error('Invalid plan: goal exceeds maximum length');
    }

    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Invalid plan structure: Steps must be a non-empty array');
    }
    if (plan.steps.length > this.limits.maxSteps) {
      throw new Error(`Invalid plan: step count exceeds maximum of ${this.limits.maxSteps}`);
    }

    const stepIds = new Set();
    for (const step of plan.steps) {
      this._validateSingleStep(step, stepIds);
    }

    return {
      goal: plan.goal.trim(),
      steps: plan.steps.map((step) => ({ id: step.id.trim(), tool: step.tool.trim(), description: step.description.trim(), input: step.input })),
    };
  }
}

module.exports = TaskPlanner;
