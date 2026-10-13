import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const EXCEPTION_EXPIRES_AT = Date.parse('2026-11-13T23:59:59Z');
const EXPECTED_KEYS = new Set([
  '@next/eslint-plugin-next',
  'braces',
  'eslint-config-next',
  'fast-glob',
  'micromatch',
]);
const BRACES_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';

function runAudit(args) {
  const result = spawnSync('npm', ['audit', ...args, '--json'], {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `npm audit did not return valid JSON (exit=${result.status}): ${result.stderr || result.stdout}`,
    );
  }

  if (report.error || !report.metadata?.vulnerabilities) {
    throw new Error(`npm audit failed: ${report.error?.summary || report.error?.code || 'missing vulnerability metadata'}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`npm audit exited unexpectedly with status ${result.status}`);
  }
  return report;
}

function fail(message) {
  console.error(`Dependency audit policy FAILED: ${message}`);
  process.exit(1);
}

const production = runAudit(['--omit=dev']);
const productionCounts = production.metadata.vulnerabilities;
console.log(
  `Production dependency audit: ${productionCounts.total} total ` +
  `(critical=${productionCounts.critical}, high=${productionCounts.high}, ` +
  `moderate=${productionCounts.moderate}, low=${productionCounts.low}).`,
);
if (productionCounts.total !== 0) {
  fail('production dependencies must have zero known vulnerabilities');
}

const full = runAudit([]);
const counts = full.metadata.vulnerabilities;
if (counts.total === 0) {
  console.log('Full dependency audit is clean; no temporary exception is needed.');
  process.exit(0);
}

if (Date.now() > EXCEPTION_EXPIRES_AT) {
  fail('the temporary, dev-tool-only exception expired; review the current advisory and dependency tree');
}

const findings = Object.entries(full.vulnerabilities || {});
if (
  findings.length !== 5 ||
  findings.some(([name, item]) => !EXPECTED_KEYS.has(name) || item.severity !== 'high') ||
  counts.critical !== 0 ||
  counts.high !== 5 ||
  counts.moderate !== 0 ||
  counts.low !== 0
) {
  fail(
    'full audit contains findings outside the narrowly scoped eslint-config-next → ' +
    'fast-glob → micromatch → braces chain; inspect the uploaded npm audit report',
  );
}

const braces = full.vulnerabilities.braces;
const advisory = braces?.via?.find((entry) => (
  typeof entry === 'object' && entry.url === BRACES_ADVISORY
));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const lockedBraces = lock.packages?.['node_modules/braces'];

if (!advisory || !lockedBraces || lockedBraces.version !== '3.0.3' || lockedBraces.dev !== true) {
  fail('the expected braces advisory/version/dev-only status changed; re-review instead of accepting it automatically');
}

console.warn(
  'Temporary exception: only the known GHSA-vfj7-8cjw-p6xm finding in braces@3.0.3 ' +
  'and its four eslint-config-next development-tool dependents remain. No patched braces release ' +
  'is currently available; this exception expires 2026-11-13 and does not apply to production dependencies.',
);
