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

    it('removes stale reverse edges when a file is emptied', () => {
        graph.addOrUpdate('/project/a.js', "require('./b.js')");
        assert.ok(graph.getAffectedFiles('/project/b.js').includes('/project/a.js'));

        graph.addOrUpdate('/project/a.js', '');
        assert.deepStrictEqual(graph.getAffectedFiles('/project/b.js'), []);
        assert.deepStrictEqual(Array.from(graph.nodes.get('/project/a.js').dependencies), []);
    });

    it('canonicalizes relative file paths and sorts affected results', () => {
        const relativeFile = path.join('tmp-dependency-graph', 'a.js');
        const absoluteFile = path.resolve(relativeFile).replace(/\\/g, '/');
        const dependency = path.resolve('tmp-dependency-graph', 'b.js').replace(/\\/g, '/');

        graph.addOrUpdate(relativeFile, "require('./b.js')");
        assert.ok(graph.nodes.has(absoluteFile));
        assert.deepStrictEqual(graph.getAffectedFiles(dependency), [absoluteFile]);
    });

    it('handles deep dependency chains iteratively without recursion overflow', () => {
        const count = 12000;
        for (let index = 0; index < count; index += 1) {
            const filePath = '/project/deep/' + index + '.js';
            const next = index + 1 < count ? ['/project/deep/' + (index + 1) + '.js'] : [];
            graph.nodes.set(filePath, {
                dependencies: new Set(next),
                dependents: new Set()
            });
        }

        assert.strictEqual(graph.detectCycle(), false);
        graph.nodes.get('/project/deep/' + (count - 1) + '.js').dependencies.add('/project/deep/0.js');
        assert.strictEqual(graph.detectCycle(), true);
    });
});