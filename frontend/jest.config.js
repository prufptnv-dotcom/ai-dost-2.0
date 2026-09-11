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
      statements: 4,
      branches: 3,
      functions: 4,
      lines: 4,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
