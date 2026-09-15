'use strict';

const OpenAIService = require('../../services/openaiService');
const AgentCoordinator = require('./AgentCoordinator');
const { ResultValidator } = require('./resultValidator');

const MAX_TASKS = 4;
const MAX_WORKER_RETRIES = 2;
const ALLOWED_ROLES = new Set(['RESEARCHER', 'CODER', 'VERIFIER']);
const SPECIALTY_TO_ROLE = {
  requirements: 'RESEARCHER',
  research: 'RESEARCHER',
  frontend: 'CODER',
  backend: 'CODER',
  integration: 'CODER',
  data: 'CODER',
  testing: 'VERIFIER',
  verification: 'VERIFIER',
  visual_qa: 'VERIFIER',
  repair: 'CODER'
};

const DIRECTOR_PLANNER_PROMPT = `You are the AI-Dost Copilot Director/Boss. Convert ONE software outcome request into the minimum sufficient set of specialist tasks. This is adaptive, not a fixed pipeline. A trivial change may need one task; a complex product may need several tasks. Inspect the request conceptually and identify only the work actually required.

Return ONLY JSON with this shape:
{"summary":"string","tasks":[{"id":"string","specialty":"requirements|research|frontend|backend|integration|data|testing|verification|visual_qa|repair","objective":"string","dependsOn":["task-id"],"expectedOutput":"string"}]}

Rules:
- Maximum 4 planned tasks; the Director always adds a separate final read-only verification gate.
- Dependencies must refer only to earlier task ids.
- Avoid duplicate or ceremonial tasks.
- For upgrades/fixes, target the affected subsystem rather than rebuilding unrelated areas.
- Include testing/verification only when needed by the request or risk profile.
- Use repair only when the objective itself is a repair/bug-fix workflow; runtime failures are handled automatically by the execution loop.
- Do not include human/manual task assignment.
`;

function extractJson(text) {
  const source = String(text || '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced ? fenced[1] : source).trim();
  try { return JSON.parse(candidate); } catch (_) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('Director planner returned invalid JSON');
  }
}

function fallbackPlan(request) {
  const text = String(request || '').toLowerCase();
  const complex = /\b(full|complete|entire|platform|app|application|website|dashboard|integrat|database|backend|frontend|deploy|production)\b/.test(text);
  if (!complex) {
    return { summary: 'Single-task adaptive execution', tasks: [{ id: 'task-1', specialty: 'integration', objective: request, dependsOn: [], expectedOutput: 'Working requested outcome with verification evidence.' }] };
  }
  return {
    summary: 'Adaptive multi-specialist execution',
    tasks: [
      { id: 'task-1', specialty: 'requirements', objective: `Inspect the existing workspace and define the smallest safe implementation for: ${request}`, dependsOn: [], expectedOutput: 'Concrete implementation scope and constraints.' },
      { id: 'task-2', specialty: 'integration', objective: request, dependsOn: ['task-1'], expectedOutput: 'Implemented outcome in the affected subsystem(s).' },
      { id: 'task-3', specialty: 'testing', objective: `Test the completed implementation for: ${request}`, dependsOn: ['task-2'], expectedOutput: 'Test/build/runtime evidence and actionable failures if any.' }
    ]
  };
}

function normalizePlan(raw, request) {
  const input = raw && typeof raw === 'object' ? raw : fallbackPlan(request);
  const rawTasks = Array.isArray(input.tasks) ? input.tasks.slice(0, MAX_TASKS) : [];
  if (!rawTasks.length) return fallbackPlan(request);
  const ids = new Set();
  const tasks = [];
  for (let i = 0; i < rawTasks.length; i += 1) {
    const task = rawTasks[i] || {};
    const id = String(task.id || `task-${i + 1}`).trim();
    if (!id || ids.has(id)) continue;
    const specialty = String(task.specialty || 'integration').trim().toLowerCase();
    const role = SPECIALTY_TO_ROLE[specialty] || 'CODER';
    const dependsOn = Array.isArray(task.dependsOn) ? task.dependsOn.map(String).filter((dep) => ids.has(dep)) : [];
    tasks.push({
      id,
      specialty,
      role: ALLOWED_ROLES.has(role) ? role : 'CODER',
      objective: String(task.objective || request).trim().slice(0, 12000),
      dependsOn,
      expectedOutput: String(task.expectedOutput || 'Evidence-backed completion of the objective.').trim().slice(0, 4000),
    });
    ids.add(id);
  }
  return tasks.length ? { summary: String(input.summary || 'Adaptive Copilot Director plan').slice(0, 2000), tasks } : fallbackPlan(request);
}

class CopilotDirector {
  constructor({ db, projectAuthorization, workspaceManager, toolRegistry, plannerExecutionLoop, contextAssembler, taskPlanner, executionController, agentTaskDao, agentRunDao, aiService = OpenAIService, coordinator = null } = {}) {
    this.db = db;
    this.projectAuthorization = projectAuthorization;
    this.workspaceManager = workspaceManager;
    this.toolRegistry = toolRegistry;
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.contextAssembler = contextAssembler;
    this.taskPlanner = taskPlanner;
    this.executionController = executionController;
    this.agentTaskDao = agentTaskDao;
    this.agentRunDao = agentRunDao;
    this.aiService = aiService;
    this.coordinator = coordinator || new AgentCoordinator({
      db,
      projectAuthService: projectAuthorization,
      workspaceManager,
      toolRegistry,
      plannerExecutionLoop,
      contextAssembler,
      executionController,
      agentTaskDao,
      agentRunDao
    });
  }

  async createPlan(request, context = {}) {
    if (!String(request || '').trim()) throw new Error('Director request is required');
    try {
      const prompt = `${DIRECTOR_PLANNER_PROMPT}\n\nREQUEST:\n${request}\n\nAUTHORIZED WORKSPACE CONTEXT:\n${JSON.stringify(context).slice(0, 30000)}`;
      const response = await this.aiService.chat(prompt, [], 'agent');
      return normalizePlan(extractJson(response), request);
    } catch (_) {
      return normalizePlan(null, request);
    }
  }

  async executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs }) {
    try {
      const workerPlan = await this.taskPlanner.generatePlan(task.objective, {
        projectId,
        role: task.role,
        specialty: task.specialty,
        directorTaskId: task.id,
        request,
        expectedOutput: task.expectedOutput,
      });
      return await this.plannerExecutionLoop.runWithPlan(
        projectId,
        userId,
        workerPlan,
        maxRepairs,
        () => Boolean(signal?.aborted),
        `copilot_${delegated.workerRun.id}`
      );
    } catch (error) {
      throw error;
    }
  }

  async run({ userId, projectId, request, signal = null, onEvent = () => {}, maxRepairs = 3 }) {
    const plan = await this.createPlan(request, { projectId });
    const supervisorResult = await this.coordinator.createSupervisorTask({
      userId,
      projectId,
      title: `Copilot Director: ${String(request).slice(0, 180)}`,
      prompt: request,
      metadata: { source: 'copilot-director', plannedTaskCount: plan.tasks.length }
    });
    const supervisorTaskId = supervisorResult.task.id;
    const supervisorRunId = supervisorResult.run.id;
    const completed = new Map();
    const results = [];

    onEvent({ type: 'director_plan', status: 'PLANNED', summary: plan.summary, taskCount: plan.tasks.length, tasks: plan.tasks.map(({ id, specialty, role, dependsOn }) => ({ id, specialty, role, dependsOn })) });
    this.agentTaskDao.updateStatus(supervisorTaskId, 'RUNNING');
    this.agentRunDao.updateStatus(supervisorRunId, 'RUNNING');

    try {
      for (const task of plan.tasks) {
        if (signal?.aborted) return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
        const unmet = task.dependsOn.filter((dep) => completed.get(dep) !== 'SUCCEEDED');
        if (unmet.length) throw new Error(`Director dependency blocked task '${task.id}': ${unmet.join(', ')}`);

        let delegated = null;
        let executionResult = null;
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_WORKER_RETRIES + 1; attempt += 1) {
          onEvent({ type: 'director_task', status: attempt === 1 ? 'DELEGATING' : 'RETRYING', attempt, taskId: task.id, specialty: task.specialty, role: task.role, objective: task.objective });
          delegated = await this.coordinator.delegate({
            supervisorRunId,
            role: task.role,
            objective: task.objective,
            constraints: { specialty: task.specialty, directorTaskId: task.id, attempt },
            expectedOutput: task.expectedOutput
          });
          try {
            executionResult = await this.coordinator.startWorker(delegated.workerRun.id, { autoPlan: false, runner: () => this.executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs }) });
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (signal?.aborted) break;
          }
        }
        if (lastError) {
          completed.set(task.id, 'FAILED');
          results.push({ task, status: 'FAILED', error: lastError.message });
          onEvent({ type: 'director_task', status: 'FAILED', taskId: task.id, specialty: task.specialty, role: task.role, error: lastError.message });
          throw lastError;
        }

        const taskStatus = executionResult?.status === 'CANCELLED' ? 'CANCELLED' : 'SUCCEEDED';
        completed.set(task.id, taskStatus);
        results.push({ task, status: taskStatus, workerRunId: delegated.workerRun.id, result: executionResult });
        onEvent({ type: 'director_task', status: taskStatus, taskId: task.id, specialty: task.specialty, role: task.role, workerRunId: delegated.workerRun.id, result: executionResult });
        if (taskStatus === 'CANCELLED') return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
      }

      onEvent({ type: 'director_verification', status: 'DELEGATING' });
      const verifier = await this.coordinator.delegate({
        supervisorRunId,
        role: 'VERIFIER',
        objective: `Perform the final read-only verification gate for the requested outcome: ${request}. Inspect the current workspace state and confirm tests/build/runtime evidence where supported. Do not mutate the workspace.`,
        constraints: { specialty: 'verification', generatedByDirector: true },
        expectedOutput: 'Final verification evidence and any remaining blockers.'
      });
      const finalVerification = await this.coordinator.startWorker(verifier.workerRun.id, {
        runner: async () => {
          const verificationPlan = await this.taskPlanner.generateVerificationPlan(request, { projectId, request, role: 'VERIFIER' });
          return this.plannerExecutionLoop.runWithPlan(projectId, userId, verificationPlan, 0, () => Boolean(signal?.aborted), `copilot_verify_${verifier.workerRun.id}`);
        }
      });
      onEvent({ type: 'director_verification', status: finalVerification?.status || 'FAILED', workerRunId: verifier.workerRun.id, result: finalVerification });
      if (finalVerification?.status !== 'SUCCEEDED') throw new Error('Final Director verification gate did not pass');

      this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
      this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
      onEvent({ type: 'director_complete', status: 'SUCCEEDED', taskId: supervisorTaskId, runId: supervisorRunId, taskCount: plan.tasks.length });
      return ResultValidator.validate({
        status: 'COMPLETED',
        summary: `Director completed ${plan.tasks.length} adaptive task(s) and final verification.`,
        artifact_refs: results.flatMap((item) => item.result?.result?.artifact_refs || item.result?.artifact_refs || []),
        context_refs: [],
        verification_status: 'PASSED',
        errors: []
      });
    } catch (error) {
      this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
      this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', error.message);
      throw error;
    }
  }
}

module.exports = { CopilotDirector, normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE, MAX_TASKS };