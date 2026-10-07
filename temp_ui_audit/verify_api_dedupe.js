// Regression: api.js must be injected exactly once, or `const API` is declared
// twice and Babel throws a SyntaxError that blanks the whole preview.
import { generateLiveAppHtml } from '../frontend/components/ide/PreviewEngine.js';

const files = [
  { path: 'src/services/api.js', content: "const API = {\n  async getItems() { return fetch('/api/items'); }\n};\nexport default API;\nexport const getItems = () => API.getItems();\n" },
  { path: 'src/App.jsx', content: "import React, { useState } from 'react';\nimport { getItems } from './services/api';\nimport '@fortawesome/fontawesome-free/css/all.css';\nexport default function App(){ const [n,setN]=useState(0); return <div className='x'>{n}</div>; }" },
  { path: 'src/components/Card.jsx', content: "export default function Card({ title }){ return <div>{title}</div>; }" },
];
const contents = Object.fromEntries(files.map((f) => [f.path, f.content]));

const html = generateLiveAppHtml(files, contents, true);

// Count top-level declarations of each identifier the module system declares.
const declCount = (name) => (html.match(new RegExp(`(?:^|\\n)\\s*(?:const|let|var|function|class)\\s+${name}\\b`, 'g')) || []).length;

for (const name of ['API', 'getItems', 'App', 'Card']) {
  const n = declCount(name);
  console.log(`${name.padEnd(10)} declared ${n}x ${n > 1 ? '<-- DUPLICATE (SyntaxError)' : ''}`);
}

// Parse-check the whole script block the way Babel would: any duplicate
// top-level const is a hard failure.
const dupes = ['API', 'getItems', 'Card'].filter((n) => declCount(n) > 1);
console.log('\nduplicates:', dupes.length ? dupes.join(', ') : 'none');
console.log('FA css import stripped:', !html.includes("@fortawesome/fontawesome-free/css/all.css';\nimport"));
console.log('guard present:', html.includes("typeof App === 'undefined'"));