'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function buildCommands(args = []) {
  const forwardedArgs = Array.isArray(args) ? args.map(String) : [];
  const frontendArgs = ['--prefix', 'frontend', 'test'];

  // Root CLI flags such as --coverage belong to Jest, not backend test:all.
  if (forwardedArgs.length > 0) {
    frontendArgs.push('--', ...forwardedArgs);
  }

  return [
    { name: 'Frontend Jest', args: frontendArgs },
    { name: 'Backend test suite', args: ['--prefix', 'backend', 'run', 'test:all'] }
  ];
}

function main() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    console.error('[test] Run this runner through npm (for example: npm test -- --coverage).');
    process.exitCode = 1;
    return;
  }

  for (const command of buildCommands(process.argv.slice(2))) {
    console.log('\n[test] Running ' + command.name + '...');
    const result = spawnSync(process.execPath, [npmCli, ...command.args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env
    });

    if (result.error) {
      console.error('[test] Failed to start ' + command.name + ': ' + result.error.message);
      process.exitCode = 1;
      return;
    }
    if (result.status !== 0) {
      process.exitCode = result.status == null ? 1 : result.status;
      return;
    }
  }

  console.log('\n[test] Frontend and backend test suites passed.');
}

if (require.main === module) {
  main();
}

module.exports = { buildCommands };
