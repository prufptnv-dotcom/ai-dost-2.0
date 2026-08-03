require('dotenv').config();
const GroqService = require('./services/groqService');

const AGENT_SYSTEM_PROMPT = `You are AI-Dost Autonomous Full-Stack AI Agent.
You operate using the ReAct (Reasoning + Acting) loop.

AVAILABLE TOOLS:
1. create_file: {"path": "relative/path.ext", "content": "file content"}
2. apply_diff: {"path": "relative/path.ext", "search": "exact string to replace", "replace": "new string"}
3. run_terminal: {"command": "shell command"}
4. search_codebase: {"query": "search term"}
5. view_file: {"path": "relative/path.ext"}
6. FINAL_ANSWER: {"answer": "summary"}

RESPONSE FORMAT (JSON ONLY):
{
  "thought": "Your reasoning",
  "action": "tool_name",
  "parameters": { ... }
}`;

async function testPrompt() {
  const prompt = `${AGENT_SYSTEM_PROMPT}\n\nUSER TASK: build a simple calculator\n\nASSISTANT (respond with valid JSON only):`;
  console.log('Sending prompt to Groq with dotenv loaded...');
  const res = await GroqService.chat(prompt, [], 'project', null);
  console.log('RESPONSE:', res);
}

testPrompt().catch(console.error);
