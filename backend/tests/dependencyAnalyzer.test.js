const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const DependencyAnalyzer = require('../agent/dependency/DependencyAnalyzer');

describe('DependencyAnalyzer', () => {
    it('should extract require and import statements from js code', () => {
        const code = "const fs = require('fs');\nimport path from 'path';\nconst { foo } = require('./foo');\nimport bar from '../utils/bar';";
        const filePath = '/project/src/index.js';
        
        const deps = DependencyAnalyzer.analyze(filePath, code);
        
        assert.ok(deps.length >= 2, 'Should find local dependencies');
        assert.ok(deps.some(d => d.includes('foo')), 'Should find ./foo');
        assert.ok(deps.some(d => d.includes('bar')), 'Should find ../utils/bar');
    });

    it('should ignore builtin node modules if not local', () => {
        const code = "const fs = require('fs');\nconst path = require('path');";
        const deps = DependencyAnalyzer.analyze('/project/index.js', code);
        assert.strictEqual(deps.length, 0, 'Should return 0 local dependencies');
    });
});