const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const DependencyGraph = require('../agent/dependency/DependencyGraph');

describe('DependencyGraph', () => {
    let graph;
    beforeEach(() => { graph = new DependencyGraph(); });

    it('should add files and return affected files', () => {
        const affected = graph.addOrUpdate('/project/foo.js', "require('./bar.js')");
        assert.ok(Array.isArray(affected));
    });

    it('should detect cycles', () => {
        const aPath = path.resolve('/project/a.js');
        const bPath = path.resolve('/project/b.js');
        graph.addOrUpdate(aPath, "require('./b.js')");
        graph.addOrUpdate(bPath, "require('./a.js')");
        assert.strictEqual(graph.detectCycle(), true);
    });
});