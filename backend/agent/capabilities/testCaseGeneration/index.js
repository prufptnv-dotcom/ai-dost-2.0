/**
 * TestCaseGeneration Capability - Capability #12: coding.test_case_generation
 *
 * Automated test case generator and execution orchestrator.
 */

const PlanModule = require('./TestGenerationPlan');
const ValidatorModule = require('./TestGenerationValidator');
const GeneratorModule = require('./TestCaseGenerator');
const ManagerModule = require('./TestExecutionManager');
const ResultModule = require('./TestGenerationResult');
const NodeTestAdapter = require('./adapters/NodeTestAdapter');
const JestAdapter = require('./adapters/JestAdapter');
const PlaywrightAdapter = require('./adapters/PlaywrightAdapter');

const TestGenerationPlan = PlanModule.TestGenerationPlan || PlanModule;
const TestGenerationValidator = ValidatorModule.TestGenerationValidator || ValidatorModule;
const TestCaseGenerator = GeneratorModule.TestCaseGenerator || GeneratorModule;
const TestExecutionManager = ManagerModule.TestExecutionManager || ManagerModule;
const TestGenerationResult = ResultModule.TestGenerationResult || ResultModule;

module.exports = {
  TestGenerationPlan,
  TestGenerationValidator,
  TestCaseGenerator,
  TestExecutionManager,
  TestGenerationResult,
  adapters: {
    NodeTestAdapter: NodeTestAdapter.NodeTestAdapter || NodeTestAdapter,
    JestAdapter: JestAdapter.JestAdapter || JestAdapter,
    PlaywrightAdapter: PlaywrightAdapter.PlaywrightAdapter || PlaywrightAdapter
  }
};
