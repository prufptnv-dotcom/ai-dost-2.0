/**
 * TestGenerationResult - Immutable/Structured result container for test generation and execution
 */

class TestGenerationResult {
  constructor(data = {}) {
    this.planId = data.planId || null;
    this.projectId = data.projectId || 'default';
    this.status = data.status || (data.ok ? 'GENERATED' : 'FAILED');
    this.ok = data.ok !== undefined ? data.ok : this.status === 'GENERATED' || this.status === 'EXECUTED';
    this.framework = data.framework || 'node:test';
    this.language = data.language || 'javascript';
    this.testType = data.testType || 'unit';
    this.files = Array.isArray(data.files) ? data.files : [];
    this.testCount = typeof data.testCount === 'number' ? data.testCount : 0;
    this.execution = data.execution || null;
    this.error = data.error || null;
    this.metadata = data.metadata || {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  isSuccess() {
    return this.ok && !this.error;
  }

  toJSON() {
    return {
      planId: this.planId,
      projectId: this.projectId,
      status: this.status,
      ok: this.ok,
      framework: this.framework,
      language: this.language,
      testType: this.testType,
      files: this.files.map(f => ({
        fileName: f.fileName,
        path: f.path,
        testCount: f.testCount,
        testType: f.testType
      })),
      testCount: this.testCount,
      execution: this.execution,
      error: this.error,
      metadata: this.metadata
    };
  }
}

TestGenerationResult.TestGenerationResult = TestGenerationResult;
module.exports = TestGenerationResult;
