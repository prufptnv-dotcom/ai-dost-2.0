/**
 * P8 collabClient — pure helpers (URL + first-touch decision), static source
 * audits of the CopilotIDE wiring, and backend contract cross-checks.
 * yjs/y-websocket/y-monaco are mocked: this suite never opens a socket.
 */
const fs = require('fs');
const path = require('path');

jest.mock('yjs', () => ({ Doc: class Doc {} }));
jest.mock('y-websocket', () => ({ WebsocketProvider: class WebsocketProvider {} }));
jest.mock('y-monaco', () => ({ MonacoBinding: class MonacoBinding {} }));

const { collabWsUrl, syncInitialDecision } = require('../lib/collabClient');

const read = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const LIB = () => read('../lib/collabClient.js');
const IDE = () => read('../components/views/CopilotIDE.jsx');
const BACKEND = (...p) => fs.readFileSync(path.join(__dirname, '../../backend', ...p), 'utf8');

describe('collabWsUrl', () => {
  test('converts http backend base to ws and appends /yws', () => {
    expect(collabWsUrl('http://localhost:5000')).toBe('ws://localhost:5000/yws');
  });

  test('https -> wss (secure deployments)', () => {
    expect(collabWsUrl('https://aidost.example.com')).toBe('wss://aidost.example.com/yws');
  });

  test('falls back to NEXT_PUBLIC default when no base given', () => {
    expect(collabWsUrl('')).toBe('ws://localhost:5000/yws');
  });
});

describe('syncInitialDecision (first-touch reconciliation)', () => {
  test('same content -> noop', () => {
    expect(syncInitialDecision('abc', 'abc')).toBe('noop');
    expect(syncInitialDecision('', '')).toBe('noop');
  });

  test('empty doc + local text -> seed (client fills the doc)', () => {
    expect(syncInitialDecision('', 'const x = 1;')).toBe('seed');
  });

  test('doc has text (equal or different) -> replace (doc is live truth)', () => {
    expect(syncInitialDecision('server text', 'local old')).toBe('replace');
    // non-string junk treated as empty — never throws
    expect(syncInitialDecision(undefined, undefined)).toBe('noop');
    expect(syncInitialDecision(null, 'local')).toBe('seed');
    expect(syncInitialDecision('doc', null)).toBe('replace');
  });
});

describe('collabClient source contract', () => {
  test('binds per-file Y.Text keys and reconciles BEFORE constructing binding', () => {
    const src = LIB();
    expect(src).toContain('`file:${filePath}`');
    // order matters: decision applied before MonacoBinding is constructed
    const decisionIdx = src.indexOf('syncInitialDecision(');
    const bindIdx = src.indexOf('new MonacoBinding(');
    expect(decisionIdx).toBeGreaterThan(-1);
    expect(bindIdx).toBeGreaterThan(decisionIdx);
  });

  test('y-monaco is given a Set of editors (its actual signature)', () => {
    expect(LIB()).toMatch(/new MonacoBinding\([^)]*new Set\(\[editor\]\)/);
  });

  test('unbindProject disposes the old binding (no two Y.Texts on one model)', () => {
    const src = LIB();
    expect(src).toContain('unbindProject');
    expect(src).toMatch(/const prev = projectBindings\.get\(key\)[\s\S]{0,240}prev\.dispose\(\)/);
  });

  test('getCollab is browser-guarded (SSR must not construct a socket)', () => {
    expect(LIB()).toContain("typeof window === 'undefined'");
  });
});

describe('CopilotIDE P8 wiring', () => {
  test('imports the collab bindings it uses', () => {
    expect(IDE()).toContain("from '../../lib/collabClient'");
    expect(IDE()).toMatch(/import \{[^}]*bindCurrentModel[^}]*\} from '\.\.\/\.\.\/lib\/collabClient'/);
    expect(IDE()).toMatch(/unsubscribe|return unsub/, 'presence subscription cleans up');
  });

  test('rebinds on project/file switch and unbinds on cleanup', () => {
    const src = IDE();
    const effectIdx = src.indexOf('bindCurrentModel(projectId, editor, activePath)');
    expect(effectIdx).toBeGreaterThan(-1);
    expect(src.slice(effectIdx, effectIdx + 400)).toContain('unbindProject(projectId)');
    // deps: rebind exactly when project, active file, or editor tick changes
    expect(src.slice(effectIdx, effectIdx + 500)).toContain('[projectId, activePath, editorTick]');
  });

  test('mount path triggers editorTick to bind fresh instance', () => {
    const src = IDE();
    const mountIdx = src.indexOf('const handleEditorMount = (editor, monaco) => {');
    expect(mountIdx).toBeGreaterThan(-1);
    expect(src.slice(mountIdx, mountIdx + 900)).toContain('setEditorTick');
  });

  test('presence strip renders with testid and dedupes cursor-only churn', () => {
    const src = IDE();
    expect(src).toContain('data-testid="collab-presence"');
    expect(src).toContain('{collabPeers.map(p => (');
    // awareness fires per keystroke — signature gate must exist before setState
    const sigIdx = src.indexOf('const sig = list.map(p =>');
    const setIdx = src.indexOf('setCollabPeers(list)');
    expect(sigIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(sigIdx);
    expect(src.slice(sigIdx, setIdx)).toContain('if (sig === lastSig) return;');
  });
});

describe('P8 backend contract cross-check', () => {
  test('server claims /yws/ upgrades before preview/HMR guessing', () => {
    const src = BACKEND('server.js');
    expect(src).toMatch(/ywsMatch/);
    expect(src).toContain('__upgradeHandled = true');
    const claimIdx = src.indexOf('ywsMatch');
    // preview matcher anchors the OLD guessing block (regex-escaped slashes in
    // source, so search the match variable, not the URL text)
    const previewIdx = src.indexOf('const previewMatch =');
    expect(previewIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeLessThan(previewIdx);
  });

  test('agent writes are mirrored into the shared doc from send()', () => {
    const src = BACKEND('routes/agent.js');
    // anchor on the P9 record call (several `send` closures exist in this file)
    const recordIdx = src.indexOf('backgroundRuns.record(runId, data)');
    expect(recordIdx).toBeGreaterThan(-1);
    const abortIdx = src.indexOf('if (isAborted) return;', recordIdx);
    expect(abortIdx).toBeGreaterThan(recordIdx, 'record happens before the abort check');
    const window = src.slice(recordIdx - 400, abortIdx + 1);
    expect(window).toContain('collabDoc.applyFile(');
    expect(window).toContain("'file_written'");
  });

  test('collabDoc serves the y-websocket protocol with agent awareness', () => {
    const src = BACKEND('services/collabDoc.js');
    expect(src).toContain("require('y-protocols/sync')");
    expect(src).toContain('writeSyncStep1');
    expect(src).toContain("'AI-Dost Agent'");
    expect(src).toContain('collab_docs'); // persisted table (migration 012)
  });

  test('migration 012 registers collab_docs', () => {
    const migration = BACKEND('db/migrations/012_collab_docs.js');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS collab_docs');
    const dbIndex = BACKEND('db/index.js');
    expect(dbIndex).toContain("require('./migrations/012_collab_docs')");
    expect(dbIndex).toContain('migration012');
  });
});
