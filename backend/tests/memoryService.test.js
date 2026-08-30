const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const MemoryService = require('../services/memoryService');
const Database = require('better-sqlite3');
const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const { migrateLegacyMemory } = require('../db/legacyMemoryMigrator');
const fs = require('fs');
const path = require('path');

describe('MemoryService & Context Graph Integration', () => {
    let db;
    let memoryService;

    const DUMMY_PROJECT = 'test-proj-1';
    const DEFAULT_PROJECT = 'default';

    before(() => {
        db = new Database(':memory:');
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        const runner = new MigrationRunner(db);
        runner.runAll([migration001]);
        
        db.prepare(`INSERT OR IGNORE INTO projects (id, user_id, name, slug) VALUES (?, 'local-user', 'Test 1', 'test-1')`).run(DUMMY_PROJECT);
        
        memoryService = new MemoryService(db);
    });

    after(() => {
        db.close();
        
        const flagPath = path.join(__dirname, '../data/personal_brain_memory_migrated.flag');
        if(fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
    });

    test('addFeedbackLog creates a FEEDBACK_LOG node', () => {
        const node = memoryService.addFeedbackLog(DUMMY_PROJECT, {
            type: 'positive',
            category: 'test',
            message: 'great job'
        });

        assert.strictEqual(node.project_id, DUMMY_PROJECT);
        assert.strictEqual(node.node_type, 'FEEDBACK_LOG');
        assert.ok(node.id);
        
        const raw = JSON.parse(node.raw_ref);
        assert.strictEqual(raw.type, 'positive');
        assert.strictEqual(raw.message, 'great job');
    });

    test('addFeedbackLog with correction creates a LEARNING_RULE node too', () => {
        memoryService.addFeedbackLog(DUMMY_PROJECT, {
            type: 'negative',
            correction: 'Never use var'
        });

        const rules = memoryService.nodeDAO.listByProject(DUMMY_PROJECT, 'LEARNING_RULE');
        assert.ok(rules.find(r => r.content_summary === 'Never use var'));
    });

    test('addScannedFile creates a SCANNED_FILE_LOG node', () => {
        const node = memoryService.addScannedFile(DUMMY_PROJECT, 'index.js');
        assert.strictEqual(node.project_id, DUMMY_PROJECT);
        assert.strictEqual(node.node_type, 'SCANNED_FILE_LOG');
        assert.strictEqual(node.content_summary, 'index.js');
    });

    test('getProjectStats calculates feedback correctly', () => {
        const stats = memoryService.getProjectStats(DUMMY_PROJECT);
        assert.strictEqual(stats.totalFeedback, 2);
        assert.strictEqual(stats.positiveCount, 1);
        assert.strictEqual(stats.negativeCount, 1);
        assert.strictEqual(stats.rulesCount, 1);
        assert.strictEqual(stats.scannedFilesCount, 1);
        assert.strictEqual(stats.learnedRules[0], 'Never use var');
        assert.strictEqual(stats.scannedFiles[0], 'index.js');
    });

    test('Project scoping isolation', () => {
        const statsDefault = memoryService.getProjectStats(DEFAULT_PROJECT);
        assert.strictEqual(statsDefault.totalFeedback, 0); // test-proj-1 has the feedback, not default
    });

    test('Legacy JSON Migration idempotency and isolation', () => {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
        const flagPath = path.join(dataDir, 'personal_brain_memory_migrated.flag');
        if(fs.existsSync(flagPath)) fs.unlinkSync(flagPath);

        const MOCK_MEMORY = {
            totalFeedback: 1,
            positiveCount: 1,
            negativeCount: 0,
            feedbackLogs: [
                { id: '1', type: 'up', message: 'Legacy yay', timestamp: new Date().toISOString() }
            ],
            learnedRules: ['Legacy rule 1'],
            scannedFiles: ['legacy.js']
        };
        fs.writeFileSync(path.join(dataDir, 'personal_brain_memory.json'), JSON.stringify(MOCK_MEMORY));
        
        // Run migrator
        migrateLegacyMemory(db);
        
        const statsDefault = memoryService.getProjectStats(DEFAULT_PROJECT);
        assert.strictEqual(statsDefault.totalFeedback, 1);
        assert.strictEqual(statsDefault.learnedRules[0], 'Legacy rule 1');
        assert.strictEqual(statsDefault.scannedFiles[0], 'legacy.js');
        
        // Run again, should be idempotent
        migrateLegacyMemory(db);
        const statsDefault2 = memoryService.getProjectStats(DEFAULT_PROJECT);
        assert.strictEqual(statsDefault2.totalFeedback, 1); // no dupes
        
        // Cleanup mock json
        fs.unlinkSync(path.join(dataDir, 'personal_brain_memory.json'));
        if(fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
    });
});
