const express = require('express');
const logger = require('../logger');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

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

// ── Agent System Prompt ───────────────────────────────────────────────────────
const AGENT_SYSTEM_PROMPT = `You are AI-Dost Agent, an autonomous AI coding assistant — similar to GitHub Copilot Agent Mode.
You work inside a real code workspace and have access to TOOLS that let you read, edit, search, and run code.

MULTILINGUAL PROMPT UNDERSTANDING:
- User prompts may be in English, Hindi, Hinglish (e.g. "ek html page banao index.html naam se", "main.py me error fix karo"), or mixed phrasing.
- ALWAYS extract the core intent: what file to create/read/modify, what code to write, what terminal command to run.
- Convert the user's request directly into concrete tool actions.

TOOLS AVAILABLE:
1. read_file(path) — Read a file's full content
2. write_file(path, content) — Create or completely overwrite a file
3. apply_diff(path, search, replace) — Surgically replace a code block in a file (PREFERRED for edits)
4. run_terminal(command) — Execute a shell command, get stdout+stderr
5. list_directory(path) — List all files in a folder
6. search_codebase(query) — Semantic keyword search across all project files, returns top 5 matching code chunks
7. run_tests(framework) — Auto-detect and execute unit tests (e.g. pytest, unittest, jest, npm test) and return pass/fail report

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
  "answer": "Summary of what was done and what files were changed."
}

RULES:
- If user requests creating or writing a file, use action 'write_file' with parameters 'path' and 'content'.
- If user requests editing an existing file, use action 'apply_diff' with 'path', 'search', and 'replace'. If exact content is unknown, use 'read_file' first.
- If run_terminal fails with an error, analyze the error and fix it before retrying.
- Never output prose before or after JSON — respond strictly with the JSON object.
- Max 14 steps total. Output FINAL_ANSWER when complete.
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
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const text = chunk.text.toLowerCase();
  const filename = chunk.file.toLowerCase();
  let score = 0;
  for (const word of words) {
    const re = new RegExp(word, 'g');
    const matches = (text.match(re) || []).length;
    score += matches * 2;
    if (filename.includes(word)) score += 5;
  }
  return score;
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
async function executeTool(action, parameters, projectPath, projectFiles) {
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
        const search = parameters.search || '';
        const replace = parameters.replace || '';
        if (!content.includes(search)) {
          return {
            success: false,
            error: `SEARCH block not found in ${parameters.path}. Use read_file to get exact content first, then retry apply_diff.`
          };
        }
        const newContent = content.replace(search, replace);
        try {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, newContent, 'utf-8');
        } catch (_) {}
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
      return new Promise((resolve) => {
        const cmd = parameters.command || '';
        const BLOCKED = ['rm -rf /', 'format c:', 'del /f /s /q c:\\', 'shutdown', 'rmdir /s /q c:'];
        if (BLOCKED.some(b => cmd.toLowerCase().includes(b))) {
          return resolve({ success: false, error: 'Command blocked for safety.', exit_code: 1 });
        }
        const child = exec(cmd, { cwd: projectPath, timeout: 20000 }, (err, stdout, stderr) => {
          const exitCode = err ? (err.code !== undefined ? err.code : 1) : 0;
          resolve({
            success: exitCode === 0,
            stdout: (stdout || '').substring(0, 3000),
            stderr: (stderr || '').substring(0, 3000),
            exit_code: exitCode,
            // Self-healing hint for LLM
            selfHealingHint: exitCode !== 0
              ? `Command failed with exit code ${exitCode}. Stderr: ${(stderr || '').substring(0, 500)}. Analyze the error and fix the code before retrying.`
              : null
          });
        });
        try { child.stdin.end('User\nFriend1\nFriend2\n'); } catch (_) {}
      });
    }

    // ── Phase 3: RAG Search Tool ──────────────────────────────────────────────
    case 'search_codebase': {
      const query = parameters.query || '';
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

    default:
      return { success: false, error: `Unknown tool: ${action}. Available: read_file, write_file, apply_diff, run_terminal, list_directory, search_codebase, run_tests` };
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

  // 1. Try Groq (Fast 8b model)
  try {
    const resp = await GroqService.chat(agentPrompt, [], 'agent', customKeys?.groq);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Groq failed:', e.message); }

  // 2. Try OpenRouter (5s fast timeout)
  try {
    const resp = await OpenRouterService.chat(agentPrompt, [], customKeys?.openrouter, 'agent');
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] OpenRouter failed:', e.message); }

  // 3. Try Gemini
  try {
    const resp = await GeminiService.chat(agentPrompt, [], null, 'agent', customKeys?.gemini);
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] Gemini failed:', e.message); }

  // 4. Try NVIDIA NIM
  try {
    const resp = await NvidiaService.chat(agentPrompt, [], customKeys?.nvidia, 'agent');
    if (!isErrorResp(resp)) return resp;
  } catch (e) { logger.info('[Agent] NVIDIA failed:', e.message); }

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
    };
    return {
      thought: parsed.thought || 'Executing task...',
      action: parsed.action,
      parameters: normalizedParams,
      answer: parsed.answer
    };
  }

  // Fallback: If LLM generated code block with file mention, infer write_file
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

  return { thought: raw, action: 'FINAL_ANSWER', answer: raw };
}

// ── Dynamic Input Analysis & Task Plan Generator ──────────────────────────────
function generateTaskPlan(userPrompt) {
  const clean = (userPrompt || '').toLowerCase();
  let tasks = [];
  let summary = `Executing task: "${userPrompt}"`;

  if (clean.includes('todo') || clean.includes('list') || clean.includes('task')) {
    summary = `Building Todo List Web Application: "${userPrompt}"`;
    tasks = [
      { id: 1, title: 'Create index.html layout & UI structure', status: 'in_progress' },
      { id: 2, title: 'Create style.css with dark glassmorphism styling', status: 'pending' },
      { id: 3, title: 'Create script.js with task add/delete & localStorage', status: 'pending' },
      { id: 4, title: 'Verify files & finalize workspace', status: 'pending' }
    ];
  } else if (clean.includes('calc') || clean.includes('math')) {
    summary = `Building Calculator App: "${userPrompt}"`;
    tasks = [
      { id: 1, title: 'Create index.html display & key grid layout', status: 'in_progress' },
      { id: 2, title: 'Create style.css modern glass theme', status: 'pending' },
      { id: 3, title: 'Create script.js evaluation logic', status: 'pending' },
      { id: 4, title: 'Verify files & finalize workspace', status: 'pending' }
    ];
  } else {
    tasks = [
      { id: 1, title: 'Analyze requirements & workspace files', status: 'in_progress' },
      { id: 2, title: 'Implement requested application code & styles', status: 'pending' },
      { id: 3, title: 'Verify implementation & finalize project', status: 'pending' }
    ];
  }

  return { summary, tasks };
}

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
  req.on('close', () => {
    isAborted = true;
    logger.info('[Agent] Client disconnected. Cancelling ReAct loop.');
  });

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

  // Build file context (RAG: most relevant files via search first)
  let fileContext = '';
  const relevantFiles = searchCodebase(userPrompt, projectFiles).results;
  if (relevantFiles.length > 0) {
    fileContext = '=== RELEVANT CODE (via semantic search) ===\n' +
      relevantFiles.map(r => `FILE: ${r.file} (line ${r.startLine})\n\`\`\`\n${r.snippet}\n\`\`\``).join('\n\n');
  }
  if (!fileContext && projectFiles && projectFiles.length > 0) {
    fileContext = projectFiles.slice(0, 5).map(f =>
      `FILE: ${f.path}\n\`\`\`\n${(f.content || '').substring(0, 1000)}\n\`\`\``
    ).join('\n\n');
  }

  send({ type: 'start', message: '🔍 Analyzing prompt & generating dynamic task plan...' });

  // Phase 1: Dynamic Task Breakdown Plan (Instant 0ms response)
  const plan = generateTaskPlan(userPrompt);
  send({ type: 'plan', plan });

  const taskListText = (plan?.tasks || [])
    .map(t => `- Task ${t.id}: ${t.title} [${(t.status || 'pending').toUpperCase()}]`)
    .join('\n');

  const messages = [{
    role: 'user',
    content: `WORKSPACE FILES:\n${fileContext || '(No files yet)'}\n\nUSER TASK: ${userPrompt}\n\nDYNAMIC TASK BREAKDOWN:\n${taskListText}`
  }];

  const MAX_STEPS = 14;
  const steps = [];
  let selfHealAttempts = 0;
  let activeTaskId = 1;

  for (let step = 0; step < MAX_STEPS; step++) {
    try {
      const activeTask = plan.tasks.find(t => t.id === activeTaskId) || plan.tasks[0];
      send({ 
        type: 'thinking', 
        step: step + 1, 
        message: `🧠 Task ${activeTask.id}/${plan.tasks.length}: ${activeTask.title}...` 
      });

      const rawResponse = await callLLM(messages, customKeys, (noticeMsg) => {
        send({ type: 'thinking', step: step + 1, message: noticeMsg });
      });
      const parsed = parseLLMAction(rawResponse);

      const stepLog = {
        step: step + 1,
        taskId: activeTaskId,
        thought: parsed.thought || '',
        action: parsed.action,
        parameters: parsed.parameters || {},
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
        parameters: parsed.parameters,
        thought: parsed.thought
      });

      const toolResult = await executeTool(parsed.action, parsed.parameters || {}, workspacePath, projectFiles);
      stepLog.result = toolResult;
      steps.push(stepLog);
      send({ type: 'step', stepLog });

      // Update task progress dynamically
      if (toolResult.success) {
        // Progress to next sub-task if file created/updated or action succeeded
        if (['create_file', 'write_file', 'apply_diff'].includes(parsed.action)) {
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
      }

      // ── Phase 4: Self-Healing Terminal Logic ─────────────────────────────────
      if (parsed.action === 'run_terminal' && !toolResult.success && selfHealAttempts < 2) {
        const errorContext = toolResult.selfHealingHint || toolResult.stderr || toolResult.error || 'Unknown error';
        selfHealAttempts++;
        send({
          type: 'self_heal',
          step: step + 1,
          message: `🔧 Self-healing (attempt ${selfHealAttempts}/2): Command failed — analyzing error and fixing...`
        });
        messages.push({ role: 'assistant', content: JSON.stringify({ thought: parsed.thought, action: parsed.action, parameters: parsed.parameters }) });
        messages.push({
          role: 'user',
          content: `SELF-HEALING REQUIRED: Command "${parsed.parameters?.command}" failed.\n\nERROR OUTPUT:\n${errorContext}\n\nYou must:\n1. Analyze the exact error above\n2. Fix the root cause (edit code if needed)\n3. Then retry the command\n\nDo NOT output FINAL_ANSWER yet — fix the error first.`
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
  res.end();
});

// ── Codebase Search Endpoint (can be called separately from UI) ───────────────
router.post('/search', (req, res) => {
  const { query, projectFiles } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  res.json(searchCodebase(query, projectFiles || []));
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

router.parseLLMAction = parseLLMAction;
module.exports = router;
