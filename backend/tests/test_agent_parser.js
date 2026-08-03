const router = require('../routes/agent.js');
const parse = router.parseLLMAction;

// Test 1: Standard JSON with file/code keys
const raw1 = JSON.stringify({
  thought: 'creating HTML',
  action: 'write_file',
  parameters: { file: 'index.html', code: '<h1>Hello World</h1>' }
});
const t1 = parse(raw1);
console.log('T1 (Standard JSON with file/code keys):', t1.action === 'write_file' && t1.parameters.path === 'index.html' && t1.parameters.content === '<h1>Hello World</h1>' ? 'PASSED ✅' : 'FAILED ❌');

// Test 2: Multiline unescaped string repair
const raw2 = '{\n"thought": "writing python",\n"action": "write_file",\n"parameters": {\n"file_path": "main.py",\n"text": "print(123)"\n}\n}';
const t2 = parse(raw2);
console.log('T2 (Multiline unescaped string repair):', t2.action === 'write_file' && t2.parameters.path === 'main.py' && t2.parameters.content === 'print(123)' ? 'PASSED ✅' : 'FAILED ❌');

// Test 3: Markdown codeblock fallback
const raw3 = 'Here is the index.html file:\n```html\n<h1>Hello World</h1>\n```';
const t3 = parse(raw3);
console.log('T3 (Markdown codeblock fallback):', t3.action === 'write_file' && t3.parameters.path === 'index.html' ? 'PASSED ✅' : 'FAILED ❌');

console.log('All agent parser unit tests complete.');
