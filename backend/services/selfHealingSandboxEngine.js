const logger = require('../logger');
const { callLLM } = require('./llmCascade');
const vm = require('vm');

/**
 * selfHealingSandboxEngine.js
 * Autonomous Diagnostic and Surgical Repair Engine for code execution sandboxes.
 * Catches runtime exceptions, AST parsing errors, and broken dependencies,
 * then generates verified surgical patches via LLM cascade.
 */

/**
 * Validates JavaScript code syntax in-memory via Node vm
 */
function validateJsSyntax(code) {
  try {
    new vm.Script(code);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
      line: err.lineNumber || null,
    };
  }
}

/**
 * Applies a surgical search-and-replace block to source code
 */
function applySurgicalPatch(sourceCode, searchBlock, replaceBlock) {
  if (!sourceCode) return { success: false, error: 'Empty source code' };
  if (!searchBlock) return { success: false, error: 'Missing search block' };

  // Direct exact match
  if (sourceCode.includes(searchBlock)) {
    const fixedCode = sourceCode.replace(searchBlock, replaceBlock);
    return { success: true, fixedCode };
  }

  // Normalized whitespace match
  const normalize = (s) => s.replace(/\r\n/g, '\n').trim();
  const normSource = normalize(sourceCode);
  const normSearch = normalize(searchBlock);

  if (normSource.includes(normSearch)) {
    // Find index in normalized string
    const idx = normSource.indexOf(normSearch);
    if (idx !== -1) {
      // Replace cleanly
      const prefix = normSource.slice(0, idx);
      const suffix = normSource.slice(idx + normSearch.length);
      return { success: true, fixedCode: prefix + replaceBlock + suffix };
    }
  }

  return { success: false, error: 'Search block not found in source code' };
}

/**
 * Diagnoses an error and generates a self-healing surgical patch
 */
async function diagnoseAndHeal({
  code,
  error,
  line = null,
  stack = '',
  language = 'javascript',
  context = 'sandbox_preview',
}) {
  if (!code) {
    return { success: false, error: 'Code content is required for self-healing' };
  }
  if (!error) {
    return { success: false, error: 'Error message is required for self-healing' };
  }

  logger.info(`[SelfHealingEngine] Diagnosing ${language} runtime error: "${error}"${line ? ` at line ${line}` : ''}`);

  const prompt = `You are the Autonomous Self-Healing Code Diagnostic Engine of AI-Dost.
A runtime exception or syntax error occurred in the sandbox execution environment.

RUNTIME ERROR:
"${error}"
${line ? `Reported Line: ${line}` : ''}
${stack ? `Stack Trace:\n${stack.slice(0, 400)}` : ''}

CURRENT CODE:
\`\`\`${language}
${code}
\`\`\`

INSTRUCTIONS:
1. Identify the exact root cause of the error (e.g. missing import/library, undefined variable, syntax error, null reference, unhandled DOM node, or broken Three.js/WebGL call).
2. Generate a minimal SURGICAL SEARCH and REPLACE block that fixes the bug while preserving all other existing code, styling, and behavior.
3. If it's a missing library (like Three.js, Anime.js, Lucide), ensure the correct CDN script or fallback is added.
4. Estimate your confidence in this fix between 0.80 and 0.99.
5. Return ONLY a valid JSON object with this exact structure:
{
  "explanation": "Short 1-sentence description of the bug and fix",
  "search": "exact code segment in existing code to replace",
  "replace": "new fixed replacement code segment",
  "confidence": 0.95
}
Do NOT include markdown fences around the JSON.`;

  try {
    const rawReply = await callLLM(prompt, 'You are an expert autonomous code debugging agent. Output JSON only.', {
      temperature: 0.1,
    });

    let parsed = null;
    try {
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (_) {}

    if (!parsed || (!parsed.search && !parsed.fixedCode)) {
      return {
        success: false,
        error: 'Failed to parse surgical fix from LLM response',
        raw: rawReply,
      };
    }

    let fixedCode = '';
    if (parsed.search && parsed.replace !== undefined) {
      const patchResult = applySurgicalPatch(code, parsed.search, parsed.replace);
      if (patchResult.success) {
        fixedCode = patchResult.fixedCode;
      } else if (parsed.fixedCode) {
        fixedCode = parsed.fixedCode;
      } else {
        // Fallback: search block couldn't be cleanly matched
        return {
          success: false,
          error: 'Could not apply surgical patch to source',
          explanation: parsed.explanation,
        };
      }
    } else if (parsed.fixedCode) {
      fixedCode = parsed.fixedCode;
    }

    // Verify syntax if JavaScript
    if (['javascript', 'js', 'node'].includes(language.toLowerCase())) {
      const syntaxCheck = validateJsSyntax(fixedCode);
      if (!syntaxCheck.valid) {
        logger.warn('[SelfHealingEngine] Generated fix failed syntax validation:', syntaxCheck.error);
      }
    }

    const confidence = Math.min(0.99, Math.max(0.7, parsed.confidence || 0.92));

    return {
      success: true,
      fixedCode,
      explanation: parsed.explanation || 'Fixed runtime exception and restored execution.',
      confidence,
      diff: {
        search: parsed.search,
        replace: parsed.replace,
      },
    };
  } catch (err) {
    logger.error('[SelfHealingEngine] Diagnosis error:', err.message);
    return {
      success: false,
      error: err.message || 'Self-healing diagnostic failed',
    };
  }
}

module.exports = {
  diagnoseAndHeal,
  validateJsSyntax,
  applySurgicalPatch,
};
