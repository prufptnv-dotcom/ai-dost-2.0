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
}

module.exports = new DeterministicCodeGuard();