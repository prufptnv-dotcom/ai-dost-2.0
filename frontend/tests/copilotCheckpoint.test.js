/**
 * Phase 1c — Devin-style /revert: pre-run checkpoints + fixed rollback payload.
 *
 * Covers:
 *  - rollbackTo posts the backend contract { checkpoint: { files }, projectId }
 *    (was `{ dir }` → always 400)
 *  - preRunCheckpointRef lifecycle (reset per run, set from snap, TDZ-safe)
 *  - done cards attach checkpointDir so the Revert button renders
 *  - git checkpoint POST /agent/checkpoint wired as the safety net
 *
 * Mutation-verified: revert payload to { dir } / drop checkpointDir / drop
 * api.post('/agent/checkpoint') → matching tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

const rollbackStart = SRC.indexOf('const rollbackTo = async');
const rollbackEnd = SRC.indexOf('const openProjectWizard', rollbackStart);
const ROLLBACK = SRC.slice(rollbackStart, rollbackEnd);

describe('rollbackTo — backend contract', () => {
  test('rollbackTo exists and posts checkpoint.files + projectId', () => {
    expect(rollbackStart).toBeGreaterThan(0);
    expect(rollbackEnd).toBeGreaterThan(rollbackStart);
    expect(ROLLBACK).toContain("api.post('/agent/rollback'");
    expect(ROLLBACK).toContain('checkpoint: { files: filesPayload }');
    expect(ROLLBACK).toContain('projectId');
  });

  test('old broken payload { dir } is gone', () => {
    expect(ROLLBACK).not.toMatch(/api\.post\('\/agent\/rollback',\s*\{\s*dir\s*\}/);
  });

  test('payload is size-capped (total 4MB, per-file 500KB)', () => {
    expect(ROLLBACK).toMatch(/4_000_000/);
    expect(ROLLBACK).toMatch(/500_000/);
  });

  test('local snapshot restore always happens; server sync only on success', () => {
    expect(ROLLBACK).toContain('handleRollbackSnapshot(snap)');
    expect(ROLLBACK).toMatch(/serverOk[\s\S]*loadWorkspaceFiles\(\)/);
    expect(ROLLBACK).toContain('Server rollback failed');
  });

  test('unknown snapshot id is surfaced, not silently ignored', () => {
    expect(ROLLBACK).toContain('Snapshot not found');
  });
});

describe('preRunCheckpointRef lifecycle', () => {
  test('declared at component top (before runCopilot/rollbackTo use)', () => {
    const declIdx = SRC.indexOf('const preRunCheckpointRef = useRef(null);');
    expect(declIdx).toBeGreaterThan(-1);
    expect(declIdx).toBeLessThan(rollbackStart);
    expect(declIdx).toBeLessThan(SRC.indexOf('const runCopilot = async'));
  });

  test('reset each run, then set from the pre-run snapshot id', () => {
    const runStart = SRC.indexOf('const runCopilot = async');
    const ckptCallIdx = SRC.indexOf("api.post('/agent/checkpoint'", runStart);
    const snapBlock = SRC.slice(runStart, ckptCallIdx);
    const resetIdx = snapBlock.indexOf('preRunCheckpointRef.current = null;');
    const setIdx = snapBlock.indexOf('preRunCheckpointRef.current = snap.id;');
    const snapsIdx = snapBlock.indexOf('setSnapshots(');
    expect(resetIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeLessThan(snapsIdx);   // reset before creating the new snap
    expect(setIdx).toBeGreaterThan(snapsIdx);  // id captured after push
  });

  test('both done cards attach checkpointDir', () => {
    const matches = SRC.match(/checkpointDir: preRunCheckpointRef\.current/g) || [];
    expect(matches).toHaveLength(2);
    // AiStudioResponseCard still renders the Revert button off message.checkpointDir
    expect(SRC).toContain('message.checkpointDir &&');
    expect(SRC).toContain('onRollback && onRollback(message.checkpointDir)');
  });
});

describe('git checkpoint wiring', () => {
  test('runCopilot fires POST /agent/checkpoint (best-effort, non-fatal)', () => {
    const runStart = SRC.indexOf('const runCopilot = async');
    const fetchIdx = SRC.indexOf("fetch(`${BACKEND}/api/agent/run`", runStart);
    const ckptIdx = SRC.indexOf("api.post('/agent/checkpoint'", runStart);
    expect(ckptIdx).toBeGreaterThan(-1);
    expect(ckptIdx).toBeLessThan(fetchIdx); // checkpoint created BEFORE the run
    expect(SRC.slice(ckptIdx, ckptIdx + 400)).toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(SRC.slice(ckptIdx, ckptIdx + 400)).toContain('projectId');
  });
});
