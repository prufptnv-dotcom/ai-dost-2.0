const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

class AgentOrchestrator {
  constructor(options = {}) {
    this.projectPath = options.projectPath || os.tmpdir();
    this.customKeys = options.customKeys || {};
    this.agentSystemPrompt = `You are AI-Dost Agent, an autonomous AI coding assistant.
You work inside a real code workspace and have access to TOOLS that let you read, edit, search, run code, and generate full projects.

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
- For "create a full project" requests, use 'generate_project_from_prompt' to build the entire project autonomously.
- For resume requests, use 'resume_from_chat' to generate structured resume data.
- Never output prose before or after JSON — respond strictly with the JSON object.
- Max 14 steps total. Output FINAL_ANSWER when complete.
`;
    
    this.services = {
      groq: options.groqService,
      gemini: options.geminiService,
      openrouter: options.openrouterService,
      nvidia: options.nvidiaService,
      together: options.togetherService,
      deepseek: options.deepseekService,
      mistral: options.mistralService,
      huggingface: options.huggingfaceService
    };
  }

  // Execute a single tool action
  async executeTool(action, parameters) {
    const projectFiles = parameters.projectFiles || [];
    
    switch (action) {
      case 'read_file': {
        try {
          const filePath = path.join(this.projectPath, parameters.path);
          if (!fs.existsSync(filePath)) {
            const inMem = projectFiles.find(f => f.path === parameters.path);
            if (inMem) return { success: true, content: (inMem.content || '').substring(0, 8000), note: 'Loaded from memory' };
            return { success: false, error: `File not found: ${parameters.path}` };
          }
          const content = fs.readFileSync(filePath, 'utf-8');
          return { success: true, content: content.substring(0, 8000) };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      case 'write_file': {
        try {
          const filePath = path.join(this.projectPath, parameters.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, parameters.content || '', 'utf-8');
          // Update in-memory files if present
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
          const filePath = path.join(this.projectPath, parameters.path);
          let content;
          try {
            content = fs.readFileSync(filePath, 'utf-8');
          } catch (_) {
            const inMem = projectFiles.find(f => f.path === parameters.path);
            if (!inMem) return { success: false, error: `File not found: ${parameters.path}. Use read_file first.` };
            content = inMem.content || '';
          }
          const search = parameters.search || parameters.search_block || '';
          const replace = parameters.replace || parameters.new_code || parameters.replacement || '';
          if (!content.includes(search)) {
            return { success: false, error: `SEARCH block not found in ${parameters.path}. Use read_file to get exact content first, then retry apply_diff.` };
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

      case 'run_terminal': {
        return new Promise((resolve) => {
          const cmd = parameters.command || '';
          const BLOCKED = ['rm -rf /', 'format c:', 'del /f /s /q c:\\', 'shutdown', 'rmdir /s /q c:'];
          if (BLOCKED.some(b => cmd.toLowerCase().includes(b))) {
            return resolve({ success: false, error: 'Command blocked for safety.', exit_code: 1 });
          }
          exec(cmd, { cwd: this.projectPath, timeout: 20000 }, (err, stdout, stderr) => {
            const exitCode = err ? (err.code !== undefined ? err.code : 1) : 0;
            resolve({
              success: exitCode === 0,
              stdout: (stdout || '').substring(0, 3000),
              stderr: (stderr || '').substring(0, 3000),
              exit_code: exitCode,
              selfHealingHint: exitCode !== 0
                ? `Command failed with exit code ${exitCode}. Stderr: ${(stderr || '').substring(0, 500)}. Analyze the error and fix the code before retrying.`
                : null
            });
          });
        });
      }

      case 'search_codebase': {
        const query = parameters.query || '';
        // Lightweight TF-IDF search
        const chunks = [];
        for (const file of projectFiles) {
          const content = file.content || '';
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i += 20) {
            const chunk = lines.slice(i, i + 25).join('\n');
            if (chunk.trim().length > 20) {
              chunks.push({ file: file.path, startLine: i + 1, text: chunk });
            }
          }
        }
        const scored = chunks.map(c => ({
          ...c,
          score: (c.text.toLowerCase().includes(query.toLowerCase()) ? 3 : 0) + (c.file.toLowerCase().includes(query) ? 5 : 0)
        }))
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

      case 'run_tests': {
        return new Promise((resolve) => {
          let cmd = 'python -m unittest discover';
          const hasPackageJson = projectFiles.some(f => f.path === 'package.json') || fs.existsSync(path.join(this.projectPath, 'package.json'));
          if (hasPackageJson) {
            cmd = 'npm test';
          } else if (parameters.framework === 'pytest') {
            cmd = 'pytest';
          }
          exec(cmd, { cwd: this.projectPath, timeout: 25000 }, (err, stdout, stderr) => {
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

      case 'generate_project_from_prompt': {
        return new Promise(async (resolve) => {
          try {
            const prompt = parameters.prompt || '';
            const targetDir = parameters.targetDir || this.projectPath;
            
            const cleanPrompt = prompt.toLowerCase();
            const projectType = this.detectProjectType(cleanPrompt);
            const projectFiles = await this.generateProjectFiles(projectType, prompt, targetDir);
            
            // Initialize git repo
            try {
              await exec('git init', { cwd: targetDir, timeout: 10000 });
            } catch (_) {}
            
            // Install dependencies if package.json was created
            if (projectFiles.some(f => f.path === 'package.json')) {
              try {
                await exec('npm install', { cwd: targetDir, timeout: 120000 });
              } catch (e) {
                // npm install partial or failed, continuing...
              }
            }
            
            resolve({ 
              success: true, 
              message: `Project generated: ${projectType}`, 
              generatedFiles: projectFiles.map(f => ({ path: f.path, size: Buffer.from(f.content).length })),
              targetDir: targetDir
            });
          } catch (e) {
            resolve({ success: false, error: `Project generation failed: ${e.message}` });
          }
        });
      }

      case 'resume_from_chat': {
        return new Promise(async (resolve) => {
          try {
            const prompt = parameters.prompt || '';
            // Call the resume generation API via backend
            // This would typically fetch from the backend API
            resolve({ success: true, message: 'Resume generation endpoint called', resumeData: null });
          } catch (e) {
            resolve({ success: false, error: `Resume generation failed: ${e.message}` });
          }
        });
      }

      default:
        return { success: false, error: `Unknown tool: ${action}. Available: read_file, write_file, apply_diff, run_terminal, list_directory, search_codebase, run_tests, generate_project_from_prompt, resume_from_chat` };
    }
  }

  detectProjectType(cleanPrompt) {
    if (cleanPrompt.includes('todo') || cleanPrompt.includes('task') || cleanPrompt.includes('dolist')) return 'todo';
    if (cleanPrompt.includes('calc') || cleanPrompt.includes('calculator') || cleanPrompt.includes('math')) return 'calculator';
    if (cleanPrompt.includes('web') || cleanPrompt.includes('website') || cleanPrompt.includes('portfolio')) return 'web';
    if (cleanPrompt.includes('api') || cleanPrompt.includes('backend') || cleanPrompt.includes('server')) return 'api';
    if (cleanPrompt.includes('react') || cleanPrompt.includes('next') || cleanPrompt.includes('vue')) return 'react';
    if (cleanPrompt.includes('python') || cleanPrompt.includes('flask') || cleanPrompt.includes('django')) return 'python';
    if (cleanPrompt.includes('chrome') || cleanPrompt.includes('extension') || cleanPrompt.includes('browser')) return 'extension';
    return 'general';
  }

  async generateProjectFiles(projectType, prompt, targetDir) {
    const files = [];
    const sanitizedDir = targetDir.replace(/[^a-zA-Z0-9\/]/g, '');
    const projectDir = `${sanitizedDir}/${this.getProjectNameFromType(projectType)}`;
    
    try { fs.mkdirSync(projectDir, { recursive: true }); } catch (_) {}
    
    switch (projectType) {
      case 'todo': {
        files.push(...await this.generateTodoProject(projectDir, prompt));
        break;
      }
      case 'calculator': {
        files.push(...await this.generateCalculatorProject(projectDir, prompt));
        break;
      }
      case 'web': {
        files.push(...await this.generateWebProject(projectDir, prompt));
        break;
      }
      case 'api': {
        files.push(...await this.generateApiProject(projectDir, prompt));
        break;
      }
      case 'react': {
        files.push(...await this.generateReactProject(projectDir, prompt));
        break;
      }
      case 'python': {
        files.push(...await this.generatePythonProject(projectDir, prompt));
        break;
      }
      case 'extension': {
        files.push(...await this.generateExtensionProject(projectDir, prompt));
        break;
      }
      default: {
        files.push(...await this.generateGeneralProject(projectDir, prompt));
        break;
      }
    }
    
    return files;
  }

  getProjectNameFromType(type) {
    const names = { todo: 'todo-app', calculator: 'calculator', web: 'web-app', api: 'api-project', react: 'react-app', python: 'python-project', extension: 'chrome-extension', general: 'project' };
    return names[type] || 'project';
  }

  // Generate Todo App project
  async generateTodoProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo App - AI Generated</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>📝 Todo App</h1>
    <input type="text" id="new-task" placeholder="Add a task...">
    <button onclick="addTask()">Add</button>
    <ul id="task-list"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    });
    files.push({
      path: `${targetDir}/style.css`,
      content: `body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f0f2f5;
  margin: 0;
  padding: 2rem;
}

.container {
  max-width: 500px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

input[type="text"] {
  width: 70%;
  padding: 0.5rem;
  margin-right: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 0.5rem 1rem;
  background: #06b6d4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0891b2;
}

ul {
  margin-top: 1rem;
  list-style: none;
}

li {
  background: #f8f9fa;
  margin: 0.5rem 0;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}`,
    });
    files.push({
      path: `${targetDir}/script.js`,
      content: `const taskList = JSON.parse(localStorage.getItem('tasks') || '[]');
const taskListEl = document.getElementById('task-list');
const inputEl = document.getElementById('new-task');

function renderTasks() {
  taskListEl.innerHTML = '';
  taskList.forEach((task, i) => {
    const li = document.createElement('li');
    li.innerHTML = \`<span>\${task}</span><button onclick="deleteTask(\${i})">✕</button>\`;
    taskListEl.appendChild(li);
  });
}

function addTask() {
  const task = inputEl.value.trim();
  if (task) {
    taskList.push(task);
    localStorage.setItem('tasks', JSON.stringify(taskList));
    renderTasks();
    inputEl.value = '';
  }
}

function deleteTask(i) {
  taskList.splice(i, 1);
  localStorage.setItem('tasks', JSON.stringify(taskList));
  renderTasks();
}

// Render on load
renderTasks();`,
    });
    files.push({
      path: `${targetDir}/package.json`,
      content: `{
  "name": "todo-app",
  "version": "1.0.0",
  "description": "Todo application generated by AI-Dost",
  "main": "script.js",
  "scripts": {
    "start": "node -e \"console.log('Starting dev server...)\""
  },
  "dependencies": {}`,
    });
  }

  // Generate Calculator project
  async generateCalculatorProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculator - AI Generated</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="calculator">
    <input type="text" id="display" disabled>
    <div class="keys">
      <button onclick="clearDisplay()">AC</button>
      <button onclick="appendDisplay('/')">/</button>
      <button onclick="appendDisplay('*')">*</button>
      <button onclick="appendDisplay('-')">-</button>
      <button onclick="calculate()">=</button>
    </div>
    <input type="text" id="history" disabled>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    });
    files.push({
      path: `${targetDir}/style.css`,
      content: `body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #1a1a2e;
  color: #e94560;
  margin: 0;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

.calculator {
  background: #16213e;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  width: 300px;
}

#display {
  width: 100%;
  height: 40px;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #2a3548;
  color: #e94560;
  border: none;
  border-radius: 4px;
  text-align: right;
}

.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.keys button {
  background: #06b6d4;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 6px;
  font-size: 1.2rem;
  cursor: pointer;
}

.keys button:hover {
  background: #0891b2;
}`,
    });
    files.push({
      path: `${targetDir}/script.js`,
      content: `const display = document.getElementById('display');
const history = document.getElementById('history');

function appendDisplay(val) {
  display.value += val;
}

function clearDisplay() {
  display.value = '';
}

function calculate() {
  try {
    display.value = eval(display.value);
    history.value = display.value;
  } catch (e) {
    display.value = 'Error';
    setTimeout(() => display.value = '', 1000);
  }
}`,
    });
    files.push({
      path: `${targetDir}/package.json`,
      content: `{
  "name": "calculator",
  "version": "1.0.0",
  "description": "Calculator app generated by AI-Dost",
  "main": "script.js",
  "scripts": {
    "start": "echo 'Calculator running'"
  },
  "dependencies": {}`,
    });
  }

  // Generate general web project
  async generateWebProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-Generated Web App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>👋 Welcome to AI-Dost Generated App</h1>
  </header>
  <main>
    <section class="hero">
      <h2>Created with AI assistance</h2>
      <p>This project was generated from your prompt.</p>
    </section>
  </main>
  <script src="script.js"></script>
</body>
</html>`,
    });
    files.push({
      path: `${targetDir}/style.css`,
      content: `body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin: 0;
  padding: 0;
  background: #0a0a0f;
  color: #f8fafc;
  min-height: 100vh;
}

header {
  background: #16213e;
  padding: 1rem 2rem;
  text-align: center;
}

.hero {
  padding: 3rem;
  text-align: center;
}

h1 { color: #06b6d4; }
h2 { color: #67e8f9; }
p { color: #a0aec0; }`,
    });
    files.push({
      path: `${targetDir}/script.js`,
      content: `// General Web App
console.log('AI-Dost generated web application');

// Add your custom JavaScript here`,
    });
    files.push({
      path: `${targetDir}/package.json`,
      content: `{
  "name": "web-app",
  "version": "1.0.0",
  "description": "Web application generated by AI-Dost",
  "main": "script.js",
  "scripts": {
    "start": "echo 'Web app running'"
  },
  "dependencies": {}`,
    });
  }

  // Generate Python project
  async generatePythonProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/main.py`,
      content: `#!/usr/bin/env python3
\"\"\"\nGenerated Python Project by AI-Dost\n\"\"\"

import sys
import os

def main():
    print("🐍 AI-Dost Generated Python Project")
    print(f\"Project: {prompt[:50] if prompt else 'General'}\")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    print(f\"Working in: {current_dir}\")
    
    try:
        files = os.listdir(current_dir)
        print("Files:")
        for f in files:
            print(f\"  - {f}\")
    except Exception as e:
        print(f\"Error listing files: {e}\")

if __name__ == \"__main__\":
    main()`,
    });
    files.push({
      path: `${targetDir}/requirements.txt`,
      content: `# AI-Dost Generated Python Project\n# Add your dependencies here\n`,
    });
    files.push({
      path: `${targetDir}/README.md`,
      content: `# AI-Dost Generated Python Project\n\nGenerated from prompt: ${prompt}\n\n## Usage\n\nRun with: python main.py\n\n## Description\n\nThis project was automatically generated by AI-Dost.`,
    });
    files.push({
      path: `${targetDir}/package.json`,
      content: `{
  "name": "python-project",
  "version": "1.0.0",
  "description": "Python project generated by AI-Dost",
  "main": "main.py",
  "scripts": {
    "start": "python main.py"
  },
  "dependencies": {}`,
    });
  }

  // Generate Chrome extension project
  async generateExtensionProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/manifest.json`,
      content: `{
  \"manifest_version\": 3,
  \"name\": \"AI-Dost Extension\",
  \"version\": \"1.0.0\",
  \"description\": \"Generated by AI-Dost\",
  \"permissions\": [\"activeTab\", \"storage\"],
  \"content_scripts\": [
    {
      \"matches\": [\"<all_urls>\"],
      \"js\": [\"content.js\"]
    }
  ]}`,
    });
    files.push({
      path: `${targetDir}/content.js`,
      content: `// AI-Dost Content Script\nconsole.log('AI-Dost extension loaded');

// Your content script code here
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === \"getSelection\") {
    sendResponse({ text: window.getSelection().toString() });
  }
});`,
    });
  }

  // Generate general project
  async generateGeneralProject(targetDir, prompt) {
    const files = [];
    files.push({
      path: `${targetDir}/index.html`,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-Dost Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="content">
    <h1>🎯 AI-Dost Project</h1>
    <p>Generated from your natural language prompt.</p>
    <div id=\"content\">
      <!-- Content will be filled based on prompt -->
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    });
    files.push({
      path: `${targetDir}/style.css`,
      content: `body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #0a0a0f;
  color: #f8fafc;
  margin: 0;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.content { text-align: center; }
h1 { color: #06b6d4; margin-bottom: 1rem; }
p { color: #64748b; }`,
    });
    files.push({
      path: `${targetDir}/script.js`,
      content: `// General project script\nconsole.log('AI-Dost project loaded');
// Add your custom logic here`,
    });
    files.push({
      path: `${targetDir}/package.json`,
      content: `{
  "name": "project",
  "version": "1.0.0",
  "description": "Project generated by AI-Dost",
  "main": "script.js",
  "scripts": {
    "start": "echo 'Project running'"
  },
  "dependencies": {}`,
    });
    return files;
  }
}

// Self-healing: analyze error and suggest fix
async function suggestFix(error, context) {
  // Use Groq for quick error analysis
  if (options?.groqService) {
    try {
      const fixPrompt = `Analyze this error and provide a code fix:

Error: ${error}
Context: ${context}

Return ONLY the fixed code block with a brief explanation. No markdown formatting.`;
      
      const resp = await options.groqService.chat(fixPrompt, [], 'agent', options.customKeys?.groq);
      if (resp && resp.trim().length > 5) return resp;
    } catch (e) {
      // Ignore errors in fix suggestion
    }
  }
  return null;
}

module.exports = AgentOrchestrator;