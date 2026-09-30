// Minimal unified-line diff (LCS) — no external dep. Used by the Devin-style
// per-file patch view in TaskActivityOverlay and tests.

function splitLines(text) {
  if (text === null || text === undefined || text === '') return [];
  return String(text).replace(/\r\n/g, '\n').split('\n');
}

// Cap for the LCS DP table (middle segment product). Beyond this we fall back
// to delete-all + add-all, which stays correct (just less granular).
const MAX_LCS_CELLS = 250000;

/**
 * @returns {Array<{type:'ctx'|'add'|'del', text:string}>}
 */
export function diffLines(oldText, newText) {
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops = [];

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  for (let i = 0; i < start; i += 1) ops.push({ type: 'ctx', text: a[i] });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  if (midA.length > 0 && midB.length > 0 && midA.length * midB.length <= MAX_LCS_CELLS) {
    const n = midA.length;
    const m = midB.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
      const row = dp[i];
      const next = dp[i + 1];
      for (let j = m - 1; j >= 0; j -= 1) {
        row[j] = midA[i] === midB[j] ? next[j + 1] + 1 : Math.max(next[j], row[j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        ops.push({ type: 'ctx', text: midA[i] });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'del', text: midA[i] });
        i += 1;
      } else {
        ops.push({ type: 'add', text: midB[j] });
        j += 1;
      }
    }
    while (i < n) {
      ops.push({ type: 'del', text: midA[i] });
      i += 1;
    }
    while (j < m) {
      ops.push({ type: 'add', text: midB[j] });
      j += 1;
    }
  } else {
    midA.forEach((text) => ops.push({ type: 'del', text }));
    midB.forEach((text) => ops.push({ type: 'add', text }));
  }

  for (let i = endA; i < a.length; i += 1) ops.push({ type: 'ctx', text: a[i] });
  return ops;
}

export function diffStats(ops) {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added += 1;
    else if (op.type === 'del') removed += 1;
  }
  return { added, removed };
}
