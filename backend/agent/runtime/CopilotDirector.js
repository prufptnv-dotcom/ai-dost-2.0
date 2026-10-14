'use strict';

const fs = require('fs');
const path = require('path');
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

// P12.8 (E2E run #14): bounded workspace listing for the specialist planner.
// Pass 2 of run #14 regenerated the whole plan from scratch and burned its
// entire repair budget re-creating files that pass 1 had already written
// ("Create package.json" ×4 → WRITE_FORBIDDEN → hallucinated-SEARCH apply_diff).
// The planner knew files EXISTED (SURGICAL directive) but not WHICH ones.
function listExistingFilesBounded(root, max = 100) {
  const out = [];
  const skip = new Set(['node_modules', '.git', '.checkpoints']);
  const walk = (dir, depth) => {
    if (out.length >= max || depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile()) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
        if (out.length >= max) return;
      }
    }
  };
  walk(root, 0);
  return out.sort();
}

// P12.9 (E2E run #15): knowing the file LIST was not enough — the specialist
// still baked SEARCH strings from imagination (31× SEARCH-not-found; it
// assumed pretty-printed 2-space package.json while the file was SINGLE-LINE
// compact JSON). Give the planner the REAL bytes of the key small files so
// SEARCH is copied verbatim, not recalled. Bounded: priority names first,
// ≤6 files, ≤2600 chars each (truncated marker beyond), ≤9000 chars total.
function readKeyFileContents(diskPath, files) {
  const PRIORITY = ['package.json', 'src/styles/global.css', 'src/index.css', 'src/App.jsx', 'index.html', 'vite.config.js', 'src/main.jsx'];
  const pick = [];
  for (const p of PRIORITY) if (files.includes(p)) pick.push(p);
  for (const p of files) { if (pick.length >= 5) break; if (!pick.includes(p)) pick.push(p); }
  const out = {};
  let budget = 4800;
  for (const p of pick) {
    if (budget <= 0) break;
    try {
      const full = path.join(diskPath, p);
      const st = fs.statSync(full);
      if (!st.isFile() || st.size > 60000) continue;
      let c = fs.readFileSync(full, 'utf-8');
      if (c.length > 1500) c = `${c.slice(0, 1300)}\n… [truncated — ${c.length} chars total — copy the REAL lines you need as SEARCH] …`;
      out[p] = c;
      budget -= c.length;
    } catch (_) {}
  }
  return Object.keys(out).length ? out : null;
}

const DIRECTOR_PLANNER_PROMPT = `You are the AI-Dost Copilot Director/Boss. Convert ONE software outcome request into the minimum sufficient set of specialist tasks. 

CODE-FIRST IMPLEMENTATION RULE (MANDATORY):
When the user asks to build, create, or code an application, website, component, or feature (e.g. "website banao", "portfolio banao", "build app", "code likho"):
- The primary task MUST be code implementation (specialty: frontend or integration, role: CODER).
- The agent MUST immediately create or modify real executable code files (such as 'src/App.jsx', 'App.jsx', 'src/index.css', 'index.html', 'src/main.jsx').
- NEVER plan or create markdown blueprint files (such as 'docs/architecture.md', 'README.md', or design specs) when the user asked for an app, website, or code. The user expects runnable code, not markdown documentation!
- Write complete, beautiful, interactive, production-ready code with responsive styling and working components.

INCREMENTAL UPGRADE RULE: If the request is an upgrade, bug fix, or addition to an existing project, plan targeted surgical code edits directly to the affected files.

Decide the task count dynamically from the actual scope, dependencies, risk, affected files, and verification needs. 

Return ONLY JSON:
{"summary":"string","tasks":[{"id":"string","specialty":"frontend|backend|integration|data|testing|verification|visual_qa|security|browser_qa|repair|research|requirements","objective":"string","dependsOn":["task-id"],"expectedOutput":"string"}]}

Rules:
- Choose 1 to 32 tasks only when justified.
- For building websites/apps/UIs, task 1 MUST have specialty 'frontend' or 'integration' to write working code.
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
    tasks: [{ id: 'task-1', specialty: 'frontend', objective: `Implement working code for: ${request}`, dependsOn: [], expectedOutput: 'Working requested outcome with verification evidence.' }]
  };
  return {
    summary: 'Adaptive multi-specialist execution',
    tasks: [
      { id: 'task-1', specialty: 'frontend', objective: `Implement complete working code and UI components for: ${request}`, dependsOn: [], expectedOutput: 'Working runnable application source code files.' },
      { id: 'task-2', specialty: 'integration', objective: `Integrate and wire complete functionality for: ${request}`, dependsOn: ['task-1'], expectedOutput: 'Implemented outcome in affected subsystem(s).' },
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
    const taskObjective = (
      (typeof task.objective === 'string' && task.objective.trim()) ||
      (typeof task.description === 'string' && task.description.trim()) ||
      (typeof task.goal === 'string' && task.goal.trim()) ||
      (typeof task.title === 'string' && task.title.trim()) ||
      (typeof task.summary === 'string' && task.summary.trim()) ||
      String(request || 'Implement requested code outcome').trim()
    );
    tasks.push({
      id,
      specialty,
      role: ALLOWED_ROLES.has(role) ? role : 'CODER',
      objective: taskObjective.slice(0, 12000),
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
      // P12.4: mode 'planner' (no system prompt) — 'agent' mode's FILE: format
      // instruction fights this prompt's "respond with valid JSON" contract.
      const response = await this.aiService.chat(prompt, [], 'planner');
      return normalizePlan(extractJson(response), request);
    } catch (_) { return normalizePlan(null, request); }
  }

  async executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent = () => {}, permissionLevel = 'auto', approvalToken = null, approvalState = null }) {
    let hasExistingFiles = false;
    let existingFiles = [];
    let existingFileContents = null;
    try {
      const meta = this.workspaceManager?.getWorkspaceMetadata?.(projectId, userId);
      hasExistingFiles = Boolean(meta && meta.fileCount > 0);
      // P12.8 (E2E run #14): pass the REAL file list to the specialist planner.
      // The SURGICAL directive alone was not enough — the planner kept emitting
      // "Create package.json"/"Create App.jsx" for files that already existed
      // (WRITE_FORBIDDEN ×4 burned the whole repair budget on pass 2). With the
      // list in AUTHORIZED CONTEXT it can plan read_file + apply_diff instead.
      if (hasExistingFiles && meta?.diskPath && fs.existsSync(meta.diskPath)) {
        existingFiles = listExistingFilesBounded(meta.diskPath, 100);
        // P12.9 (E2E run #15): the LIST alone still left SEARCH guessing —
        // the planner baked imagined content (31× SEARCH-not-found). Hand it
        // the actual bytes of the key small files so SEARCH is verbatim.
        existingFileContents = existingFiles.length ? readKeyFileContents(meta.diskPath, existingFiles) : null;
      }
    } catch (_) {}

    const directive = hasExistingFiles
      ? `[SURGICAL_DIRECTIVE: Inspect existing workspace files first. Apply surgical targeted edits to affected files only without wiping or regenerating unrelated code.` +
        (existingFiles.length ? ` EXISTING FILES (these paths ALREADY EXIST — never plan write_file for them, it is REJECTED; to change one, read_file it then apply_diff): ${existingFiles.join(', ')}` : '') +
        `]`
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
          expectedOutput: task.expectedOutput,
          ...(existingFiles.length ? { existingFiles } : {}),
          ...(existingFileContents ? { existingFileContents } : {})
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
          { onEvent, permissionLevel, approvalToken: approvalToken || undefined, approvalState: approvalState || undefined }
        );

        // Execution completed all steps successfully
        if (lastResult?.status === 'SUCCEEDED') {
          return lastResult;
        } else {
          lastError = lastResult?.error || lastResult?.reason || 'Unknown execution failure';
        }
        // P12.3: an approval gate cannot self-heal — a repair plan without a
        // token hits the same gate. Propagate immediately (code preserved) so
        // the run pauses honestly instead of burning repair/LLM budget.
        if (typeof lastError === 'string' && lastError.startsWith('APPROVAL_REQUIRED')) {
          throw Object.assign(new Error(lastError), { code: 'APPROVAL_REQUIRED' });
        }
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} status: ${lastResult?.status}, error: ${lastError}`);
      } catch (error) {
        if (error?.code === 'APPROVAL_REQUIRED') throw error;
        lastError = error.message;
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} caught error: ${lastError}`);
      }
    }

    throw new Error(`Worker ${task.id} failed after ${attempt} self-healing attempts. Final error: ${lastError}`);
  }

  async run({ userId, projectId, request, signal = null, onEvent = () => {}, maxRepairs = 3, plan: presetPlan = null, permissionLevel = 'auto', approvalToken = null }) {
    // P12.3: ONE shared mutable approval state for this run — every worker (and
    // the final verification) gets the SAME holder. ExecutionController's
    // single-use rotation writes through the ChatPlanner context proxy into it,
    // so a worker that builds its context later reads the ROTATED token instead
    // of the original one an earlier worker already consumed
    // ("already consumed (replay rejected)" used to kill every later gated step).
    const approvalState = { token: approvalToken || null };
    // Plan-mode override: use the user-approved plan (normalized + validated —
    // bad shapes fall back to a generic sequential plan, never crash).
    const plan = presetPlan ? normalizePlan(presetPlan, request) : await this.createPlan(request, { projectId });
    const supervisorResult = await this.coordinator.createSupervisorTask({ userId, projectId, title: `Copilot Director: ${String(request).slice(0, 180)}`, prompt: request, metadata: { source: 'copilot-director', plannedTaskCount: plan.tasks.length } });
    const supervisorTaskId = supervisorResult.task.id;
    const supervisorRunId = supervisorResult.run.id;
    const completed = new Map();
    const results = [];
    const markCancelled = (reason = 'Task canceled by user') => {
      this.agentTaskDao.updateStatus(supervisorTaskId, 'CANCELLED');
      this.agentRunDao.updateStatus(supervisorRunId, 'CANCELLED', reason, null, new Date().toISOString());
      return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
    };
    onEvent({ type: 'director_plan', status: 'PLANNED', summary: plan.summary, taskCount: plan.tasks.length, tasks: plan.tasks.map(({ id, specialty, role, dependsOn }) => ({ id, specialty, role, dependsOn })) });
    this.agentTaskDao.updateStatus(supervisorTaskId, 'RUNNING');
    this.agentRunDao.updateStatus(supervisorRunId, 'RUNNING');
    try {
      const pending = new Set(plan.tasks.map((task) => task.id));
      while (pending.size) {
        if (signal?.aborted) return markCancelled();
        const ready = plan.tasks.filter((task) => pending.has(task.id) && task.dependsOn.every((dep) => completed.get(dep) === 'SUCCEEDED'));
        if (!ready.length) {
          // P12.3: remaining tasks are blocked by skipped/failed deps — report
          // them honestly and proceed to verification instead of crashing the
          // whole run ("dependency-blocked" used to discard completed work).
          for (const stuck of plan.tasks.filter((task) => pending.has(task.id))) {
            pending.delete(stuck.id);
            results.push({ task: stuck, status: 'SKIPPED', error: 'Dependency did not succeed' });
            onEvent({ type: 'director_task', status: 'SKIPPED', taskId: stuck.id, specialty: stuck.specialty, role: stuck.role, error: 'Dependency did not succeed' });
          }
          break;
        }
        for (const task of ready) {
          pending.delete(task.id);
          let delegated = null;
          let executionResult = null;
          let lastError = null;
          let delegateFailed = null;
          for (let attempt = 1; attempt <= MAX_WORKER_RETRIES + 1; attempt += 1) {
            onEvent({ type: 'director_task', status: attempt === 1 ? 'DELEGATING' : 'RETRYING', attempt, taskId: task.id, specialty: task.specialty, role: task.role, objective: task.objective });
            try {
              delegated = await this.coordinator.delegate({ supervisorRunId, role: task.role, objective: task.objective, constraints: { specialty: task.specialty, directorTaskId: task.id, attempt }, expectedOutput: task.expectedOutput });
            } catch (delegateErr) {
              // P12.3: a spawn failure (worker cap, project limits) must not
              // nuke completed work — skip this task honestly and move on;
              // its dependents are skipped by the !ready branch above.
              logger.warn(`[CopilotDirector] delegate failed for task ${task.id}: ${delegateErr.message}`);
              delegateFailed = delegateErr;
              break;
            }
            try {
              executionResult = await this.coordinator.startWorker(delegated.workerRun.id, { autoPlan: false, runner: () => this.executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent, permissionLevel, approvalToken, approvalState }) });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              if (signal?.aborted || ['APPROVAL_REQUIRED', 'TASK_CANCELED'].includes(error?.code)) break;
            }
          }
          if (delegateFailed) {
            results.push({ task, status: 'SKIPPED', error: delegateFailed.message });
            onEvent({ type: 'director_task', status: 'SKIPPED', taskId: task.id, specialty: task.specialty, role: task.role, error: delegateFailed.message });
            continue;
          }
          if (lastError && (signal?.aborted || lastError?.code === 'TASK_CANCELED')) {
            return markCancelled(lastError.message || 'Task canceled by user');
          }
          if (lastError) {
            completed.set(task.id, 'FAILED');
            results.push({ task, status: 'FAILED', error: lastError.message });
            onEvent({ type: 'director_task', status: 'FAILED', taskId: task.id, specialty: task.specialty, role: task.role, error: lastError.message });
            throw lastError;
          }
          const executionStatus = String(executionResult?.status || '').toUpperCase();
          const taskStatus = executionStatus === 'CANCELLED'
            ? 'CANCELLED'
            : ['SUCCEEDED', 'COMPLETED'].includes(executionStatus)
              ? 'SUCCEEDED'
              : 'FAILED';
          if (taskStatus === 'FAILED') {
            const failureMessage = executionResult?.error || executionResult?.reason ||
              `Worker ${task.id} returned non-success status "${executionResult?.status || 'unknown'}".`;
            completed.set(task.id, 'FAILED');
            results.push({ task, status: 'FAILED', error: failureMessage, workerRunId: delegated.workerRun.id, result: executionResult });
            onEvent({ type: 'director_task', status: 'FAILED', taskId: task.id, specialty: task.specialty, role: task.role, workerRunId: delegated.workerRun.id, error: failureMessage, result: executionResult });
            throw new Error(failureMessage);
          }

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

          if (taskStatus === 'CANCELLED') return markCancelled('Worker canceled execution');
        }
      }
      onEvent({ type: 'director_verification', status: 'DELEGATING' });
      const verifier = await this.coordinator.delegate({ supervisorRunId, role: 'VERIFIER', objective: `Perform the final read-only verification gate for the requested outcome: ${request}. Inspect the current workspace state and confirm tests/build/runtime evidence where supported. Do not mutate the workspace.`, constraints: { specialty: 'verification', generatedByDirector: true }, expectedOutput: 'Final verification evidence and any remaining blockers.' });
      const finalVerification = await this.coordinator.startWorker(verifier.workerRun.id, { runner: async () => { const verificationPlan = await this.taskPlanner.generateVerificationPlan(request, { projectId, request, role: 'VERIFIER' }); return this.plannerExecutionLoop.runWithPlan(projectId, userId, verificationPlan, 0, () => Boolean(signal?.aborted), `copilot_verify_${verifier.workerRun.id}`, { onEvent, permissionLevel, approvalToken: approvalToken || undefined, approvalState: approvalState || undefined }); } });
      const verificationStatus = String(finalVerification?.status || 'FAILED').toUpperCase();
      const verificationSummary = String(
        finalVerification?.summary || finalVerification?.result?.summary || finalVerification?.message || ''
      ).trim().slice(0, 400);
      const verificationArtifacts = Array.isArray(finalVerification?.artifact_refs)
        ? finalVerification.artifact_refs.filter((ref) => typeof ref === 'string' && ref.trim()).slice(0, 10)
        : [];
      onEvent({
        type: 'director_verification',
        status: verificationStatus,
        workerRunId: verifier.workerRun.id,
        summary: verificationSummary || undefined,
        artifact_refs: verificationArtifacts,
        result: finalVerification
      });
      if (verificationStatus !== 'SUCCEEDED') throw new Error('Final Director verification gate did not pass');
      const incompleteTasks = results.filter((item) => item.status !== 'SUCCEEDED');
      if (incompleteTasks.length > 0) {
        const taskSummary = incompleteTasks
          .slice(0, 8)
          .map(({ task, status }) => `${task.id} (${status})`)
          .join(', ');
        const remainder = incompleteTasks.length > 8 ? `, and ${incompleteTasks.length - 8} more` : '';
        throw new Error(
          `Director cannot report success: ${incompleteTasks.length} planned task(s) did not succeed: ${taskSummary}${remainder}`
        );
      }
      this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
      this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
      const artifactRefs = [
        ...results.flatMap((item) => item.result?.result?.artifact_refs || item.result?.artifact_refs || []),
        ...verificationArtifacts
      ].filter((ref, index, all) => typeof ref === 'string' && ref.trim() && all.indexOf(ref) === index).slice(0, 10);
      const completion = {
        type: 'director_complete',
        status: 'SUCCEEDED',
        taskId: supervisorTaskId,
        runId: supervisorRunId,
        taskCount: plan.tasks.length,
        verification: {
          status: verificationStatus,
          summary: verificationSummary || 'Final verification passed.',
          artifact_refs: verificationArtifacts
        }
      };
      onEvent(completion);
      return ResultValidator.validate({
        status: 'COMPLETED',
        summary: `Director completed ${plan.tasks.length} adaptive task(s) and final verification.`,
        artifact_refs: artifactRefs,
        context_refs: [],
        verification_status: 'PASSED',
        errors: []
      });
    } catch (error) {
      if (signal?.aborted || error?.code === 'TASK_CANCELED') {
        return markCancelled(error.message || 'Task canceled by user');
      }
      this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
      this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', error.message);
      throw error;
    }
  }
}

module.exports = { CopilotDirector, normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE, MAX_TASKS, hasDependencyCycle };
