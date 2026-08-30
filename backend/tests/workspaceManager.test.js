const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const workspaceManager = require('../services/workspaceManager');
const projectService = require('../services/projectService');
const devServerManager = require('../sandbox/devServerManager');

describe('Phase 1.2 — Milestone 2: Workspace Lifecycle Consolidation Test Suite', () => {
  let testDb;
  let customManager;

  before(() => {
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');

    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    customManager = new workspaceManager.WorkspaceManager(testDb);
  });

  after(() => {
    if (testDb) {
      testDb.close();
    }
  });

  test('1. Resolution: Resolves existing and creates fresh workspace', async () => {
    const projId = `test_ws_${Date.now()}`;
    const res = await customManager.ensureWorkspace(projId, 'local-user');

    assert.ok(res);
    assert.strictEqual(res.project.id, projId);
    assert.strictEqual(res.workspace.project_id, projId);
    assert.strictEqual(res.diskPath, customManager.getDefaultDiskPath(projId));
    assert.ok(fs.existsSync(res.diskPath), 'Physical workspace directory must exist on disk');

    // Cleanup
    try { fs.rmSync(res.diskPath, { recursive: true, force: true }); } catch (_) {}
  });

  test('2. Idempotency: Repeated ensureWorkspace calls return identical workspace', async () => {
    const projId = `test_idem_${Date.now()}`;
    const res1 = await customManager.ensureWorkspace(projId, 'local-user');
    const res2 = await customManager.ensureWorkspace(projId, 'local-user');

    assert.strictEqual(res1.project.id, res2.project.id);
    assert.strictEqual(res1.workspace.id, res2.workspace.id);
    assert.strictEqual(res1.diskPath, res2.diskPath);

    try { fs.rmSync(res1.diskPath, { recursive: true, force: true }); } catch (_) {}
  });

  test('3. Concurrency: Concurrent ensureWorkspace calls resolve safely without race conditions', async () => {
    const projId = `test_concurrent_${Date.now()}`;
    const promises = [
      customManager.ensureWorkspace(projId, 'local-user'),
      customManager.ensureWorkspace(projId, 'local-user'),
      customManager.ensureWorkspace(projId, 'local-user')
    ];

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].workspace.id, results[1].workspace.id);
    assert.strictEqual(results[1].workspace.id, results[2].workspace.id);

    try { fs.rmSync(results[0].diskPath, { recursive: true, force: true }); } catch (_) {}
  });

  test('4. Restart Resolution: Resolves previously persisted workspace correctly', async () => {
    const projId = `test_restart_${Date.now()}`;
    const initial = await customManager.ensureWorkspace(projId, 'local-user');
    const initialDiskPath = initial.diskPath;

    // Simulate new instance / restart with same DB
    const restartedManager = new workspaceManager.WorkspaceManager(testDb);
    const resolved = restartedManager.getWorkspace(projId);

    assert.ok(resolved);
    assert.strictEqual(resolved.project_id, projId);
    assert.strictEqual(path.resolve(resolved.disk_path), initialDiskPath);

    try { fs.rmSync(initialDiskPath, { recursive: true, force: true }); } catch (_) {}
  });

  test('5. Path Security: Safe relative paths resolve correctly', () => {
    const projId = `test_paths_${Date.now()}`;
    customManager.ensureWorkspaceSync(projId, 'local-user');
    const wsRoot = customManager.getWorkspacePath(projId);

    const p1 = customManager.resolvePath(projId, 'src/App.jsx');
    assert.strictEqual(p1, path.join(wsRoot, 'src', 'App.jsx'));

    const p2 = customManager.resolvePath(projId, 'package.json');
    assert.strictEqual(p2, path.join(wsRoot, 'package.json'));

    try { fs.rmSync(wsRoot, { recursive: true, force: true }); } catch (_) {}
  });

  test('6. Path Security: Traversal sequences (..) are strictly rejected', () => {
    const projId = `test_sec_${Date.now()}`;
    customManager.ensureWorkspaceSync(projId, 'local-user');

    assert.throws(() => {
      customManager.resolvePath(projId, '../secret.txt');
    }, /ERR_PATH_TRAVERSAL/);

    assert.throws(() => {
      customManager.resolvePath(projId, '..\\secret.txt');
    }, /ERR_PATH_TRAVERSAL/);

    assert.throws(() => {
      customManager.resolvePath(projId, 'src/../../etc/passwd');
    }, /ERR_PATH_TRAVERSAL/);

    try { fs.rmSync(customManager.getWorkspacePath(projId), { recursive: true, force: true }); } catch (_) {}
  });

  test('7. Path Security: UNC network paths and external absolute paths are rejected', () => {
    const projId = `test_unc_${Date.now()}`;
    customManager.ensureWorkspaceSync(projId, 'local-user');

    assert.throws(() => {
      customManager.resolvePath(projId, '\\\\evil-server\\share\\malware.exe');
    }, /ERR_PATH_TRAVERSAL/);

    assert.throws(() => {
      customManager.resolvePath(projId, 'C:\\Windows\\System32\\calc.exe');
    }, /ERR_PATH_TRAVERSAL/);

    try { fs.rmSync(customManager.getWorkspacePath(projId), { recursive: true, force: true }); } catch (_) {}
  });

  test('8. Ownership: Enforces user ownership boundaries', () => {
    const projId = `test_owner_${Date.now()}`;
    customManager.ensureWorkspaceSync(projId, 'alice');

    // Correct user
    const wsAlice = customManager.getWorkspace(projId, 'alice');
    assert.ok(wsAlice);

    // Unauthorized user
    assert.throws(() => {
      customManager.getWorkspace(projId, 'mallory');
    }, /Access denied.*does not own project/);

    assert.throws(() => {
      customManager.resolvePath(projId, 'index.html', 'mallory');
    }, /Access denied.*does not own project/);

    try { fs.rmSync(customManager.getWorkspacePath(projId), { recursive: true, force: true }); } catch (_) {}
  });

  test('9. Metadata & Existence checks', () => {
    const projId = `test_meta_${Date.now()}`;
    customManager.ensureWorkspaceSync(projId, 'local-user');
    const wsRoot = customManager.getWorkspacePath(projId);

    // Write some sample files
    fs.writeFileSync(path.join(wsRoot, 'index.html'), '<html></html>');
    fs.mkdirSync(path.join(wsRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(wsRoot, 'src', 'main.js'), 'console.log("hello");');

    assert.strictEqual(customManager.workspaceExists(projId), true);

    const meta = customManager.getWorkspaceMetadata(projId);
    assert.strictEqual(meta.projectId, projId);
    assert.strictEqual(meta.existsOnDisk, true);
    assert.strictEqual(meta.fileCount, 2);
    assert.ok(meta.totalSizeBytes > 0);

    try { fs.rmSync(wsRoot, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(customManager.workspaceExists(projId), false);
  });

  test('10. Integration: ProjectService delegates to WorkspaceManager', () => {
    const projId = `test_proj_svc_${Date.now()}`;
    const { project, workspace } = projectService.resolveProject(projId, 'local-user');

    assert.ok(project);
    assert.ok(workspace);
    assert.strictEqual(workspace.project_id, projId);
    assert.strictEqual(path.resolve(workspace.disk_path), workspaceManager.getWorkspacePath(projId));

    try { fs.rmSync(workspace.disk_path, { recursive: true, force: true }); } catch (_) {}
  });

  test('11. Integration: DevServerManager delegates workspace resolution', () => {
    const projId = `test_dev_srv_${Date.now()}`;
    const wsPath = devServerManager._workspaceDir(projId);
    const canonicalPath = workspaceManager.getWorkspacePath(projId);

    assert.strictEqual(path.resolve(wsPath), path.resolve(canonicalPath));
  });
});
