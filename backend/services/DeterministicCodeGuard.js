const path = require('path');
const verifierService = require('./verifierService');

// Tiny local WASM policy gate: accepts a positive deterministic grammar score.
const WASM_POLICY = Uint8Array.from([
  0, 97, 115, 109, 1, 0, 0, 0,
  1, 6, 1, 96, 1, 127, 1, 127,
  3, 2, 1, 0,
  7, 10, 1, 6, 97, 99, 99, 101, 112, 116, 0, 0,
  10, 9, 1, 7, 0, 32, 0, 65, 0, 74, 11
]);

let wasmAccept;
try {
  wasmAccept = new WebAssembly.Instance(new WebAssembly.Module(WASM_POLICY)).exports.accept;
} catch (error) {
  throw new Error(`Deterministic WASM guard unavailable: ${error.message}`);
}

class DeterministicCodeGuard {
  guard(filePath, content, options = {}) {
    const source = String(content ?? '');
    const verification = verifierService.verifyCode(filePath, source, options);
    const grammarScore = verification.valid ? 1 : 0;
    const accepted = Boolean(wasmAccept(grammarScore));
    if (!accepted) {
      return {
        accepted: false,
        reason: 'WASM grammar policy rejected candidate code',
        filePath,
        diagnostics: verification.diagnostics || [],
        verification,
      };
    }
    return { accepted: true, filePath, grammarScore, verification };
  }

  /**
   * P12.x (E2E run #10): guard rejections surfaced to the model as the bare
   * string "Code rejected before persistence: WASM grammar policy rejected
   * candidate code" while the actual parser diagnostic (Unclosed string / line
   * info) sat in `diagnostics` where no prompt ever saw it — the model guessed
   * blindly 4x on the same file and burned its repair budget. Surface the first
   * diagnostic in the message so re-planning can act on it.
   */
  rejectionDetail(guardResult) {
    if (!guardResult) return 'policy rejected candidate code';
    const first = Array.isArray(guardResult.diagnostics)
      ? guardResult.diagnostics.find((d) => d && d.message)
      : null;
    if (!first) return guardResult.reason || 'policy rejected candidate code';
    const loc = Number.isFinite(first.line) ? ` (line ${first.line})` : '';
    return `${guardResult.reason} — ${first.message}${loc}`;
  }

  /**
   * P12.3 (E2E-verified): models occasionally emit ONE-LINE escaped blobs —
   * literal \n / \" sequences instead of real newlines/quotes (observed on a
   * portfolio run: package.json = 1 line, `{\n \"name\"...`). The raw text is
   * genuinely invalid so `guard` correctly rejects it — but a single unescape
   * makes it valid. Normalization is attempted ONLY after a rejection and the
   * unescaped variant must pass the SAME guard, so well-formed content is
   * never touched and a failed unescape never weakens the original verdict.
   * Returns { ...guardResult, content, normalized } — callers must persist
   * `content` (the accepted source), not the raw input.
   */
  guardWithNormalization(filePath, content, options = {}) {
    const source = String(content ?? '');
    const primary = this.guard(filePath, source, options);
    if (primary.accepted) return { ...primary, content: source, normalized: false };
    if (!/\\[nrt"'\\]/.test(source)) return { ...primary, content: source, normalized: false };

    const UNESCAPE = { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' };
    const unescaped = source.replace(/\\([nrt"'\\])/g, (m, ch) => UNESCAPE[ch] ?? m);
    if (unescaped === source) return { ...primary, content: source, normalized: false };

    const retry = this.guard(filePath, unescaped, options);
    if (retry.accepted) return { ...retry, content: unescaped, normalized: true };
    return { ...primary, content: source, normalized: false };
  }
}

module.exports = new DeterministicCodeGuard();