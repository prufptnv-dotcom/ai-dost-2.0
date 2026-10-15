/**
 * P2 proof: old substring scorer vs new BM25, on a realistic repo.
 * Demonstrates the concrete retrieval failures the old scorer had.
 */
const path = require('path');
const codeContext = require(path.join(__dirname, '..', 'backend', 'services', 'codeContext'));

// A small but realistic project: hook + components + server + config.
const repo = [
  {
    path: 'src/hooks/useTimer.js',
    content: [
      'import { useState, useEffect } from "react";',
      'export function useTimer(minutes = 25) {',
      '  const [remaining, setRemaining] = useState(minutes * 60);',
      '  const [running, setRunning] = useState(false);',
      '  useEffect(() => {',
      '    if (!running || remaining <= 0) return;',
      '    const id = setInterval(() => setRemaining(r => r - 1), 1000);',
      '    return () => clearInterval(id);',
      '  }, [running, remaining]);',
      '  return { remaining, running, setRunning };',
      '}',
    ].join('\n'),
  },
  {
    path: 'src/components/Timer.jsx',
    content: [
      'import { useTimer } from "../hooks/useTimer";',
      'export default function Timer() {',
      '  const { remaining, running, setRunning } = useTimer(25);',
      '  return <section className="timer">',
      '    <output>{remaining}</output>',
      '    <button onClick={() => setRunning(!running)}>Toggle</button>',
      '  </section>;',
      '}',
    ].join('\n'),
  },
  {
    path: 'src/components/SessionList.jsx',
    content: [
      'export default function SessionList({ sessions }) {',
      '  return <ul>{sessions.map((s, i) => <li key={i}>{s.label}</li>)}</ul>;',
      '}',
    ].join('\n'),
  },
  {
    path: 'server.js',
    content: [
      'import express from "express";',
      'import cors from "cors";',
      'const app = express();',
      'app.use(cors());',
      'app.get("/api/sessions", (req, res) => res.json([]));',
      'app.post("/api/sessions", (req, res) => res.json({ id: 1 }));',
      'app.listen(5000);',
    ].join('\n'),
  },
  {
    path: 'src/utils/helpers.js',
    content: 'export const cx = (...a) => a.filter(Boolean).join(" ");\nexport const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));',
  },
  {
    path: 'README.md',
    content: '# Pomodoro\nA focus timer built with React. Sessions are persisted server-side.',
  },
];

// ── The old scorer, verbatim from routes/agent.js (buildCodebaseIndex + scoreChunk)
function buildCodebaseIndexOld(projectFiles) {
  const chunks = [];
  for (const file of projectFiles || []) {
    const content = file.content || '';
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 20) {
      const chunk = lines.slice(i, i + 25).join('\n');
      if (chunk.trim().length > 20) chunks.push({ file: file.path, startLine: i + 1, text: chunk });
    }
  }
  return chunks;
}
function scoreChunkOld(chunk, query) {
  if (!query || !chunk.text) return 0;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const text = chunk.text.toLowerCase();
  const filename = chunk.file.toLowerCase();
  let score = 0;
  for (const word of words) {
    const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
    score += (text.match(wordRegex) || []).length * 3;
    if (filename.includes(word)) score += 5;
  }
  return Math.max(0, score);
}
function searchOld(query, projectFiles) {
  return buildCodebaseIndexOld(projectFiles)
    .map(c => ({ ...c, score: scoreChunkOld(c, query) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const queries = [
  ['clamp',                          'rare identifier: lives ONLY in utils/helpers.js'],
  ['session',                        'mid-frequency: server.js + SessionList.jsx'],
  ['setInterval countdown timer',    'concepts spread across hook + component'],
  ['cors',                           'rare package: only server.js'],
  ['cx join classes',                'the cx helper'],
  ['layout styling colors theme',     'NOT in the repo → both must return nothing'],
];

console.log('='.repeat(78));
console.log('QUERY'.padEnd(30), '| OLD (substring count)'.padEnd(26), '| NEW (BM25)');
console.log('='.repeat(78));

const EXPECTED = {
  clamp: 'src/utils/helpers.js',
  session: 'server.js',
  'setInterval countdown timer': 'src/hooks/useTimer.js',
  cors: 'server.js',
  'cx join classes': 'src/utils/helpers.js',
};

let oldMissed = 0, newMissed = 0, applicable = 0;

for (const [q, why] of queries) {
  const oldHits = searchOld(q, repo).map(h => h.file);
  const newHits = codeContext.search(codeContext.buildIndex(repo), q, { limit: 5 }).map(h => h.file);
  const fmt = (a) => (a.length ? a.map(f => f.replace(/^src\//, '')).join(', ') : '(nothing)');

  console.log(q);
  console.log('  old:', fmt(oldHits));
  console.log('  new:', fmt(newHits));
  console.log('  why:', why);

  const want = EXPECTED[q];
  if (want) {
    applicable++;
    const oldHit = oldHits[0] === want;
    const newHit = newHits[0] === want;
    if (!oldHit) oldMissed++;
    if (!newHit) newMissed++;
    console.log(`  top-1 ${oldHit ? '✓' : '✗'} old   ${newHit ? '✓' : '✗'} new   (expected ${want})`);
  } else {
    const oldNone = oldHits.length === 0, newNone = newHits.length === 0;
    console.log(`  both empty: old=${oldNone ? '✓' : '✗'} new=${newNone ? '✓' : '✗'}`);
  }
  console.log('');
}

console.log('='.repeat(78));
console.log(`TOP-1 ACCURACY  old: ${applicable - oldMissed}/${applicable}   new: ${applicable - newMissed}/${applicable}`);

console.log('\n--- CODE MAP the model now receives (there was no equivalent before) ---');
const ctx = codeContext.retrieveContext({ projectFiles: repo, query: 'setInterval countdown timer' });
console.log(ctx.block.split('\n').filter(l => l.includes('CODE MAP') || l.startsWith('- ')).join('\n'));
console.log('\n--- STATS ---');
console.log(JSON.stringify(ctx.stats, null, 2));