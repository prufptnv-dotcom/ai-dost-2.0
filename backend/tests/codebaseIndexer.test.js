const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CodebaseIndexer = require('../agent/codebaseIndexer');

describe('CodebaseIndexer - Comprehensive Intelligence Test Suite', () => {
  let tempDir;
  let indexer;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-indexer-test-'));
    indexer = new CodebaseIndexer({ maxFileSizeBytes: 100 * 1024 }); // 100 KB limit for test
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('1. Empty project indexing', async () => {
    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.scanned, 0);
    assert.strictEqual(progress.indexed, 0);

    const idx = indexer.getIndex(tempDir);
    assert.ok(idx);
    assert.strictEqual(idx.filesCount, 0);
  });

  test('2. Single JS file symbol and export parsing', async () => {
    const jsContent = `
import { helper } from './utils';
export function calculateSum(a, b) {
  return a + b;
}
export default calculateSum;
`;
    fs.writeFileSync(path.join(tempDir, 'main.js'), jsContent, 'utf-8');

    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.scanned, 1);
    assert.strictEqual(progress.indexed, 1);

    const meta = indexer.getFileMetadata(tempDir, 'main.js');
    assert.ok(meta);
    assert.strictEqual(meta.language, 'javascript');
    assert.ok(meta.symbols.some(s => s.name === 'calculateSum' && s.type === 'function' && s.exported));
    assert.ok(meta.exports.includes('calculateSum'));
  });

  test('3. TypeScript file with interface, type, enum, and arrow function', async () => {
    const tsContent = `
export interface UserProfile {
  id: string;
  name: string;
}
export type UserRole = 'admin' | 'user';
export enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE'
}
export const renderUser = (user: UserProfile) => {
  return user.name;
};
`;
    fs.writeFileSync(path.join(tempDir, 'types.ts'), tsContent, 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'types.ts');
    assert.ok(meta);
    assert.strictEqual(meta.language, 'typescript');
    assert.ok(meta.symbols.some(s => s.name === 'UserProfile' && s.type === 'interface'));
    assert.ok(meta.symbols.some(s => s.name === 'UserRole' && s.type === 'type'));
    assert.ok(meta.symbols.some(s => s.name === 'Status' && s.type === 'enum'));
    assert.ok(meta.symbols.some(s => s.name === 'renderUser' && s.type === 'function'));
  });

  test('4. Python file functions, classes, and imports', async () => {
    const pyContent = `
import math
from os import path

class DataProcessor:
    def process(self, data):
        return data

def calculate_metrics():
    return 100
`;
    fs.writeFileSync(path.join(tempDir, 'engine.py'), pyContent, 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'engine.py');
    assert.ok(meta);
    assert.strictEqual(meta.language, 'python');
    assert.ok(meta.symbols.some(s => s.name === 'DataProcessor' && s.type === 'class'));
    assert.ok(meta.symbols.some(s => s.name === 'calculate_metrics' && s.type === 'function'));
    assert.ok(meta.imports.some(i => i.source === 'math'));
    assert.ok(meta.imports.some(i => i.source === 'os'));
  });

  test('5. Nested directories scan', async () => {
    const srcDir = path.join(tempDir, 'src', 'components');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'Header.jsx'), 'export const Header = () => null;', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'src/components/Header.jsx');
    assert.ok(meta);
    assert.strictEqual(meta.path, 'src/components/Header.jsx');
  });

  test('6. Ignored directories (node_modules, .git, dist, .next)', async () => {
    const nodeModules = path.join(tempDir, 'node_modules', 'pkg');
    const gitDir = path.join(tempDir, '.git');
    const distDir = path.join(tempDir, 'dist');
    fs.mkdirSync(nodeModules, { recursive: true });
    fs.mkdirSync(gitDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });

    fs.writeFileSync(path.join(nodeModules, 'index.js'), 'module.exports = 1;', 'utf-8');
    fs.writeFileSync(path.join(gitDir, 'config'), 'repo config', 'utf-8');
    fs.writeFileSync(path.join(distDir, 'bundle.js'), 'bundle', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'app.js'), 'console.log("App");', 'utf-8');

    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.scanned, 1);
    assert.strictEqual(progress.indexed, 1);

    const idx = indexer.getIndex(tempDir);
    assert.strictEqual(idx.filesCount, 1);
    assert.ok(idx.files['app.js']);
    assert.strictEqual(idx.files['node_modules/pkg/index.js'], undefined);
  });

  test('7. Large file exclusion (> maxFileSizeBytes)', async () => {
    const smallFile = path.join(tempDir, 'small.js');
    const largeFile = path.join(tempDir, 'large.bin');
    fs.writeFileSync(smallFile, 'console.log("small");', 'utf-8');
    fs.writeFileSync(largeFile, Buffer.alloc(150 * 1024, 'x')); // 150 KB > 100 KB limit

    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.scanned, 2);
    assert.strictEqual(progress.indexed, 1);
    assert.strictEqual(progress.skipped, 1);
  });

  test('8. SHA-256 hash generation', async () => {
    const content = 'const secret = "ai-dost";';
    fs.writeFileSync(path.join(tempDir, 'hash_test.js'), content, 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'hash_test.js');
    assert.ok(meta);
    assert.strictEqual(meta.hash.length, 64);
    assert.match(meta.hash, /^[a-f0-9]{64}$/);
  });

  test('9. Incremental indexing (skips parsing unchanged files)', async () => {
    fs.writeFileSync(path.join(tempDir, 'file1.js'), 'const a = 1;', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'file2.js'), 'const b = 2;', 'utf-8');

    // First scan: 2 changed/parsed
    const p1 = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(p1.changed, 2);
    assert.strictEqual(p1.indexed, 2);

    // Second scan (no file changes): 0 changed, 2 indexed from cache
    const p2 = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(p2.changed, 0);
    assert.strictEqual(p2.indexed, 2);

    // Modify only 1 file
    fs.writeFileSync(path.join(tempDir, 'file2.js'), 'const b = 200; export function test() {}', 'utf-8');
    const p3 = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(p3.changed, 1);
    assert.strictEqual(p3.indexed, 2);
  });

  test('10. Deleted file detection in incremental indexing', async () => {
    const f1 = path.join(tempDir, 'file1.js');
    const f2 = path.join(tempDir, 'file2.js');
    fs.writeFileSync(f1, 'const a = 1;', 'utf-8');
    fs.writeFileSync(f2, 'const b = 2;', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    assert.strictEqual(indexer.getIndex(tempDir).filesCount, 2);

    // Delete file1
    fs.unlinkSync(f1);

    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.deleted, 1);
    assert.strictEqual(indexer.getIndex(tempDir).filesCount, 1);
    assert.strictEqual(indexer.getFileMetadata(tempDir, 'file1.js'), null);
  });

  test('11. Local import resolution (./, ../, extensions)', async () => {
    fs.writeFileSync(path.join(tempDir, 'utils.js'), 'export function format() {}', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'index.js'), 'import { format } from "./utils";', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'index.js');
    assert.ok(meta);
    assert.strictEqual(meta.imports.length, 1);
    assert.strictEqual(meta.imports[0].resolvedPath, 'utils.js');
  });

  test('12. Unresolved external dependency handling', async () => {
    fs.writeFileSync(path.join(tempDir, 'app.js'), 'import React from "react"; import axios from "axios";', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const meta = indexer.getFileMetadata(tempDir, 'app.js');
    assert.ok(meta);
    assert.strictEqual(meta.imports.length, 2);
    assert.strictEqual(meta.imports[0].resolvedPath, null);
    assert.strictEqual(meta.imports[1].resolvedPath, null);
  });

  test('13. Symbol search (findSymbol)', async () => {
    fs.writeFileSync(path.join(tempDir, 'service.js'), 'export class AuthService {}\nexport function loginUser() {}', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const results = indexer.findSymbol(tempDir, 'AuthService');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].file, 'service.js');
    assert.strictEqual(results[0].symbol.name, 'AuthService');
    assert.strictEqual(results[0].symbol.type, 'class');
  });

  test('14. File search (searchFiles)', async () => {
    fs.writeFileSync(path.join(tempDir, 'UserProfile.jsx'), 'export const UserProfile = () => null;', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'Dashboard.jsx'), 'export const Dashboard = () => null;', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const matches = indexer.searchFiles(tempDir, 'UserProfile');
    assert.ok(matches.length >= 1);
    assert.strictEqual(matches[0].path, 'UserProfile.jsx');
  });

  test('15. Dependency lookup (getDependencies)', async () => {
    fs.writeFileSync(path.join(tempDir, 'db.js'), 'export const db = {};', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'server.js'), 'import { db } from "./db"; import express from "express";', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const deps = indexer.getDependencies(tempDir, 'server.js');
    assert.strictEqual(deps.length, 2);
    assert.strictEqual(deps[0].resolvedPath, 'db.js');
    assert.strictEqual(deps[1].resolvedPath, null);
  });

  test('16. Dependent lookup (getDependents)', async () => {
    fs.writeFileSync(path.join(tempDir, 'config.js'), 'export const PORT = 5000;', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'server.js'), 'import { PORT } from "./config";', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'worker.js'), 'import { PORT } from "./config";', 'utf-8');

    await indexer.indexWorkspace(tempDir);
    const dependents = indexer.getDependents(tempDir, 'config.js');
    assert.strictEqual(dependents.length, 2);
    assert.ok(dependents.includes('server.js'));
    assert.ok(dependents.includes('worker.js'));
  });

  test('17. Path traversal protection', async () => {
    fs.writeFileSync(path.join(tempDir, 'safe.js'), 'const a = 1;', 'utf-8');
    await indexer.indexWorkspace(tempDir);

    assert.throws(() => {
      indexer.getFileMetadata(tempDir, '../../etc/passwd');
    }, /Path traversal/i);
  });

  test('18. Secret and credential file exclusion (.env, id_rsa, *.pem)', async () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET_KEY=12345', 'utf-8');
    fs.writeFileSync(path.join(tempDir, '.env.production'), 'API_KEY=xyz', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'cert.pem'), 'CERT_DATA', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'id_rsa'), 'PRIVATE_KEY', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'safe.js'), 'console.log("Safe");', 'utf-8');

    const progress = await indexer.indexWorkspace(tempDir);
    assert.strictEqual(progress.scanned, 1);
    assert.strictEqual(progress.indexed, 1);

    const idx = indexer.getIndex(tempDir);
    assert.strictEqual(idx.filesCount, 1);
    assert.ok(idx.files['safe.js']);
    assert.strictEqual(idx.files['.env'], undefined);
    assert.strictEqual(idx.files['cert.pem'], undefined);
    assert.strictEqual(idx.files['id_rsa'], undefined);
  });
});
