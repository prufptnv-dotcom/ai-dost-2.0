/**
 * Playwright E2E config for AI-Dost.
 * Reuses already-running dev servers (frontend :3000, backend :5000) if present,
 * otherwise boots them. Run: npx playwright test
 */
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node server.js',
      url: 'http://localhost:5000/health',
      reuseExistingServer: true,
      timeout: 60_000,
      cwd: __dirname,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: require('path').join(__dirname, '..', '..', 'frontend'),
    },
  ],
});
