'use strict';

const OpenAIService = require('../../services/openaiService');

function extractJson(text) {
  const source = String(text || '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : source;
  try {
    return JSON.parse(candidate);
  } catch (_) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('Planner returned invalid JSON');
  }
}

function toolCatalog(toolRegistry) {
  return toolRegistry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    permissions: tool.permissions,
  }));
}

function plannerPrompt(kind, intent, context, tools, extra = '') {
  return [
    'You are the canonical AI-Dost autonomous task planner.',
    `Planner mode: ${kind}.`,
    'Return ONLY one JSON object with this exact shape:',
    '{"goal":"string","steps":[{"id":"string","tool":"registered-tool-name","description":"string","input":{}}]}',
    'Every tool must be selected ONLY from the supplied tool catalog. Never invent a tool name.',
    kind === 'verification'
      ? 'Verification must be read-only and must not repeat destructive or mutating actions. Prefer inspection, retrieval, status, search, or read tools.'
      : 'Plan the minimum safe sequence needed to fulfill the user objective.',
    extra,
    `USER INTENT:\n${String(intent || '')}`,
    `AUTHORIZED CONTEXT:\n${JSON.stringify(context || {})}`,
    `TOOL CATALOG:\n${JSON.stringify(tools)}`,
  ].join('\n\n');
}

function createStructuredAgentPlanner({ toolRegistry, openai = OpenAIService, customApiKey = null } = {}) {
  if (!toolRegistry || typeof toolRegistry.list !== 'function') throw new Error('toolRegistry is required');

  const complete = async (prompt) => {
    const response = await openai.chat(prompt, [], 'agent', customApiKey);
    return extractJson(response);
  };

  return {
    async generateStructuredPlan(intent, context) {
      return complete(plannerPrompt('execution', intent, context, toolCatalog(toolRegistry)));
    },

    async generateRepairPlan(failedStep, errorInfo, context) {
      return complete(plannerPrompt(
        'repair',
        failedStep?.description || failedStep?.tool || 'Repair failed task step',
        context,
        toolCatalog(toolRegistry),
        `FAILED STEP:\n${JSON.stringify(failedStep || {})}\nERROR:\n${String(errorInfo || '')}\nRepair must avoid repeating irreversible side effects unless the tool explicitly requires it.`,
      ));
    },

    async generateVerificationPlan(goal, context) {
      return complete(plannerPrompt('verification', goal, context, toolCatalog(toolRegistry)));
    },
  };
}

module.exports = {
  createStructuredAgentPlanner,
  extractJson,
};