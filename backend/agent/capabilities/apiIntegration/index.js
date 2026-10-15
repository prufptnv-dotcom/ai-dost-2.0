'use strict';

const crypto = require('crypto');
const path = require('path');
const { ApiIntegrationPlan } = require('./ApiIntegrationPlan');
const { ApiIntegrationValidator } = require('./ApiIntegrationValidator');
const { OpenApiGenerator } = require('./OpenApiGenerator');
const { ApiClientGenerator } = require('./ApiClientGenerator');
const { ContractValidatorGenerator } = require('./ContractValidatorGenerator');
const { MockAdapterGenerator } = require('./MockAdapterGenerator');
const { ContractDriftDetector } = require('./ContractDriftDetector');
const { ApiIntegrationResult } = require('./ApiIntegrationResult');

let DeterministicCodeGuard;
try {
  DeterministicCodeGuard = require('../../../services/DeterministicCodeGuard');
} catch {
  DeterministicCodeGuard = null;
}

/**
 * Main execution orchestrator for Phase 4D: coding.api_integration
 */
async function generateApiIntegration(inputPlan) {
  const startTime = Date.now();

  const plan = inputPlan instanceof ApiIntegrationPlan
    ? inputPlan
    : new ApiIntegrationPlan(inputPlan);

  // 1. Validation phase
  const validation = ApiIntegrationValidator.validatePlan(plan);
  if (!validation.ok) {
    return ApiIntegrationResult.failure(validation.errors[0], {
      planId: plan.planId,
      warnings: validation.warnings
    });
  }

  try {
    // 2. OpenAPI 3.0.3 generation
    const openapiSpec = OpenApiGenerator.generateSpec(plan);
    const contractChecksum = OpenApiGenerator.computeChecksum(openapiSpec);

    // 3. Client SDK generation
    let clientContent;
    if (plan.clientStyle === 'axios') {
      clientContent = ApiClientGenerator.generateAxiosClient(openapiSpec, plan);
    } else {
      clientContent = ApiClientGenerator.generateFetchClient(openapiSpec, plan);
    }

    // 4. Runtime validator generation
    let validatorContent;
    if (plan.validatorMode === 'zod') {
      validatorContent = ContractValidatorGenerator.generateZodValidators(openapiSpec);
    } else {
      validatorContent = ContractValidatorGenerator.generateJsValidators(openapiSpec);
    }

    // 5. Offline mock client generation
    let mockContent = null;
    if (plan.generateMock) {
      mockContent = MockAdapterGenerator.generateMockClient(openapiSpec, plan);
    }

    // 6. Contract drift detection
    let driftReport = null;
    if (plan.detectDrift && plan.previousSpec) {
      driftReport = ContractDriftDetector.detectDrift(plan.previousSpec, openapiSpec);
    }

    // 7. Prepare file descriptors
    const files = [];

    // OpenAPI spec file
    const openapiRelPath = path.join(plan.openapiOutputDir, plan.openapiFileName).replace(/\\/g, '/');
    const openapiContent = JSON.stringify(openapiSpec, null, 2);
    files.push({
      path: openapiRelPath,
      content: openapiContent,
      action: 'CREATE',
      type: 'SPECIFICATION',
      checksum: crypto.createHash('sha256').update(openapiContent).digest('hex')
    });

    // API Client file
    const ext = plan.language === 'typescript' ? 'ts' : 'js';
    const clientFileName = plan.clientFileName.replace(/\.(?:js|ts)$/, `.${ext}`);
    const clientRelPath = path.join(plan.clientOutputDir, clientFileName).replace(/\\/g, '/');
    files.push({
      path: clientRelPath,
      content: clientContent,
      action: 'CREATE',
      type: 'CLIENT_SDK',
      checksum: crypto.createHash('sha256').update(clientContent).digest('hex')
    });

    // Validator file
    const validatorRelPath = path.join(plan.clientOutputDir, `validators.${ext}`).replace(/\\/g, '/');
    files.push({
      path: validatorRelPath,
      content: validatorContent,
      action: 'CREATE',
      type: 'VALIDATOR',
      checksum: crypto.createHash('sha256').update(validatorContent).digest('hex')
    });

    // Mock client file
    if (mockContent) {
      const mockRelPath = path.join(plan.clientOutputDir, `mockClient.${ext}`).replace(/\\/g, '/');
      files.push({
        path: mockRelPath,
        content: mockContent,
        action: 'CREATE',
        type: 'MOCK_ADAPTER',
        checksum: crypto.createHash('sha256').update(mockContent).digest('hex')
      });
    }

    // 8. AST safety check on generated JS code using DeterministicCodeGuard if available
    if (DeterministicCodeGuard && plan.language === 'javascript') {
      for (const f of files) {
        if (f.path.endsWith('.js')) {
          const guardResult = DeterministicCodeGuard.guard(f.path, f.content);
          if (guardResult && !guardResult.accepted) {
            return ApiIntegrationResult.failure({
              code: 'CODE_GUARD_VIOLATION',
              message: `DeterministicCodeGuard rejected generated file ${f.path}: ${guardResult.reason || 'Guard rejected'}`
            }, { planId: plan.planId, files });
          }
        }
      }
    }

    // 9. Collect metrics
    const routesParsed = Object.keys(openapiSpec.paths || {}).length;
    let methodsGenerated = 0;
    for (const pathItem of Object.values(openapiSpec.paths || {})) {
      methodsGenerated += Object.keys(pathItem || {}).length;
    }
    const schemasCreated = Object.keys(openapiSpec.components?.schemas || {}).length;

    return ApiIntegrationResult.success({
      planId: plan.planId,
      files,
      openapiSpec,
      contractChecksum,
      driftReport,
      metrics: {
        routesParsed,
        methodsGenerated,
        schemasCreated,
        durationMs: Date.now() - startTime
      },
      warnings: validation.warnings
    });
  } catch (err) {
    return ApiIntegrationResult.failure(err, {
      planId: plan.planId,
      warnings: validation.warnings
    });
  }
}

module.exports = {
  ApiIntegrationPlan,
  ApiIntegrationValidator,
  OpenApiGenerator,
  ApiClientGenerator,
  ContractValidatorGenerator,
  MockAdapterGenerator,
  ContractDriftDetector,
  ApiIntegrationResult,
  generateApiIntegration
};
