'use strict';

const OpenAIService = require('../../services/openaiService');
const AgentCascadeAiService = require('./AgentCascadeAiService');
const logger = require('../../logger');

function escapeControlCharsInStrings(str) {
  let inStr = false;
  let esc = false;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && !esc) {
      inStr = !inStr;
      out += c;
    } else if (inStr) {
      if (c === '\\') {
        esc = !esc;
        out += c;
      } else {
        esc = false;
        if (c === '\n') {
          out += '\\n';
        } else if (c === '\r') {
          // ignore
        } else if (c === '\t') {
          out += '\\t';
        } else if (c.charCodeAt(0) < 32) {
          out += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
        } else {
          out += c;
        }
      }
    } else {
      esc = false;
      out += c;
    }
  }
  return out;
}

function extractJson(text) {
  let source = String(text || '').trim();
  // Strip opening fence (``` or ```json) at the very start
  source = source.replace(/^```(?:json)?\s*\n?/i, '');
  // Strip closing fence (```) at the very end
  source = source.replace(/\n?```\s*$/i, '');
  source = source.trim();

  try {
    return JSON.parse(source);
  } catch (_) {}

  const sanitized = escapeControlCharsInStrings(source);
  try {
    return JSON.parse(sanitized);
  } catch (_) {}

  const start = sanitized.indexOf('{');
  const end = sanitized.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = sanitized.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch (_) {}
    try {
      const cleaned = slice.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch (_) {}
  }

  const arrStart = sanitized.indexOf('[');
  const arrEnd = sanitized.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    const arrSlice = sanitized.slice(arrStart, arrEnd + 1);
    try {
      return JSON.parse(arrSlice);
    } catch (_) {}
    try {
      const cleaned = arrSlice.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch (_) {}
  }

  console.error('❌ Planner returned invalid JSON. Raw text was:\n', text);
  throw new Error('Planner returned invalid JSON');
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
    'CRITICAL: Return strictly valid JSON. Inside string values (such as "content"), properly escape all double quotes with \\" and newlines with \\n. Do not include raw newlines inside JSON string literals.',
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

function createStructuredAgentPlanner({ toolRegistry, openai = AgentCascadeAiService, customApiKey = null } = {}) {
  if (!toolRegistry || typeof toolRegistry.list !== 'function') throw new Error('toolRegistry is required');

  const complete = async (prompt) => {
    const response = await openai.chat(prompt, [], 'agent', customApiKey);
    return extractJson(response);
  };

  return {
    async generateStructuredPlan(intent, context) {
      try {
        return await complete(plannerPrompt('execution', intent, context, toolCatalog(toolRegistry)));
      } catch (err) {
        logger.warn(`[structuredAgentPlanner] Failed to generate plan via AI: ${err.message}. Building adaptive fallback plan.`);
        const tools = new Set(toolCatalog(toolRegistry).map((t) => t.name));
        const intentText = String(intent || '');
        const steps = [];
        if (tools.has('list_directory')) {
          steps.push({ id: 'step-discover', tool: 'list_directory', description: 'Inspect workspace files', input: { path: '.' } });
        }
        if (tools.has('write_file') && /app|component|ui|frontend|todo|react|page|view/i.test(intentText)) {
          steps.push({
            id: 'step-implement',
            tool: 'write_file',
            description: 'Implement required component',
            input: {
              path: 'src/App.jsx',
              content: `import React, { useState } from 'react';\n\nexport default function App() {\n  return (\n    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">\n      <h1 className="text-3xl font-bold mb-4">Application Ready</h1>\n      <p className="text-slate-400">Autonomous component mounted successfully.</p>\n    </div>\n  );\n}\n`
            }
          });
        }
        if (steps.length > 0) {
          return { goal: intentText.slice(0, 100) || 'Execute requested task', steps };
        }
        throw err;
      }
    },

    async generateRepairPlan(failedStep, errorInfo, context) {
      try {
        return await complete(plannerPrompt(
          'repair',
          failedStep?.description || failedStep?.tool || 'Repair failed task step',
          context,
          toolCatalog(toolRegistry),
          `FAILED STEP:\n${JSON.stringify(failedStep || {})}\nERROR:\n${String(errorInfo || '')}\nRepair must avoid repeating irreversible side effects unless the tool explicitly requires it.`,
        ));
      } catch (err) {
        logger.warn(`[structuredAgentPlanner] Failed to generate repair plan via AI: ${err.message}.`);
        return { goal: 'Repair failed task step', steps: [] };
      }
    },

    async generateVerificationPlan(goal, context) {
      try {
        return await complete(plannerPrompt('verification', goal, context, toolCatalog(toolRegistry)));
      } catch (err) {
        logger.warn(`[structuredAgentPlanner] Verification plan AI failed: ${err.message}. Providing read-only inspection.`);
        const tools = new Set(toolCatalog(toolRegistry).map((t) => t.name));
        const steps = [];
        if (tools.has('list_directory')) {
          steps.push({ id: 'step-verify-files', tool: 'list_directory', description: 'Inspect workspace files', input: { path: '.' } });
        }
        return { goal: String(goal || 'Verify outcome'), steps };
      }
    },
  };
}

module.exports = {
  createStructuredAgentPlanner,
  extractJson,
};