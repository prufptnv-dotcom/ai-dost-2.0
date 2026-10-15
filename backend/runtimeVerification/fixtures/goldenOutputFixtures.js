'use strict';

/**
 * AI-Dost 2.0 — Phase: Runtime Reality & Golden Output Acceptance Fixtures
 * 
 * Golden test set mapping representative user requests against expected
 * capability selection, plans, artifact manifests, API schemas, and forbidden output patterns.
 */

const GOLDEN_SCENARIOS = Object.freeze([
  {
    id: 'GOLDEN_1_FULLSTACK_APP',
    name: 'Autonomous Full-Stack Task Application Generation',
    inputPrompt: 'Generate a full stack task manager application with Express backend and React frontend',
    expectedCapability: 'coding.full_stack_delivery',
    expectedPlan: {
      framework: 'react-vite',
      backend: 'express',
      stages: ['scaffold', 'database', 'api', 'tests', 'visualVerification']
    },
    expectedFiles: [
      'package.json',
      'server.js',
      'src/App.jsx'
    ],
    expectedApiResponseSchema: {
      type: 'object',
      required: ['success', 'manifest', 'executionId'],
      properties: {
        success: { type: 'boolean' },
        manifest: { type: 'object' },
        executionId: { type: 'string' }
      }
    },
    expectedDatabaseChanges: {
      tablesCreated: ['tasks', 'users'],
      indicesCreated: ['idx_tasks_user_id']
    },
    expectedUserVisibleResult: 'A fully functional containerizable React+Express fullstack application with operational REST endpoints and responsive UI',
    forbiddenOutputs: [
      /eval\s*\(/i,                                 // Dangerous code execution
      /localStorage\.(?:set|get)Item\s*\([^)]*token/i, // Insecure token storage
      /0\.0\.0\.0/i,                                // Unsafe wildcard network binding
      /privileged:\s*true/i,                        // Insecure Docker container mode
      /curl.*\|\s*sh/i                              // Piping remote curl into shell
    ]
  },
  {
    id: 'GOLDEN_2_SECURE_AUTH_GATE',
    name: 'Autonomous Authentication & Access Control Gate Synthesis',
    inputPrompt: 'Add secure user registration, JWT login, and role-based access control',
    expectedCapability: 'saas.authentication',
    expectedPlan: {
      passwordAlgorithm: 'scrypt',
      jwtAlgorithm: 'HS256',
      roles: ['admin', 'user', 'guest']
    },
    expectedFiles: [
      'backend/utils/auth.js',
      'backend/middleware/auth.js',
      'backend/routes/auth.js',
      'backend/migrations/002_create_auth_tables.sql',
      'frontend/src/context/AuthContext.jsx',
      'frontend/src/components/LoginForm.jsx',
      'frontend/src/components/RegisterForm.jsx'
    ],
    expectedApiResponseSchema: {
      type: 'object',
      required: ['status', 'files', 'roles'],
      properties: {
        status: { type: 'string' },
        files: { type: 'array' },
        roles: { type: 'array' }
      }
    },
    expectedDatabaseChanges: {
      tablesCreated: ['users', 'refresh_tokens'],
      indicesCreated: ['idx_users_email', 'idx_refresh_tokens_hash']
    },
    expectedUserVisibleResult: 'Security gate providing in-memory access token storage, HttpOnly refresh cookie rotation, and Double-Submit CSRF protection',
    forbiddenOutputs: [
      /localStorage/i,
      /sessionStorage/i,
      /"alg":\s*"none"/i,
      /md5/i,
      /sha1/i
    ]
  },
  {
    id: 'GOLDEN_3_DATABASE_SCHEMA_MIGRATION',
    name: 'E-commerce Relational Schema & Migration Generation',
    inputPrompt: 'Create relational database schema for products, orders, and order items with foreign keys',
    expectedCapability: 'coding.database_schema_generation',
    expectedPlan: {
      databaseType: 'sqlite',
      migrationStrategy: 'up_down'
    },
    expectedFiles: [
      'migrations/001_create_ecommerce_tables.sql',
      'models/Product.js',
      'models/Order.js'
    ],
    expectedApiResponseSchema: {
      type: 'object',
      required: ['success', 'schema', 'tables'],
      properties: {
        success: { type: 'boolean' },
        schema: { type: 'string' }
      }
    },
    expectedDatabaseChanges: {
      tablesCreated: ['products', 'orders', 'order_items'],
      foreignKeysEnforced: true
    },
    expectedUserVisibleResult: 'Validated relational schema with indexed primary/foreign keys and automated rollback scripts',
    forbiddenOutputs: [
      /DROP\s+TABLE\s+[^;]+CASCADE/i,
      /AUTOINCREMENT.*VARCHAR/i
    ]
  },
  {
    id: 'GOLDEN_4_TEST_CASE_GENERATION',
    name: 'Comprehensive Unit & Integration Test Generation',
    inputPrompt: 'Generate unit and integration tests for user authentication and task endpoints',
    expectedCapability: 'coding.test_case_generation',
    expectedPlan: {
      runner: 'node:test',
      coverageTarget: 80
    },
    expectedFiles: [
      'tests/auth.test.js',
      'tests/tasks.test.js'
    ],
    expectedApiResponseSchema: {
      type: 'object',
      required: ['totalTests', 'testSuites', 'files'],
      properties: {
        totalTests: { type: 'number' },
        files: { type: 'array' }
      }
    },
    expectedDatabaseChanges: {
      tablesCreated: []
    },
    expectedUserVisibleResult: 'Zero-network unit test suites that verify boundary conditions, error handling, and assertions',
    forbiddenOutputs: [
      /it\.skip/i,
      /test\.skip/i,
      /expect\(true\)\.toBe\(true\)/i
    ]
  },
  {
    id: 'GOLDEN_5_DOCKER_CONTAINERIZATION',
    name: 'Secure Local Docker Containerization & Deployment',
    inputPrompt: 'Containerize this project with Dockerfile and compose for local development',
    expectedCapability: 'devops.docker',
    expectedPlan: {
      targetEnv: 'staging',
      offlineBoundary: true
    },
    expectedFiles: [
      'Dockerfile',
      'docker-compose.yml'
    ],
    expectedApiResponseSchema: {
      type: 'object',
      required: ['dockerfileValid', 'composeValid'],
      properties: {
        dockerfileValid: { type: 'boolean' },
        composeValid: { type: 'boolean' }
      }
    },
    expectedDatabaseChanges: {
      tablesCreated: []
    },
    expectedUserVisibleResult: 'Non-root Docker container configuration with loopback host binding and resource quotas',
    forbiddenOutputs: [
      /USER\s+root/i,
      /--privileged/i,
      /\/var\/run\/docker\.sock/i,
      /network_mode:\s*host/i
    ]
  }
]);

/**
 * Validate actual synthesized output against golden scenario rules
 * @param {Object} goldenScenario
 * @param {Object} actualOutput
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAgainstGolden(goldenScenario, actualOutput) {
  const errors = [];

  // 1. Verify expected files generated
  if (goldenScenario.expectedFiles && actualOutput.files) {
    for (const file of goldenScenario.expectedFiles) {
      if (!actualOutput.files.some(f => f.includes(file) || f.endsWith(file))) {
        errors.push(`Missing expected golden file: ${file}`);
      }
    }
  }

  // 2. Scan for forbidden outputs
  if (actualOutput.codeContents) {
    for (const [filePath, content] of Object.entries(actualOutput.codeContents)) {
      for (const pattern of goldenScenario.forbiddenOutputs) {
        if (pattern.test(content)) {
          errors.push(`Forbidden pattern ${pattern.toString()} detected in ${filePath}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  GOLDEN_SCENARIOS,
  validateAgainstGolden
};
