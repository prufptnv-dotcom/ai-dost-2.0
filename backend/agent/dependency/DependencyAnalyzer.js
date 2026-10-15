const path = require('path');
const fs = require('fs');

class DependencyAnalyzer {
    static analyze(filePath, content) {
        const deps = new Set();
        // matches ES6 imports/exports: import X from './Y', export * from './Y'
        const importRegex = /(?:import|export)\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        // matches dynamic import(): import('./Y')
        const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        // matches CommonJS require(): require('./Y')
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        
        let match;
        const addDep = (m) => {
            if (m && m[1]) {
               // Only track relative/local dependencies, skip node_modules like 'react'
               if (m[1].startsWith('.')) {
                   deps.add(m[1]);
               }
            }
        };

        while ((match = importRegex.exec(content)) !== null) addDep(match);
        while ((match = dynamicRegex.exec(content)) !== null) addDep(match);
        while ((match = requireRegex.exec(content)) !== null) addDep(match);

        const dir = path.dirname(filePath);
        return Array.from(deps).map(d => this.resolveModulePath(dir, d)).filter(Boolean);
    }

    static resolveModulePath(dir, reqPath) {
        const fullPath = path.resolve(dir, reqPath);
        return fullPath; // Extension resolution is delegated to Graph
    }
}
module.exports = DependencyAnalyzer;
