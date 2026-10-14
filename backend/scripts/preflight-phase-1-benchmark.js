#!/usr/bin/env node
'use strict';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key);
    args[key] = value;
    i += 1;
  }
  return args;
}

function ensureLocalUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must use HTTP or HTTPS.');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error('Benchmark preflight only permits a loopback backend URL.');
  }
  return url.toString().replace(/\/+$/, '');
}

async function checkBackendHealth({ baseUrl, timeoutMs = 5000, fetchImpl = fetch }) {
  const localBaseUrl = ensureLocalUrl(baseUrl);
  let response;
  try {
    response = await fetchImpl(localBaseUrl + '/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error('Backend health request failed: ' + error.message);
  }
  if (!response.ok) throw new Error('Backend health endpoint returned HTTP ' + response.status + '.');
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('Backend health endpoint did not return valid JSON.');
  }
  if (!body || body.status !== 'OK') throw new Error('Backend health status is not OK.');
  const keysConfigured = Number.isInteger(body.keysConfigured) ? body.keysConfigured : null;
  return {
    baseUrl: localBaseUrl,
    healthStatus: body.status,
    keysConfigured,
    providerConfiguration: keysConfigured === null
      ? 'UNKNOWN'
      : keysConfigured > 0 ? 'AT_LEAST_ONE_API_KEY_CONFIGURED' : 'NO_RECOGNIZED_API_KEYS_REPORTED',
    warning: keysConfigured === 0
      ? 'The backend reports zero recognized provider API keys. OAuth or other auth paths may still work; confirm the intended provider before spending benchmark runs.'
      : keysConfigured === null
        ? 'The health response did not expose local provider-key configuration; verify provider readiness from backend logs.'
        : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args['base-url'] || process.env.AI_DOST_BASE_URL || 'http://127.0.0.1:5000';
  const preferredModel = args['preferred-model'] || process.env.AI_DOST_BENCHMARK_MODEL;
  const revision = args.revision || process.env.AI_DOST_BENCHMARK_REVISION;
  const timeoutMs = Number(args['timeout-ms'] || 5000);
  if (!preferredModel) throw new Error('Set --preferred-model or AI_DOST_BENCHMARK_MODEL before running the benchmark.');
  if (!revision) throw new Error('Set --revision or AI_DOST_BENCHMARK_REVISION to record the exact backend revision.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000) {
    throw new Error('--timeout-ms must be an integer from 1000 to 30000.');
  }
  const health = await checkBackendHealth({ baseUrl, timeoutMs });
  const report = {
    preflightStatus: 'READY_TO_ATTEMPT_GENERATION',
    revision,
    preferredModel,
    timeoutMs,
    health,
    note: 'Health readiness is not proof that a model call will succeed or that the preferred model will be selected. This preflight does not generate an app or consume model tokens.',
  };
  console.log(JSON.stringify(report, null, 2));
  if (health.warning) console.warn('WARNING: ' + health.warning);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Phase 1 benchmark preflight failed: ' + error.message);
    process.exitCode = 2;
  });
}

module.exports = { parseArgs, ensureLocalUrl, checkBackendHealth };
