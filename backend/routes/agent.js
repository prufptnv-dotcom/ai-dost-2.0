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
const TogetherService   = require('../services/togetherService');
const DeepSeekService   = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const CerebrasService   = require('../services/cerebrasService');
const PythonEngine      = require('../services/pythonEngineService');
const AgentOrchestrator = require('../agent/orchestrator');
const McpClientManager  = require('../mcp/McpClientManager');

// ── Agent System Prompt ───────────────────────────────────────────────────────
const AGENT_SYSTEM_PROMPT = `You are AI-Dost Agent, an autonomous AI coding assistant — similar to GitHub Copilot Agent Mode.
You work inside a real code workspace and have access to TOOLS that let you read, edit, search, run code, see the UI, and generate full projects.

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
6. search_codebase(query) — Advanced Semantic RAG Search across the entire workspace. Use this to ask questions about the codebase architecture, locate features, or find where specific components are defined. Returns an AI-synthesized answer and relevant source code snippets.
7. run_tests(framework) — Auto-detect and execute unit tests (e.g. pytest, unittest, jest, npm test) and return pass/fail report
8. take_screenshot(url) — Take a full-page screenshot of a running app (default: http://localhost:3001). Returns base64 PNG. Use this to visually inspect the UI for bugs.
9. generate_project_from_prompt(prompt, targetDir) — Plan and create a complete full-stack project from a single prompt. Writes all files, runs npm install, starts dev server.
10. resume_from_chat(prompt) — Generate a structured resume from a user prompt. Returns JSON resume data.

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
- For visual UI bugs, use 'take_screenshot' to capture the rendered app, then analyze with vision.
- For "create a full project" requests, use 'generate_project_from_prompt' to build the entire project autonomously.
- For resume requests, use 'resume_from_chat' to generate structured resume data.
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
async function executeTool(action, parameters, projectPath, projectFiles, onProgress = null) {
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
          const targetDir = parameters.targetDir || projectPath;
          
          logger.info(`[Agent] Generating full-stack project for prompt: "${prompt}"`);
          if (onProgress) onProgress({ type: 'step', stepLog: { action: 'Generating architecture', thought: 'Analyzing prompt and generating file tree...' } });
          
          // 1. Prompt Gemini to scaffold the project
          const GeminiService = require('../services/geminiService');
          const systemPrompt = `You are an expert full-stack scaffolding AI. 
Generate a complete, working codebase for the following prompt: "${prompt}".
Return ONLY a valid JSON object containing an array of files. 
Do not wrap it in markdown blockquotes, just raw JSON.
Example format:
{
  "files": [
    { "path": "index.html", "content": "<!DOCTYPE html>..." },
    { "path": "style.css", "content": "body { ... }" },
    { "path": "package.json", "content": "{ \"name\": \"app\" }" }
  ]
}`;

          const rawResponse = await GeminiService.chat(systemPrompt, [], null, 'agent');
          if (onProgress) onProgress({ type: 'step', stepLog: { action: 'Parsing files', thought: 'Extracting project structure...' } });
          
          // 2. Parse JSON
          let parsedData;
          try {
            const cleaned = rawResponse.replace(/\`\`\`json\s*/gi, '').replace(/\`\`\`\s*$/gi, '').trim();
            parsedData = JSON.parse(cleaned);
          } catch (err) {
            // repair attempt
            try {
              const repaired = rawResponse.replace(/(?<=:\s*"[\s\S]*?)\r?\n(?=[\s\S]*?")/g, '\\n');
              parsedData = JSON.parse(repaired);
            } catch (err2) {
              throw new Error('Failed to parse scaffolding JSON from AI.');
            }
          }
          
          if (!parsedData || !Array.isArray(parsedData.files)) {
            throw new Error('AI returned an invalid project structure format.');
          }

          // 3. Write files to workspace
          const writtenFiles = [];
          for (const file of parsedData.files) {
            const safePath = safeJoin(targetDir, file.path);
            fs.mkdirSync(path.dirname(safePath), { recursive: true });
            fs.writeFileSync(safePath, file.content || '', 'utf-8');
            writtenFiles.push({ path: file.path, size: Buffer.from(file.content || '').length });
            
            // Auto-emit event so frontend IDE file tree updates in real-time
            fileEvents.emit('fileChanged', { projectId: null, action: 'add', path: file.path, content: file.content });
          }

          // 4. Initialize Git
          try {
            await new Promise((res) => exec('git init', { cwd: targetDir, timeout: 5000 }, res));
          } catch (_) {}

          // 5. Install Dependencies if package.json exists
          if (parsedData.files.some(f => f.path.endsWith('package.json'))) {
             if (onProgress) onProgress({ type: 'step', stepLog: { action: 'Installing dependencies', thought: 'Running npm install...' } });
             try {
               await new Promise((res, rej) => {
                 exec('npm install', { cwd: targetDir, timeout: 120000 }, (error) => {
                   if (error) rej(error); else res();
                 });
               });
             } catch (e) {
               logger.info('[Agent] npm install partial or failed, continuing...');
             }
          }

          resolve({ 
            success: true, 
            message: `Successfully generated ${parsedData.files.length} files.`,
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

    default:
      return { success: false, error: `Unknown tool: ${action}. Available: read_file, write_file, apply_diff, run_terminal, list_directory, search_codebase, run_tests, take_screenshot, generate_project_from_prompt, resume_from_chat` };
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

// ── Plan-only endpoint (plan → approve gate) ──────────────────────────────────
router.post('/plan', (req, res) => {
  const { userPrompt } = req.body;
  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return res.status(400).json({ error: 'userPrompt is required and must be a non-empty string' });
  }
  const plan = generateTaskPlan(userPrompt.trim());
  return res.json({ success: true, plan });
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
  // req.on('close', () => {
  //   isAborted = true;
  //   logger.info('[Agent] Client disconnected. Cancelling ReAct loop.');
  // });

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
        res.end();
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

  const MAX_STEPS = 14;
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
          const toolResult = await executeTool('write_file', { path: filename, content: fileContent }, workspacePath, projectFiles);
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

      const toolResult = await executeTool(parsed.action, parsed.parameters || {}, workspacePath, projectFiles, send);
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
  res.end();
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

router.parseLLMAction = parseLLMAction;
module.exports = router;
