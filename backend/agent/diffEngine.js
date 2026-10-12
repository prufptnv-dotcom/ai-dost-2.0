/**
 * Smart Diff Engine for Autonomous Agents
 * Layered matching to gracefully handle LLM formatting drift.
 */

class DiffEngine {
  /**
   * Public entry point: runs the strategy chain, then — ONLY on total failure —
   * salvages a double-escaped SEARCH blob (E2E run #16). The planner prompt
   * instructs "escape newlines as \\n" and the 7b model over-applies it: the
   * whole SEARCH arrives as ONE line of literal backslash-n text (realNL=false),
   * so every line-sequence strategy fails before comparing a single real line.
   * Such a blob (no real newline anywhere + contains \n/\r/\t escapes) is
   * unescaped and the chain retried ONCE; only a UNIQUE unescaped match may
   * write. A legitimate single-line search (e.g. console.log("a\\nb")) still
   * matches on the primary path and never reaches the salvage, and an
   * unescaped blob that matches nothing returns the ORIGINAL honest error.
   * @param {string} originalContent
   * @param {string} searchBlock
   * @param {string} replaceBlock
   * @param {string|object} [options] Optional expectedSourceHash or options object { expectedSourceHash }
   * @returns { success: boolean, newContent?: string, strategy?: string, confidence?: number, error?: string, code?: string, salvaged?: string }
   */
  static apply(originalContent, searchBlock, replaceBlock, options = {}) {
    const result = this._applyStrategies(originalContent, searchBlock, replaceBlock, options);
    if (result.success) return result;
    if (typeof searchBlock === 'string' && !searchBlock.includes('\n') && /\\[nrt]/.test(searchBlock)) {
      const uSearch = this._unescapeEscapedText(searchBlock);
      const uReplace = typeof replaceBlock === 'string' ? this._unescapeEscapedText(replaceBlock) : replaceBlock;
      const retry = this._applyStrategies(originalContent, uSearch, uReplace, options);
      if (retry.success) return { ...retry, salvaged: 'literal-escapes' };
    }
    return result;
  }

  static _unescapeEscapedText(text) {
    return String(text).replace(/\\([nrt])/g, (_m, c) => (c === 'n' ? '\n' : c === 'r' ? '\r' : '\t'));
  }

  /**
   * Applies a search/replace block to original content with multiple fallback strategies.
   * @param {string} originalContent 
   * @param {string} originalContent 
   * @param {string} searchBlock 
   * @param {string} replaceBlock 
   * @param {string|object} [options] Optional expectedSourceHash or options object { expectedSourceHash }
   * @returns { success: boolean, newContent?: string, strategy?: string, confidence?: number, error?: string, code?: string }
   */
  static _applyStrategies(originalContent, searchBlock, replaceBlock, options = {}) {
    const expectedSourceHash = typeof options === 'string' ? options : options?.expectedSourceHash;
    if (expectedSourceHash) {
      const crypto = require('crypto');
      const currentHash = crypto.createHash('sha256').update(originalContent || '').digest('hex');
      // P12.6 (E2E runs #10/#12): models echo back the TRUNCATED display hash
      // from an earlier error ("b2ed7b76..." — dots included). Normalize and
      // accept a hex prefix of the live hash.
      const norm = String(expectedSourceHash).trim().replace(/[.]+$/, '').toLowerCase();
      const looksLikeHash = /^[0-9a-f]{8,64}$/.test(norm);
      // P12.7 (E2E run #13): ONLY a genuine hex value can express "the file
      // changed since analysis". Non-hex garbage ("existing", and in run #13
      // the literal template placeholder "$search_content_hash" the model sent
      // THREE times in a row) can never be "fixed" by retrying — rejecting it
      // just buried the REAL failure (SEARCH never matched the file) behind a
      // dead-end error. Treat non-hex as absent: the byte-exact SEARCH match
      // below still guards the patch, and a wrong-but-valid hash still rejects.
      if (looksLikeHash && !currentHash.startsWith(norm)) {
        return {
          success: false,
          code: 'STALE_PATCH',
          error: `Source conflict: File has changed since analysis. Expected hash ${norm.substring(0, 8)}... but found ${currentHash.substring(0, 8)}... — if you just read this file, that expected hash is WRONG (model-fabricated hex); resend with expectedSourceHash=${currentHash} (read_file's metadata.sourceHash has the full value) or OMIT expectedSourceHash entirely — the byte-exact SEARCH match still guards the patch.`,
          expectedHash: expectedSourceHash,
          actualHash: currentHash
        };
      }
    }

    if (!searchBlock) {
      return { success: false, error: 'Empty search block provided.' };
    }

    // Idempotency: If replaceBlock already exists and searchBlock does not exist at all,
    // the patch was likely already applied. Do not corrupt source.
    if (replaceBlock && searchBlock !== replaceBlock) {
      const searchCount = originalContent.split(searchBlock).length - 1;
      const replaceCount = originalContent.split(replaceBlock).length - 1;
      if (searchCount === 0 && replaceCount >= 1) {
        return {
          success: true,
          newContent: originalContent,
          strategy: 'idempotent-noop',
          confidence: 1.0,
          message: 'Patch already applied. No-op.'
        };
      }
    }

    // Determine the original line ending style to preserve it
    const isCRLF = originalContent.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';

    // 1. Exact Match
    let count = originalContent.split(searchBlock).length - 1;
    if (count === 1) {
      return { 
        success: true, 
        newContent: originalContent.replace(searchBlock, replaceBlock), 
        strategy: 'exact', 
        confidence: 1.0 
      };
    } else if (count > 1) {
      return { success: false, error: 'Ambiguous match: found multiple exact occurrences. Provide more context lines.' };
    }

    // Prepare line arrays
    const origLines = originalContent.split(/\r?\n/);
    const searchLines = searchBlock.split(/\r?\n/);
    const replaceLines = replaceBlock.split(/\r?\n/);

    // 2. Line-Ending Agnostic Match
    let matchIdx = this._findMatch(origLines, searchLines, (o, s) => o === s);
    if (matchIdx.count === 1) {
      return {
        success: true,
        newContent: this._replaceSlice(origLines, matchIdx.index, searchLines.length, replaceLines, newline),
        strategy: 'line-ending-normalized',
        confidence: 0.99
      };
    } else if (matchIdx.count > 1) {
      return { success: false, error: 'Ambiguous match after line-ending normalization.' };
    }

    // 3. Indentation & Trailing Whitespace Tolerant Match
    let matchIdxIndent = this._findMatch(origLines, searchLines, (o, s) => o.trim() === s.trim());
    if (matchIdxIndent.count === 1) {
      // Re-apply original indentation to the replacement lines if possible
      const startIdx = matchIdxIndent.index;
      const originalFirstLine = origLines[startIdx] || '';
      const searchFirstLine = searchLines[0] || '';
      
      const origIndentMatch = originalFirstLine.match(/^\s*/);
      const searchIndentMatch = searchFirstLine.match(/^\s*/);
      const origIndent = origIndentMatch ? origIndentMatch[0] : '';
      const searchIndent = searchIndentMatch ? searchIndentMatch[0] : '';
      
      // If the LLM stripped indentation, we can attempt to restore it on the replace block
      const adjustedReplace = replaceLines.map(line => {
        if (line.startsWith(searchIndent) && searchIndent.length < origIndent.length) {
           return origIndent.substring(searchIndent.length) + line;
        }
        return line;
      });

      return {
        success: true,
        newContent: this._replaceSlice(origLines, startIdx, searchLines.length, adjustedReplace, newline),
        strategy: 'indentation-tolerant',
        confidence: 0.9
      };
    } else if (matchIdxIndent.count > 1) {
      return { success: false, error: 'Ambiguous match after whitespace normalization.' };
    }

    // 3.5 Outer-whitespace-tolerant SUBSTRING match (E2E run #15): the
    // specialist's plan assumed pretty-printed 2-space JSON while package.json
    // had been written as SINGLE-LINE compact JSON — SEARCH  "scripts": {}
    // failed 8× in a row. Line-sequence strategies (exact/line-ending/indent/
    // fuzzy) all compare WHOLE lines, so a SEARCH that is a SUBSET of one line
    // can never hit. Strip the block's outer whitespace and try it as a raw
    // substring; unique occurrence only (raw exact already ran above, so this
    // only fires when outer indent/newlines were the difference).
    const searchFlat = searchBlock.trim();
    if (searchFlat && searchFlat !== searchBlock) {
      const flatCount = originalContent.split(searchFlat).length - 1;
      if (flatCount === 1) {
        const flatIdx = originalContent.indexOf(searchFlat);
        return {
          success: true,
          newContent: originalContent.slice(0, flatIdx) + replaceBlock + originalContent.slice(flatIdx + searchFlat.length),
          strategy: 'substring-indent-tolerant',
          confidence: 0.85
        };
      }
    }

    // 4. Fuzzy / Blank Line Tolerant Match
    // Sometimes LLMs skip or add blank lines within the search block.
    const origNonEmpty = origLines.map((l, i) => ({ text: l.trim(), index: i })).filter(l => l.text.length > 0);
    const searchNonEmpty = searchLines.map(l => l.trim()).filter(l => l.length > 0);

    if (searchNonEmpty.length > 0) {
      let fuzzyMatchCount = 0;
      let fuzzyMatchStartIndex = -1;
      let fuzzyMatchEndIndex = -1;

      for (let i = 0; i <= origNonEmpty.length - searchNonEmpty.length; i++) {
        let matches = true;
        for (let j = 0; j < searchNonEmpty.length; j++) {
          if (origNonEmpty[i + j].text !== searchNonEmpty[j]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          fuzzyMatchCount++;
          fuzzyMatchStartIndex = origNonEmpty[i].index;
          fuzzyMatchEndIndex = origNonEmpty[i + searchNonEmpty.length - 1].index;
        }
      }

      if (fuzzyMatchCount === 1) {
         const linesToReplace = (fuzzyMatchEndIndex - fuzzyMatchStartIndex) + 1;
         return {
            success: true,
            newContent: this._replaceSlice(origLines, fuzzyMatchStartIndex, linesToReplace, replaceLines, newline),
            strategy: 'fuzzy-blank-line-tolerant',
            confidence: 0.8
         };
      } else if (fuzzyMatchCount > 1) {
         return { success: false, error: 'Ambiguous fuzzy match. Search block is not unique.' };
      }
    }

    // P12.x (E2E run #11): this error is the ONLY feedback the repair planner
    // receives (generateRepairPlan forwards err.message) — steps in a plan
    // execute back-to-back with no LLM call in between, so a search written at
    // plan time cannot adapt to the file's real content. The model retried a
    // stale SEARCH 7x in a row, blind. Show it the actual content so the next
    // plan can copy VERBATIM.
    //
    // P12.6 (E2E run #12): docs/architecture.md was 2486 chars → the old 2000
    // cap excerpted it, so a whole-file rewrite could never copy the file
    // byte-for-byte (3 more failed attempts). Cap now matches read_file's
    // 8000-char view: anything the model CAN read is fully visible here, and
    // the error states the two legal recipes explicitly.
    const MAX_CONTENT = 8000;
    let excerpt = originalContent;
    let recipe;
    if (excerpt.length > MAX_CONTENT) {
      excerpt = `${excerpt.slice(0, 6000)}\n… [truncated — file is ${originalContent.length} chars — too big for a whole-file rewrite, use a SMALLER unique SEARCH block] …\n${excerpt.slice(-400)}`;
      recipe = 'Whole-file rewrite is impossible for a file this size — pick a small, unique block of the REAL file below as SEARCH (a few lines) and put your changes in REPLACE.';
    } else {
      recipe = 'Whole-file rewrite? Then SEARCH = the ENTIRE current content shown below (copy it byte-for-byte, including whitespace) and REPLACE = your new content. Partial edit? SEARCH = only the exact lines you are changing — and SEARCH must be text that is ACTUALLY in the file, never your new content.';
    }
    // P12.7 (E2E run #13): the model sent search:"$search_content" +
    // expectedSourceHash:"$search_content_hash" — it treats the tool as a
    // TEMPLATE ENGINE, expecting $vars to be substituted. Say so explicitly
    // when the SEARCH looks like a placeholder, before the general recipe.
    const placeholderMatch = String(searchBlock).match(/^\s*(\$\{?[A-Za-z_][\w.]*\}?|\{\{[^}]+\}\})/);
    const placeholderNote = placeholderMatch
      ? `SEARCH looks like a template placeholder ("${placeholderMatch[1].trim()}") — there is NO variable substitution here. SEARCH must be literal text copied byte-for-byte from the file you just read with read_file.\n`
      : '';
    return {
      success: false,
      error:
        'SEARCH block not found in file.\n' +
        placeholderNote +
        `${recipe}\n` +
        `--- CURRENT FILE CONTENT (${originalContent.length} chars) ---\n` +
        `${excerpt}\n` +
        '--- END FILE CONTENT ---'
    };
  }

  static _findMatch(origLines, searchLines, compareFn) {
    if (searchLines.length === 0) return { count: 0, index: -1 };
    let count = 0;
    let lastIndex = -1;

    for (let i = 0; i <= origLines.length - searchLines.length; i++) {
      let matches = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (!compareFn(origLines[i + j], searchLines[j])) {
          matches = false;
          break;
        }
      }
      if (matches) {
        count++;
        lastIndex = i;
      }
    }
    return { count, index: lastIndex };
  }

  static _replaceSlice(origLines, startIdx, deleteCount, insertLines, newline) {
    const before = origLines.slice(0, startIdx);
    const after = origLines.slice(startIdx + deleteCount);
    return [...before, ...insertLines, ...after].join(newline);
  }
}

module.exports = DiffEngine;
