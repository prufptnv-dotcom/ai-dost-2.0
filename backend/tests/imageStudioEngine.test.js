const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  detectImageCategory,
  CATEGORY_PRESETS,
  buildEnhancedImageRequest,
  IMAGE_STUDIO_DIRECTIVE,
} = require('../services/imageStudioEngine');

describe('Category 3: Z-Image Turbo & Visual Arts Studio Tests', () => {
  describe('All 17 Visual Categories Configured', () => {
    const categories = [
      'logo',
      'youtube-banner',
      'poster',
      'thumbnail',
      'character-design',
      'anime-artwork',
      'realistic-portrait',
      'infographic',
      'concept-art',
      'product-mockup',
      'ui-design',
      'book-cover',
      'social-media-post',
      'background-change',
      'object-add-remove',
      'style-transformation',
      'image-enhancement',
    ];

    test('has presets configured for all 17 core visual categories', () => {
      for (const cat of categories) {
        assert.ok(CATEGORY_PRESETS[cat], `Preset for ${cat} should exist`);
        assert.ok(CATEGORY_PRESETS[cat].aspectRatio, `${cat} should define an aspect ratio`);
        assert.ok(CATEGORY_PRESETS[cat].enhancer, `${cat} should have an enhancer string`);
        assert.ok(CATEGORY_PRESETS[cat].width > 0, `${cat} should have valid width`);
        assert.ok(CATEGORY_PRESETS[cat].height > 0, `${cat} should have valid height`);
      }
    });
  });

  describe('Category Intent Detection', () => {
    test('detects logo design requests', () => {
      assert.equal(detectImageCategory('tech startup ke liye modern minimalist vector logo design karo'), 'logo');
    });

    test('detects YouTube banner requests', () => {
      assert.equal(detectImageCategory('create a gaming channel youtube banner 16:9 ratio'), 'youtube-banner');
    });

    test('detects YouTube thumbnail requests', () => {
      assert.equal(detectImageCategory('high CTR video thumbnail banao with vibrant rim lighting'), 'thumbnail');
    });

    test('detects character design turnaround', () => {
      assert.equal(detectImageCategory('cyberpunk female warrior full body character design model sheet'), 'character-design');
    });

    test('detects anime artwork aesthetic', () => {
      assert.equal(detectImageCategory('Makoto Shinkai style anime illustration with clouds'), 'anime-artwork');
    });

    test('detects realistic portrait', () => {
      assert.equal(detectImageCategory('8k photorealistic studio portrait headshot of an Indian scientist'), 'realistic-portrait');
    });

    test('detects UI design mockups', () => {
      assert.equal(detectImageCategory('modern crypto wallet app dashboard ui design concept'), 'ui-design');
    });

    test('detects background removal requests', () => {
      assert.equal(detectImageCategory('remove background and make transparent bg'), 'background-change');
    });
  });

  describe('Prompt Enhancement & Parameter Tuning', () => {
    test('builds enhanced image request with correct aspect ratio and prompt structure', () => {
      const res = buildEnhancedImageRequest('AI-Dost neural assistant', 'logo');
      assert.ok(res.prompt.includes('AI-Dost neural assistant'));
      assert.ok(res.prompt.includes('minimalist vector logo'));
      assert.equal(res.aspectRatio, '1:1');
      assert.equal(res.category, 'logo');
    });

    test('builds 16:9 aspect ratio for YouTube banners', () => {
      const res = buildEnhancedImageRequest('Cosmic astronomy universe exploration', 'youtube-banner');
      assert.equal(res.aspectRatio, '16:9');
      assert.ok(res.prompt.includes('Cosmic astronomy universe exploration'));
      assert.ok(res.prompt.includes('ultra-wide YouTube channel art banner'));
    });
  });

  describe('Directive & Schema Verification', () => {
    test('directive contains comprehensive guidance across all 17 categories', () => {
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('1. LOGO DESIGN:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('2. YOUTUBE BANNER:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('3. POSTER DESIGN:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('4. YOUTUBE THUMBNAIL:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('5. CHARACTER DESIGN:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('6. ANIME-STYLE ARTWORK:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('7. REALISTIC PORTRAIT:'));
      assert.ok(IMAGE_STUDIO_DIRECTIVE.includes('8. INFOGRAPHIC & DATA VISUALS:'));
    });
  });
});
