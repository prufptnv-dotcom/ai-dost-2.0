const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const projectService = require('../services/projectService');
const artifactService = require('../services/artifactService');

describe('Phase 1.2 — Milestone 1: Universal Artifact Service & Pipeline Integration Test Suite', () => {
  let testDb;
  let testWsDir;
  let testDownloadsDir;
  let testUploadsDir;

  before(() => {
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');

    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    testWsDir = path.join(os.tmpdir(), 'agent-ws-test-art-proj');
    fs.mkdirSync(path.join(testWsDir, '.artifacts', 'verification'), { recursive: true });

    testDownloadsDir = path.resolve(path.join(__dirname, '../../frontend/public/downloads'));
    fs.mkdirSync(testDownloadsDir, { recursive: true });

    testUploadsDir = path.resolve(path.join(__dirname, '../uploads'));
    fs.mkdirSync(testUploadsDir, { recursive: true });
  });

  after(() => {
    try {
      if (fs.existsSync(testWsDir)) {
        fs.rmSync(testWsDir, { recursive: true, force: true });
      }
    } catch (_) {}
    if (testDb) {
      testDb.close();
    }
  });

  test('1. Successful File Registration & SHA-256 Calculation', () => {
    const testFile = path.join(testDownloadsDir, 'test_sample_doc.txt');
    const content = 'Hello AI-Dost Artifact Engine ' + Date.now();
    fs.writeFileSync(testFile, content);

    const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');

    const art = artifactService.registerFile({
      filePath: testFile,
      projectId: 'default',
      name: 'test_sample_doc.txt',
      type: 'document_txt',
      mimeType: 'text/plain',
      metadata: { test: true }
    });

    assert.ok(art);
    assert.ok(art.id.startsWith('art_'));
    assert.strictEqual(art.project_id, 'default');
    assert.strictEqual(art.name, 'test_sample_doc.txt');
    assert.strictEqual(art.type, 'document_txt');
    assert.strictEqual(art.mime_type, 'text/plain');
    assert.strictEqual(art.sha256, expectedSha256);
    assert.strictEqual(art.size_bytes, Buffer.from(content).length);

    fs.unlinkSync(testFile);
  });

  test('2. Missing File Throws Error', () => {
    assert.throws(() => {
      artifactService.registerFile({
        filePath: path.join(testDownloadsDir, 'non_existent_file.pdf'),
        projectId: 'default'
      });
    }, /File does not exist/);
  });

  test('3. Path Traversal & Sensitive File Security Rejection', () => {
    assert.throws(() => {
      artifactService.registerFile({
        filePath: '../../etc/passwd',
        projectId: 'default'
      });
    }, /Security error/);

    assert.throws(() => {
      artifactService.registerFile({
        filePath: path.join(testWsDir, '.env'),
        projectId: 'default'
      });
    }, /Security error/);
  });

  test('4. Idempotency: Re-registering Same File Returns Existing Artifact', () => {
    const testFile = path.join(testDownloadsDir, 'test_idempotent.docx');
    fs.writeFileSync(testFile, 'Docx content for idempotency');

    const art1 = artifactService.registerFile({
      filePath: testFile,
      projectId: 'default',
      type: 'document_docx'
    });

    const art2 = artifactService.registerFile({
      filePath: testFile,
      projectId: 'default',
      type: 'document_docx'
    });

    assert.strictEqual(art1.id, art2.id);
    assert.strictEqual(art1.sha256, art2.sha256);

    fs.unlinkSync(testFile);
  });

  test('5. Content Modification Updates/Replaces Artifact Entry', () => {
    const testFile = path.join(testDownloadsDir, 'test_versioning.csv');
    fs.writeFileSync(testFile, 'col1,col2\nval1,val2');

    const art1 = artifactService.registerFile({
      filePath: testFile,
      projectId: 'default',
      type: 'document_csv'
    });

    // Modify file content
    fs.writeFileSync(testFile, 'col1,col2,col3\nval1,val2,val3');
    const art2 = artifactService.registerFile({
      filePath: testFile,
      projectId: 'default',
      type: 'document_csv'
    });

    assert.notStrictEqual(art1.sha256, art2.sha256);
    assert.strictEqual(art2.storage_path, art1.storage_path);

    fs.unlinkSync(testFile);
  });

  test('6. Project Scoping and Artifact Isolation', () => {
    const fileA = path.join(testDownloadsDir, 'proj_a_file.pdf');
    fs.writeFileSync(fileA, 'Project A Report');

    const artA = artifactService.registerFile({
      filePath: fileA,
      projectId: 'proj_alpha',
      type: 'document_pdf'
    });

    const projAArtifacts = artifactService.listProjectArtifacts('proj_alpha');
    assert.strictEqual(projAArtifacts.length, 1);
    assert.strictEqual(projAArtifacts[0].id, artA.id);

    const projBArtifacts = artifactService.listProjectArtifacts('proj_beta');
    assert.strictEqual(projBArtifacts.length, 0);

    const crossAccess = artifactService.getArtifact(artA.id, 'proj_beta');
    assert.strictEqual(crossAccess, null, 'Cross-project artifact lookup must return null');

    fs.unlinkSync(fileA);
  });

  test('7. Document Generation Integration Pipeline', async () => {
    // Simulate document generation output
    const testDocName = `generated_report_${Date.now()}.docx`;
    const docPath = path.join(testDownloadsDir, testDocName);
    const docBuffer = Buffer.from('PK... Mock DOCX Office OpenXML Content ...PK');
    fs.writeFileSync(docPath, docBuffer);

    const registered = artifactService.registerFile({
      filePath: docPath,
      projectId: 'proj_report_test',
      name: testDocName,
      type: 'document_docx',
      metadata: { topic: 'Annual Financial Overview' }
    });

    assert.ok(registered);
    assert.strictEqual(registered.name, testDocName);
    assert.strictEqual(registered.type, 'document_docx');
    assert.strictEqual(registered.sha256, crypto.createHash('sha256').update(docBuffer).digest('hex'));

    // Verify lookup from database
    const retrieved = artifactService.getArtifact(registered.id, 'proj_report_test');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, registered.id);

    fs.unlinkSync(docPath);
  });

  test('8. Image Generation Integration Pipeline', async () => {
    const imgName = `gen-test-${Date.now()}.png`;
    const imgPath = path.join(testUploadsDir, imgName);
    const imgBuffer = Buffer.from('PNG... Mock 1024x768 Image Pixel Buffer ...PNG');
    fs.writeFileSync(imgPath, imgBuffer);

    const registered = artifactService.registerFile({
      filePath: imgPath,
      projectId: 'default',
      name: imgName,
      type: 'generated_image',
      mimeType: 'image/png',
      metadata: { prompt: 'Futuristic glassmorphic IDE interface' }
    });

    assert.ok(registered);
    assert.strictEqual(registered.type, 'generated_image');
    assert.strictEqual(registered.mime_type, 'image/png');
    assert.strictEqual(registered.sha256, crypto.createHash('sha256').update(imgBuffer).digest('hex'));

    fs.unlinkSync(imgPath);
  });

  test('9. Visual Verification Screenshot Registration Pipeline', async () => {
    const projId = `proj_shot_${Date.now()}`;
    const customWs = path.join(os.tmpdir(), `agent-ws-${projId}`);
    fs.mkdirSync(path.join(customWs, '.artifacts', 'verification'), { recursive: true });

    const shotName = `screenshot-test-${Date.now()}.png`;
    const shotPath = path.join(customWs, '.artifacts', 'verification', shotName);
    const shotBuffer = Buffer.from('PNG... FullPage Playwright Screenshot Buffer ...PNG');
    fs.writeFileSync(shotPath, shotBuffer);

    const registered = artifactService.registerFile({
      filePath: shotPath,
      projectId: projId,
      name: shotName,
      type: 'verification_screenshot',
      mimeType: 'image/png',
      metadata: { status: 'PASS', pageTitle: 'React App' }
    });

    assert.ok(registered);
    assert.strictEqual(registered.type, 'verification_screenshot');
    assert.strictEqual(registered.project_id, projId);
    assert.strictEqual(registered.sha256, crypto.createHash('sha256').update(shotBuffer).digest('hex'));

    // Check query by type
    const screenshots = artifactService.listProjectArtifacts(projId, 'verification_screenshot');
    assert.strictEqual(screenshots.length, 1);
    assert.strictEqual(screenshots[0].id, registered.id);

    try {
      fs.rmSync(customWs, { recursive: true, force: true });
    } catch (_) {}
  });
});
