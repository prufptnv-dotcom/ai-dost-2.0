class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool || !tool.name || typeof tool.execute !== 'function') {
      throw new Error('Invalid tool provided to registry');
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      permissions: t.permissions
    }));
  }
}

// Singleton for canonical use
const defaultRegistry = new ToolRegistry();
defaultRegistry.ToolRegistry = ToolRegistry;

module.exports = defaultRegistry;
