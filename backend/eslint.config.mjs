import js from "@eslint/js";

const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "writable",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  fetch: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  global: "readonly",
  performance: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  DOMException: "readonly",
  WebAssembly: "readonly",
  document: "readonly",
  window: "readonly"
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  CustomEvent: "readonly",
  Event: "readonly",
  HTMLIFrameElement: "readonly",
  HTMLElement: "readonly",
  Element: "readonly",
  Node: "readonly",
  navigator: "readonly",
  location: "readonly"
};

export default [
  {
    ignores: [
      "node_modules/**",
      "data/**",
      "logs/**",
      "uploads/**",
      "test-results/**",
      "audit_screenshots/**",
      "temp/**",
      "temp_test_workspace/**",
      "scratch/**",
      "**/*.log",
      "test_*.js",
      "verify_*.js"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_", "caughtErrors": "none" }],
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-useless-escape": "off",
      "no-misleading-character-class": "off"
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: nodeGlobals
    }
  },
  {
    files: ["tests/**/*.js", "**/*.test.js", "**/tests/**/*.js"],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...browserGlobals,
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "off"
    }
  }
];
