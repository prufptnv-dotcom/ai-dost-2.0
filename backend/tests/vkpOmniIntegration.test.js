const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const pythonEngineService = require('../services/pythonEngineService');

describe('VKP-Omni-2B Model Integration Tests (NandiAi/VKP-Omni-2B)', () => {
  test('pythonEngineService exports queryVkpOmni and getVkpOmniStatus functions', () => {
    assert.equal(typeof pythonEngineService.queryVkpOmni, 'function');
    assert.equal(typeof pythonEngineService.getVkpOmniStatus, 'function');
  });

  test('queryVkpOmni handles offline engine safely without crashing', async () => {
    const res = await pythonEngineService.queryVkpOmni('Hello from test', { maxTokens: 100 });
    assert.ok(res !== undefined);
    assert.ok('ok' in res);
    // If engine is not running on 8001 during unit test, ok will be false with an error message
    if (!res.ok) {
      assert.ok(typeof res.error === 'string');
    } else {
      assert.ok(res.data);
    }
  });

  test('getVkpOmniStatus returns null or status object when offline', async () => {
    const status = await pythonEngineService.getVkpOmniStatus();
    assert.ok(status === null || typeof status === 'object');
  });
});
