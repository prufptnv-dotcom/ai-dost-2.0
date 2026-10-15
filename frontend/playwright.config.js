import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Visual Healer browser tests.
 * Runs against the real Chromium browser to verify actual geometry/computed-style detection.
 * Uses file:// URLs for fixtures — no webServer required.
 */
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    headless: true,
    // file:// fixtures with nested iframes need this flag so the host page can
    // access iframe.contentWindow (same behavior as http:// same-origin previews)
    launchOptions: {
      args: ['--allow-file-access-from-files'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
