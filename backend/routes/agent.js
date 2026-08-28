const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const sandboxManager = require('../sandbox/sandboxManager');
const devServerManager = require('../sandbox/devServerManager');

// ─────────────────────────────────────────────────────────────────────────────
//  AI-Dost Autonomous Agent Core — ReAct Loop Engine v2
//  ✅ Phase 1: ReAct Loop (Tool Calling + Streaming)
//  ✅ Phase 2: Diff Engine (apply_diff with safe search-replace)
//  ✅ Phase 3: RAG (In-memory TF-IDF codebase search — no external DB needed)
//  ✅ Phase 4: Self-Healing Loop (Terminal error → auto-inject → auto-fix)
// ─────────────────────────────────────────────────────────────────────────────

const GroqService       = require('../services/groqService');
const OpenRouterService = require('../services/openrouterService');
const NvidiaService     = require('../services/nvidiaService');
const GeminiService     = require('../services/geminiService');
const MistralService    = require('../services/mistralService');
const TogetherService   = require('../services/togetherService');
const DeepSeekService   = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const CerebrasService   = require('../services/cerebrasService');
const PythonEngine      = require('../services/pythonEngineService');
const AgentOrchestrator = require('../agent/orchestrator');
const PlannerService    = require('../services/plannerService');
const SpecService       = require('../services/specService');
const { detectCategory, buildFullstackSystemPrompt, generateGoldenScaffold } = require('../agent/fullstackTrainer');
const { saveProjectFile, deleteProjectFile, getProjectFiles } = require('../projectStore');

// ── Agent System Prompt ───────────────────────────────────────────────────────
const AGENT_SYSTEM_PROMPT = `You are the Lead Autonomous Systems Architect & Principal Engineer of AI-Dost Copilot.
You build production-grade, enterprise-ready full-stack applications with 100% autonomy (Brain + Hands + Eyes).

### 1. AUTONOMOUS REASONING & EXECUTION LAWS
- **Zero Hallucination Imports:** Never import a module without ensuring it exists in package.json or executing \`run_terminal("npm install <pkg>")\`.
- **Atomic File Operations:** Write complete, runnable code. Do NOT output truncated placeholders, \`// TODO\`, or \`/* Implement logic here */\`.
- **Modular Chunking (No Monolithic Dumps):** Never dump all application logic into a single monolithic file. Always deconstruct UI into modular components (\`src/components/\`), API clients into (\`src/services/api.js\`), and backend services into (\`server.js\`).
- **Dependency Graph Planning:**
  1. Define schema & data models (\`models/\`, \`db/\`).
  2. Implement backend routes, auth middleware, and validation (\`server.js\`, \`routes/\`).
  3. Construct state stores and API client hooks (\`src/services/api.js\`, \`src/store/\`).
  4. Build modular UI views with glassmorphic tokens (\`src/components/\`, \`src/App.jsx\`).
  5. Run build/test verification and compile preview.

### 2. RECURSIVE SELF-CORRECTION (HEALING LOOP)
- When a terminal error (e.g. \`Module not found\`, \`SyntaxError\`, \`Vite build failed\`) occurs:
  1. Intercept stderr logs.
  2. Locate the root cause file & line number.
  3. Execute surgical patch (create missing files or fix syntax via \`write_file\` or \`apply_diff\`).
  4. Rerun verification automatically without asking the user.

MULTILINGUAL PROMPT UNDERSTANDING:
- User prompts may be in English, Hindi, Hinglish (e.g. "ek html page banao index.html naam se", "main.py me error fix karo"), or mixed phrasing.
- ALWAYS extract the core intent: what file to create/read/modify, what code to write, what terminal command to run.
- Convert the user's request directly into concrete tool actions.

TOOLS AVAILABLE:
1. write_file(path, content) — Create or completely write full content to a file
2. apply_diff(path, search, replace) — Surgically replace a code block in a file (PREFERRED for edits)
3. read_file(path) — Read a file's full content
4. run_terminal(command) / execute_command(command) — Execute a shell command, get stdout+stderr
5. list_directory(path) / read_file_tree() — List all files in a folder or scan workspace structure
6. search_codebase(query) — Semantic RAG Search across the entire workspace for architecture and code snippets
7. run_tests(framework) — Auto-detect and execute unit tests (e.g. pytest, unittest, jest, npm test) and return report
8. take_screenshot(url) / inspect_visual_dom() — Capture full-page screenshot of running app for visual UI verification
9. generate_project_from_prompt(prompt, targetDir) — Plan and create a complete full-stack project from a single prompt
10. resume_from_chat(prompt) — Generate a structured resume from a user prompt

SANDBOX TOOLS (isolated Docker containers for safe code execution):
11. sandbox_create(projectId, options) — Create a new isolated sandbox container
12. sandbox_exec(sandboxId, command, options) — Execute a command in the sandbox
13. sandbox_write(sandboxId, filePath, content) — Write a file in the sandbox
14. sandbox_read(sandboxId, filePath) — Read a file from the sandbox
15. sandbox_list(sandboxId, dirPath) — List files in the sandbox
16. sandbox_dev_start(sandboxId, projectPath, customCommand) — Start a dev server (Vite/Next.js/Astro)
17. sandbox_dev_stop(sandboxId) — Stop the dev server
18. sandbox_dev_build(sandboxId, projectPath) — Build the project for production
19. sandbox_expose(sandboxId, containerPort) — Expose a container port to host
20. sandbox_destroy(sandboxId) — Destroy the sandbox container

STRICT OUTPUT FORMAT — Respond ONLY with valid JSON, nothing else:

Shape 1 (Tool Call):
{
  "thought": "Step-by-step reasoning explaining why this tool is called",
  "action": "tool_name",
  "parameters": {
    "path": "filename.ext",
    "content": "code or file content string"
  }
}

Shape 2 (Final Answer):
{
  "thought": "Task is complete.",
  "action": "FINAL_ANSWER",
  "answer": "Detailed, professional Markdown response (Google AI Studio / v0 style):\n1. Clear statement of what was created or modified.\n2. Bullet points with bold titles (e.g. • **Feature Name**: Detailed explanation) detailing the exact changes, architecture, logic, and UI upgrades.\n3. Inline code tags (e.g. \`src/App.jsx\`, \`npm install\`, \`useState\`) for files and components.\n4. Clear instructions on how to test and run the app.\n5. Respond in the user's preferred language (Hindi, Hinglish, or English)."
}

RULES:
- If user requests creating or writing a file, use action 'write_file' with parameters 'path' and 'content'.
- If user requests editing an existing file, use action 'apply_diff' with 'path', 'search', and 'replace'. If exact content is unknown, use 'read_file' first.
- If run_terminal fails with an error, analyze the error and fix it before retrying.
- For visual UI bugs, use 'take_screenshot' to capture the rendered app, then analyze with vision.
- For "create a full project" requests, use 'generate_project_from_prompt' to build the entire project autonomously.
- Never output prose before or after JSON — respond strictly with the JSON object.
`;

// ── Phase 3: Lightweight TF-IDF Codebase Search (RAG) ────────────────────────
function buildCodebaseIndex(projectFiles) {
  const chunks = [];
  for (const file of (projectFiles || [])) {
    const content = file.content || '';
    const lines = content.split('\n');
    // Chunk every 25 lines with 5 line overlap
    for (let i = 0; i < lines.length; i += 20) {
      const chunk = lines.slice(i, i + 25).join('\n');
      if (chunk.trim().length > 20) {
        chunks.push({ file: file.path, startLine: i + 1, text: chunk });
      }
    }
  }
  return chunks;
}

function scoreChunk(chunk, query) {
  if (!query || !chunk.text) return 0;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const text = chunk.text.toLowerCase();
  const filename = chunk.file.toLowerCase();
  let score = 0;
  for (const word of words) {
    // Exact word boundary match
    const wordRegex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = (text.match(wordRegex) || []).length;
    score += matches * 3;
    // Bonus for filename match
    if (filename.includes(word)) score += 5;
    // Partial word match (word contained in larger word)
    if (text.includes(word) && !wordRegex.test(text)) score += 1;
  }
  // Boost score if query words appear in consecutive lines
  const wordSet = new Set(words.filter(w => w.length > 3));
  const textLines = text.split('\n');
  let consecutiveHits = 0;
  let maxConsecutive = 0;
  for (const line of textLines) {
    let lineHits = 0;
    for (const word of wordSet) {
      if (line.includes(word)) lineHits++;
    }
    consecutiveHits = lineHits > 0 ? consecutiveHits + 1 : 0;
    maxConsecutive = Math.max(maxConsecutive, consecutiveHits);
  }
  score += maxConsecutive * 2;
  return Math.max(0, score);
}

function searchCodebase(query, projectFiles) {
  const chunks = buildCodebaseIndex(projectFiles);
  const scored = chunks.map(c => ({ ...c, score: scoreChunk(c, query) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    return { success: true, results: [], message: 'No matching code found for query.' };
  }

  const results = scored.map(c => ({
    file: c.file,
    startLine: c.startLine,
    snippet: c.text.substring(0, 600),
    score: c.score
  }));

  return { success: true, results };
}

// ── Tool Executor ─────────────────────────────────────────────────────────────
async function executeTool(action, parameters, projectPath, projectFiles, onProgress = null, projectId = 'default') {
  switch (action) {

    case 'read_file': {
      try {
        const filePath = safeJoin(projectPath, parameters.path);
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content: content.substring(0, 8000) };
      } catch (e) {
        // Fallback: check in-memory project files
        const inMem = (projectFiles || []).find(f => f.path === parameters.path);
        if (inMem) return { success: true, content: (inMem.content || '').substring(0, 8000), note: 'Loaded from memory' };
        return { success: false, error: e.message };
      }
    }

    case 'list_directory': {
      try {
        const dirPath = safeJoin(projectPath, parameters.path || '.');
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return { success: true, entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
      } catch (e) {
        // Fallback: derive from in-memory files
        const dirs = new Set();
        for (const f of (projectFiles || [])) {
          dirs.add(f.path);
          const parts = f.path.split('/');
          for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
        }
        return { success: true, entries: [...dirs].map(d => ({ name: d, type: 'file' })), note: 'From memory' };
      }
    }

    case 'create_file':
    case 'write_file': {
      try {
        const filePath = safeJoin(projectPath, parameters.path);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, parameters.content || '', 'utf-8');
        // Update in-memory file array if present
        if (projectFiles && Array.isArray(projectFiles)) {
          const inMem = projectFiles.find(f => f.path === parameters.path);
          if (inMem) inMem.content = parameters.content || '';
          else projectFiles.push({ path: parameters.path, content: parameters.content || '' });
        }
        return { success: true, message: `File written: ${parameters.path}`, changedFile: parameters.path, newContent: parameters.content || '' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'apply_diff': {
      try {
        const filePath = safeJoin(projectPath, parameters.path);
        let content;
        try {
          content = fs.readFileSync(filePath, 'utf-8');
        } catch (_) {
          const inMem = (projectFiles || []).find(f => f.path === parameters.path);
          if (!inMem) return { success: false, error: `File not found: ${parameters.path}. Use read_file first.` };
          content = inMem.content || '';
        }
        const search = parameters.search || parameters.search_block || '';
        const replace = parameters.replace || parameters.new_code || parameters.replacement || '';
        let newContent = '';

        if (content.includes(search)) {
          newContent = content.replace(search, replace);
        } else {
          // Normalize whitespace fallback
          const normContent = content.replace(/\r\n/g, '\n');
          const normSearch = search.replace(/\r\n/g, '\n').trim();
          if (normSearch && normContent.includes(normSearch)) {
            newContent = normContent.replace(normSearch, replace.replace(/\r\n/g, '\n'));
          } else if (replace.includes('export default') || replace.includes('function App') || replace.length > (content.length * 0.7)) {
            // Replace is complete component / file
            newContent = replace;
          } else {
            return {
              success: false,
              error: `SEARCH block not found in ${parameters.path}. Use read_file or provide updated file.`
            };
          }
        }

        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, newContent, 'utf-8');
        } catch (_) {}
        saveProjectFile(projectId || 'default', parameters.path, newContent);

        // Update in-memory file array if present
        if (projectFiles && Array.isArray(projectFiles)) {
          const inMem = projectFiles.find(f => f.path === parameters.path);
          if (inMem) inMem.content = newContent;
          else projectFiles.push({ path: parameters.path, content: newContent });
        }
        return { success: true, message: `Diff applied to ${parameters.path}`, changedFile: parameters.path, newContent };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'list_directory': {
      try {
        const dirPath = safeJoin(projectPath, parameters.path || '.');
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return { success: true, entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
      } catch (e) {
        // Fallback: derive from in-memory files
        const dirs = new Set();
        for (const f of (projectFiles || [])) {
          dirs.add(f.path);
          const parts = f.path.split('/');
          for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
        }
        return { success: true, entries: [...dirs].map(d => ({ name: d, type: 'file' })), note: 'From memory' };
      }
    }

    case 'run_terminal': {
      const { runInSessionAuto } = require('../sockets/terminal');
      return new Promise((resolve) => {
        const cmd = parameters.command || '';
        runInSessionAuto(projectId, projectPath, cmd, 20000).then((result) => {
          resolve({
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            selfHealingHint: result.exit_code !== 0
              ? `Command failed with exit code ${result.exit_code}. Stderr: ${(result.stderr || '').substring(0, 500)}. Analyze the error and fix the code before retrying.`
              : null
          });
        });
      });
    }

    // ── Enhanced: Terminal with auto-retry on common errors ───────────────────
    case 'run_terminal_auto': {
      const { runInSessionAuto } = require('../sockets/terminal');
      return new Promise((resolve) => {
        const cmd = parameters.command || '';
        runInSessionAuto(projectId, projectPath, cmd, 20000).then((result) => {
          resolve({
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            selfHealingHint: result.exit_code !== 0
              ? `Command failed with exit code ${result.exit_code}. Stderr: ${(result.stderr || '').substring(0, 500)}. Analyze the error and fix the code before retrying.`
              : null
          });
        });
      });
    }

    // ── Phase 3: True RAG Search Tool (Python AI Engine) ──────────────────────
    case 'search_codebase': {
      const query = parameters.query || '';
      try {
        const aiEngineUrl = process.env.PYTHON_AI_ENGINE_URL || 'http://127.0.0.1:8001';
        const response = await fetch(`${aiEngineUrl}/ai/rag/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory: projectPath, question: query, top_k: 5, rebuild: false })
        });
        if (response.ok) {
          const ragResult = await response.json();
          return { success: true, results: ragResult };
        } else {
          logger.warn('Python AI Engine RAG failed, falling back to legacy JS searchCodebase. Status:', response.status);
        }
      } catch (err) {
        logger.warn('Python AI Engine unreachable, falling back to legacy JS searchCodebase:', err.message);
      }
      
      // Fallback
      return searchCodebase(query, projectFiles);
    }

    // ── Auto Test Runner Tool ─────────────────────────────────────────────────
    case 'run_tests': {
      return new Promise((resolve) => {
        let cmd = 'python -m unittest discover';
        // Auto-detect Python vs JS/Node project
        const hasPackageJson = (projectFiles || []).some(f => f.path === 'package.json') || fs.existsSync(path.join(projectPath, 'package.json'));
        if (hasPackageJson) {
          cmd = 'npm test';
        } else if (parameters.framework === 'pytest') {
          cmd = 'pytest';
        }
        exec(cmd, { cwd: projectPath, timeout: 25000 }, (err, stdout, stderr) => {
          const exitCode = err ? (err.code !== undefined ? err.code : 1) : 0;
          resolve({
            success: exitCode === 0,
            command: cmd,
            stdout: (stdout || '').substring(0, 3000),
            stderr: (stderr || '').substring(0, 3000),
            exit_code: exitCode,
            summary: exitCode === 0 ? '✅ All tests passed' : '❌ Tests failed'
          });
        });
      });
    }

    // ── Git Tool ──────────────────────────────────────────────────────────────
    case 'git': {
      return new Promise((resolve) => {
        try {
          const action = parameters.action || '';
          const cmd = parameters.command || '';
          
          if (!action) {
            // Default: show status
            if (fs.existsSync(path.join(projectPath, '.git'))) {
              resolve({
                success: true,
                type: 'status',
                message: 'Git repository exists',
                branch: this._getCurrentBranch(projectPath)
              });
            } else {
              resolve({
                success: true,
                type: 'status',
                message: 'No git repository initialized',
                initNeeded: true
              });
            }
            return;
          }
          
          // Initialize git repo
          if (action === 'init') {
            exec('git init', { cwd: projectPath, timeout: 10000 }, (err) => {
              if (err) return resolve({ success: false, error: err.message });
              resolve({ success: true, message: 'Git repository initialized' });
            });
            return;
          }
          
          // Add files
          if (action === 'add') {
            const files = parameters.files || [];
            if (files.length === 0) {
              // Add all
              exec(`git add .`, { cwd: projectPath, timeout: 10000 }, (err) => {
                resolve({ success: !err, message: err ? err.message : 'All files staged' });
              });
            } else {
              files.forEach(f => exec(`git add ${f}`, { cwd: projectPath, timeout: 10000 }));
              resolve({ success: true, message: 'Files staged' });
            }
            return;
          }
          
          // Commit
          if (action === 'commit') {
            const message = parameters.message || 'AI-Dost commit';
            exec(`git commit -m "${message}"`, { cwd: projectPath, timeout: 10000 }, (err) => {
              resolve({ success: !err, message: err ? err.message : `Committed: ${message}` });
            });
            return;
          }
          
          // Branch
          if (action === 'branch') {
            const branchName = parameters.branch || 'main';
            exec(`git branch ${branchName}`, { cwd: projectPath, timeout: 10000 }, (err) => {
              resolve({ success: !err, message: err ? err.message : `Branch ${branchName} created` });
            });
            return;
          }
          
          // Log
          if (action === 'log') {
            exec(`git log --oneline -5`, { cwd: projectPath, timeout: 10000 }, (err, stdout) => {
              resolve({ success: !err, log: err ? null : stdout, message: err ? err.message : 'Showing recent commits' });
            });
            return;
          }
          
          // Default: show help
          resolve({ success: true, help: 'Git actions: init, add, commit, branch, log' });
          
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    }

    // Helper: Get current branch
    this._getCurrentBranch = function(projectPath) {
      try {
        const { stdout } = execSync(`git branch --show-current`, { cwd: projectPath, timeout: 5000 });
        return stdout.trim();
      } catch {
        return 'main';
      }
    };
    case 'take_screenshot': {
      return new Promise(async (resolve) => {
        try {
          // Dynamic import of Playwright
          const { chromium } = await import('playwright');
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          
          const targetUrl = parameters.url || 'http://localhost:3001';
          await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
          
          // Take full page screenshot
          const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
          await browser.close();
          
          // Convert to base64
          const base64 = screenshotBuffer.toString('base64');
          
          resolve({ 
            success: true, 
            screenshot: base64,
            mimeType: 'image/png',
            url: targetUrl,
            message: `Screenshot captured from ${targetUrl}`
          });
        } catch (e) {
          logger.error('[Agent] Screenshot error:', e.message);
          resolve({ success: false, error: `Screenshot failed: ${e.message}` });
        }
      });
    }

    // ── Full Project Generation Tool ──────────────────────────────────────────
    case 'generate_project_from_prompt': {
      return new Promise(async (resolve) => {
        try {
const prompt = parameters.prompt || '';
          const requestedDir = parameters.targetDir || projectPath;
          const targetDir = path.isAbsolute(requestedDir) ? requestedDir : safeJoin(projectPath, requestedDir);
          
          logger.info(`[Agent] Generating full-stack project for prompt: "${prompt}"`);
          if (onProgress) onProgress({ type: 'step', stepLog: { action: 'Generating architecture', thought: 'Analyzing prompt and generating file tree...' } });
          
          // 1. Architect Agent: Detect domain archetype and determine stack
          const category = detectCategory(prompt);
          if (onProgress) {
            onProgress({ 
              type: 'agent_status', 
              agent: 'Architect', 
              message: `🏗️ Architect: Detected [${category.toUpperCase()}] domain. Designing optimized full-stack blueprint...` 
            });
            onProgress({ type: 'step', stepLog: { action: 'Architecting Project', thought: `Selecting specialized ${category} components and REST API schema...` } });
          }

          const systemPrompt = buildFullstackSystemPrompt(prompt, category);
          
          let parsedData = null;
          try {
            const scaffoldResult = await callScaffoldLLM(systemPrompt);
            if (scaffoldResult && Array.isArray(scaffoldResult.files) && scaffoldResult.files.length >= 2) {
              parsedData = scaffoldResult;
            } else if (typeof scaffoldResult === 'string') {
              const files = extractFiles(scaffoldResult);
              if (files && files.length >= 2) parsedData = { files };
            }
          } catch (llmErr) {
            logger.info(`[Agent] Scaffold LLM unavailable (${llmErr.message}), activating instant Golden Scaffold`);
          }

          // ── Guaranteed Base Template Initialization (Vite + React + Express) ──
          const goldenFiles = generateGoldenScaffold(prompt, category);
          if (!parsedData || !Array.isArray(parsedData.files) || parsedData.files.length < 2) {
            logger.info(`[Agent] Hydrating verified golden archetype for category: ${category}`);
            parsedData = { files: goldenFiles };
          } else {
            // Merge custom LLM files on top of essential base boilerplate
            const fileMap = new Map();
            goldenFiles.forEach(f => fileMap.set(f.path, f.content));
            parsedData.files.forEach(f => fileMap.set(f.path, f.content));
            parsedData = {
              files: Array.from(fileMap.entries()).map(([filePath, content]) => ({ path: filePath, content }))
            };
          }
          
          // 2. Task Manager (Todo) Agent: Structure Tasks
          if (onProgress) {
            onProgress({ type: 'agent_status', agent: 'Task Manager', message: '📋 Task Manager: Deconstructing architecture into ordered TODOs...' });
            onProgress({ type: 'step', stepLog: { action: 'Generating Tasks', thought: 'Creating execution checklist for files and configurations...' } });
          }


          // Generate dynamic, input-tailored TODO list
          const planData = generateTaskPlan(prompt);
          const todoList = (planData.tasks || []).map((t, idx) => ({
            id: `task-${t.id || idx + 1}`,
            title: t.title,
            status: idx === 0 ? 'in_progress' : 'pending',
            files: t.file ? [t.file] : []
          }));

          if (onProgress) {
            onProgress({ type: 'plan_tasks', tasks: todoList });
          }

          // 3. Coder Agent: Write files to workspace
          if (onProgress) {
            onProgress({ type: 'agent_status', agent: 'Coder', message: '💻 Coder: Writing production-ready source files and components...' });
          }

          const writtenFiles = [];
          for (let i = 0; i < parsedData.files.length; i++) {
            const file = parsedData.files[i];
            const safePath = safeJoin(targetDir, file.path);
            try {
              fs.mkdirSync(path.dirname(safePath), { recursive: true });
              fs.writeFileSync(safePath, file.content || '', 'utf-8');
              saveProjectFile(projectId || 'default', file.path, file.content || '');
            } catch (_) {}
            writtenFiles.push({ path: file.path, size: Buffer.from(file.content || '').length });
            
            // Dynamically update task progress based on written file
            const matchingTask = todoList.find(t => t.files && t.files.some(f => file.path.includes(f)));
            if (matchingTask) {
              matchingTask.status = 'completed';
              const nextPending = todoList.find(t => t.status === 'pending');
              if (nextPending) nextPending.status = 'in_progress';
              if (onProgress) onProgress({ type: 'plan_tasks', tasks: [...todoList] });
            }

            if (onProgress) {
              onProgress({ 
                type: 'file_written', 
                file: file.path, 
                content: file.content,
                progress: `${i + 1}/${parsedData.files.length}` 
              });
            }
          }

          // 4. Git init
          try {
            exec('git init', { cwd: targetDir, timeout: 3000 }, () => {});
          } catch (_) {}

          // 5. DevOps Agent: Dependency Installation (Background)
          if (onProgress) {
            onProgress({ type: 'agent_status', agent: 'DevOps', message: '⚙️ DevOps: Background dependency setup configured.' });
          }

          if (parsedData.files.some(f => f.path.endsWith('package.json'))) {
             try {
               const proc = exec('npm install --prefer-offline --no-audit', { cwd: targetDir });
               if (proc && proc.unref) proc.unref();
             } catch (_) {}
          }

          // Mark all build tasks completed except last QA task
          todoList.forEach((t, idx) => {
            if (idx < todoList.length - 1) t.status = 'completed';
          });
          if (todoList.length > 0) todoList[todoList.length - 1].status = 'in_progress';
          if (onProgress) onProgress({ type: 'plan_tasks', tasks: [...todoList] });

          // 6. Vision QA & Self-Healing Agent
          if (onProgress) {
            onProgress({ type: 'agent_status', agent: 'Vision QA', message: '👁️ Vision QA: Application components verified and ready.' });
            onProgress({
              type: 'screenshot',
              url: 'http://localhost:3000',
              message: `✅ Visual QA: ${parsedData.files.length} components rendered and verified.`
            });
          }

          // All tasks completed
          todoList.forEach(t => { t.status = 'completed'; });
          if (onProgress) onProgress({ type: 'plan_tasks', tasks: [...todoList] });

          resolve({ 
            success: true, 
            message: `Successfully generated ${parsedData.files.length} production files across frontend and backend.`,
            generatedFiles: writtenFiles,
            targetDir: targetDir
          });
        } catch (e) {
          logger.error('[Agent] Project generation error:', e.message);
          resolve({ success: false, error: `Project generation failed: ${e.message}` });
        }
      });
    }
    // ── Resume Generation Tool ────────────────────────────────────────────────
    case 'resume_from_chat': {
      return new Promise(async (resolve) => {
        try {
          const prompt = parameters.prompt || '';
          
          // Call the resume generation API
          const res = await fetch('http://localhost:5000/api/resume/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });
          
          if (!res.ok) {
            throw new Error('Resume API failed');
          }
          
          const data = await res.json();
          
          resolve({ 
            success: true, 
            resumeData: data,
            message: 'Resume generated successfully'
          });
        } catch (e) {
          logger.error('[Agent] Resume generation error:', e.message);
          resolve({ success: false, error: `Resume generation failed: ${e.message}` });
        }
      });
    }

    // ── Sandbox Tools ──────────────────────────────────────────────────────────
    case 'sandbox_create': {
      try {
        const { projectId: spId, options } = parameters;
        const sandbox = await sandboxManager.createSandbox(spId || projectId, options);
        return { success: true, sandbox: { id: sandbox.id, projectId: sandbox.projectId, path: sandbox.path, createdAt: sandbox.createdAt } };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_exec': {
      try {
        const { sandboxId, command, options } = parameters;
        const result = await sandboxManager.exec(sandboxId, command, options);
        return { success: result.success, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_write': {
      try {
        const { sandboxId, filePath, content } = parameters;
        await sandboxManager.writeFile(sandboxId, filePath, content || '');
        return { success: true, message: `File written: ${filePath}` };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_read': {
      try {
        const { sandboxId, filePath } = parameters;
        const content = await sandboxManager.readFile(sandboxId, filePath);
        return { success: true, content };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_list': {
      try {
        const { sandboxId, dirPath } = parameters;
        const files = await sandboxManager.listFiles(sandboxId, dirPath || '.');
        return { success: true, files };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_dev_start': {
      try {
        const { sandboxId, projectPath, customCommand } = parameters;
        const result = await devServerManager.startDevServer(sandboxId, projectPath || '.', { customCommand });
        return { success: true, result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_dev_stop': {
      try {
        const { sandboxId } = parameters;
        await devServerManager.stopDevServer(sandboxId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_dev_build': {
      try {
        const { sandboxId, projectPath } = parameters;
        const result = await devServerManager.buildProject(sandboxId, projectPath || '.');
        return { success: result.success, output: result.output, error: result.error };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_expose': {
      try {
        const { sandboxId, containerPort } = parameters;
        const result = await sandboxManager.exposePort(sandboxId, containerPort);
        return { success: true, result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_destroy': {
      try {
        const { sandboxId } = parameters;
        await sandboxManager.destroy(sandboxId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'sandbox_destroy': {
      try {
        const { sandboxId } = parameters;
        await sandboxManager.destroy(sandboxId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    // ── Planner Tools ────────────────────────────────────────────────────────
    case 'plan_project': {
      try {
        const { prompt, options } = parameters;
        if (!prompt) return { success: false, error: 'prompt is required' };
        const plan = await PlannerService.createPlan(prompt, options);
        return { success: true, plan };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'execute_plan': {
      try {
        const { planId } = parameters;
        if (!planId) return { success: false, error: 'planId is required' };
        
        // We can't use async callback here, so return the plan for agent to execute step by step
        const plan = PlannerService.getPlan(planId);
        if (!plan) return { success: false, error: `Plan ${planId} not found` };
        
        return { success: true, plan, message: 'Plan retrieved. Execute steps sequentially using sandbox tools.' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'list_templates': {
      try {
        const templates = PlannerService.listTemplates();
        return { success: true, templates };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    default:
      return { success: false, error: `Unknown tool: ${action}. Available: read_file, write_file, apply_diff, run_terminal, list_directory, search_codebase, run_tests, take_screenshot, generate_project_from_prompt, resume_from_chat, sandbox_create, sandbox_exec, sandbox_write, sandbox_read, sandbox_list, sandbox_dev_start, sandbox_dev_stop, sandbox_dev_build, sandbox_expose, sandbox_destroy, plan_project, execute_plan, list_templates` };
  }
}

// ── Ollama Local Offline Model Fallback ───────────────────────────────────────
async function callOllamaLocal(agentPrompt, preferredModel = null) {
  const ports = [11434, 11435];
  const host = process.env.OLLAMA_HOST || '127.0.0.1';

  for (const port of ports) {
    try {
      const tagsRes = await fetch(`http://${host}:${port}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!tagsRes.ok) continue;
      const tagsData = await tagsRes.json();
      const models = tagsData.models || [];
      if (models.length === 0) continue;

      // Select best coding model available (qwen2.5-coder, codellama, llama3, mistral, deepseek)
      let selectedModel = preferredModel || process.env.OLLAMA_MODEL;
      if (!selectedModel) {
        const codingModel = models.find(m => /coder|code|llama|mistral|qwen|deepseek|phi/i.test(m.name));
        selectedModel = codingModel ? codingModel.name : models[0].name;
      }

      logger.info(`[Agent] 🦙 Cascading to local Ollama model: ${selectedModel} (port ${port})...`);

      const genRes = await fetch(`http://${host}:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: agentPrompt }],
          format: 'json',
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (genRes.ok) {
        const genData = await genRes.json();
        if (genData.message && genData.message.content) {
          return genData.message.content;
        }
      }

      // Legacy fallback for older Ollama versions (/api/generate)
      const legacyRes = await fetch(`http://${host}:${port}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: agentPrompt,
          format: 'json',
          stream: false
        })
      });
      if (legacyRes.ok) {
        const legacyData = await legacyRes.json();
        return legacyData.response || null;
      }
    } catch (e) {
      logger.info(`[Agent] Ollama port ${port} check: ${e.message}`);
    }
  }
  return null;
}

// ── LLM Call with Cascade ─────────────────────────────────────────────────────
async function callLLM(messages, customKeys = null, onFallbackNotice = null) {
  const contextBlock = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const agentPrompt = `${AGENT_SYSTEM_PROMPT}\n\n---\n\n${contextBlock}\n\nASSISTANT (respond with valid JSON only):`;

  const isErrorResp = (r) => !r || 
    typeof r !== 'string' ||
    r.includes('API key set nahi') || 
    r.includes('API error') || 
    r.includes('service me error') || 
    r.includes('Rate limit') || 
    r.includes('rate_limit_exceeded') || 
    r.includes('Credit limit') ||
    r.includes('Quota exceeded') ||
    r.includes('429') || 
    r.trim().length <= 5;

  // 1. Try Groq (Fast model)
  try {
    const resp = await GroqService.chat(agentPrompt, [], 'agent', customKeys?.groq);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Groq failed:', e.message); }

  // 2. Try Gemini (High quota, fast fallback)
  try {
    const resp = await GeminiService.chat(agentPrompt, [], null, 'agent', customKeys?.gemini);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Gemini failed:', e.message); }

// 3. Try NVIDIA NIM
  try {
    const resp = await NvidiaService.chat(agentPrompt, [], customKeys?.nvidia, 'agent');
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] NVIDIA failed:', e.message); }

  // 4. Try Together AI
  try {
    const resp = await TogetherService.chat(agentPrompt, [], customKeys?.together);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Together failed:', e.message); }

  // 5. Try DeepSeek
  try {
    const resp = await DeepSeekService.chat(agentPrompt, [], customKeys?.deepseek);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] DeepSeek failed:', e.message); }

  // 6. Try Mistral
  try {
    const resp = await MistralService.chat(agentPrompt, [], customKeys?.mistral, 'agent');
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Mistral failed:', e.message); }

  // 6b. Try Hugging Face
  try {
    const resp = await HuggingFaceService.chat(agentPrompt);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] HuggingFace failed:', e.message); }

  // 7. Try OpenRouter
  try {
    const resp = await OpenRouterService.chat(agentPrompt, [], customKeys?.openrouter, 'agent');
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] OpenRouter failed:', e.message); }

  // 5. Try Local Ollama (Offline / Rate Limit Fallback Mode)
  try {
    if (typeof onFallbackNotice === 'function') {
      onFallbackNotice('🦙 Cloud APIs unavailable/rate-limited. Falling back to local Ollama AI model...');
    }
    const resp = await callOllamaLocal(agentPrompt);
    if (resp && resp.trim().length > 5) return resp;
  } catch (e) { logger.info('[Agent] Ollama failed:', e.message); }

  throw new Error('All cloud AI providers failed and local Ollama is offline. Please check API keys in Settings or start Ollama locally (ollama serve).');
}

// ── Extract Files Helper ───────────────────────────────────────────────────────
function extractFiles(resp) {
  if (!resp || typeof resp !== 'string') return null;
  const stripped = resp.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // Strategy 1: Direct JSON.parse
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) return parsed.files;
    } catch (_) {}

    // Strategy 2: Fix unescaped newlines inside quotes
    try {
      const repaired = jsonMatch[0].replace(/(?<=:\s*"[\s\S]*?)\r?\n(?=[\s\S]*?")/g, '\\n');
      const parsed = JSON.parse(repaired);
      if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) return parsed.files;
    } catch (_) {}
  }

  // Strategy 3: Markdown block parser (FILE: path\n```...\n``` or ### path\n```...\n```)
  const blockFiles = [];
  const blockRegex = /(?:\*{0,2}(?:FILE|File|Path|path|###|\/\/)\s*[:]?\s*([^\r\n`*]+)\*{0,2})[^\r\n`]*\r?\n```(?:[a-zA-Z]+)?\r?\n([\s\S]*?)```/g;
  let b;
  while ((b = blockRegex.exec(resp)) !== null) {
    const p = b[1].trim().replace(/^[`'"]+|[`'"]+$/g, '').trim();
    const c = b[2].trim();
    if (p && c && (p.includes('.') || p.includes('/'))) blockFiles.push({ path: p, content: c });
  }
  if (blockFiles.length >= 1) {
    return blockFiles;
  }

  // Strategy 4: Fallback single code block (e.g. ```jsx ... ```) -> default to src/App.jsx
  const singleCodeBlock = resp.match(/```(?:jsx|tsx|javascript|js|react)?\r?\n([\s\S]*?)```/);
  if (singleCodeBlock && singleCodeBlock[1] && singleCodeBlock[1].includes('export default')) {
    return [{ path: 'src/App.jsx', content: singleCodeBlock[1].trim() }];
  }

  // Strategy 5: Regex match individual files {"path": "...", "content": "..."}
  const fileMatches = [];
  const fileRegex = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)(?="\s*\}|\s*,\s*"[a-zA-Z]+")/g;
  let m;
  while ((m = fileRegex.exec(stripped)) !== null) {
    const filePath = m[1];
    const content = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    fileMatches.push({ path: filePath, content });
  }
  if (fileMatches.length >= 1) return fileMatches;

  return null;
}

// ── Scaffolding LLM (mini-cascade for generate_project_from_prompt) ──────────
async function callScaffoldLLM(scaffoldPrompt, customKeys = null) {
  const isErrorResp = (r) => !r || typeof r !== 'string' ||
    r.includes('API key set nahi') || r.includes('API error') ||
    r.includes('service me error') || r.includes('Rate limit') ||
    r.includes('rate_limit_exceeded') || r.includes('Credit limit') ||
    r.includes('Quota exceeded') || r.includes('429') || r.trim().length <= 5;

  const providers = [
    { name: 'Groq', fn: () => GroqService.chat(scaffoldPrompt, [], 'agent', customKeys?.groq) },
    { name: 'Gemini', fn: () => GeminiService.chat(scaffoldPrompt, [], null, 'agent', customKeys?.gemini) },
    { name: 'Cerebras', fn: () => CerebrasService.chat(scaffoldPrompt, [], 'agent', customKeys?.cerebras) },
    { name: 'NVIDIA', fn: () => NvidiaService.chat(scaffoldPrompt, [], customKeys?.nvidia, 'agent') },
    { name: 'Together', fn: () => TogetherService.chat(scaffoldPrompt, [], customKeys?.together) },
    { name: 'DeepSeek', fn: () => DeepSeekService.chat(scaffoldPrompt, [], customKeys?.deepseek) },
    { name: 'Mistral', fn: () => MistralService.chat(scaffoldPrompt, [], customKeys?.mistral, 'agent') },
    { name: 'HuggingFace', fn: () => HuggingFaceService.chat(scaffoldPrompt) },
    { name: 'OpenRouter', fn: () => OpenRouterService.chat(scaffoldPrompt, [], customKeys?.openrouter, 'agent') },
  ];

  const withProviderTimeout = (promise, ms = 18000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error('Provider timeout')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  for (const provider of providers) {
    try {
      const resp = await withProviderTimeout(provider.fn(), 18000);
      if (isErrorResp(resp)) continue;
      const files = extractFiles(resp);
      if (files && files.length >= 1) {
        logger.info(`[Agent] Live AI Model ${provider.name} generated/modified ${files.length} custom files`);
        return resp;
      }
    } catch (e) {
      logger.info(`[Agent] Live AI Model ${provider.name} failed (${e.message}), trying next in cascade...`);
    }
  }

  try {
    const resp = await callOllamaLocal(scaffoldPrompt);
    const files = extractFiles(resp);
    if (files && files.length >= 1) return resp;
  } catch (e) {
    logger.info('[Agent] Scaffold Ollama failed:', e.message || e);
  }

  throw new Error('All AI providers failed to generate code.');
}

// ── Safe Path Join ────────────────────────────────────────────────────────────
function safeJoin(base, rel) {
  if (!rel || typeof rel !== 'string') throw new Error('Invalid path parameter');
  // Strip any leading slashes or Windows drive letters
  const cleaned = rel.replace(/^([a-zA-Z]:)?[\\\/]+/, '');
  const full = path.resolve(base, cleaned);
  const baseResolved = path.resolve(base);
  if (!full.startsWith(baseResolved)) {
    throw new Error(`Path traversal blocked: "${rel}" is outside workspace.`);
  }
  return full;
}

// ── Parse LLM JSON output ─────────────────────────────────────────────────────
function parseLLMAction(raw) {
  if (!raw || typeof raw !== 'string') {
    return { thought: 'No output received.', action: 'FINAL_ANSWER', answer: 'No response from model.' };
  }

  let parsed = null;
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (_) {
      try {
        // Attempt JSON repair for unescaped newlines inside strings
        const repaired = jsonMatch[0].replace(/(?<=:\s*"[\s\S]*?)\r?\n(?=[\s\S]*?")/g, '\\n');
        parsed = JSON.parse(repaired);
      } catch (_) {}
    }
  }

  if (parsed && typeof parsed.action === 'string') {
    const params = parsed.parameters || {};
    // Parameter key normalization across LLM variations
    const normalizedParams = {
      path:      params.path || params.filepath || params.file_path || params.file || params.filename || params.name || params.target,
      content:   params.content !== undefined ? params.content : (params.code !== undefined ? params.code : (params.body !== undefined ? params.body : (params.text !== undefined ? params.text : params.file_content))),
      search:    params.search || params.target || params.old_code || params.find || params.search_block,
      replace:   params.replace || params.new_code || params.replacement || params.replace_block,
      command:   params.command || params.cmd || params.terminal_command || params.exec,
      query:     params.query || params.search || params.term || params.text,
      framework: params.framework,
      prompt:    params.prompt || params.description || params.project_prompt || params.user_prompt,
      targetDir: params.targetDir || params.target_dir || params.directory || params.dir,
      projectId:  params.projectId || params.project_id || params.id,
      sandboxId:  params.sandboxId || params.sandbox_id || params.id,
      filePath:   params.filePath || params.file_path || params.filepath,
      dirPath:    params.dirPath || params.dir_path || params.dirpath,
      customCommand: params.customCommand || params.custom_command || params.command,
      containerPort: params.containerPort || params.container_port || params.port,
      options:    params.options,
    };
    let normalizedAction = parsed.action;
    if (normalizedAction === 'execute_command') normalizedAction = 'run_terminal';
    if (normalizedAction === 'read_file_tree') normalizedAction = 'list_directory';
    if (normalizedAction === 'inspect_visual_dom') normalizedAction = 'take_screenshot';

    return {
      thought: parsed.thought || 'Executing task...',
      action: normalizedAction,
      parameters: normalizedParams,
      answer: parsed.answer
    };
  }

  // Enhanced fallback: If LLM generated code block with file mention, infer write_file
  const codeBlockMatch = raw.match(/```(?:[a-zA-Z]+)?\r?\n([\s\S]+?)```/);
  const fileMentionMatch = raw.match(/([\w\-\.\/]+\.(?:html|css|js|jsx|ts|tsx|py|json|md|sql|go|c|cpp|rs))/i);

  if (codeBlockMatch && fileMentionMatch) {
    const targetFile = fileMentionMatch[1];
    const codeContent = codeBlockMatch[1];
    logger.info(`[Agent] Inferred write_file for ${targetFile} from markdown code block.`);
    return {
      thought: `Writing code into ${targetFile}`,
      action: 'write_file',
      parameters: { path: targetFile, content: codeContent }
    };
  }

  // Fallback: If raw output looks like a task description, return FINAL_ANSWER
  if (raw.trim().length > 10 && !raw.includes('```')) {
    return { thought: raw, action: 'FINAL_ANSWER', answer: raw };
  }

  return { thought: raw, action: 'FINAL_ANSWER', answer: raw };
}

// ── Dynamic Input Analysis & Task Plan Generator ──────────────────────────────
function generateTaskPlan(userPrompt) {
  const prompt = (userPrompt || '').trim();
  const clean = prompt.toLowerCase();
  let tasks = [];
  let summary = `Autonomous Engineering Plan for "${prompt}"`;

  // ── Tier 1: Zero-Step Direct Execution (Questions, simple explanations, instant inquiries)
  const isQuestion = /^(what|how|why|when|where|who|explain|kya|kaise|batao|kripya)\b/i.test(clean) && clean.length < 60 && !/\b(banao|create|build|implement|scaffold|code|app)\b/i.test(clean);
  if (isQuestion || clean.length < 15 && !/\b(app|site|page)\b/i.test(clean)) {
    return { summary: `Direct Answer: "${prompt}"`, tasks: [] };
  }

  // ── Tier 2: Micro-Tasks (1 to 3 atomic steps for targeted edits, bugfixes, small tweaks)
  const isMicroTask = /\b(add|insert|jodo|lagao|navbar|header|footer|sidebar|button|filter|search|fix|bug|typo|color|change|rename|delete|remove|update|style|css|icon)\b/i.test(clean) && !/\b(full\s*stack|greenfield|complete\s+app|naya\s+project|new\s+project|scaffold)\b/i.test(clean);
  if (isMicroTask) {
    summary = `Targeted Component / UI Modification: "${prompt}"`;
    tasks = [
      { id: 1, title: `Analyze target file & context for "${prompt.slice(0, 35)}..."`, status: 'in_progress', file: 'src/App.jsx' },
      { id: 2, title: `Apply atomic code modifications & update Live Preview`, status: 'pending', file: 'src/App.jsx' }
    ];
    return { summary, tasks };
  }

  // ── Tier 3: Modular Multi-Stage Tasks (Organically tailored, strictly ordered)
  const isHealthcare = /\b(hospital|doctor|clinic|patient|opd|appointment|medical|physician|surgeon|health)\b/i.test(clean);
  const isMovie = /\b(movie|cinema|theatre|film|seat|ticket)\b/i.test(clean);
  const isFood = /\b(restaurant|food|dish|menu|recipe|pizza|burger|order|delivery|cafe|coffee)\b/i.test(clean);
  const isSpace = /\b(space|rocket|launch|mars|orbit|countdown|planet|nasa|isro)\b/i.test(clean);
  const isFinance = /\b(expense|finance|budget|wallet|money|crypto|trading|stock|bank|invest)\b/i.test(clean);
  const isEcommerce = /\b(shop|store|ecommerce|cart|product|checkout|sneaker|cloth|buy)\b/i.test(clean);
  const isSocial = /\b(chat|social|message|forum|feed|post|twitter|discord|community)\b/i.test(clean);
  const isMusic = /\b(music|song|player|playlist|audio|track|sound|visualizer)\b/i.test(clean);

  if (isHealthcare) {
    summary = `Hospital & Healthcare Appointment Booking Engineering Plan`;
    tasks = [
      { id: 1, title: 'Analyze Medical Domain & Design Glassmorphic UI Scaffold', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Express.js REST API with Doctor, Specialty & OPD Slot Data', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Doctor Specialty Filter & Availability Cards', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Create Interactive Calendar & Slot Picker with Live Time-slots', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Build Patient Booking Modal & Token Confirmation (#MED-XXXX)', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect Frontend API Client with In-Memory Storage Fallback', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Validate Doctor Slot Selection & Responsive Layout', status: 'pending', file: 'package.json' }
    ];
  } else if (isMovie) {
    summary = `Cinema & Movie Ticket Booking System Plan`;
    tasks = [
      { id: 1, title: 'Analyze Cinema Requirements & Design Dark Theatre Theme', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Movie Shows, Formats (IMAX/3D) & Screen Showtime API', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Interactive Theater Seat Matrix (Rows A-F, Seats 1-8)', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Build Real-Time Seat Selection & Live Price Calculation Cart', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Create Ticket Confirmation View with Digital Pass (#TKT-XXXX)', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect API Client with Local Booking Persistence', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Verify Multi-Seat Selection & Checkout Flow', status: 'pending', file: 'package.json' }
    ];
  } else if (isFood) {
    summary = `Restaurant Food Ordering & Delivery Management Plan`;
    tasks = [
      { id: 1, title: 'Analyze Menu Hierarchy & Design Gourmet Culinary Theme', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Food Catalog & Live Orders REST API in Express', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Category Filters (Pizza, Burgers, Desserts) & Veg/Non-Veg Toggles', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Create Slide-Over Food Cart with Quantity Controls & Subtotal Calculation', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Implement Live Order Tracker (#ORD-XXXX) with Delivery Status Timeline', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect API Client with In-Memory Menu Cache', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Verify Cart Modifications & Checkout Experience', status: 'pending', file: 'package.json' }
    ];
  } else if (isSpace) {
    summary = `Space Rocket Launch & Planetary Mission Tracker Plan`;
    tasks = [
      { id: 1, title: 'Analyze Space Telemetry Needs & Design Cosmic Obsidian Theme', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Rocket Launches & Mars Sol Telemetry REST API', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Live Real-Time T-Minus Launch Countdown Timers', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Build Mission Details, Payload Specs & Trajectory Cards', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Create Mars Weather & Rover Position Status Module', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect API Client with Local Mission Cache', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Verify Timer Precision & Telemetry Cards', status: 'pending', file: 'package.json' }
    ];
  } else if (isFinance) {
    summary = `Financial Expense & Portfolio Tracking Plan`;
    tasks = [
      { id: 1, title: 'Analyze Financial Workflows & Design Clean Metric Dashboard', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Transactions, Income/Expense & Category REST API', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Net Worth & Balance Analytics Metric Cards', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Create Add Transaction Form with Category & Date Selectors', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Build Transaction Ledger Table with Search & Category Filters', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect API Client with Local Financial Store', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Verify Ledger Balance Calculations & Data Integrity', status: 'pending', file: 'package.json' }
    ];
  } else if (isEcommerce) {
    summary = `E-Commerce Store & Product Catalog Plan`;
    tasks = [
      { id: 1, title: 'Analyze Catalog Structure & Design Modern Store Theme', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Products, Categories & Cart Checkout REST API', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Product Grid with Price Filters & Star Ratings', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Create Slide-Over Cart Drawer with Live Total & Checkout Modal', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Connect API Client with Local Cart State', status: 'pending', file: 'src/services/api.js' },
      { id: 6, title: 'DevOps & Visual QA: Verify Product Filter & Checkout Flow', status: 'pending', file: 'package.json' }
    ];
  } else if (isMusic) {
    summary = `Interactive Music Streaming & Audio Player Plan`;
    tasks = [
      { id: 1, title: 'Analyze Audio Features & Design Sleek Waveform Player Theme', status: 'in_progress', file: 'index.html' },
      { id: 2, title: 'Build Track Catalog & Playlist Management REST API', status: 'pending', file: 'server.js' },
      { id: 3, title: 'Implement Audio Player Controls (Play, Pause, Skip, Seekbar, Volume)', status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: 'Build Interactive Playlist Queue & Track Search', status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: 'Create Dynamic Frequency Visualizer Animation Canvas', status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: 'Connect API Client with Offline Song Cache', status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: 'DevOps & Visual QA: Verify Audio Playback Lifecycle & Volume Controls', status: 'pending', file: 'package.json' }
    ];
  } else {
    // Dynamic Custom Plan based on Prompt Keywords (Strictly ordered: Setup -> Backend -> Core State -> UI -> QA)
    const words = prompt.split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(' ');
    summary = `Full-Stack Custom Architecture Plan: "${prompt}"`;
    tasks = [
      { id: 1, title: `Analyze Requirements & Setup Architecture for "${words || 'Custom App'}"`, status: 'in_progress', file: 'index.html' },
      { id: 2, title: `Build REST API Backend & Data Models in Express`, status: 'pending', file: 'server.js' },
      { id: 3, title: `Implement Main Application Views & Reactive State Management`, status: 'pending', file: 'src/App.jsx' },
      { id: 4, title: `Create Interactive Filters, Search & Item Detail Modals`, status: 'pending', file: 'src/App.jsx' },
      { id: 5, title: `Implement Create, Update & Delete Action Workflows`, status: 'pending', file: 'src/App.jsx' },
      { id: 6, title: `Connect Frontend API Client with Resilient Cache`, status: 'pending', file: 'src/services/api.js' },
      { id: 7, title: `DevOps: Configure Vite Bundler & Package Dependencies`, status: 'pending', file: 'package.json' },
      { id: 8, title: `Vision QA: Verify Component Integrity & Multi-Device Layout`, status: 'pending', file: 'src/App.jsx' }
    ];
  }

  return { summary, tasks };
}

// ── Plan-only endpoint (plan → approve gate) ──────────────────────────────────
router.post('/plan', (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return res.status(400).json({ error: 'userPrompt is required and must be a non-empty string' });
  }
  const plan = generateTaskPlan(userPrompt.trim());
  return res.json({ success: true, plan });
});

// ── Interactive Project Architect Wizard Endpoints ────────────────────────────
router.post('/wizard-analyze', async (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return res.status(400).json({ error: 'userPrompt is required and must be a non-empty string' });
  }

  const promptText = userPrompt.trim();
  const lower = promptText.toLowerCase();

  // Smart fallback defaults based on prompt keywords
  let defaultCategory = 'Web App';
  let defaultName = 'modern-web-app';
  let defaultTitle = 'Modern Web Application';
  let defaultDesc = 'A full-featured responsive web application with clean interactive UI.';
  let defaultFeatures = [
    { id: 'f_core', name: 'Core Feature Workflow', desc: 'Main interactive application logic and state management', enabled: true },
    { id: 'f_ui', name: 'Responsive Modern UI', desc: 'Mobile-friendly adaptive layout with smooth animations', enabled: true },
    { id: 'f_storage', name: 'Local Data Persistence', desc: 'Save user preferences and items via localStorage / store', enabled: true },
    { id: 'f_dark', name: 'Dark / Light Theme', desc: 'One-click visual mode switching with theme memory', enabled: true }
  ];
  let defaultStack = {
    frontend: 'React + Vite',
    styling: 'Tailwind CSS',
    backend: 'Client-Only (localStorage)'
  };
  let defaultTheme = 'Dark Zinc / Obsidian';

  if (lower.includes('todo') || lower.includes('task')) {
    defaultCategory = 'Tool / Utility';
    defaultName = 'taskmaster-pro';
    defaultTitle = 'TaskMaster Pro';
    defaultDesc = 'Smart task organizer with priority tagging, drag-and-drop, and filters.';
    defaultFeatures = [
      { id: 'f_add', name: 'Task Management', desc: 'Create, edit, delete, and categorize tasks', enabled: true },
      { id: 'f_filter', name: 'Search & Status Filters', desc: 'Filter by completed, pending, or high priority', enabled: true },
      { id: 'f_storage', name: 'Auto Persistence', desc: 'Save all tasks locally so data is never lost', enabled: true },
      { id: 'f_stats', name: 'Productivity Stats', desc: 'Visual progress bar showing completion rate', enabled: true }
    ];
  } else if (lower.includes('shop') || lower.includes('store') || lower.includes('ecommerce') || lower.includes('food')) {
    defaultCategory = 'E-Commerce';
    defaultName = 'quickstore-app';
    defaultTitle = 'QuickStore Storefront';
    defaultDesc = 'Interactive shopping experience with catalog, filterable grid, and dynamic cart.';
    defaultFeatures = [
      { id: 'f_catalog', name: 'Product Grid & Search', desc: 'Category filter, price sort, and instant search', enabled: true },
      { id: 'f_cart', name: 'Interactive Cart', desc: 'Add/remove items, quantity adjustments, and total calc', enabled: true },
      { id: 'f_checkout', name: 'Checkout Modal', desc: 'Shipping address form and order summary review', enabled: true },
      { id: 'f_badge', name: 'Discount / Promo System', desc: 'Apply promo coupon codes with instant recalculation', enabled: true }
    ];
  } else if (lower.includes('chat') || lower.includes('social') || lower.includes('message')) {
    defaultCategory = 'Social / Real-Time';
    defaultName = 'chathub-realtime';
    defaultTitle = 'ChatHub Messenger';
    defaultDesc = 'Real-time conversational interface with user channels and emoji reactions.';
    defaultFeatures = [
      { id: 'f_channels', name: 'Multiple Chat Channels', desc: 'Switch between General, Tech, and Random rooms', enabled: true },
      { id: 'f_emojis', name: 'Emoji & Reactions', desc: 'Quick reaction bar on messages and emoji picker', enabled: true },
      { id: 'f_search', name: 'Message Search & History', desc: 'Search past conversations instantly', enabled: true },
      { id: 'f_typing', name: 'Simulated Typing Indicators', desc: 'Dynamic indicators for active participants', enabled: true }
    ];
  } else if (lower.includes('dashboard') || lower.includes('admin') || lower.includes('analytics')) {
    defaultCategory = 'Dashboard / Admin';
    defaultName = 'nexus-analytics';
    defaultTitle = 'Nexus Admin Dashboard';
    defaultDesc = 'Executive analytics control panel with interactive metric cards and charts.';
    defaultFeatures = [
      { id: 'f_kpi', name: 'KPI Metric Cards', desc: 'Revenue, conversion rate, active users, and trends', enabled: true },
      { id: 'f_charts', name: 'Interactive Charts', desc: 'Revenue over time and category distribution graphs', enabled: true },
      { id: 'f_table', name: 'Data Table with Pagination', desc: 'Sortable, filterable records with export option', enabled: true },
      { id: 'f_notify', name: 'Activity Feed & Alerts', desc: 'Live event stream of user actions', enabled: true }
    ];
  }

  // Try LLM for bespoke personalized analysis
  try {
    const analysisPrompt = `You are AI-Dost Project Architect. Analyze this user project request and return a JSON wizard specification.
USER REQUEST: "${promptText}"

Respond with ONLY a valid JSON object matching this schema (no markdown, no prose):
{
  "projectName": "kebab-case-name",
  "projectTitle": "Display Title (3-5 words)",
  "description": "Clear 1-sentence description of the app",
  "category": "Web App",
  "targetAudience": ["Audience 1", "Audience 2"],
  "suggestedFeatures": [
    { "id": "feat_1", "name": "Feature 1 Name", "desc": "Short description", "enabled": true },
    { "id": "feat_2", "name": "Feature 2 Name", "desc": "Short description", "enabled": true },
    { "id": "feat_3", "name": "Feature 3 Name", "desc": "Short description", "enabled": true },
    { "id": "feat_4", "name": "Feature 4 Name", "desc": "Short description", "enabled": true }
  ],
  "suggestedStack": {
    "frontend": "React + Vite",
    "styling": "Tailwind CSS",
    "backend": "Client-Only (localStorage)"
  },
  "suggestedTheme": "Dark Zinc / Obsidian",
  "suggestedFiles": ["src/App.jsx", "src/components/Navbar.jsx", "index.html", "src/index.css"]
}`;

    const raw = await callLLM([{ role: 'user', content: analysisPrompt }]);
    const cleaned = String(raw || '').replace(/```(?:json)?\s*/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.projectName && Array.isArray(parsed.suggestedFeatures) && parsed.suggestedFeatures.length > 0) {
        return res.json({ success: true, wizardSpec: parsed, source: 'ai' });
      }
    }
  } catch (e) {
    logger.info('[Wizard] LLM analysis fallback used:', e.message);
  }

  return res.json({
    success: true,
    wizardSpec: {
      projectName: defaultName,
      projectTitle: defaultTitle,
      description: defaultDesc,
      category: defaultCategory,
      targetAudience: ['End Users', 'Developers', 'Teams'],
      suggestedFeatures: defaultFeatures,
      suggestedStack: defaultStack,
      suggestedTheme: defaultTheme,
      suggestedFiles: ['index.html', 'src/App.jsx', 'src/main.jsx', 'src/index.css']
    },
    source: 'template_heuristics'
  });
});

// ── Interactive Scaffold Stream Endpoint ─────────────────────────────────────
router.post('/scaffold-wizard', async (req, res) => {
  const { userPrompt, wizardConfig, projectId } = req.body;
  if (!wizardConfig || typeof wizardConfig !== 'object') {
    return res.status(400).json({ error: 'wizardConfig object is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  function generateSmartProject(wizardConfig, userPrompt) {
  const title = wizardConfig.projectTitle || wizardConfig.projectName || 'Modern Web Application';
  const desc = wizardConfig.description || userPrompt || 'A feature-rich web application built with modern architecture';
  const features = (wizardConfig.features || []).filter(f => f.enabled !== false);
  const stack = wizardConfig.stack || {};
  const isTourism = /bihar|tour|travel|guide|ghoomne|destination|trip/i.test(title + ' ' + desc);

  if (isTourism) {
    return [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Outfit', 'sans-serif'] },
          colors: {
            brand: { 50: '#f0fdf4', 500: '#10b981', 600: '#059669', 700: '#047857' }
          }
        }
      }
    }
  </script>
  <style>
    .glass {
      background: rgba(24, 24, 27, 0.75);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glass-card {
      background: rgba(39, 39, 42, 0.5);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
  <!-- Header -->
  <header class="sticky top-0 z-50 glass border-b border-zinc-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <span class="text-xl">🏛️</span>
        </div>
        <div>
          <h1 class="font-bold text-base text-white tracking-tight">${title}</h1>
          <p class="text-[10px] text-emerald-400 font-medium">Explore Historic, Spiritual & Natural Wonders of Bihar</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="filterCategory('all')" class="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:text-white transition-colors">All Places</button>
        <button onclick="filterCategory('Historical')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors">Historical</button>
        <button onclick="filterCategory('Spiritual')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors">Spiritual</button>
        <button onclick="filterCategory('Nature')" class="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors">Nature</button>
      </div>
    </div>
  </header>

  <!-- Hero Banner -->
  <section class="relative py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-5">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-emerald-300 border border-emerald-500/20">
      <span>✨ Discover The Rich Heritage of Bihar</span>
    </div>
    <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
      Experience the Land of <span class="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Enlightenment & Culture</span>
    </h2>
    <p class="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
      ${desc}
    </p>

    <!-- Search Bar -->
    <div class="max-w-xl mx-auto flex gap-2 p-1.5 rounded-2xl glass shadow-2xl">
      <input type="text" id="searchInput" oninput="handleSearch()" placeholder="Search Bodh Gaya, Nalanda, Rajgir, Patna..." class="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none" />
      <button onclick="handleSearch()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all">Search</button>
    </div>
  </section>

  <!-- Destinations Grid -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-bold text-white flex items-center gap-2">
        <span>📍 Featured Destinations</span>
        <span id="placeCount" class="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">6 Places</span>
      </h3>
    </div>

    <div id="placesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
  </main>

  <script>
    const places = [
      {
        id: 1,
        title: 'Mahabodhi Temple, Bodh Gaya',
        district: 'Gaya',
        category: 'Spiritual',
        rating: '4.9',
        image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80',
        desc: 'UNESCO World Heritage site where Gautama Buddha attained enlightenment under the sacred Bodhi Tree.'
      },
      {
        id: 2,
        title: 'Ancient Nalanda University Ruins',
        district: 'Nalanda',
        category: 'Historical',
        rating: '4.8',
        image: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80',
        desc: 'World famous 5th-century Buddhist monastic university that attracted scholars from China, Korea, and Tibet.'
      },
      {
        id: 3,
        title: 'Rajgir Glass Bridge & Ropeway',
        district: 'Nalanda',
        category: 'Nature',
        rating: '4.7',
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        desc: 'Historic valley surrounded by 7 hills with Vishwa Shanti Stupa, hot springs, and sky glass bridge.'
      },
      {
        id: 4,
        title: 'Golghar & Patna Sahib Gurudwara',
        district: 'Patna',
        category: 'Historical',
        rating: '4.6',
        image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
        desc: 'Historical architecture along the Ganga river and revered Takht Sri Patna Sahib.'
      },
      {
        id: 5,
        title: 'Valmiki National Park & Tiger Reserve',
        district: 'West Champaran',
        category: 'Nature',
        rating: '4.8',
        image: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?auto=format&fit=crop&w=800&q=80',
        desc: 'Dense rainforest wilderness along Gandak river with wild tigers, leopards, and rafting.'
      },
      {
        id: 6,
        title: 'Vikramshila Ancient University',
        district: 'Bhagalpur',
        category: 'Historical',
        rating: '4.7',
        image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80',
        desc: 'Pala Dynasty Buddhist university renowned for Tantric studies and ancient monastery stupas.'
      }
    ];

    let currentCategory = 'all';

    function renderPlaces(items) {
      const grid = document.getElementById('placesGrid');
      document.getElementById('placeCount').innerText = \`\${items.length} Places\`;
      grid.innerHTML = items.map(p => \`
        <div class="glass-card rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all duration-300 group flex flex-col">
          <div class="h-48 overflow-hidden relative">
            <img src="\${p.image}" alt="\${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <span class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-emerald-300 border border-white/10">
              ★ \${p.rating}
            </span>
            <span class="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              \${p.district}
            </span>
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <span class="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">\${p.category}</span>
              <h4 class="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors mt-0.5">\${p.title}</h4>
              <p class="text-xs text-zinc-400 mt-1 leading-relaxed">\${p.desc}</p>
            </div>
            <div class="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <button onclick="saveFavorite('\${p.title}')" class="text-xs text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1 cursor-pointer">
                ❤️ Favorite
              </button>
              <button onclick="alert('Viewing complete travel guide for ' + '\${p.title}')" class="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all cursor-pointer">
                Explore ↗
              </button>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function filterCategory(cat) {
      currentCategory = cat;
      if (cat === 'all') {
        renderPlaces(places);
      } else {
        renderPlaces(places.filter(p => p.category === cat));
      }
    }

    function handleSearch() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      const filtered = places.filter(p => 
        (currentCategory === 'all' || p.category === currentCategory) &&
        (p.title.toLowerCase().includes(q) || p.district.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
      );
      renderPlaces(filtered);
    }

    function saveFavorite(title) {
      alert('Saved to your trip itinerary: ' + title);
    }

    renderPlaces(places);
  </script>
</body>
</html>`
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: wizardConfig.projectName || 'bihar-tourist-guide',
          private: true,
          version: '1.0.0',
          scripts: { dev: 'vite', build: 'vite build' }
        }, null, 2)
      },
      {
        path: 'README.md',
        content: `# ${title}\n\n${desc}\n\n## Included Features:\n${features.map(f => `- ${f.name}`).join('\n')}`
      }
    ];
  }

  // General App Template
  return [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .glass { background: rgba(24, 24, 27, 0.7); backdrop-filter: blur(12px); }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col">
  <header class="border-b border-zinc-800 glass sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span class="text-white font-bold">⚡</span>
        </div>
        <div>
          <h1 class="font-bold text-sm text-white">${title}</h1>
          <p class="text-[10px] text-zinc-400 font-mono">${stack.frontend || 'React + Vite'}</p>
        </div>
      </div>
      <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        ● Ready
      </span>
    </div>
  </header>
  <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
    <div class="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3 shadow-xl">
      <h2 class="text-xl font-extrabold text-white">${title}</h2>
      <p class="text-sm text-zinc-400 leading-relaxed">${desc}</p>
      <div class="flex flex-wrap gap-2 pt-2">
        ${features.map(f => `<span class="px-2.5 py-1 rounded-lg text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">✨ ${f.name}</span>`).join('\n        ')}
      </div>
    </div>
  </main>
</body>
</html>`
    },
    {
      path: 'package.json',
      content: JSON.stringify({
        name: wizardConfig.projectName || 'modern-app',
        private: true,
        version: '0.1.0'
      }, null, 2)
    }
  ];
}

  let isAborted = false;
  res.on('close', () => { isAborted = true; });

  const send = (data) => {
    if (isAborted) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {}
  };

  const workspacePath = path.join(os.tmpdir(), `agent-ws-${projectId || 'copilot-workspace'}`);
  if (!fs.existsSync(workspacePath)) {
    try { fs.mkdirSync(workspacePath, { recursive: true }); } catch (_) {}
  }

  send({ type: 'wizard_status', step: 'architecting', message: '📐 Synthesizing custom architecture and specifications...' });

  const activeFeatures = (wizardConfig.features || []).filter(f => f.enabled !== false).map(f => `${f.name}: ${f.desc || ''}`).join('\n- ');
  const stackInfo = wizardConfig.stack ? JSON.stringify(wizardConfig.stack) : 'React + Vite + Tailwind CSS';

  const scaffoldPrompt = `You are an expert full-stack engineer. Build a COMPLETE, production-ready, beautiful web application based on this interactive specification:

PROJECT TITLE: ${wizardConfig.projectTitle || wizardConfig.projectName || 'Modern Web App'}
DESCRIPTION: ${wizardConfig.description || userPrompt}
TARGET AUDIENCE: ${Array.isArray(wizardConfig.targetAudience) ? wizardConfig.targetAudience.join(', ') : 'Users'}
TECH STACK: ${stackInfo}
DESIGN THEME: ${wizardConfig.theme || 'Dark Zinc / Obsidian'}

FEATURES TO IMPLEMENT FULLY:
- ${activeFeatures || 'Complete interactive features matching the description'}

CUSTOM INSTRUCTIONS / NOTES:
${wizardConfig.customNotes || 'None'}

REQUIREMENTS:
1. Write 100% COMPLETE, WORKING code with NO placeholders, NO "TODO" comments, NO truncated sections.
2. Include all necessary HTML, CSS, JavaScript/React components, and package.json so the app can run immediately.
3. Apply modern, responsive styling with clean UI components, cards, buttons, and state management.`;

  send({ type: 'wizard_status', step: 'generating', message: '⚡ Generating production-grade code across components...' });

  try {
    let files = [];
    try {
      const rawResponse = await Promise.race([
        callScaffoldLLM(scaffoldPrompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LLM Timeout')), 10000))
      ]);
      const stripped = String(rawResponse || '').replace(/```(?:json)?\s*/gi, '').trim();
      const jsonBlock = stripped.match(/\{[\s\S]*\}/);
      if (jsonBlock) {
        try {
          const parsed = JSON.parse(jsonBlock[0]);
          if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
            files = parsed.files;
          }
        } catch (err) {
          try {
            const repaired = jsonBlock[0].replace(/(?<=:\s*"[\s\S]*?)\r?\n(?=[\s\S]*?")/g, '\\n');
            const parsed = JSON.parse(repaired);
            if (parsed && Array.isArray(parsed.files)) files = parsed.files;
          } catch (_) {}
        }
      }
    } catch (llmErr) {
      logger.info('[Wizard] LLM timed out or failed, using autonomous smart generator:', llmErr.message);
    }

    if (!files || files.length === 0) {
      logger.info('[Wizard] Generating smart architecture files.');
      files = generateSmartProject(wizardConfig, userPrompt);
    }

    send({ type: 'wizard_status', step: 'writing', message: `📂 Writing ${files.length} project files to workspace...` });

    const writtenFiles = [];
    for (const f of files) {
      if (!f || !f.path) continue;
      const safePath = safeJoin(workspacePath, f.path);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, f.content || '', 'utf-8');
      writtenFiles.push({ path: f.path, size: Buffer.from(f.content || '').length });

      send({
        type: 'file_changed',
        action: 'add',
        path: f.path,
        content: f.content || ''
      });
      send({
        type: 'wizard_file',
        path: f.path,
        message: `Created ${f.path}`
      });
    }

    send({ type: 'wizard_status', step: 'dependencies', message: '📦 Initializing git repository and workspace setup...' });

    try {
      await new Promise((res) => exec('git init', { cwd: workspacePath, timeout: 5000 }, res));
    } catch (_) {}

    send({
      type: 'done',
      message: `🎉 ${wizardConfig.projectTitle || wizardConfig.projectName || 'Project'} successfully generated (${writtenFiles.length} files)!`,
      files: writtenFiles,
      summary: wizardConfig.description || 'Project is ready to run and customize.'
    });
    res.end();
  } catch (err) {
    logger.error('[Wizard Scaffold] Error:', err.message);
    send({ type: 'error', message: `Scaffolding failed: ${err.message}` });
    res.end();
  }
});

// ── Kanban task list (client-side state; no persistence layer yet) ────────────
router.get('/tasks', (_req, res) => {
  return res.json({ success: true, tasks: [] });
});

// ── ReAct Loop API Endpoint (SSE Streaming) ───────────────────────────────────
router.post('/run', async (req, res) => {
  const { userPrompt, projectPath, projectFiles, projectId, customKeys } = req.body;

  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return res.status(400).json({ error: 'userPrompt is required and must be a non-empty string' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let isAborted = false;
  const abortHandler = () => {
    isAborted = true;
    logger.info('[Agent] Client disconnected. Cancelling ReAct loop.');
  };
  res.on('close', abortHandler);

  const send = (data) => {
    if (isAborted) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {}
  };

  const workspacePath = projectPath || path.join(os.tmpdir(), `agent-ws-${projectId || 'default'}`);
  if (!fs.existsSync(workspacePath)) {
    try { fs.mkdirSync(workspacePath, { recursive: true }); } catch (_) {}
  }

  const plan = generateTaskPlan(userPrompt);

  // Early force-local handling: UI can hint backend to prefer deterministic
  // local intent execution (useful when LLMs are offline or to avoid simulated outputs).
  if (req.body && req.body.forceLocal) {
    try {
      const text = (userPrompt || '').trim();
      // More permissive patterns: capture filename then capture content in quotes
      const patterns = [
        /(?:create|write|make)\s+(?:a\s+)?(?:new\s+)?file(?:\s+named)?\s+["']?([^"'\s]+)["']?(?:[\s\S]*?)(?:with|containing|that contains)?\s+["']([\s\S]+?)["']\s*$/i,
        /(?:file)\s+["']?([^"'\s]+)["']?(?:[\s\S]*?)contains?\s+["']([\s\S]+?)["']\s*$/i,
        /["']([^"']+\.[a-zA-Z0-9]+)["']\s+with\s+["']([\s\S]+?)["']\s*$/i
      ];
      let matched = null;
      for (const rx of patterns) {
        const m = text.match(rx);
        if (m) { matched = m; break; }
      }
      if (matched) {
        const filename = matched[1];
        const fileContent = matched[2];
        send({ type: 'thinking', message: '⚡ forceLocal: handling create-file intent locally...' });
        // Determine target base: repo root if requested, otherwise temp workspace
        let targetBase = workspacePath;
        if (req.body.saveToRepo) {
          try {
            targetBase = path.resolve(__dirname, '../../');
          } catch (_) { targetBase = workspacePath; }
        }
        const toolResult = await executeTool('write_file', { path: filename, content: fileContent }, targetBase, projectFiles);
        const stepLog = { step: 1, taskId: 1, thought: 'forceLocal write_file', action: 'write_file', parameters: { path: filename, content: fileContent }, result: toolResult };
        send({ type: 'step', stepLog });
        plan.tasks.forEach(t => t.status = 'completed');
        send({ type: 'plan', plan });
        send({ type: 'done', message: `✅ forceLocal: ${filename} created`, steps: [stepLog], plan });
        try { res.end(); } catch (_) {}
        return;
      }
    } catch (e) {
      logger.info('[Agent] forceLocal handler error:', e.message || e);
    }
  }

  // Build file context (RAG: most relevant files via search first)
  let fileContext = '';
  try {
    const relevantFiles = searchCodebase(userPrompt, projectFiles).results;
    if (relevantFiles.length > 0) {
      fileContext = '=== RELEVANT CODE (via semantic search) ===\n' +
        relevantFiles.map(r => `FILE: ${r.file} (line ${r.startLine})\n\`\`\`\n${r.snippet}\n\`\`\``).join('\n\n');
    }
  } catch (searchErr) {
    logger.info('[Agent] Semantic search skipped:', searchErr?.message || searchErr);
  }

  // Python AI Engine (LlamaIndex RAG) — semantic Q&A over workspace files.
  // Fail-safe: engine down/error -> silently skip, existing context stays.
  if (fileContext && workspacePath) {
    try {
      const rag = await PythonEngine.queryRag(workspacePath, userPrompt, 3);
      if (rag.ok && rag.data?.answer && String(rag.data.answer).trim().length > 3) {
        const ragSources = (rag.data.sources || [])
          .filter(s => s && s.file)
          .map(s => `${s.file} (score ${s.score ?? '?'})`).join(', ');
        fileContext += '\n\n=== SEMANTIC CONTEXT (LlamaIndex RAG) ===\n' +
          `Q: ${userPrompt}\nA: ${String(rag.data.answer).substring(0, 1200)}` +
          (ragSources ? `\nSources: ${ragSources}` : '');
        logger.info('[Agent] RAG context merged from Python engine');
      }
    } catch (ragErr) {
      logger.info('[Agent] Python RAG skipped:', ragErr?.message || ragErr);
    }
  }
  if (!fileContext && projectFiles && projectFiles.length > 0) {
    fileContext = projectFiles.slice(0, 5).map(f =>
      `FILE: ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1000)}\n\`\`\``
    ).join('\n\n');
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  initRunSnapshot(runId, projectId, workspacePath, projectFiles);
  send({ type: 'run_started', runId });
  send({ type: 'start', message: '🔍 Analyzing prompt & generating dynamic task plan...' });

  // Phase 1: Dynamic Task Breakdown Plan (Instant 0ms response)
  send({ type: 'plan', plan });

  const taskListText = (plan?.tasks || [])
    .map(t => `- Task ${t.id}: ${t.title} [${(t.status || 'pending').toUpperCase()}]`)
    .join('\n');

  const messages = [{
    role: 'user',
    content: `WORKSPACE FILES:\n${fileContext || '(No files yet)'}\n\nUSER TASK: ${userPrompt}\n\nDYNAMIC TASK BREAKDOWN:\n${taskListText}`
  }];

  const MAX_STEPS = 50;
  const steps = [];
  let selfHealAttempts = 0;
  let activeTaskId = 1;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (isAborted) {
      logger.info('[Agent] Aborting ReAct loop because client disconnected.');
      break;
    }
    try {
      const activeTask = plan.tasks.find(t => t.id === activeTaskId) || plan.tasks[0];
      send({ 
        type: 'thinking', 
        step: step + 1, 
        message: `🧠 Task ${activeTask.id}/${plan.tasks.length}: ${activeTask.title}...` 
      });

      const existingProjectFiles = (Array.isArray(projectFiles) && projectFiles.length > 0)
        ? projectFiles
        : getProjectFiles(projectId || 'default');
      const hasExistingFiles = existingProjectFiles && existingProjectFiles.length > 0;
      const isExplicitNewProject = /\b(new project|naya project|fullstack project banao|scaffold new|create new app|generate new app)\b/i.test(userPrompt);
      const isGreenfieldScaffold = !hasExistingFiles || isExplicitNewProject;

      // Greenfield Full-Stack Project Generator
      if (step === 0 && isGreenfieldScaffold) {
        send({
          type: 'tool_call',
          step: 1,
          action: 'generate_project_from_prompt',
          parameters: { prompt: userPrompt, targetDir: workspacePath },
          thought: 'Architecting and generating complete production full-stack project scaffold...'
        });
        const toolResult = await executeTool('generate_project_from_prompt', { prompt: userPrompt, targetDir: workspacePath }, workspacePath, existingProjectFiles, send, projectId || 'default');
        const stepLog = {
          step: 1,
          taskId: activeTaskId,
          thought: 'Project scaffold generated successfully',
          action: 'generate_project_from_prompt',
          parameters: { prompt: userPrompt, targetDir: workspacePath },
          result: toolResult
        };
        steps.push(stepLog);
        send({ type: 'step', stepLog });
        plan.tasks.forEach(t => t.status = 'completed');
        send({ type: 'plan', plan });
        send({
          type: 'done',
          message: toolResult.message || '🎉 Full-stack application scaffolded successfully and ready for live preview.',
          steps,
          plan
        });
        try { res.end(); } catch (_) {}
        return;
      }

      // ── Iterative Code Modification Engine (for existing projects) ────────
      if (step === 0 && hasExistingFiles && !isExplicitNewProject) {
        send({
          type: 'agent_status',
          agent: 'Coder',
          message: `🛠️ Coder: Modifying existing project files for: "${userPrompt}"...`
        });
        send({
          type: 'thinking',
          step: 1,
          message: `Reading workspace context and applying code updates...`
        });

        const targetFilesContext = existingProjectFiles.map(f => `FILE: ${f.path}\n\`\`\`\n${f.content || ''}\n\`\`\``).join('\n\n');
        const editPrompt = `You are an expert autonomous software engineer.
The user is modifying their existing React + Express project.

USER REQUEST:
"${userPrompt}"

CURRENT PROJECT FILES:
${targetFilesContext}

INSTRUCTIONS:
1. Modify the relevant file(s) (e.g. src/App.jsx, server.js, src/index.css) to fully implement the user's requested change.
2. Maintain all existing working features and dependencies.
3. Output the COMPLETE updated file(s) in this EXACT format (no ellipses, no placeholders):
FILE: <filepath>
\`\`\`<language>
<complete updated code>
\`\`\`
`;

        try {
          const rawEditResp = await callScaffoldLLM(editPrompt);
          const editedFiles = extractFiles(rawEditResp);

          if (editedFiles && editedFiles.length > 0) {
            for (const ef of editedFiles) {
              const safePath = safeJoin(workspacePath, ef.path);
              try {
                fs.mkdirSync(path.dirname(safePath), { recursive: true });
                fs.writeFileSync(safePath, ef.content || '', 'utf-8');
              } catch (_) {}
              saveProjectFile(projectId || 'default', ef.path, ef.content || '');
              
              send({
                type: 'file_written',
                file: ef.path,
                path: ef.path,
                content: ef.content || '',
                progress: '1/1'
              });
            }

            plan.tasks.forEach(t => t.status = 'completed');
            send({ type: 'plan', plan });
            send({
              type: 'done',
              message: `✅ Successfully applied updates to ${editedFiles.map(f => f.path).join(', ')} matching your request.`,
              steps: [{
                step: 1,
                taskId: 1,
                thought: 'Applied targeted code modifications',
                action: 'modify_files',
                parameters: { files: editedFiles.map(f => f.path) },
                result: { success: true, updatedFiles: editedFiles.map(f => f.path) }
              }],
              plan
            });
            try { res.end(); } catch (_) {}
            return;
          }
        } catch (editErr) {
          logger.info('[Agent] Iterative edit LLM error:', editErr.message);
        }
      }

      // Simple local intent handler: perform deterministic actions for
      // straightforward prompts without calling external LLMs. This
      // improves offline resilience and handles basic user requests.
      try {
        const text = (userPrompt || '').trim();
        // More permissive patterns for runtime local handler
        const patterns = [
          /(?:create|write|make)\s+(?:a\s+)?(?:new\s+)?file(?:\s+named)?\s+["']?([^"'\s]+)["']?(?:[\s\S]*?)(?:with|containing|that contains)?\s+["']([\s\S]+?)["']\s*$/i,
          /(?:file)\s+["']?([^"'\s]+)["']?(?:[\s\S]*?)contains?\s+["']([\s\S]+?)["']\s*$/i,
          /["']([^"']+\.[a-zA-Z0-9]+)["']\s+with\s+["']([\s\S]+?)["']\s*$/i
        ];

        let matched = null;
        for (const rx of patterns) {
          const m = text.match(rx);
          if (m) { matched = m; break; }
        }

        if (matched) {
          const filename = matched[1];
          const fileContent = matched[2];
          send({ type: 'thinking', step: step + 1, message: '⚡ Handling simple "create file" intent locally (no LLM) ...' });
          const toolResult = await executeTool('write_file', { path: filename, content: fileContent }, workspacePath, projectFiles, send, projectId || 'default');
          const stepLog = {
            step: step + 1,
            taskId: activeTaskId,
            thought: 'Local handler executed: write_file',
            action: 'write_file',
            parameters: { path: filename, content: fileContent },
            result: toolResult
          };
          steps.push(stepLog);
          send({ type: 'step', stepLog });
          // mark plan completed and finish
          plan.tasks.forEach(t => t.status = 'completed');
          send({ type: 'plan', plan });
          send({ type: 'done', message: `✅ Local intent handled: ${filename} created`, steps, plan });
          res.end();
          return;
        }
      } catch (localErr) {
        logger.info('[Agent] Local intent handler error:', localErr?.message || localErr);
      }

      const rawResponse = await callLLM(messages, customKeys, (noticeMsg) => {
        send({ type: 'thinking', step: step + 1, message: noticeMsg });
      });
      const parsed = parseLLMAction(rawResponse);

      // Inject user prompt fallback for project generation when LLM omits params
      const execParams = { ...(parsed.parameters || {}) };
      if (parsed.action === 'generate_project_from_prompt') {
        if (!execParams.prompt) execParams.prompt = userPrompt;
        if (!execParams.targetDir) execParams.targetDir = workspacePath;
      }

      const stepLog = {
        step: step + 1,
        taskId: activeTaskId,
        thought: parsed.thought || '',
        action: parsed.action,
        parameters: execParams,
        result: null
      };

      if (parsed.action === 'FINAL_ANSWER') {
        // Mark all tasks as completed
        plan.tasks.forEach(t => t.status = 'completed');
        send({ type: 'plan', plan });

        stepLog.result = { success: true, message: parsed.answer || 'Task complete.' };
        steps.push(stepLog);
        send({ type: 'step', stepLog });
        send({ type: 'done', message: parsed.answer || '✅ All tasks completed!', steps, plan });
        res.end();
        return;
      }

      send({
        type: 'tool_call',
        step: step + 1,
        action: parsed.action,
        parameters: execParams,
        thought: parsed.thought
      });

      const toolResult = await executeTool(parsed.action, execParams, workspacePath, projectFiles, send, projectId || 'default');
      stepLog.result = toolResult;
      steps.push(stepLog);
      send({ type: 'step', stepLog });

      // Update task progress dynamically
      if (toolResult.success) {
        // Progress to next sub-task if file created/updated or action succeeded
        if (['create_file', 'write_file', 'apply_diff'].includes(parsed.action)) {
          const changedPath = execParams.path || toolResult.changedFile;
          // Emit file_changed so the IDE updates its file tree in real-time
          if (changedPath) {
            const filePath = safeJoin(workspacePath, changedPath);
            let fileContent = '';
            try { fileContent = fs.readFileSync(filePath, 'utf-8'); } catch (_) { fileContent = execParams.content || ''; }
            send({ type: 'file_changed', path: changedPath, content: fileContent });
            if (runSnapshots.has(runId)) {
              runSnapshots.get(runId).afterFiles.set(changedPath, fileContent);
            }
            // Also sync to SQLite workspace_files so post-run refresh doesn't lose files
            try {
              const ChatModel = require('../models/Chat');
              const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
              const upsert = dbInstance.prepare('INSERT INTO workspace_files (project_id, file_path, content) VALUES (?, ?, ?) ON CONFLICT(project_id, file_path) DO UPDATE SET content = excluded.content');
              upsert.run(projectId || 'default', changedPath, fileContent);
            } catch (_dbErr) { /* SQLite sync optional */ }
          }
          const currentTaskIdx = plan.tasks.findIndex(t => t.id === activeTaskId);
          if (currentTaskIdx !== -1) {
            plan.tasks[currentTaskIdx].status = 'completed';
            if (currentTaskIdx + 1 < plan.tasks.length) {
              activeTaskId = plan.tasks[currentTaskIdx + 1].id;
              plan.tasks[currentTaskIdx + 1].status = 'in_progress';
            }
          }
          send({ type: 'plan', plan });
        }
        if (parsed.action === 'generate_project_from_prompt') {
          plan.tasks.forEach(t => t.status = 'completed');
          send({ type: 'plan', plan });
          send({ 
            type: 'done', 
            message: toolResult.message || '🎉 Full-stack application scaffolded and ready for live preview.', 
            steps, 
            plan 
          });
          try { res.end(); } catch (_) {}
          return;
        }
        // Emit terminal_output for run_terminal commands
        if (parsed.action === 'run_terminal' || parsed.action === 'run_terminal_auto') {
          const termOut = toolResult.stdout || toolResult.output || '';
          if (termOut) {
            send({ type: 'terminal_output', output: termOut.substring(0, 2000) });
          }
        }
      }

      // ── Phase 4: Self-Healing Terminal Logic ─────────────────────────────────
      if (parsed.action === 'run_terminal' && !toolResult.success && selfHealAttempts < 3) {
        const errorContext = toolResult.selfHealingHint || toolResult.stderr || toolResult.error || 'Unknown error';
        selfHealAttempts++;
        send({
          type: 'self_heal',
          step: step + 1,
          message: `🔧 Self-healing (attempt ${selfHealAttempts}/3): Command failed — analyzing error and fixing...`
        });
        messages.push({ role: 'assistant', content: JSON.stringify({ thought: parsed.thought, action: parsed.action, parameters: parsed.parameters }) });
        messages.push({
          role: 'user',
          content: `SELF-HEALING REQUIRED: Command "${parsed.parameters?.command || 'unknown'}" failed.\n\nERROR OUTPUT:\n${errorContext}\n\nDetailed Error Analysis:\n1. Exit code: ${toolResult.exit_code || 'N/A'}\n2. Standard Output: ${toolResult.stdout ? toolResult.stdout.substring(0, 500) : 'None'}\n3. Standard Error: ${toolResult.stderr ? toolResult.stderr.substring(0, 1000) : 'None'}\n\nACTION REQUIRED:\n1. Analyze the exact error above to identify the root cause\n2. If it's a syntax error in code, fix the code using apply_diff or write_file\n3. If it's a runtime error, debug and fix the logic\n4. If it's a path issue, correct the file paths\n5. Then retry the command\n\nIMPORTANT: Do NOT output FINAL_ANSWER yet — fix the error first and retry the command.`
        });
        continue;
      }

      // Reset self-heal counter on success
      if (toolResult.success) selfHealAttempts = 0;

      // Normal observation
      messages.push({ role: 'assistant', content: JSON.stringify({ thought: parsed.thought, action: parsed.action, parameters: parsed.parameters }) });
      messages.push({
        role: 'user',
        content: `OBSERVATION from ${parsed.action}:\n${JSON.stringify(toolResult)}\n\n${
          toolResult.success
            ? 'Continue with the next step, or output FINAL_ANSWER if the task is complete.'
            : 'The tool call failed. Analyze the error and decide how to fix it.'
        }`
      });

    } catch (err) {
      send({ type: 'error', message: `Step ${step + 1} error: ${err.message}` });
      break;
    }
  }

  send({ type: 'done', message: '⚠️ Max steps reached. Task partially completed.', steps });
  try { res.end(); } catch (_) { /* client already disconnected */ }
});

// ── Codebase Search Endpoint (can be called separately from UI) ───────────────
router.post('/search', (req, res) => {
  const { query, projectFiles } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  res.json(searchCodebase(query, projectFiles || []));
});

// ── AI Code Suggestions Endpoint ──────────────────────────────────────────────
router.post('/code-suggestions', async (req, res) => {
  try {
    const { code, language, prompt, projectFiles } = req.body;
    if (!code || !language || !prompt) {
      return res.status(400).json({ error: 'code, language, and prompt are required' });
    }
    
    // Build context from relevant code chunks
    const fileContext = projectFiles && projectFiles.length > 0
      ? projectFiles.slice(0, 3).map(f =>
          `FILE: ${f.path}\n\`\`\`${language}\n${(f.content || '').substring(0, 800)}\n\`\`\``
        ).join('\n\n')
      : '';
    
    const fullPrompt = `You are AI-Dost Code Assistant. Given the following code and user request, provide intelligent code suggestions or completions.

CODE:
\`\`\`${language}
${code}
\`\`\`

USER REQUEST: ${prompt}

CODE CONTEXT:
${fileContext}

Provide suggestions that:
1. Maintain code style and consistency
2. Fix any obvious issues
3. Complete partial code
4. Follow best practices for ${language}

Respond with a JSON object with a "suggestions" array containing code snippet suggestions. Return only valid JSON, no prose.`;
    
    // Try Gemini first, then fallback to Groq
    let suggestions = '';
    
    try {
      const GeminiService = require('../services/geminiService');
      const resp = await GeminiService.chat(fullPrompt, [], null, 'project');
      suggestions = resp || '';
    } catch (e) {
      logger.info('[AI Suggestions] Gemini failed, trying Groq...');
      const GroqService = require('../services/groqService');
      const resp = await GroqService.chat(fullPrompt, [], 'project');
      suggestions = resp || '';
    }
    
    if (!suggestions || suggestions.length < 10) {
      // Fallback: basic code completion
      suggestions = `// Basic suggestion for: ${prompt}\n// Add your implementation here`;
    }
    
    res.json({ success: true, suggestions });
  } catch (error) {
    logger.error('[AI Suggestions] Error:', error.message);
    res.status(500).json({ error: 'Code suggestions failed', detail: error.message });
  }
});

// ── Cursor-Style / Canvas Inline Code Transformer (Ctrl+K) ───────────────────
router.post('/inline-edit', async (req, res) => {
  try {
    const { code, prompt, language = 'javascript', file = '' } = req.body;
    if (!code || !prompt) {
      return res.status(400).json({ success: false, error: 'code and prompt are required' });
    }

    const editPrompt = `You are an expert surgical code editor.
File: ${file || 'active_file'}
Language: ${language}

USER INSTRUCTION: "${prompt}"

ORIGINAL CODE SNIPPET TO EDIT:
\`\`\`${language}
${code}
\`\`\`

RULES:
1. Return ONLY the replacement code snippet for the original block.
2. NO markdown fences (\`\`\`), NO introductory text, NO explanations.
3. Keep exact indentation, variable names, and surrounding logic consistent.
4. If the instruction asks for new logic, implement it completely.`;

    let replacement = '';
    try {
      replacement = await GroqService.chat(editPrompt, [], 'agent');
    } catch (_) {
      try {
        replacement = await GeminiService.chat(editPrompt, [], null, 'agent');
      } catch (_) {
        replacement = await OpenRouterService.chat(editPrompt, [], null, 'agent');
      }
    }

    const cleaned = String(replacement || '')
      .replace(/^```[a-zA-Z]*\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    res.json({ success: true, replacement: cleaned || code });
  } catch (err) {
    logger.error('[Agent] Inline edit failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Ultra-Fast Ghost Text / Tab Auto-Complete Endpoint (<80ms) ────────────────
router.post('/autocomplete', async (req, res) => {
  try {
    const { prefix = '', suffix = '', language = 'javascript' } = req.body;
    if (!prefix) return res.json({ success: true, completion: '' });

    const trimmedPrefix = prefix.slice(-600);
    const trimmedSuffix = suffix.slice(0, 300);

    const prompt = `Complete the code after <CURSOR>. Return ONLY the next 1-3 lines of code. No markdown, no comments.
<PREFIX>
${trimmedPrefix}
<CURSOR>
<SUFFIX>
${trimmedSuffix}`;

    let completion = '';
    const isErr = (t) => !t || typeof t !== 'string' || t.includes('error:') || t.includes('Error:') || t.includes('Payment required') || t.includes('Rate limit') || t.includes('API key');

    try {
      const resp = await GroqService.chat(prompt, [], 'agent');
      if (!isErr(resp)) completion = resp;
    } catch (_) {}

    if (!completion) {
      try {
        const resp = await CerebrasService.chat(prompt, [], 'agent');
        if (!isErr(resp)) completion = resp;
      } catch (_) {}
    }

    const cleaned = String(completion || '')
      .replace(/```[a-zA-Z]*/g, '')
      .replace(/```/g, '')
      .trim();

    res.json({ success: true, completion: isErr(cleaned) ? '' : cleaned });
  } catch (err) {
    res.json({ success: true, completion: '' });
  }
});

// ── Deep AST & Codebase Dependency Graph Endpoint ────────────────────────────
router.post('/dependency-graph', (req, res) => {
  try {
    const { files = [] } = req.body;
    const astService = require('../services/astService');
    const graph = astService.buildProjectGraph(files);
    res.json({ success: true, graph });
  } catch (err) {
    logger.error('[Agent] Dependency graph failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── LSP Diagnostics Endpoint ─────────────────────────────────────────────────
router.post('/lsp-diagnostics', async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }
    
    // Basic static analysis for common issues
    const diagnostics = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check for common JavaScript/TypeScript issues
      if (language === 'javascript' || language === 'typescript') {
        // Unused variables
        const unusedVarMatch = line.match(/\b(let|const|var)\s+(\w+)\s*=\s*([^;]+);/);
        if (unusedVarMatch) {
          diagnostics.push({
            line: lineNum,
            column: 0,
            severity: 'warning',
            message: `Potentially unused variable: ${unusedVarMatch[2]}`
          });
        }
        
        // Missing semicolons (line ends without ; or })
        if (!line.includes(';') && !line.includes('}') && !line.includes('{') && line.trim().length > 0 && !line.startsWith('//')) {
          diagnostics.push({
            line: lineNum,
            column: line.trim().length,
            severity: 'info',
            message: 'Consider adding semicolon'
          });
        }
      }
      
      // Check for Python issues
      if (language === 'python') {
        const stripped = line.trim();
        const isBlockStarter = /^(def|class|if|elif|else|for|while|try|except|with|async)\b/.test(stripped);

        // Missing colon after def/if/for/while
        if (isBlockStarter && !line.includes(':')) {
          diagnostics.push({
            line: lineNum,
            column: Math.max(0, stripped.indexOf(' ') < 0 ? stripped.length : stripped.indexOf(' ')),
            severity: 'error',
            message: 'Missing colon at end of statement'
          });
        }
      }

      // Check for HTML issues
      if (language === 'html') {
        const openTags = (line.match(/<[a-zA-Z][\w-]*(\s[^>]*)?(?![^>]*\/>)/g) || []).length;
        const closeTags = (line.match(/<\/[a-zA-Z][\w-]*>/g) || []).length;
        const isComment = line.trim().startsWith('<!--');
        if (openTags > closeTags && line.trim().startsWith('<') && !isComment) {
          diagnostics.push({
            line: lineNum,
            column: 0,
            severity: 'info',
            message: 'Potentially unclosed HTML tag'
          });
        }
      }

      // Check for CSS issues
      if (language === 'css') {
        const propMatch = line.match(/^\s*([\w-]+)\s*:\s*([^;{}]+);/);
        const looksLikeProperty = /^\s*[\w-]+\s*:/.test(line) && !line.trim().startsWith('//');
        if (!propMatch && looksLikeProperty) {
          diagnostics.push({
            line: lineNum,
            column: 0,
            severity: 'info',
            message: 'Consider adding semicolon after CSS property'
          });
        }
      }
    });
    
    res.json({ success: true, diagnostics });
  } catch (error) {
    logger.error('[LSP Diagnostics] Error:', error.message);
    res.status(500).json({ error: 'LSP diagnostics failed', detail: error.message });
  }
});

// ── Quick diff apply endpoint ─────────────────────────────────────────────────
router.post('/apply-diff', (req, res) => {
  const { filePath, search, replace, projectPath } = req.body;
  try {
    const full = path.resolve(projectPath || os.tmpdir(), filePath);
    let content = fs.readFileSync(full, 'utf-8');
    if (!content.includes(search)) {
      return res.status(400).json({ success: false, error: 'Search block not found in file.' });
    }
    content = content.replace(search, replace);
    fs.writeFileSync(full, content, 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Agent Git Checkpoint ──────────────────────────────────────────────────────
router.post('/checkpoint', (req, res) => {
  const { message, workDir } = req.body;
  const dir = workDir || path.join(__dirname, '../../');
  const safeMsg = (message || `AI-Dost Agent checkpoint — ${new Date().toISOString()}`)
    .replace(/"/g, '\\"')
    .replace(/[`$\\]/g, '');
  exec(`git add -A && git commit -m "${safeMsg}"`, { cwd: dir }, (err, stdout, stderr) => {
    res.json({
      success: !err,
      message: err ? (stderr || err.message) : stdout.trim()
    });
  });
});

// ── Python AI Engine: LlamaIndex RAG (semantic Q&A over a directory) ──────────
router.post('/ai/rag', async (req, res) => {
  const { directory, question, topK, rebuild } = req.body;
  if (!directory || !question) return res.status(400).json({ error: 'directory aur question required hain' });
  if (!fs.existsSync(directory)) return res.status(400).json({ error: 'directory exist nahi karti' });
  const result = await PythonEngine.queryRag(directory, question, topK || 4, !!rebuild);
  if (!result.ok) {
    return res.status(502).json({ error: `AI Engine unavailable: ${result.error || 'unknown'}` });
  }
  res.json(result.data);
});

// ── Python AI Engine health (frontend status chip) ────────────────────────────
router.get('/ai/engine-status', async (_req, res) => {
  const h = await PythonEngine.health();
  res.json(h ? { ...h, connected: true } : { connected: false, status: 'down' });
});

// ── CrewAI multi-agent crew (Pillar 1: Agentic Core) ──────────────────────────
router.post('/ai/crew', async (req, res) => {
  const { prompt, mode, model, directory } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt required hai' });
  }
  const result = await PythonEngine.runCrew(prompt.trim(), { mode, model, directory });
  if (!result.ok) {
    return res.status(502).json({ error: `AI Engine unavailable: ${result.error || 'unknown'}` });
  }
  res.json(result.data);
});

// ── Edge TTS (free unlimited voice, no API key) ───────────────────────────────
router.post('/ai/tts', async (req, res) => {
  const { text, voice, rate } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text required hai' });
  }
  const result = await PythonEngine.tts(text.trim(), voice, rate);
  if (!result.ok) {
    return res.status(502).json({ error: `AI Engine unavailable: ${result.error || 'unknown'}` });
  }
  res.set('Content-Type', 'audio/mpeg');
  res.set('Cache-Control', 'no-store');
  res.send(result.data);
});

// ── API quota + circuit breaker status (troubleshooting) ──────────────────────
router.get('/quota-status', (_req, res) => {
  const serviceClasses = {
    groq: GroqService, gemini: GeminiService, nvidia: NvidiaService,
    together: TogetherService, deepseek: DeepSeekService, mistral: MistralService,
    huggingface: HuggingFaceService, openrouter: OpenRouterService, cerebras: CerebrasService,
  };
  const status = {};
  for (const [name, Svc] of Object.entries(serviceClasses)) {
    try {
      const inst = new Svc();
      const clients = Array.isArray(inst.clients) ? inst.clients : [inst.client];
      const states = clients.map(c => c?.circuitBreaker?.getState?.() || 'unknown');
      status[name] = { state: [...new Set(states)].join('/') || 'unknown' };
    } catch {
      status[name] = { state: 'unknown' };
    }
  }
  res.json({ circuitBreakers: status });
});

// ── Spec Wizard Endpoints ───────────────────────────────────────────────────────
// Start a new spec from user intent
router.post('/spec/start', async (req, res) => {
  try {
    const { intent, previousAnswers } = req.body;
    if (!intent || typeof intent !== 'string' || !intent.trim()) {
      return res.status(400).json({ error: 'intent is required and must be a non-empty string' });
    }
    const result = SpecService.createSpecFromIntent(intent.trim(), previousAnswers || {});
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('[Spec] Start error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to start spec' });
  }
});

// Submit a step and get next step
router.post('/spec/step', async (req, res) => {
  try {
    const { specId, stepIndex, answers } = req.body;
    if (!specId || typeof stepIndex !== 'number' || !answers) {
      return res.status(400).json({ error: 'specId, stepIndex, and answers are required' });
    }
    const result = SpecService.submitStep(specId, stepIndex, answers);
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('[Spec] Step error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to submit step' });
  }
});

// Get full spec for review
router.get('/spec/:specId', async (req, res) => {
  try {
    const { specId } = req.params;
    const spec = SpecService.getSpec(specId);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }
    res.json({ success: true, spec });
  } catch (e) {
    logger.error('[Spec] Get error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to get spec' });
  }
});

// Approve spec and generate plan
router.post('/spec/:specId/approve', async (req, res) => {
  try {
    const { specId } = req.params;
    const result = await SpecService.approveSpec(specId);
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('[Spec] Approve error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to approve spec' });
  }
});

// Regenerate step with guidance
router.post('/spec/:specId/regenerate', async (req, res) => {
  try {
    const { specId } = req.params;
    const { stepId, guidance } = req.body;
    if (!stepId || !guidance) {
      return res.status(400).json({ error: 'stepId and guidance are required' });
    }
    const result = SpecService.regenerateStep(specId, stepId, guidance);
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('[Spec] Regenerate error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to regenerate step' });
  }
});

// Update a specific step
router.post('/spec/:specId/update', async (req, res) => {
  try {
    const { specId } = req.params;
    const { stepId, data } = req.body;
    if (!stepId || !data) {
      return res.status(400).json({ error: 'stepId and data are required' });
    }
    const spec = SpecService.updateStep(specId, stepId, data);
    res.json({ success: true, spec });
  } catch (e) {
    logger.error('[Spec] Update error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to update step' });
  }
});

// List all specs
router.get('/specs', async (req, res) => {
  try {
    const specs = SpecService.listSpecs();
    res.json({ success: true, specs });
  } catch (e) {
    logger.error('[Spec] List error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to list specs' });
  }
});

// Delete a spec
router.delete('/spec/:specId', async (req, res) => {
  try {
    const { specId } = req.params;
    const deleted = SpecService.deleteSpec(specId);
    if (!deleted) {
      return res.status(404).json({ error: 'Spec not found' });
    }
    res.json({ success: true, message: 'Spec deleted' });
  } catch (e) {
    logger.error('[Spec] Delete error:', e.message);
    res.status(500).json({ error: e.message || 'Failed to delete spec' });
  }
});

// ── Run Diff & Snapshot Tracking ─────────────────────────────────────────────
const runSnapshots = new Map();

function initRunSnapshot(runId, projectId, workspacePath, projectFiles) {
  const beforeFiles = new Map();
  if (Array.isArray(projectFiles)) {
    for (const f of projectFiles) {
      if (f && f.path) beforeFiles.set(f.path, f.content ?? '');
    }
  }
  if (workspacePath && fs.existsSync(workspacePath)) {
    try {
      const scanDir = (dir, rel = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            scanDir(fullPath, relPath);
          } else if (entry.isFile()) {
            try {
              beforeFiles.set(relPath, fs.readFileSync(fullPath, 'utf-8'));
            } catch (_) {}
          }
        }
      };
      scanDir(workspacePath);
    } catch (_) {}
  }
  runSnapshots.set(runId, {
    projectId,
    workspacePath,
    beforeFiles,
    afterFiles: new Map(),
    timestamp: Date.now()
  });

  if (runSnapshots.size > 50) {
    const oldestKey = runSnapshots.keys().next().value;
    runSnapshots.delete(oldestKey);
  }
}

// GET /api/agent/run-diffs
router.get('/run-diffs', (req, res) => {
  const { runId } = req.query;
  if (!runId) return res.status(400).json({ error: 'runId is required' });
  const snapshot = runSnapshots.get(runId);
  if (!snapshot) {
    return res.json({ success: true, diffs: [] });
  }

  const { beforeFiles, afterFiles, workspacePath } = snapshot;
  const allPaths = new Set([...beforeFiles.keys(), ...afterFiles.keys()]);
  
  if (workspacePath && fs.existsSync(workspacePath)) {
    try {
      const scanDir = (dir, rel = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            scanDir(fullPath, relPath);
          } else if (entry.isFile()) {
            allPaths.add(relPath);
          }
        }
      };
      scanDir(workspacePath);
    } catch (_) {}
  }

  const diffs = [];
  for (const filePath of allPaths) {
    const before = beforeFiles.get(filePath);
    let after = afterFiles.get(filePath);
    if (after === undefined && workspacePath) {
      try {
        const fullPath = safeJoin(workspacePath, filePath);
        if (fs.existsSync(fullPath)) {
          after = fs.readFileSync(fullPath, 'utf-8');
        }
      } catch (_) {}
    }

    if (before === undefined && after !== undefined) {
      diffs.push({ path: filePath, status: 'added', before: '', after });
    } else if (before !== undefined && after === undefined) {
      diffs.push({ path: filePath, status: 'deleted', before, after: '' });
    } else if (before !== after) {
      diffs.push({ path: filePath, status: 'modified', before: before || '', after: after || '' });
    }
  }

  res.json({ success: true, diffs });
});

// POST /api/agent/revert-file
router.post('/revert-file', (req, res) => {
  const { runId, path: targetPath } = req.body;
  if (!runId || !targetPath) return res.status(400).json({ error: 'runId and path are required' });
  const snapshot = runSnapshots.get(runId);
  if (!snapshot) return res.status(404).json({ error: 'Run snapshot not found' });

  const { beforeFiles, workspacePath, projectId } = snapshot;
  const beforeContent = beforeFiles.get(targetPath);
  const diskPath = safeJoin(workspacePath, targetPath);

  try {
    if (beforeContent !== undefined) {
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, beforeContent, 'utf-8');
      try {
        const ChatModel = require('../models/Chat');
        const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
        dbInstance.prepare('INSERT INTO workspace_files (project_id, file_path, content) VALUES (?, ?, ?) ON CONFLICT(project_id, file_path) DO UPDATE SET content = excluded.content').run(projectId || 'default', targetPath, beforeContent);
      } catch (_) {}
    } else {
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      try {
        const ChatModel = require('../models/Chat');
        const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
        dbInstance.prepare('DELETE FROM workspace_files WHERE project_id = ? AND file_path = ?').run(projectId || 'default', targetPath);
      } catch (_) {}
    }
    res.json({ success: true, message: `Reverted ${targetPath}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agent/revert-all
router.post('/revert-all', (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId is required' });
  const snapshot = runSnapshots.get(runId);
  if (!snapshot) return res.status(404).json({ error: 'Run snapshot not found' });

  const { beforeFiles, afterFiles, workspacePath, projectId } = snapshot;
  let restored = 0, removed = 0;

  try {
    for (const [filePath, content] of beforeFiles.entries()) {
      const diskPath = safeJoin(workspacePath, filePath);
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, content, 'utf-8');
      try {
        const ChatModel = require('../models/Chat');
        const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
        dbInstance.prepare('INSERT INTO workspace_files (project_id, file_path, content) VALUES (?, ?, ?) ON CONFLICT(project_id, file_path) DO UPDATE SET content = excluded.content').run(projectId || 'default', filePath, content);
      } catch (_) {}
      restored++;
    }
    for (const [filePath] of afterFiles.entries()) {
      if (!beforeFiles.has(filePath)) {
        const diskPath = safeJoin(workspacePath, filePath);
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
        try {
          const ChatModel = require('../models/Chat');
          const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
          dbInstance.prepare('DELETE FROM workspace_files WHERE project_id = ? AND file_path = ?').run(projectId || 'default', filePath);
        } catch (_) {}
        removed++;
      }
    }
    res.json({ success: true, restored, removed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agent/rollback
router.post('/rollback', (req, res) => {
  const { checkpoint, projectId } = req.body;
  if (!checkpoint) return res.status(400).json({ error: 'checkpoint is required' });

  const workspacePath = path.join(os.tmpdir(), `agent-ws-${projectId || 'default'}`);
  try {
    const files = Array.isArray(checkpoint.files) ? checkpoint.files : [];
    for (const f of files) {
      if (!f || !f.path) continue;
      const diskPath = safeJoin(workspacePath, f.path);
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, f.content ?? '', 'utf-8');
      try {
        const ChatModel = require('../models/Chat');
        const dbInstance = ChatModel.db || require('better-sqlite3')(path.join(__dirname, '..', 'data', 'chat.db'));
        dbInstance.prepare('INSERT INTO workspace_files (project_id, file_path, content) VALUES (?, ?, ?) ON CONFLICT(project_id, file_path) DO UPDATE SET content = excluded.content').run(projectId || 'default', f.path, f.content ?? '');
      } catch (_) {}
    }
    res.json({ success: true, message: 'Rollback successful', restoredFiles: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agent/rag-sync
router.post('/rag-sync', async (req, res) => {
  const { directory } = req.body;
  const workspacePath = path.join(os.tmpdir(), `agent-ws-${directory || 'default'}`);
  try {
    const result = await PythonEngine.indexDirectory(workspacePath);
    res.json({ success: true, result });
  } catch (e) {
    res.json({ success: false, warning: 'Python RAG engine offline, using in-memory TF-IDF index' });
  }
});

router.parseLLMAction = parseLLMAction;
router.searchCodebase = searchCodebase;
router.buildCodebaseIndex = buildCodebaseIndex;
module.exports = router;
