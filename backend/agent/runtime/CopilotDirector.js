'use strict';

const OpenAIService = require('../../services/openaiService');
const AgentCascadeAiService = require('./AgentCascadeAiService');
const AgentCoordinator = require('./AgentCoordinator');
const { ResultValidator } = require('./resultValidator');
const logger = require('../../logger');

// The planner decides the actual count. This is only a defensive ceiling against
// malformed or adversarial model output, not a workflow rule.
const MAX_TASKS = 32;
const MAX_WORKER_RETRIES = 1;
const ALLOWED_ROLES = new Set(['RESEARCHER', 'CODER', 'VERIFIER']);
const SPECIALTY_TO_ROLE = {
  requirements: 'RESEARCHER', research: 'RESEARCHER',
  frontend: 'CODER', backend: 'CODER', integration: 'CODER', data: 'CODER',
  testing: 'VERIFIER', verification: 'VERIFIER', visual_qa: 'VERIFIER',
  security: 'VERIFIER', browser_qa: 'VERIFIER', repair: 'CODER'
};

const DIRECTOR_PLANNER_PROMPT = `You are the AI-Dost Copilot Director/Boss. Convert ONE software outcome request into the minimum sufficient set of specialist tasks. 

MANDATORY ARCHITECTURE RULE: For any non-trivial task, the first task MUST be 'architecture' (specialty: requirements). The agent must define a blueprint, file structure, and API contracts before any coding starts.

FRONTEND / UI IMPLEMENTATION RULE: If the request asks to build, create, or modify an application, website, component, or UI feature, you MUST include a 'frontend' task (specialty: frontend) that writes the primary working UI component (such as 'src/App.jsx' or 'App.jsx') with a clean default export, complete interactive logic, and modern styling. Never finish without delivering the actual working implementation.

INCREMENTAL UPGRADE RULE: If the request is an upgrade or change to an existing project, the first task MUST be 'analysis' (specialty: research). The agent must index the existing codebase, identify affected files, and determine the impact of the change before planning the implementation.

Decide the task count dynamically from the actual scope, dependencies, risk, affected files, and verification needs. 

Return ONLY JSON:
{"summary":"string","tasks":[{"id":"string","specialty":"requirements|research|frontend|backend|integration|data|testing|verification|visual_qa|security|browser_qa|repair","objective":"string","dependsOn":["task-id"],"expectedOutput":"string"}]}

Rules:
- Choose 1 to 32 tasks only when justified.
- Dependencies may reference any task id in the returned plan.
- For upgrades/fixes, target the affected subsystem; do not rebuild unrelated areas.
- Include testing, security, browser QA, or verification when the request/risk requires it.
- Runtime failures are automatically retried and repaired; use repair for explicit repair work too.
- Do not include human/manual task assignment.`;

function escapeControlCharsInStrings(str) {
  let inStr = false;
  let esc = false;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && !esc) {
      inStr = !inStr;
      out += c;
    } else if (inStr) {
      if (c === '\\') {
        esc = !esc;
        out += c;
      } else {
        esc = false;
        if (c === '\n') {
          out += '\\n';
        } else if (c === '\r') {
          // ignore
        } else if (c === '\t') {
          out += '\\t';
        } else if (c.charCodeAt(0) < 32) {
          out += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
        } else {
          out += c;
        }
      }
    } else {
      esc = false;
      out += c;
    }
  }
  return out;
}

function extractJson(text) {
  let source = String(text || '').trim();
  source = source.replace(/^```(?:json)?\s*\n?/i, '');
  source = source.replace(/\n?```\s*$/i, '');
  source = source.trim();
  try {
    return JSON.parse(source);
  } catch (_) {}

  const sanitized = escapeControlCharsInStrings(source);
  try {
    return JSON.parse(sanitized);
  } catch (_) {}

  const start = sanitized.indexOf('{');
  const end = sanitized.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = sanitized.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch (_) {
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
      } catch (_) {}
    }
  }
  throw new Error('Director planner returned invalid JSON');
}

function fallbackPlan(request) {
  const text = String(request || '').toLowerCase();
  const complex = /\b(full|complete|entire|platform|app|application|website|dashboard|integrat|database|backend|frontend|deploy|production|security)\b/.test(text);
  if (!complex) return {
    summary: 'Single-task adaptive execution',
    tasks: [{ id: 'task-1', specialty: 'integration', objective: request, dependsOn: [], expectedOutput: 'Working requested outcome with verification evidence.' }]
  };
  return {
    summary: 'Adaptive multi-specialist execution',
    tasks: [
      { id: 'task-1', specialty: 'requirements', objective: `Inspect the existing workspace and define the smallest safe implementation for: ${request}`, dependsOn: [], expectedOutput: 'Concrete implementation scope and constraints.' },
      { id: 'task-2', specialty: 'integration', objective: request, dependsOn: ['task-1'], expectedOutput: 'Implemented outcome in affected subsystem(s).' },
      { id: 'task-3', specialty: 'testing', objective: `Test the completed implementation for: ${request}`, dependsOn: ['task-2'], expectedOutput: 'Test/build/runtime evidence and actionable failures.' }
    ]
  };
}

function hasDependencyCycle(tasks) {
  const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of graph.get(id) || []) if (visit(dep)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return tasks.some((task) => visit(task.id));
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
    tasks.push({
      id,
      specialty,
      role: ALLOWED_ROLES.has(role) ? role : 'CODER',
      objective: String(task.objective || request).trim().slice(0, 12000),
      dependsOn: Array.isArray(task.dependsOn) ? [...new Set(task.dependsOn.map(String).map((dep) => dep.trim()).filter(Boolean))] : [],
      expectedOutput: String(task.expectedOutput || 'Evidence-backed completion of the objective.').trim().slice(0, 4000)
    });
    ids.add(id);
  }
  const validIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    task.dependsOn = task.dependsOn.filter((dep) => validIds.has(dep) && dep !== task.id);
  }
  if (!tasks.length || hasDependencyCycle(tasks)) return fallbackPlan(request);
  return { summary: String(input.summary || 'Adaptive Copilot Director plan').slice(0, 2000), tasks };
}

class CopilotDirector {
  constructor({ db, projectAuthorization, workspaceManager, toolRegistry, plannerExecutionLoop, contextAssembler, taskPlanner, executionController, agentTaskDao, agentRunDao, aiService = AgentCascadeAiService, coordinator = null } = {}) {
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
    this.coordinator = coordinator || new AgentCoordinator({ db, projectAuthService: projectAuthorization, workspaceManager, toolRegistry, plannerExecutionLoop, contextAssembler, executionController, agentTaskDao, agentRunDao });
  }

  async createPlan(request, context = {}) {
    if (!String(request || '').trim()) throw new Error('Director request is required');
    try {
      const prompt = `${DIRECTOR_PLANNER_PROMPT}\n\nREQUEST:\n${request}\n\nAUTHORIZED WORKSPACE CONTEXT:\n${JSON.stringify(context).slice(0, 30000)}`;
      const response = await this.aiService.chat(prompt, [], 'agent');
      return normalizePlan(extractJson(response), request);
    } catch (_) { return normalizePlan(null, request); }
  }

  async executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent = () => {} }) {
    let hasExistingFiles = false;
    try {
      const meta = this.workspaceManager?.getWorkspaceMetadata?.(projectId, userId);
      hasExistingFiles = Boolean(meta && meta.fileCount > 0);
    } catch (_) {}

    const directive = hasExistingFiles
      ? `[SURGICAL_DIRECTIVE: Inspect existing workspace files first. Apply surgical targeted edits to affected files only without wiping or regenerating unrelated code.]`
      : `[GREENFIELD_DIRECTIVE: Workspace is new/empty. Create required source and component files directly using write_file. Do not attempt to read non-existent legacy files.]`;

    const objectiveWithDirective = `${directive}\n${task.objective}`;
    
    let attempt = 0;
    let lastResult = null;
    let lastError = null;
    const maxSelfHealingAttempts = Math.min(maxRepairs || 1, 2);

    while (attempt <= maxSelfHealingAttempts) {
      attempt++;
      try {
        const currentObjective = attempt === 1 
          ? objectiveWithDirective 
          : `REPAIR ATTEMPT ${attempt}: The previous implementation failed with error: ${lastError}. Please analyze the failure, read the relevant logs, and provide a corrected fix. Original objective: ${objectiveWithDirective}`;

        onEvent({ type: 'thinking', message: `🛠️ Specialist [${task.id}] planning steps (attempt ${attempt}/${maxSelfHealingAttempts + 1})...` });

        const workerPlan = await this.taskPlanner.generatePlan(currentObjective, { 
          projectId, 
          role: task.role, 
          specialty: task.specialty, 
          directorTaskId: task.id, 
          request, 
          expectedOutput: task.expectedOutput 
        });

        onEvent({ type: 'thinking', message: `⚡ Specialist [${task.id}] executing ${workerPlan.steps?.length || 0} step(s)...` });

        // --- VERIFICATION GATE: Execute and then Verify ---
        lastResult = await this.plannerExecutionLoop.runWithPlan(
          projectId, 
          userId, 
          workerPlan, 
          maxRepairs || 3, 
          () => Boolean(signal?.aborted), 
          `copilot_${delegated.workerRun.id}_att${attempt}`,
          { onEvent }
        );

        // Execution completed all steps successfully
        if (lastResult?.status === 'SUCCEEDED') {
          return lastResult;
        } else {
          lastError = lastResult?.error || lastResult?.reason || 'Unknown execution failure';
        }
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} status: ${lastResult?.status}, error: ${lastError}`);
      } catch (error) {
        lastError = error.message;
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} caught error: ${lastError}`);
      }
    }

    throw new Error(`Worker ${task.id} failed after ${attempt} self-healing attempts. Final error: ${lastError}`);
  }

  async run({ userId, projectId, request, signal = null, onEvent = () => {}, maxRepairs = 3, plan: presetPlan = null }) {
    // Plan-mode override: use the user-approved plan (normalized + validated —
    // bad shapes fall back to a generic sequential plan, never crash).
    const plan = presetPlan ? normalizePlan(presetPlan, request) : await this.createPlan(request, { projectId });
    const supervisorResult = await this.coordinator.createSupervisorTask({ userId, projectId, title: `Copilot Director: ${String(request).slice(0, 180)}`, prompt: request, metadata: { source: 'copilot-director', plannedTaskCount: plan.tasks.length } });
    const supervisorTaskId = supervisorResult.task.id;
    const supervisorRunId = supervisorResult.run.id;
    const completed = new Map();
    const results = [];
    onEvent({ type: 'director_plan', status: 'PLANNED', summary: plan.summary, taskCount: plan.tasks.length, tasks: plan.tasks.map(({ id, specialty, role, dependsOn }) => ({ id, specialty, role, dependsOn })) });
    this.agentTaskDao.updateStatus(supervisorTaskId, 'RUNNING');
    this.agentRunDao.updateStatus(supervisorRunId, 'RUNNING');
    try {
      const pending = new Set(plan.tasks.map((task) => task.id));
      while (pending.size) {
        if (signal?.aborted) return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
        const ready = plan.tasks.filter((task) => pending.has(task.id) && task.dependsOn.every((dep) => completed.get(dep) === 'SUCCEEDED'));
        if (!ready.length) throw new Error('Director plan is dependency-blocked or contains an invalid dependency graph');
        for (const task of ready) {
          pending.delete(task.id);
          let delegated = null;
          let executionResult = null;
          let lastError = null;
          for (let attempt = 1; attempt <= MAX_WORKER_RETRIES + 1; attempt += 1) {
            onEvent({ type: 'director_task', status: attempt === 1 ? 'DELEGATING' : 'RETRYING', attempt, taskId: task.id, specialty: task.specialty, role: task.role, objective: task.objective });
            delegated = await this.coordinator.delegate({ supervisorRunId, role: task.role, objective: task.objective, constraints: { specialty: task.specialty, directorTaskId: task.id, attempt }, expectedOutput: task.expectedOutput });
            try {
              executionResult = await this.coordinator.startWorker(delegated.workerRun.id, { autoPlan: false, runner: () => this.executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent }) });
              lastError = null;
              break;
            } catch (error) { lastError = error; if (signal?.aborted) break; }
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

          if (Array.isArray(executionResult?.stepLogs)) {
            for (const step of executionResult.stepLogs) {
              const act = step?.action || step?.tool || '';
              const target = step?.params?.path || step?.params?.filePath || step?.params?.TargetFile || step?.params?.file;
              if (target && (act.includes('write') || act.includes('edit') || act.includes('patch') || act.includes('replace') || act.includes('diff'))) {
                const fname = String(target).split(/[/\\]/).pop();
                onEvent({
                  type: 'director_file_diff',
                  file: fname,
                  fullPath: target,
                  action: act,
                  taskId: task.id,
                  specialty: task.specialty,
                  summary: step?.result?.message || `Surgical edit applied to ${fname}`,
                  timestamp: Date.now()
                });
              }
            }
          }

          if (taskStatus === 'CANCELLED') return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
        }
      }
      onEvent({ type: 'director_verification', status: 'DELEGATING' });
      const verifier = await this.coordinator.delegate({ supervisorRunId, role: 'VERIFIER', objective: `Perform the final read-only verification gate for the requested outcome: ${request}. Inspect the current workspace state and confirm tests/build/runtime evidence where supported. Do not mutate the workspace.`, constraints: { specialty: 'verification', generatedByDirector: true }, expectedOutput: 'Final verification evidence and any remaining blockers.' });
      const finalVerification = await this.coordinator.startWorker(verifier.workerRun.id, { runner: async () => { const verificationPlan = await this.taskPlanner.generateVerificationPlan(request, { projectId, request, role: 'VERIFIER' }); return this.plannerExecutionLoop.runWithPlan(projectId, userId, verificationPlan, 0, () => Boolean(signal?.aborted), `copilot_verify_${verifier.workerRun.id}`); } });
      onEvent({ type: 'director_verification', status: finalVerification?.status || 'FAILED', workerRunId: verifier.workerRun.id, result: finalVerification });
      if (finalVerification?.status !== 'SUCCEEDED') throw new Error('Final Director verification gate did not pass');
      this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
      this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
      onEvent({ type: 'director_complete', status: 'SUCCEEDED', taskId: supervisorTaskId, runId: supervisorRunId, taskCount: plan.tasks.length });
      return ResultValidator.validate({ status: 'COMPLETED', summary: `Director completed ${plan.tasks.length} adaptive task(s) and final verification.`, artifact_refs: results.flatMap((item) => item.result?.result?.artifact_refs || item.result?.artifact_refs || []), context_refs: [], verification_status: 'PASSED', errors: [] });
    } catch (error) {
      this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
      this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', error.message);
      throw error;
    }
  }
}

module.exports = { CopilotDirector, normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE, MAX_TASKS, hasDependencyCycle };
