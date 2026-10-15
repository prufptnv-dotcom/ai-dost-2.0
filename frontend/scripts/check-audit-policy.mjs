import { spawnSync } from 'node:child_process';

function runAudit(args, scope) {
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
      `${scope} npm audit did not return valid JSON (exit=${result.status}): ${result.stderr || result.stdout}`,
    );
  }

  if (report.error || !report.metadata?.vulnerabilities) {
    throw new Error(
      `${scope} npm audit failed: ${report.error?.summary || report.error?.code || 'missing vulnerability metadata'}`,
    );
  }

  const counts = report.metadata.vulnerabilities;
  console.log(
    `${scope} dependency audit: ${counts.total} total ` +
    `(critical=${counts.critical}, high=${counts.high}, ` +
    `moderate=${counts.moderate}, low=${counts.low}).`,
  );

  if (result.status !== 0 || counts.total !== 0) {
    const findings = Object.entries(report.vulnerabilities || {})
      .map(([name, item]) => `${name} (${item.severity}; ${item.range || 'affected range unavailable'})`)
      .join(', ');
    throw new Error(
      `${scope} dependency audit must be clean; npm audit exit=${result.status}. ${findings || result.stderr || 'No finding details were returned.'}`,
    );
  }
}

try {
  runAudit(['--omit=dev'], 'Production');
  runAudit([], 'Full');
  console.log('Dependency audit policy PASSED: production and development trees are clean.');
} catch (error) {
  console.error(`Dependency audit policy FAILED: ${error.message}`);
  process.exitCode = 1;
}
