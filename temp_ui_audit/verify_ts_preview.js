import { generateLiveAppHtml } from '../frontend/components/ide/PreviewEngine.js';

const files = [
  { path: 'src/main.tsx', content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);" },
  { path: 'src/App.tsx', content: "import { useState } from 'react';\nimport Hero from './components/Hero';\nexport default function App() { const [n, setN] = useState(0); return <Hero title={'hi'} />; }" },
  { path: 'src/components/Hero.tsx', content: "import { Sparkles } from 'lucide-react';\nexport default function Hero({ title }) { return <section><Sparkles />{title}</section>; }" },
];
const contents = Object.fromEntries(files.map((f) => [f.path, f.content]));

const html = generateLiveAppHtml(files, contents, true);

console.log('total lines:', html.split('\n').length);
console.log('\n=== leaked entry injections (must be 0) ===');
console.log('main.tsx createRoot:', (html.match(/createRoot\(document\.getElementById/g) || []).length);
console.log('bare <App /> outside guard:', (html.match(/<App \/>/g) || []).length);

console.log('\n=== import aliases emitted ===');
const aliases = html.split('\n').filter((l) => /^const (App|Hero|useState|Sparkles)\b.*(typeof React|typeof window)/.test(l.trim()));
console.log(aliases.length ? aliases.join('\n') : 'NONE');

console.log('\n=== guard present ===', html.includes("typeof App === 'undefined'"));

// every JSX root tag referenced must be declared somewhere
const tags = new Set((html.match(/<([A-Z][A-Za-z0-9_]*)/g) || []).map((t) => t.slice(1)));
const missing = [...tags].filter((t) => {
  const declared = new RegExp(`(function|class|const|let|var|window\\.)\\s*${t}\\b`).test(html);
  const alias = new RegExp(`const\\s+${t}\\s*=`).test(html);
  return !declared && !alias;
});
console.log('\nJSX tags:', [...tags].join(', '));
console.log('UNDECLARED TAGS:', missing.length ? missing.join(', ') : 'none');