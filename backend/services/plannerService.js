const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const FRAMEWORK_TEMPLATES = {
  'react-vite': {
    name: 'React + Vite',
    description: 'Modern React app with Vite build tool',
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
    devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.2.0' },
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
      'src/App.jsx': `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  return (
    <div className="app">
      <header>
        <h1>{{projectName}}</h1>
        <p>A modern React application</p>
      </header>
      <main>
        <button onClick={() => setCount(count + 1)}>Count: {count}</button>
        <p>Edit src/App.jsx to customize</p>
      </main>
    </div>
  )
}

export default App`,
      'src/index.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; }
.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
header { text-align: center; margin-bottom: 2rem; }
button { padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; }
button:hover { background: #2563eb; }`,
      'src/App.css': `.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
header { text-align: center; margin-bottom: 2rem; }
button { padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; }
button:hover { background: #2563eb; }`,
      'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 }
})`,
      'package.json': `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}`
    }
  },
  'nextjs': {
    name: 'Next.js App Router',
    description: 'Full-stack React framework with App Router',
    dependencies: { next: '^14.0.0', react: '^18.2.0', 'react-dom': '^18.2.0' },
    devDependencies: { typescript: '^5.0.0', '@types/react': '^18.2.0', '@types/node': '^20.0.0' },
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}`,
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}`,
      'app/layout.tsx': `export const metadata = { title: '{{projectName}}', description: 'A Next.js application' }
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
      'app/page.tsx': `export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>{{projectName}}</h1>
      <p>A modern Next.js application</p>
    </main>
  )
}`,
      'app/globals.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }`,
      'next-env.d.ts': `/// <reference types="next" />
/// <reference types="next/image-types/global" />`
    }
  },
  'astro': {
    name: 'Astro',
    description: 'Modern static site builder with islands architecture',
    dependencies: { astro: '^4.0.0' },
    devDependencies: {},
    scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.0.0"
  }
}`,
      'astro.config.mjs': `import { defineConfig } from 'astro/config'
export default defineConfig({ server: { host: '0.0.0.0', port: 4321 } })`,
      'src/pages/index.astro': `---
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <main>
      <h1>{{projectName}}</h1>
      <p>A modern Astro application</p>
    </main>
  </body>
</html>`,
      'src/styles/global.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }`,
      'public/favicon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="55" font-size="50" text-anchor="middle">🚀</text></svg>`
    }
  },
  'sveltekit': {
    name: 'SvelteKit',
    description: 'Full-stack Svelte framework',
    dependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^4.0.0', vite: '^5.0.0' },
    devDependencies: { '@sveltejs/vite-plugin-svelte': '^3.0.0', typescript: '^5.0.0' },
    scripts: { dev: 'vite dev', build: 'vite build', preview: 'vite preview' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte": "^4.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.0.0"
  }
}`,
      'vite.config.js': `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [sveltekit()], server: { host: '0.0.0.0', port: 5173 } })`,
      'svelte.config.js': `import adapter from '@sveltejs/adapter-auto';
export default { kit: { adapter } }`,
      'src/routes/+page.svelte': `<script> let count = 0; </script>
<main>
  <h1>{{projectName}}</h1>
  <p>A modern SvelteKit application</p>
  <button onclick={() => count++}>Count: {count}</button>
</main>
<style>
  main { padding: 2rem; font-family: system-ui; text-align: center; }
  button { padding: 0.75rem 1.5rem; font-size: 1rem; background: #ff3e00; color: white; border: none; border-radius: 0.5rem; cursor: pointer; }
</style>`,
      'src/app.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    %sveltekit.body%
  </body>
</html>`
}
  },
  'express': {
    name: 'Express API',
    description: 'REST API server with Express.js',
    dependencies: { express: '^4.18.0', cors: '^2.8.5', 'body-parser': '^1.20.2' },
    devDependencies: { nodemon: '^3.0.0' },
    scripts: { dev: 'nodemon index.js', start: 'node index.js' },
    files: {
      'index.js': `const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data/todos.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

app.use('/api/todos', todosRouter);

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../client/dist/index.html')); });

app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));`,
      'package.json': `{
  "name": "{{projectName}}-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}`,
      'data/todos.json': `[]`
    }
  },
  'nuxt': {
    name: 'Nuxt 3',
    description: 'Full-stack Vue framework with Nuxt 3',
    dependencies: { nuxt: '^3.8.0', vue: '^3.3.0' },
    devDependencies: { '@nuxt/devtools': '^1.0.0' },
    scripts: { dev: 'nuxt dev', build: 'nuxt build', generate: 'nuxt generate', preview: 'nuxt preview' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview"
  },
  "dependencies": {
    "nuxt": "^3.8.0",
    "vue": "^3.3.0"
  },
  "devDependencies": {
    "@nuxt/devtools": "^1.0.0"
  }
}`,
      'nuxt.config.ts': `export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: true,
  app: {
    head: { title: '{{projectName}}', meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }] }
  },
  modules: []
})`,
      'app.vue': `<template>
  <div class="app">
    <header><h1>{{projectName}}</h1></header>
    <main><NuxtPage /></main>
  </div>
</template>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }
.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
header { text-align: center; margin-bottom: 2rem; }
</style>`,
      'pages/index.vue': `<template>
  <div>
    <h1>{{projectName}}</h1>
    <p>A modern Nuxt 3 application</p>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>`,
      'assets/main.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }`
    }
  },
  'remix': {
    name: 'Remix',
    description: 'Full-stack React framework with Remix',
    dependencies: { '@remix-run/react': '^2.8.0', '@remix-run/node': '^2.8.0', react: '^18.2.0', 'react-dom': '^18.2.0' },
    devDependencies: { '@remix-run/dev': '^2.8.0', vite: '^5.0.0', '@vitejs/plugin-react': '^4.2.0', typescript: '^5.0.0' },
    scripts: { dev: 'remix dev', build: 'remix build', start: 'remix-serve ./build/index.js' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "remix dev",
    "build": "remix build",
    "start": "remix-serve ./build/index.js"
  },
  "dependencies": {
    "@remix-run/react": "^2.8.0",
    "@remix-run/node": "^2.8.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@remix-run/dev": "^2.8.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.0.0"
  }
}`,
      'vite.config.ts': `import { remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [remix()], server: { host: '0.0.0.0', port: 3000 } })`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"]
}`,
      'remix.config.js': `module.exports = { ignoredRouteFiles: ['**/.*'] }`,
      'app/root.tsx': `import { Links, Meta, Outlet, Scripts } from '@remix-run/react';
export const links = () => [{ rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css' }];
export default function Root() {
  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body><Outlet /><Scripts /></body>
    </html>
  );
}`,
      'app/routes/_index.tsx': `export default function Index() {
  const [count, setCount] = React.useState(0);
  return (
    <main style={{padding: '2rem', textAlign: 'center'}}>
      <h1>{{projectName}}</h1>
      <p>A modern Remix application</p>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </main>
  );
}`,
      'app/entry.client.tsx': `import { hydrateRoot } from 'react-dom/client';
import { RemixBrowser } from '@remix-run/react';
hydrateRoot(document, <RemixBrowser />);`,
      'app/entry.server.tsx': `import { RemixServer } from '@remix-run/react';
import { renderToString } from 'react-dom/server';
export default function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Response(renderToString(<RemixServer context={remixContext} url={request.url} />), {
    status: responseStatusCode,
    headers: responseHeaders
  });
}`
    }
  },
  'expo': {
    name: 'Expo (React Native)',
    description: 'Cross-platform React Native with Expo',
    dependencies: { expo: '~50.0.0', 'react-native': '0.73.0', react: '18.2.0' },
    devDependencies: { '@babel/core': '^7.20.0', '@expo/cli': '^0.10.0' },
    scripts: { dev: 'expo start', build: 'expo build', start: 'expo start' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "build": "expo build",
    "start": "expo start"
  },
  "dependencies": {
    "expo": "~50.0.0",
    "expo-router": "~3.4.0",
    "react-native": "0.73.0",
    "react": "18.2.0",
    "react-native-safe-area-context": "4.8.0",
    "react-native-screens": "~3.29.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@expo/cli": "^0.10.0"
  }
}`,
      'app.json': `{
  "expo": {
    "name": "{{projectName}}",
    "slug": "{{projectName}}",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#ffffff" },
    "ios": { "supportsTablet": true },
    "android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#ffffff" } },
    "web": { "favicon": "./assets/favicon.png" },
    "plugins": ["expo-router"]
  }
}`,
      'app/_layout.tsx': `import { Stack } from 'expo-router';
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}`,
      'app/index.tsx': `import { View, Text, Button, StyleSheet } from 'react-native';
export default function Index() {
  const [count, setCount] = React.useState(0);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{{projectName}}</Text>
      <Text>A modern Expo application</Text>
      <Button title="Count: {count}" onPress={() => setCount(c => c + 1)} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 }
});`
    }
  },
  'tauri': {
    name: 'Tauri (Rust + Web)',
    description: 'Desktop apps with Rust backend + Web frontend',
    dependencies: { '@tauri-apps/api': '^1.5.0', react: '^18.2.0', 'react-dom': '^18.2.0' },
    devDependencies: { '@tauri-apps/cli': '^1.5.0', vite: '^5.0.0', '@vitejs/plugin-react': '^4.2.0', typescript: '^5.0.0' },
    scripts: { dev: 'tauri dev', build: 'tauri build' },
    files: {
      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tauri-apps/api": "^1.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.0.0"
  }
}`,
      'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 },
  build: { outDir: '../dist' }
})`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}`,
      'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
      'src/App.tsx': `import { useState } from 'react';
import './App.css';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [count, setCount] = useState(0);
  const [greeting, setGreeting] = useState('');
  
  async function greet() {
    const msg = await invoke('greet', { name: 'World' });
    setGreeting(msg);
  }

  return (
    <div className="app">
      <header><h1>{{projectName}}</h1></header>
      <main>
        <p>A modern Tauri (Rust + React) application</p>
        <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
        <button onClick={greet}>Greet from Rust</button>
        {greeting && <p>{greeting}</p>}
      </main>
    </div>
  );
}
export default App;`,
      'src/index.css': `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; line-height: 1.5; }
.app { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
header { text-align: center; margin-bottom: 2rem; }
button { padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; }
button:hover { background: #2563eb; }`,
      'src-tauri/Cargo.toml': `[package]
name = "{{projectName}}"
version = "1.0.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["macos-private-api", "api-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
`,
      'src-tauri/src/main.rs': `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command, generate_context, Builder, Manager};

#[command]
fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
  Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
    .run(generate_context!())
    .expect("error while running tauri application");
}
`,
      'src-tauri/tauri.conf.json': `{
  "build": { "beforeDevCommand": "npm run dev", "beforeBuildCommand": "npm run build", "devPath": "http://localhost:5173", "distDir": "../dist" },
  "package": { "productName": "{{projectName}}", "version": "1.0.0" },
  "tauri": {
    "allowlist": { "all": true },
    "windows": [{ "title": "{{projectName}}", "width": 800, "height": 600 }],
    "security": { "csp": null }
  }
}`
    }
  }
};

class PlannerService {
  constructor() {
    this.plans = new Map();
    this._maxPlans = 50;
  }

  async createPlan(prompt, options = {}) {
    if (!prompt || typeof prompt !== 'string') {
      const err = new Error('prompt is required and must be a non-empty string');
      err.status = 400;
      err.code = 'BAD_INPUT';
      throw err;
    }

    // Cap in-memory plans to avoid unbounded growth
    if (this.plans.size >= this._maxPlans) {
      const oldestKey = this.plans.keys().next().value;
      this.plans.delete(oldestKey);
    }

    const planId = uuidv4().substring(0, 8);
    const projectName = this.sanitizeProjectName(this.extractProjectName(prompt) || 'ai-dost-project');
    const framework = options.framework || this.detectFramework(prompt);

    const template = FRAMEWORK_TEMPLATES[framework];
    if (!template) {
      const err = new Error(`Unknown framework: ${framework}. Available: ${Object.keys(FRAMEWORK_TEMPLATES).join(', ')}`);
      err.status = 400;
      err.code = 'BAD_FRAMEWORK';
      throw err;
    }

    const plan = {
      id: planId,
      projectName,
      framework: template.name,
      frameworkKey: framework,
      prompt: String(prompt).slice(0, 2000),
      template,
      steps: this.generateSteps(prompt, template, projectName),
      createdAt: new Date().toISOString(),
      status: 'planned',
      estimatedTime: this.estimateTime(template)
    };

    this.plans.set(planId, plan);
    return plan;
  }

  sanitizeProjectName(name) {
    const cleaned = String(name).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 60);
    return cleaned || 'ai-dost-project';
  }

  extractProjectName(prompt) {
    const match = prompt.match(/(?:name|call|named)\s+["']?([^"'\s]+)["']?/i);
    if (match) return match[1].replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    const words = prompt.toLowerCase().split(/\s+/);
    const idx = words.findIndex(w => ['app', 'project', 'site', 'page', 'dashboard', 'tool', 'blog', 'portfolio', 'shop', 'store'].includes(w));
    if (idx > 0) return words[idx - 1].replace(/[^a-zA-Z0-9-]/g, '-');
    
    return null;
  }

  detectFramework(prompt) {
    const p = prompt.toLowerCase();
    if (p.includes('next') || p.includes('nextjs')) return 'nextjs';
    if (p.includes('nuxt')) return 'nuxt';
    if (p.includes('remix')) return 'remix';
    if (p.includes('expo') || p.includes('react native') || p.includes('mobile app')) return 'expo';
    if (p.includes('tauri') || p.includes('rust') || p.includes('desktop app')) return 'tauri';
    if (p.includes('astro')) return 'astro';
    if (p.includes('svelte')) return 'sveltekit';
    if (p.includes('vue')) return 'nuxt';
    if (p.includes('react') || p.includes('vite')) return 'react-vite';
    return 'react-vite';
  }

  generateSteps(prompt, template, projectName) {
    const steps = [
      { id: 1, title: 'Initialize project structure', description: 'Create project directory and initialize package.json', status: 'pending', tool: 'sandbox_create', estimatedTime: 30 },
      { id: 2, title: 'Write configuration files', description: 'Write package.json, config files, and build setup', status: 'pending', tool: 'sandbox_write', estimatedTime: 60 },
      { id: 3, title: 'Create source files', description: 'Generate main entry points, components, and pages', status: 'pending', tool: 'sandbox_write', estimatedTime: 120 },
      { id: 4, title: 'Install dependencies', description: 'Run npm install to install all dependencies', status: 'pending', tool: 'sandbox_exec', estimatedTime: 120 },
      { id: 5, title: 'Start development server', description: 'Launch dev server and verify it runs', status: 'pending', tool: 'sandbox_dev_start', estimatedTime: 30 },
      { id: 6, title: 'Verify live preview', description: 'Check that the preview loads correctly', status: 'pending', tool: 'sandbox_exec', estimatedTime: 30 }
    ];

    // Customize based on prompt
    if (prompt.toLowerCase().includes('api') || prompt.toLowerCase().includes('backend')) {
      steps.push({ id: 7, title: 'Create API routes', description: 'Add backend API endpoints', status: 'pending', tool: 'sandbox_write', estimatedTime: 90 });
    }
    if (prompt.toLowerCase().includes('database') || prompt.toLowerCase().includes('db')) {
      steps.push({ id: 8, title: 'Setup database', description: 'Configure database connection and models', status: 'pending', tool: 'sandbox_write', estimatedTime: 60 });
    }
    if (prompt.toLowerCase().includes('auth') || prompt.toLowerCase().includes('login')) {
      steps.push({ id: 9, title: 'Implement authentication', description: 'Add auth pages and logic', status: 'pending', tool: 'sandbox_write', estimatedTime: 120 });
    }

    return steps;
  }

  estimateTime(template) {
    const baseTime = 5; // minutes
    const fileCount = Object.keys(template.files).length;
    return Math.ceil(baseTime + fileCount * 0.5);
  }

  getPlan(planId) {
    return this.plans.get(planId) || null;
  }

  updatePlanStep(planId, stepId, status, result = null) {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    
    const step = plan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = status;
      step.result = result;
      step.completedAt = status === 'completed' ? new Date().toISOString() : null;
    }
    return true;
  }

  async executePlan(planId, sandboxManager, devServerManager, onProgress) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    // Create sandbox
    onProgress?.({ step: 1, message: 'Creating sandbox...' });
    const sandbox = await sandboxManager.createSandbox(plan.projectName, { ports: this.getRequiredPorts(plan.frameworkKey) });
    const sandboxId = sandbox.id;

    try {
      // Write all template files
      onProgress?.({ step: 2, message: 'Writing project files...' });
      const template = FRAMEWORK_TEMPLATES[plan.frameworkKey] || FRAMEWORK_TEMPLATES['react-vite'];
      for (const [filePath, content] of Object.entries(template.files)) {
        const processed = content.replace(/\{\{projectName\}\}/g, plan.projectName);
        await sandboxManager.writeFile(sandboxId, filePath, processed);
      }

      // Install dependencies
      onProgress?.({ step: 4, message: 'Installing dependencies...' });
      await sandboxManager.exec(sandboxId, 'npm install', { timeout: 180000 });

      // Start dev server
      onProgress?.({ step: 5, message: 'Starting dev server...' });
      const devResult = await devServerManager.startDevServer(sandboxId, '.');
      
      onProgress?.({ step: 6, message: 'Verifying preview...' });
      return { success: true, sandboxId, url: devResult.url, planId: plan.id };
    } catch (err) {
      await sandboxManager.destroy(sandboxId);
      throw err;
    }
  }

  getRequiredPorts(frameworkKey) {
    const ports = { 
      'react-vite': [5173], 
      'nextjs': [3000], 
      'astro': [4321], 
      'sveltekit': [5173], 
      'nuxt': [3000], 
      'remix': [3000],
      'expo': [8081, 19000, 19001],
      'tauri': [5173]
    };
    return ports[frameworkKey] || [5173];
  }

  listTemplates() {
    return Object.entries(FRAMEWORK_TEMPLATES).map(([key, t]) => ({ key, name: t.name, description: t.description }));
  }

  mergeTemplates(frontendKey, backendKey, projectName) {
    const frontend = FRAMEWORK_TEMPLATES[frontendKey];
    const backend = FRAMEWORK_TEMPLATES[backendKey];
    if (!frontend || !backend) {
      throw new Error(`Unknown template keys: ${frontendKey}, ${backendKey}`);
    }

    const mergedFiles = {};
    for (const [path, content] of Object.entries(frontend.files)) {
      mergedFiles[`client/${path}`] = content.replace(/\{\{projectName\}\}/g, projectName);
    }
    for (const [path, content] of Object.entries(backend.files)) {
      mergedFiles[`server/${path}`] = content.replace(/\{\{projectName\}\}/g, projectName);
    }
    mergedFiles['package.json'] = JSON.stringify({
    name: projectName,
    version: "1.0.0",
    private: true,
    workspaces: ["client", "server"],
    scripts: {
      dev: 'concurrently "npm run dev --workspace=client" "npm run dev --workspace=server"',
      build: "npm run build --workspaces",
      "install:all": "npm install --workspaces"
    },
    devDependencies: {
      concurrently: "^8.2.0"
    }
  }, null, 2);

    return { files: mergedFiles, projectName };
  }
}

module.exports = new PlannerService();