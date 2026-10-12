import { build } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await mkdir('dist/assets', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  outfile: 'dist/assets/app.js',
  loader: { '.css': 'css' },
  assetNames: 'media/[name]-[hash]',
  sourcemap: false,
  legalComments: 'none',
});
console.log('Frontend built to dist/.');
