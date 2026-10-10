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

// P12.4: models routinely emit structurally-INCOMPLETE but otherwise valid
// JSON — measured from real E2E run #5 logs, 4 of 9 "invalid JSON" responses
// were complete-looking objects missing the final `]}` or a single step `}`,
// or ending inside a trailing string. A retry replays the same systematic
// failure, so extractJson repairs instead: append/insert-only, bounded,
// and NEVER applied to text that does not start with { or [ (prose and
// classifier junk must still fail honestly).
function repairIncompleteJson(text) {
  const source = String(text || '');
  if (!/^[\s]*[{[]/.test(source)) return null;

  let out = '';
  const stack = [];
  const cuts = []; // out.length right after each completed VALUE
  let inStr = false;
  let esc = false;
  let strStart = -1;

  // Inside an array a completed string is a value; inside an object it is a
  // value only if the last significant character before its opening quote is ':'.
  const stringWasValue = () => {
    if (stack.length && stack[stack.length - 1] === '[') return true;
    for (let j = strStart - 1; j >= 0; j--) {
      const ch = out[j];
      if (/\s/.test(ch)) continue;
      return ch === ':';
    }
    return false;
  };

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inStr) {
      out += c;
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') {
        inStr = false;
        if (stringWasValue()) cuts.push(out.length);
      }
      continue;
    }
    if (c === '"') { inStr = true; esc = false; strStart = out.length; out += c; continue; }
    if (c === '{' || c === '[') { stack.push(c); out += c; continue; }
    if (c === '}' || c === ']') {
      if (!stack.length) continue; // extra closer — drop it
      const want = stack[stack.length - 1] === '{' ? '}' : ']';
      if (c !== want) {
        // The model forgot to close the innermost value — insert the missing
        // closer and re-process this character against the new innermost.
        out += want;
        stack.pop();
        i -= 1;
        continue;
      }
      out += c;
      stack.pop();
      cuts.push(out.length);
      if (!stack.length) break; // root value closed — ignore any tail text
      continue;
    }
    out += c;
  }

  const closersFor = (st) => st.slice().reverse().map((ch) => (ch === '{' ? '}' : ']')).join('');
  const bases = [];
  if (!inStr) {
    bases.push(out);
  } else {
    // Close the unterminated trailing string (drop a dangling backslash first).
    bases.push((esc ? out.slice(0, -1) : out) + '"');
    // If that string was a half-written KEY, everything from its opening quote
    // on is garbage — also try the text before it.
    if (strStart > 0) bases.push(out.slice(0, strStart));
  }
  // Fallbacks: discard a half-written trailing value and retry from the most
  // recent completed value.
  for (let k = cuts.length - 1; k >= 0 && bases.length < 42; k--) {
    if (cuts[k] < out.length) bases.push(out.slice(0, cuts[k]));
  }

  for (const base of bases) {
    const candidate = base.replace(/,\s*$/, '') + closersFor(stack);
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  return null;
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

  // Last resort before failing honestly: structurally-incomplete JSON.
  const repaired = repairIncompleteJson(sanitized);
  if (repaired !== null) return repaired;

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

  // P12.4: mode 'planner' — NOT 'agent'. Groq's 'agent' system prompt says
  // "Output the source code immediately using FILE: path format", which fights
  // the planner's "Return ONLY one JSON object" instruction; ~half of all plan
  // calls came back as prose ("I'll start by inspecting…") or classifier junk
  // ("User Safety: safe") and fell into the template fallback. Every cascade
  // service leaves the system prompt EMPTY for an unknown mode, so the planner
  // prompt speaks for itself.
  //
  // Free-tier providers flake per-call — retry the whole cascade a couple of
  // times when a response ARRIVES but is not parseable JSON. A cascade-level
  // throw (all providers down) propagates immediately: rewalking it instantly
  // would not help.
  const complete = async (prompt) => {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await openai.chat(prompt, [], 'planner', customApiKey);
      try {
        return extractJson(response);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          logger.warn(`[structuredAgentPlanner] Plan response was not valid JSON (attempt ${attempt}/3) — retrying cascade.`);
        }
      }
    }
    throw lastErr;
  };

  return {
    // P12.4: NO fabricated fallback plan. The old template fallback wrote a
    // hardcoded src/App.jsx stub component: it landed as junk once, then every
    // later call hit WRITE_FORBIDDEN_ON_EXISTING and was silently swallowed —
    // specialists reported success while doing nothing. Fail honestly instead;
    // callers self-heal (CopilotDirector re-plans with a REPAIR ATTEMPT
    // objective) or surface an honest error.
    async generateStructuredPlan(intent, context) {
      return await complete(plannerPrompt('execution', intent, context, toolCatalog(toolRegistry)));
    },

    async generateRepairPlan(failedStep, errorInfo, context) {
      return await complete(plannerPrompt(
        'repair',
        failedStep?.description || failedStep?.tool || 'Repair failed task step',
        context,
        toolCatalog(toolRegistry),
        `FAILED STEP:\n${JSON.stringify(failedStep || {})}\nERROR:\n${String(errorInfo || '')}\nRepair must avoid repeating irreversible side effects unless the tool explicitly requires it.`,
      ));
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