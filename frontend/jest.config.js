const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // tests/browser/* are Playwright (real Chromium) suites — run with:
  //   npx playwright test
  // Keep them OUT of the jsdom/Jest run (they import @playwright/test, which
  // cannot load in a jsdom environment).
  testPathIgnorePatterns: ['<rootDir>/tests/browser/'],
  transformIgnorePatterns: ['/node_modules/(?!(marked|next|@next)/)'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx}',
    'utils/**/*.{js,jsx}',
    'hooks/**/*.{js,jsx}',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 22,
      functions: 20,
      lines: 25,
    },
    // Keep focused regression coverage for the agent run and history flow, not
    // just the aggregate percentages for a large, mostly UI component.
    './components/AgentPanel.jsx': {
      statements: 45,
      branches: 35,
      functions: 28,
      lines: 50,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  // next/jest OVERWRITES transformIgnorePatterns with its own list (which has no
  // `marked` exception), so marked@18 (ESM-only) dies with `Unexpected token 'export'`.
  // Re-inject marked into the allow-list so babel/SWC can convert it for Jest.
  config.transformIgnorePatterns = (config.transformIgnorePatterns || []).map((p) =>
    typeof p === 'string' && p.includes('(?!(geist|') ? p.replace('(?!(geist|', '(?!(geist|marked|') : p
  );
  return config;
};
