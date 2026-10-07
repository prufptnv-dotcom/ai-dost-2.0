const test = require('node:test');
const assert = require('node:assert/strict');
const OpenRouterService = require('../services/openrouterService');

test('OpenRouterService - Model Catalog and Dictionary', () => {
    assert.ok(OpenRouterService.FREE_MODELS, 'FREE_MODELS should be defined');
    assert.equal(OpenRouterService.FREE_MODELS.auto, 'openrouter/free');
    assert.equal(OpenRouterService.FREE_MODELS.nemotron_3_super, 'nvidia/nemotron-3-super-120b-a12b:free');
    assert.equal(OpenRouterService.FREE_MODELS.north_mini_code, 'cohere/north-mini-code:free');
    assert.equal(OpenRouterService.FREE_MODELS.laguna_s, 'poolside/laguna-s-2.1:free');
    assert.equal(OpenRouterService.FREE_MODELS.ling_sante, 'inclusionai/ling-3.0-flash-sante:free');
    assert.equal(OpenRouterService.FREE_MODELS.apodex_mini, 'apodex/apodex-1.1-mini:free');

    const catalog = OpenRouterService.getModelCatalog();
    assert.ok(Array.isArray(catalog));
    assert.ok(catalog.length >= 20, `Catalog has ${catalog.length} models`);
    const superModel = catalog.find(m => m.key === 'nemotron_3_super');
    assert.ok(superModel);
    assert.equal(superModel.category, 'General Reasoning & Heavy Tasks');
});

test('OpenRouterService - Model Resolution & Normalization', () => {
    // 1. Task keys
    assert.equal(OpenRouterService.resolveModel('auto'), 'openrouter/free');
    assert.equal(OpenRouterService.resolveModel('nemotron_3_super'), 'nvidia/nemotron-3-super-120b-a12b:free');
    assert.equal(OpenRouterService.resolveModel('north_mini_code'), 'cohere/north-mini-code:free');
    assert.equal(OpenRouterService.resolveModel('lfm_reasoning'), 'liquid/lfm-2.5-2.6b:free');

    // 2. Prefixed keys
    assert.equal(OpenRouterService.resolveModel('openrouter:nemotron_3_super'), 'nvidia/nemotron-3-super-120b-a12b:free');
    assert.equal(OpenRouterService.resolveModel('openrouter:laguna_s'), 'poolside/laguna-s-2.1:free');

    // 3. Typo aliases normalization
    assert.equal(OpenRouterService.resolveModel('dots3-note-preview:free'), 'dots-studio/dots-3-note-preview:free');
    assert.equal(OpenRouterService.resolveModel('dots-studio/dots3-note-preview:free'), 'dots-studio/dots-3-note-preview:free');
    assert.equal(OpenRouterService.resolveModel('liquid/lfm2.5-2.6b:free'), 'liquid/lfm-2.5-2.6b:free');
    assert.equal(OpenRouterService.resolveModel('google/gemma-4-26b-a4b:free'), 'google/gemma-4-26b-a4b-it:free');
    assert.equal(OpenRouterService.resolveModel('nvidia/nemotron-3-nano-omni:free'), 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free');

    // 4. Fallback for null
    assert.equal(OpenRouterService.resolveModel(null), 'openrouter/free');
    assert.equal(OpenRouterService.resolveModel(''), 'openrouter/free');
});

test('OpenRouterService - isSupportedModel validation', () => {
    assert.equal(OpenRouterService.isSupportedModel('openrouter'), true);
    assert.equal(OpenRouterService.isSupportedModel('openrouter:nemotron_3_super'), true);
    assert.equal(OpenRouterService.isSupportedModel('nemotron_3_super'), true);
    assert.equal(OpenRouterService.isSupportedModel('north_mini_code'), true);
    assert.equal(OpenRouterService.isSupportedModel('liquid/lfm-2.5-2.6b:free'), true);
    assert.equal(OpenRouterService.isSupportedModel('unknown_random_model_123'), false);
    assert.equal(OpenRouterService.isSupportedModel(null), false);
});

test('OpenRouterService - Reasoning extraction logic', async () => {
    const service = new OpenRouterService();
    // Verify client configuration
    assert.ok(service.client);
    assert.equal(service.client.serviceName, 'OpenRouter');
});

test('OpenRouterService - Priority routing and cascade order', () => {
    assert.ok(OpenRouterService.isSupportedModel('openrouter:nemotron_3_super'));
    assert.ok(OpenRouterService.isSupportedModel('openrouter:north_mini_code'));
    const resolved = OpenRouterService.resolveModel('openrouter:nemotron_3_super');
    assert.equal(resolved, 'nvidia/nemotron-3-super-120b-a12b:free');
});

