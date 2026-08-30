class TaskPlanner {
  constructor({ toolRegistry, aiService }) {
    this.toolRegistry = toolRegistry;
    this.aiService = aiService;
  }

  async generatePlan(intent, context) {
    if (!intent || typeof intent !== 'string') {
      throw new Error('TaskPlanner requires a valid intent string');
    }
    
    let rawPlan;
    if (this.aiService && typeof this.aiService.generateStructuredPlan === 'function') {
      rawPlan = await this.aiService.generateStructuredPlan(intent, context);
    } else {
      throw new Error('AI Service not provided to TaskPlanner');
    }

    return this.validateAndSanitizePlan(rawPlan);
  }

  async generateRepairPlan(failedStep, errorInfo, context) {
    let rawPlan;
    if (this.aiService && typeof this.aiService.generateRepairPlan === 'function') {
      rawPlan = await this.aiService.generateRepairPlan(failedStep, errorInfo, context);
    } else {
      throw new Error('AI Service not provided to TaskPlanner');
    }
    return this.validateAndSanitizePlan(rawPlan);
  }

  async generateVerificationPlan(goal, context) {
    let rawPlan;
    if (this.aiService && typeof this.aiService.generateVerificationPlan === 'function') {
      rawPlan = await this.aiService.generateVerificationPlan(goal, context);
    } else {
      throw new Error('AI Service not provided to TaskPlanner');
    }
    return this.validateAndSanitizePlan(rawPlan);
  }

  validateAndSanitizePlan(rawPlan) {
    // 1. Structural Validation
    if (!rawPlan || typeof rawPlan !== 'object') {
      throw new Error('Invalid plan structure: Plan must be an object');
    }
    if (typeof rawPlan.goal !== 'string') {
      throw new Error('Invalid plan structure: Missing or invalid goal string');
    }
    if (!Array.isArray(rawPlan.steps) || rawPlan.steps.length === 0) {
      throw new Error('Invalid plan structure: Steps must be a non-empty array');
    }

    // 2. Semantic Tool Validation
    const stepIds = new Set();
    for (const step of rawPlan.steps) {
      if (!step || typeof step !== 'object') {
        throw new Error('Invalid plan structure: Each step must be an object');
      }
      if (typeof step.id !== 'string' || typeof step.tool !== 'string' || typeof step.description !== 'string' || typeof step.input !== 'object' || step.input === null) {
        throw new Error('Invalid plan structure: Step must contain string id, tool, description, and an object input');
      }

      // Unique step ID check
      if (stepIds.has(step.id)) {
        throw new Error(`Invalid plan: Duplicate step ID '${step.id}'`);
      }
      stepIds.add(step.id);

      // Tool Existence Check
      const tool = this.toolRegistry.get(step.tool);
      if (!tool) {
        throw new Error(`Invalid plan: Unknown tool '${step.tool}' requested`);
      }

      // Input Schema Validation against the registered Tool
      try {
        tool.validateInput(step.input);
      } catch (err) {
        throw new Error(`Invalid plan: Step '${step.id}' provided invalid input for tool '${step.tool}': ${err.message}`);
      }
    }

    return rawPlan;
  }
}

module.exports = TaskPlanner;
