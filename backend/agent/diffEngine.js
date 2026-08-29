/**
 * Smart Diff Engine for Autonomous Agents
 * Layered matching to gracefully handle LLM formatting drift.
 */

class DiffEngine {
  /**
   * Applies a search/replace block to original content with multiple fallback strategies.
   * @param {string} originalContent 
   * @param {string} searchBlock 
   * @param {string} replaceBlock 
   * @returns { success: boolean, newContent?: string, strategy?: string, confidence?: number, error?: string }
   */
  static apply(originalContent, searchBlock, replaceBlock) {
    if (!searchBlock) {
      return { success: false, error: 'Empty search block provided.' };
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

    return { 
      success: false, 
      error: 'SEARCH block not found in file. Ensure the block exactly matches the target file.' 
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
