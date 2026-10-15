/**
 * Canonical Phase 2 Base Tool Interface.
 * 
 * Defines the contract for all tool executions.
 * Must NOT bypass ProjectAuthorizationService or WorkspaceManager.
 */
class Tool {
  /**
   * @param {string} name 
   * @param {string} description 
   * @param {object} inputSchema - JSON Schema for the input
   * @param {Array<string>} permissions - Required permission mask (e.g., ['fs:read'])
   */
  constructor({ name, description, inputSchema, permissions = [] }) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.permissions = permissions;
  }

  /**
   * Validates the tool input against the defined schema.
   * This provides a lightweight validation layer without heavy dependencies.
   */
  validateInput(input) {
    if (!this.inputSchema || !this.inputSchema.type) return true;
    
    if (this.inputSchema.type === 'object' && this.inputSchema.required) {
      if (!input || typeof input !== 'object') {
        throw new Error(`Validation Error: Input to tool '${this.name}' must be an object`);
      }
      for (const req of this.inputSchema.required) {
        if (input[req] === undefined || input[req] === null) {
          throw new Error(`Validation Error: Missing required property '${req}' in tool '${this.name}'`);
        }
      }
    }
    
    // Check property types if defined
    if (this.inputSchema.properties) {
      for (const [key, def] of Object.entries(this.inputSchema.properties)) {
        if (input[key] !== undefined && input[key] !== null) {
          if (def.type === 'string' && typeof input[key] !== 'string') {
            throw new Error(`Validation Error: Property '${key}' must be a string in tool '${this.name}'`);
          }
          if (def.type === 'number' && typeof input[key] !== 'number') {
            throw new Error(`Validation Error: Property '${key}' must be a number in tool '${this.name}'`);
          }
          if (def.type === 'boolean' && typeof input[key] !== 'boolean') {
            throw new Error(`Validation Error: Property '${key}' must be a boolean in tool '${this.name}'`);
          }
        }
      }
    }
    return true;
  }

  /**
   * Executes the tool logic. Must be overridden by subclasses.
   * @param {object} context - The execution context { projectId, userId, workspacePath, logger, ... }
   * @param {object} input - The validated input payload
   * @returns {Promise<object>} The execution result
   */
  async execute(context, input) {
    this.validateInput(input);
    throw new Error('Tool.execute() must be implemented by subclasses.');
  }
}

module.exports = Tool;
