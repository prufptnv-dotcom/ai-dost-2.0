const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CodebaseIndexer = require('../agent/codebaseIndexer');
const ContextRetriever = require('../agent/contextRetriever');

test('ContextRetriever Test Suite', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-retriever-test-'));
  const indexer = new CodebaseIndexer({ maxFileSizeBytes: 100 * 1024 });
  const legacySearchMock = async (query) => {
    if (query.includes('legacy_trigger')) {
       return { results: [{ file: 'src/legacy_file.js' }] };
    }
    return { results: [] };
  };
  const retriever = new ContextRetriever({ codebaseIndexer: indexer, legacySearch: legacySearchMock });

  // Setup mock files
  fs.mkdirSync(path.join(tempDir, 'src', 'auth'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'src', 'components'), { recursive: true });

  fs.writeFileSync(path.join(tempDir, 'src/auth/login.js'), `
import { validateToken } from './tokenUtils';
export function loginUser() {
   console.log("login");
}
  `, 'utf-8');

  fs.writeFileSync(path.join(tempDir, 'src/auth/tokenUtils.js'), `
export function validateToken() {
   // validation logic
   let a = 1;
   let b = 2;
   let c = 3;
   return a + b + c;
}
export function verify_signature() {
   return true;
}
  `, 'utf-8');

  fs.writeFileSync(path.join(tempDir, 'src/components/LoginForm.js'), `
import { loginUser } from '../auth/login';
export class LoginForm {
   render() {}
}
  `, 'utf-8');

  fs.writeFileSync(path.join(tempDir, 'src/legacy_file.js'), `
export const OLD = 1;
  `, 'utf-8');

  fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET=123', 'utf-8');

  await indexer.indexWorkspace(tempDir);

  await t.test('1. Exact file match', async () => {
    const res = await retriever.retrieve(tempDir, 'Fix src/auth/login.js bug');
    assert.strictEqual(res.candidates[0].path, 'src/auth/login.js');
    assert.ok(res.candidates[0].reasons.includes('exact_path_match'));
  });

  await t.test('2. Filename match', async () => {
    const res = await retriever.retrieve(tempDir, 'Fix the authentication login component');
    const loginMatches = res.candidates.filter(c => c.path.includes('login.js') || c.path.includes('LoginForm.js'));
    assert.ok(loginMatches.length > 0);
  });

  await t.test('3. Symbol match', async () => {
    const res = await retriever.retrieve(tempDir, 'Fix validateToken');
    assert.strictEqual(res.candidates[0].path, 'src/auth/tokenUtils.js');
    assert.ok(res.candidates[0].reasons.includes('symbol_exact_match'));
  });

  await t.test('4. camelCase tokenization', () => {
    const tokens = retriever.tokenize('UserAuthenticationService');
    assert.ok(tokens.includes('user'));
    assert.ok(tokens.includes('authentication'));
    assert.ok(tokens.includes('service'));
  });

  await t.test('5. snake_case tokenization', () => {
    const tokens = retriever.tokenize('verify_signature');
    assert.ok(tokens.includes('verify'));
    assert.ok(tokens.includes('signature'));
  });

  await t.test('6. kebab-case tokenization', () => {
    const tokens = retriever.tokenize('login-form-component');
    assert.ok(tokens.includes('login'));
    assert.ok(tokens.includes('form'));
  });

  await t.test('7. Stop word filtering', () => {
    const tokens = retriever.tokenize('fix the login problem please');
    assert.ok(!tokens.includes('fix'));
    assert.ok(!tokens.includes('the'));
    assert.ok(!tokens.includes('please'));
    assert.ok(tokens.includes('login'));
  });

  await t.test('8 & 9. Import and Dependent relationship boosting', async () => {
    // Top candidate might be login.js, it imports tokenUtils.js and is imported by LoginForm.js
    const res = await retriever.retrieve(tempDir, 'loginUser function');
    const paths = res.candidates.map(c => c.path);
    assert.ok(paths.includes('src/auth/tokenUtils.js'), 'Import dependency should be included');
    assert.ok(paths.includes('src/components/LoginForm.js'), 'Dependent relationship should be included');
    const tokenUtilsCand = res.candidates.find(c => c.path === 'src/auth/tokenUtils.js');
    assert.ok(tokenUtilsCand.reasons.includes('import_dependency'));
    const formCand = res.candidates.find(c => c.path === 'src/components/LoginForm.js');
    assert.ok(formCand.reasons.includes('dependent_relationship'));
  });

  await t.test('10. Legacy search contribution', async () => {
    const res = await retriever.retrieve(tempDir, 'legacy_trigger');
    const legacyCand = res.candidates.find(c => c.path === 'src/legacy_file.js');
    assert.ok(legacyCand);
    assert.ok(legacyCand.reasons.includes('legacy_search_match'));
  });

  await t.test('11. Duplicate candidate merging (accumulated score)', async () => {
    // If a task hits exact match, symbol match, and filename match, the score accumulates
    const res = await retriever.retrieve(tempDir, 'loginUser login.js');
    const cand = res.candidates.find(c => c.path === 'src/auth/login.js');
    assert.ok(cand.reasons.length >= 2);
  });

  await t.test('12. Deterministic ranking', async () => {
    const res1 = await retriever.retrieve(tempDir, 'login');
    const res2 = await retriever.retrieve(tempDir, 'login');
    assert.deepStrictEqual(res1.candidates.map(c => c.path), res2.candidates.map(c => c.path));
  });

  await t.test('13. topK default', async () => {
    const res = await retriever.retrieve(tempDir, 'a');
    assert.ok(res.candidates.length <= 12);
  });

  await t.test('14. topK maximum 50', async () => {
    // Generate many files
    for (let i = 0; i < 60; i++) {
      fs.writeFileSync(path.join(tempDir, `test_file_${i}.js`), 'console.log("test");', 'utf-8');
    }
    await indexer.indexWorkspace(tempDir);
    const res = await retriever.retrieve(tempDir, 'test_file', { topK: 100 });
    assert.strictEqual(res.candidates.length, 50);
  });

  await t.test('15. Context size limit', async () => {
    const res = await retriever.retrieve(tempDir, 'test_file', { topK: 50, totalBudget: 200 });
    let totalLen = 0;
    for (const c of res.context) {
       totalLen += c.preview.length;
    }
    console.log("BUDGET TEST", "CANDS:", res.candidates.length, "CTX:", res.context.length, "LEN:", totalLen);
    assert.ok(totalLen <= 200 + 100, 'Context total budget should be roughly enforced');
  });

  await t.test('16. Per-file preview limit', async () => {
    fs.writeFileSync(path.join(tempDir, 'large_preview.js'), 'a'.repeat(2000), 'utf-8');
    await indexer.indexWorkspace(tempDir);
    const res = await retriever.retrieve(tempDir, 'large_preview', { maxPreviewLength: 500 });
    const ctx = res.context.find(c => c.path === 'large_preview.js');
    assert.ok(ctx.preview.length <= 500 + 50); // With some truncation string overhead
    assert.ok(ctx.preview.includes('truncated'));
  });

  await t.test('17. Symbol relevant-range extraction', async () => {
    const res = await retriever.retrieve(tempDir, 'validateToken', { rangeWindow: 2 });
    const ctx = res.context.find(c => c.path === 'src/auth/tokenUtils.js');
    assert.ok(ctx.relevantRanges.length > 0);
    assert.ok(ctx.preview.includes('let a = 1'));
  });

  await t.test('18. Dependency depth limit', async () => {
    // It should only go depth 1
    fs.writeFileSync(path.join(tempDir, 'alpha.js'), 'import { b } from "./beta"; export const a = 1;', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'beta.js'), 'import { g } from "./gamma"; export const b = 2;', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'gamma.js'), 'export const g = 3;', 'utf-8');
    await indexer.indexWorkspace(tempDir);
    
    const res = await retriever.retrieve(tempDir, 'alpha');
    const paths = res.candidates.map(c => c.path);
    assert.ok(paths.includes('alpha.js'));
    assert.ok(paths.includes('beta.js')); // depth 1
    // depth 3 shouldn't be pulled by dependency expansion from depth1
    const gammaCand = res.candidates.find(c=>c.path==='gamma.js');
    assert.ok(!gammaCand || (!gammaCand.reasons.includes('import_dependency') && !gammaCand.reasons.includes('dependent_relationship')));
  });

  await t.test('19. Secret exclusion', async () => {
    const res = await retriever.retrieve(tempDir, 'SECRET');
    assert.ok(!res.candidates.some(c => c.path === '.env'));
  });

  await t.test('20. Path traversal protection', async () => {
    const res = await retriever.retrieve(tempDir, '../etc/passwd');
    assert.ok(!res.candidates.some(c => c.path.includes('passwd')));
  });

  await t.test('21. Empty repository', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-repo-'));
    const res = await retriever.retrieve(emptyDir, 'login');
    assert.strictEqual(res.candidates.length, 0);
  });

  await t.test('22. Unknown task', async () => {
    const res = await retriever.retrieve(tempDir, 'UNKNOWN_TASK_THAT_DOES_NOT_EXIST');
    assert.ok(res.candidates.length === 0 || res.candidates[0].score < 20);
  });

  await t.test('23. Cache reuse', async () => {
    const res1 = await retriever.retrieve(tempDir, 'cache_test_task');
    const res2 = await retriever.retrieve(tempDir, 'cache_test_task');
    assert.strictEqual(res1, res2); // Exact object reference returned from Map
  });

  await t.test('24. Cache invalidation after index change', async () => {
    const res1 = await retriever.retrieve(tempDir, 'invalidation_test');
    fs.writeFileSync(path.join(tempDir, 'new_file_for_invalidation.js'), 'const a = 1;', 'utf-8');
    await indexer.indexWorkspace(tempDir); // Re-index changes hash
    const res2 = await retriever.retrieve(tempDir, 'invalidation_test');
    assert.notStrictEqual(res1, res2); // Different object
  });
});
