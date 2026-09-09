const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ArbitratorAgent = require('../agent/arbitration/ArbitratorAgent');
const TaskScheduler = require('../agent/concurrency/TaskScheduler');

describe('ArbitratorAgent', () => {
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-arbitrator-'));
    fs.writeFileSync(path.join(workspace, 'app.js'), 'good state', 'utf8');
  });

  afterEach(() => fs.rmSync(workspace, { recursive: true, force: true }));

  it('commits immutable operations and advances the version vector', () => {
    const arbitrator = new ArbitratorAgent();
    const operation = arbitrator.beginOperation({ workspacePath: workspace, agentId: 'coder', files: ['app.js'] });
    fs.writeFileSync(path.join(workspace, 'app.js'), 'better state', 'utf8');

    const result = arbitrator.commitOperation(operation, { success: true });

    assert.equal(result.success, true);
    assert.deepEqual(result.versionVector, { coder: 1 });
    assert.equal(arbitrator.getOpLog(workspace)[0].type, 'commit');
    assert.equal(Object.isFrozen(operation.snapshot), true);
  });

  it('rolls back a stale agent without calling a model', () => {
    const arbitrator = new ArbitratorAgent();
    const first = arbitrator.beginOperation({ workspacePath: workspace, agentId: 'coder-a', files: ['app.js'] });
    fs.writeFileSync(path.join(workspace, 'app.js'), 'best state', 'utf8');
    const firstCommit = arbitrator.commitOperation(first, { success: true });
    const staleVector = { ...first.baseVector };

    fs.writeFileSync(path.join(workspace, 'app.js'), 'bad concurrent state', 'utf8');
    const second = arbitrator.beginOperation({ workspacePath: workspace, agentId: 'coder-b', files: ['app.js'], versionVector: staleVector });

    assert.ok(second.conflict);
    assert.equal(fs.readFileSync(path.join(workspace, 'app.js'), 'utf8'), 'best state');
    assert.equal(arbitrator.getVersionVector(workspace).coderA, undefined);
    assert.deepEqual(firstCommit.versionVector, { 'coder-a': 1 });
    assert.equal(arbitrator.getOpLog(workspace).at(-1).type, 'rollback');
  });

  it('arbitrates two overlapping scheduler runs and preserves the first committed state', async () => {
    const arbitrator = new ArbitratorAgent();
    const firstScheduler = new TaskScheduler();
    const secondScheduler = new TaskScheduler();
    const task = (content) => [{ action: 'write_file', parameters: { path: 'app.js', content } }];
    const execute = (content) => async () => {
      await new Promise((resolve) => setTimeout(resolve, content === 'first agent' ? 5 : 15));
      fs.writeFileSync(path.join(workspace, 'app.js'), content, 'utf8');
      return { success: true };
    };

    const [firstResult, secondResult] = await Promise.all([
      firstScheduler.schedule(task('first agent'), execute('first agent'), { arbitrator, workspacePath: workspace, agentId: 'agent-a' }),
      secondScheduler.schedule(task('second agent'), execute('second agent'), { arbitrator, workspacePath: workspace, agentId: 'agent-b' }),
    ]);

    assert.equal(firstResult[0].success, true);
    assert.equal(secondResult[0].success, false);
    assert.equal(fs.readFileSync(path.join(workspace, 'app.js'), 'utf8'), 'first agent');
    assert.equal(arbitrator.getOpLog(workspace).filter((entry) => entry.type === 'rollback').length, 1);
  });
});