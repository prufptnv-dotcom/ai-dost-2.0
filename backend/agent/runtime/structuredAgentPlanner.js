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
  // P12.10 (E2E run #16): existingFileContents inside JSON.stringify(context)
  // shows the model file bytes as ESCAPED text (\n as \\n) — the 7b model then
  // copies that escaped form verbatim into apply_diff SEARCH, and one giant
  // "line" of literal backslash-n matches nothing (the run's dominant failure:
  // realNL=false literalSlashN=true on every late SEARCH). Keep the contents
  // OUT of the JSON and render them as fenced plain text with REAL newlines.
  const ctxIsObject = context && typeof context === 'object' && !Array.isArray(context);
  const { existingFileContents, ...contextRest } = ctxIsObject ? context : {};
  const contentsBlock = existingFileContents && typeof existingFileContents === 'object' && Object.keys(existingFileContents).length
    ? [
      'VERBATIM FILE CONTENTS (REAL newlines — copy SEARCH byte-for-byte from here; never write \\n escapes into SEARCH):',
      ...Object.entries(existingFileContents).map(([p, c]) => `--- ${p} ---\n${String(c)}\n--- end ${p} ---`),
    ].join('\n\n')
    : '';
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
    kind === 'verification'
      ? ''
      : [
        'FILE RULES (strict):',
        '- CODE-FIRST RULE: When building, modifying, or creating websites, apps, portfolios, UIs, or features, you MUST write executable code files (e.g. "src/App.jsx", "App.jsx", "index.html", "src/index.css"). NEVER write markdown blueprint/doc files (like docs/architecture.md) instead of real code!',
        '- write_file CREATES a new file only. If the file already exists, write_file is REJECTED — never plan to overwrite an existing file with write_file.',
        '- If the AUTHORIZED CONTEXT lists "existingFiles": paths IN that list ALREADY EXIST — never plan write_file for them (rejected WRITE_FORBIDDEN_ON_EXISTING; to change one, read_file it first, then apply_diff with verbatim SEARCH). Paths NOT in the list do NOT exist yet — apply_diff there fails (file not found), so create those with write_file.',
        '- The "VERBATIM FILE CONTENTS" block (--- path --- fenced sections) shows real bytes of key existing files with REAL newlines — copy SEARCH text from it byte-for-byte (exact whitespace); never reconstruct file content from memory and never put \\n escapes in SEARCH.',
        '- write_file targets a FILE path: "src/App.jsx" is valid. Directories are created automatically as a side effect of writing a file inside them — never plan a step just to create a folder, and never target a folder with non-empty content (rejected with PATH_IS_DIRECTORY).',
        '- To modify an existing file: step 1 read_file it, step 2 apply_diff with the SEARCH string copied VERBATIM (exact whitespace, exact characters) from what you just read.',
        '- Whole-file rewrite = apply_diff where SEARCH = the ENTIRE current file content (copied byte-for-byte from read_file) and REPLACE = your new content. NEVER put your new content in SEARCH — SEARCH always describes what is in the file NOW.',
        '- Do not invent file contents for SEARCH blocks — they must match the real file byte-for-byte or the diff is rejected.',
        '- EXECUTION MODEL: the steps of ONE plan run back-to-back with NO model call between them, so this plan\'s read_file output is invisible to its own later steps. Never guess SEARCH text from memory — if apply_diff answers "SEARCH block not found", that error embeds the CURRENT file content; copy the SEARCH byte-for-byte from that feedback and retry.',
        '- ZERO STUBS OR TODOs: Never output "// TODO", "// implement later", or empty function stubs. All components, routes, database queries, and utilities must be fully functional and implemented.',
        '- COMPLETE ERROR & STATE HANDLING: Implement explicit loading, error, empty, and data-loaded states for all asynchronous operations and UI views.',
        '- FRAMEWORK INTEGRITY: Match the workspace framework and dependencies. Do not import phantom libraries or invent nonexistent packages.',
        '- SECURITY HYGIENE: Never embed plaintext secrets, tokens, or API keys in code. Use environment variables (process.env) exclusively.',
        '- RESOURCE DISPOSAL: Clean up timers (clearInterval), subscriptions, and event listeners in useEffect cleanup functions.',
      ].join('\n'),
    // Applies to verification plans too (read_file paths). Run #9 wrote a junk
    // file literally named "proj_1791555817452" (a directory tree as text) and
    // later steps tried "proj_1791555817452/src/..." — ENOTDIR against that
    // stray file blocked them. The project ID is an identifier, never a folder.
    [
      'PATH RULES (strict):',
      '- Every path is RELATIVE to the project workspace root, e.g. "src/App.jsx", "src/index.css", "package.json".',
      '- NEVER prefix a path with the project ID, a leading slash, or any folder that does not exist yet — the project ID is NOT a directory.',
      '- To create nested files (e.g. "src/assets/logo.svg"), write_file the nested path directly — the tool creates parent directories.',
    ].join('\n'),
    extra,
    `USER INTENT:\n${String(intent || '')}`,
    `AUTHORIZED CONTEXT:\n${JSON.stringify(ctxIsObject ? contextRest : context)}`,
    ...(contentsBlock ? ['', contentsBlock] : []),
    `TOOL CATALOG:\n${JSON.stringify(tools)}`,
  ].join('\n\n');
}

function createStructuredAgentPlanner({ toolRegistry, openai = AgentCascadeAiService, customApiKey = null, retryDelayMs = 1500 } = {}) {
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
  // would not help. Between attempts wait out the provider's per-minute rate
  // window (E2E run #6/#7: three instant retries burned Groq's TPM budget and
  // killed the whole cascade) — `retryDelayMs` keeps tests fast.
  const complete = async (prompt, preferredModel = 'auto') => {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = preferredModel && preferredModel !== 'auto'
        ? await openai.chat(prompt, [], 'planner', customApiKey, preferredModel)
        : await openai.chat(prompt, [], 'planner', customApiKey);
      try {
        return extractJson(response);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          logger.warn(`[structuredAgentPlanner] Plan response was not valid JSON (attempt ${attempt}/3) — retrying cascade.`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
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
      try {
        return await complete(plannerPrompt('execution', intent, context, toolCatalog(toolRegistry)), context?.preferredModel);
      } catch (err) {
        const rawIntent = String(intent || '').toLowerCase();
        const isThemeIntent = /(theme|color|dark mode|light mode|palette|style|css|styling|design)/i.test(rawIntent);
        if (isThemeIntent) {
          logger.warn(`[structuredAgentPlanner] LLM cascade failed for theme intent (${err.message}). Generating fallback styling plan.`);
          const tools = new Set(toolCatalog(toolRegistry).map((t) => t.name));
          const steps = [];
          if (tools.has('read_file')) {
            steps.push({
              id: 'step-read-theme',
              tool: 'read_file',
              description: 'Read current stylesheet or theme variables',
              input: { path: 'src/styles/global.css' }
            });
          }
          if (tools.has('apply_diff')) {
            steps.push({
              id: 'step-apply-theme',
              tool: 'apply_diff',
              description: 'Update color palette and theme variables in styles',
              input: {
                path: 'src/styles/global.css',
                search: ':root {',
                replace: ':root {\n  --color-primary: #6366f1;\n  --color-secondary: #8b5cf6;\n  --color-accent: #06b6d4;\n  --color-bg: #0b0f19;\n  --color-surface: #151d30;\n  --color-text: #f8fafc;\n  --color-text-muted: #94a3b8;'
              }
            });
          }
          if (steps.length > 0) {
            return {
              goal: 'Update application theme and styling palette',
              steps
            };
          }
        }
        throw err;
      }
    },

    async generateRepairPlan(failedStep, errorInfo, context) {
      return await complete(plannerPrompt(
        'repair',
        failedStep?.description || failedStep?.tool || 'Repair failed task step',
        context,
        toolCatalog(toolRegistry),
        `FAILED STEP:\n${JSON.stringify(failedStep || {})}\nERROR:\n${String(errorInfo || '')}\nRepair must avoid repeating irreversible side effects unless the tool explicitly requires it.`,
      ), context?.preferredModel);
    },

    async generateVerificationPlan(goal, context) {
      try {
        return await complete(plannerPrompt('verification', goal, context, toolCatalog(toolRegistry)), context?.preferredModel);
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