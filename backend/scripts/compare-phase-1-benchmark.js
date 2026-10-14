#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  if (!args['artifacts-dir']) throw new Error('--artifacts-dir is required.');
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resultKey(result) {
  return result.caseId + '::' + result.runNumber;
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function validateSummary(summary, expectedPhase) {
  if (!summary || summary.phase !== expectedPhase) {
    throw new Error('Expected ' + expectedPhase + '-summary.json with matching phase field.');
  }
  if (!Number.isInteger(summary.runsPerCase) || summary.runsPerCase < 1 ||
      !Number.isInteger(summary.caseCount) || summary.caseCount < 1) {
    throw new Error(expectedPhase + ' summary must declare positive integer runsPerCase and caseCount.');
  }
  if (typeof summary.revision !== 'string' || !summary.revision.trim()) {
    throw new Error(expectedPhase + ' summary must record the exact backend revision.');
  }
  if (typeof summary.preferredModel !== 'string' || !summary.preferredModel.trim()) {
    throw new Error(expectedPhase + ' summary must record preferredModel.');
  }
  const expectedResultCount = summary.runsPerCase * summary.caseCount;
  if (!Array.isArray(summary.results) || summary.results.length !== expectedResultCount) {
    throw new Error(expectedPhase + ' summary must contain exactly ' + expectedResultCount + ' results.');
  }
  const seen = new Set();
  const caseIds = new Set();
  for (const item of summary.results) {
    if (!item || typeof item.caseId !== 'string' || !item.caseId.trim() ||
        !Number.isInteger(item.runNumber) || item.runNumber < 1 ||
        item.runNumber > summary.runsPerCase || typeof item.runDir !== 'string' || !item.runDir.trim()) {
      throw new Error(expectedPhase + ' summary contains an invalid case/run result.');
    }
    const key = resultKey(item);
    if (seen.has(key)) throw new Error(expectedPhase + ' summary contains duplicate case/run pair: ' + key);
    seen.add(key);
    caseIds.add(item.caseId);
  }
  if (caseIds.size !== summary.caseCount) {
    throw new Error(expectedPhase + ' summary caseCount does not match its unique case IDs.');
  }
  for (const caseId of caseIds) {
    for (let runNumber = 1; runNumber <= summary.runsPerCase; runNumber += 1) {
      if (!seen.has(caseId + '::' + runNumber)) {
        throw new Error(expectedPhase + ' summary is missing ' + caseId + ' run ' + runNumber + '.');
      }
    }
  }
}

function loadRunEvidence(result) {
  const runDir = result.runDir;
  const metadataPath = path.join(runDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error('Required provenance metadata is missing: ' + metadataPath);
  }
  const metadata = readJson(metadataPath);
  const diagnosticPath = path.join(runDir, 'static-diagnostic.json');
  let diagnostic = null;
  if (fs.existsSync(diagnosticPath)) {
    try {
      diagnostic = readJson(diagnosticPath);
    } catch (_) {}
  }
  const bytes = (metadata.project?.files || []).reduce((sum, file) => sum + (Number(file.bytes) || 0), 0);
  return {
    metadata,
    diagnostic,
    metrics: {
      generationCompleted: Boolean(metadata.generationCompleted),
      directorPathObserved: Boolean(metadata.directorPathObserved),
      generationCompletionReason: metadata.generationCompletionReason || 'NOT_RECORDED',
      fileCount: Number(metadata.project?.fileCount) || 0,
      totalBytes: bytes,
      elapsedMs: Number(metadata.elapsedMs) || 0,
      outputQuality: metadata.outputQuality?.status || 'NOT_REPORTED',
      staticSignalsObserved: diagnostic?.staticSignals?.observedCount ?? null,
      staticSignalsTotal: diagnostic?.staticSignals?.totalCount ?? null,
      placeholderCount: diagnostic?.placeholderMarkers?.count ?? null,
      acceptanceStatus: metadata.acceptanceStatus || 'NOT_RECORDED',
    },
    evidencePaths: {
      runDir,
      events: path.join(runDir, 'events.ndjson'),
      metadata: metadataPath,
      staticDiagnostic: fs.existsSync(diagnosticPath) ? diagnosticPath : null,
      projectDir: metadata.project?.directory || null,
    },
  };
}

function compareSummaries(baseline, candidate) {
  validateSummary(baseline, 'baseline');
  validateSummary(candidate, 'candidate');
  if (baseline.revision === candidate.revision) {
    throw new Error('Baseline and candidate revisions are identical; comparison would not measure a code change.');
  }
  if (baseline.runsPerCase !== candidate.runsPerCase || baseline.caseCount !== candidate.caseCount) {
    throw new Error('Baseline and candidate must use the same run count and case count.');
  }
  if (baseline.preferredModel !== candidate.preferredModel) {
    throw new Error('Baseline and candidate preferred-model settings differ; the comparison is not controlled.');
  }

  const baselineMap = new Map(baseline.results.map((item) => [resultKey(item), item]));
  const candidateMap = new Map(candidate.results.map((item) => [resultKey(item), item]));
  const baselineKeys = [...baselineMap.keys()].sort();
  const candidateKeys = [...candidateMap.keys()].sort();
  if (JSON.stringify(baselineKeys) !== JSON.stringify(candidateKeys)) {
    throw new Error('Baseline and candidate case/run pairs do not match.');
  }

  const pairs = [];
  const warnings = [];
  for (const key of baselineKeys) {
    const baseResult = baselineMap.get(key);
    const candidateResult = candidateMap.get(key);
    const base = loadRunEvidence(baseResult);
    const next = loadRunEvidence(candidateResult);
    for (const [label, loaded, summary, result] of [
      ['baseline', base, baseline, baseResult],
      ['candidate', next, candidate, candidateResult],
    ]) {
      if (loaded.metadata.phase !== label || loaded.metadata.caseId !== result.caseId ||
          Number(loaded.metadata.runNumber) !== result.runNumber) {
        throw new Error(label + ' provenance metadata does not match summary pair ' + key + '.');
      }
      if (loaded.metadata.revision !== summary.revision) {
        throw new Error(label + ' run revision does not match summary revision for ' + key + '.');
      }
      if (loaded.metadata.settings?.preferredModel !== summary.preferredModel) {
        throw new Error(label + ' run-level model preference does not match summary for ' + key + '.');
      }
    }
    if (base.metadata.prompt !== next.metadata.prompt) {
      throw new Error('Prompt mismatch for ' + key + '; results are not paired.');
    }
    if (base.metadata.settings?.preferredModel !== next.metadata.settings?.preferredModel) {
      throw new Error('Run-level model preference mismatch for ' + key + '.');
    }

    const baseProvider = base.metadata.settings?.actualProviderModelObservations?.[0]?.provider || null;
    const nextProvider = next.metadata.settings?.actualProviderModelObservations?.[0]?.provider || null;
    const providerParity = baseProvider && nextProvider ? baseProvider === nextProvider : null;
    const providerParityStatus = providerParity === null ? 'UNKNOWN' : providerParity ? 'MATCH' : 'MISMATCH';
    if (providerParity === false) {
      warnings.push(key + ': selected scaffold provider differs (' + baseProvider + ' -> ' + nextProvider + ').');
    } else if (providerParity === null) {
      warnings.push(key + ': selected provider is not exposed by the captured generation events; inspect backend logs before attributing differences.');
    }

    pairs.push({
      key,
      caseId: baseResult.caseId,
      runNumber: baseResult.runNumber,
      prompt: base.metadata.prompt,
      baseline: { revision: base.metadata.revision, ...base.metrics, evidencePaths: base.evidencePaths },
      candidate: { revision: next.metadata.revision, ...next.metrics, evidencePaths: next.evidencePaths },
      deltas: {
        fileCount: next.metrics.fileCount - base.metrics.fileCount,
        totalBytes: next.metrics.totalBytes - base.metrics.totalBytes,
        elapsedMs: next.metrics.elapsedMs - base.metrics.elapsedMs,
        staticSignalsObserved: base.metrics.staticSignalsObserved === null || next.metrics.staticSignalsObserved === null
          ? null
          : next.metrics.staticSignalsObserved - base.metrics.staticSignalsObserved,
        placeholderCount: base.metrics.placeholderCount === null || next.metrics.placeholderCount === null
          ? null
          : next.metrics.placeholderCount - base.metrics.placeholderCount,
      },
      providerParity,
      providerParityStatus,
      requirementAcceptance: {
        baseline: base.metrics.acceptanceStatus,
        candidate: next.metrics.acceptanceStatus,
        status: 'NOT_EVALUATED',
      },
    });
  }

  const baselineCompleted = pairs.filter((pair) => pair.baseline.generationCompleted).length;
  const candidateCompleted = pairs.filter((pair) => pair.candidate.generationCompleted).length;
  const report = {
    schemaVersion: '1.0',
    evaluator: 'phase-1-baseline-candidate-diagnostic-comparison',
    comparisonStatus: 'DIAGNOSTIC_ONLY',
    acceptanceStatus: 'NOT_EVALUATED',
    baseline: {
      revision: baseline.results?.[0] ? loadRunEvidence(baseline.results[0]).metadata.revision : null,
      preferredModel: baseline.preferredModel,
      runs: pairs.length,
      completedGenerations: baselineCompleted,
      averageFileCount: average(pairs.map((pair) => pair.baseline.fileCount)),
      averageElapsedMs: average(pairs.map((pair) => pair.baseline.elapsedMs)),
    },
    candidate: {
      revision: candidate.results?.[0] ? loadRunEvidence(candidate.results[0]).metadata.revision : null,
      preferredModel: candidate.preferredModel,
      runs: pairs.length,
      completedGenerations: candidateCompleted,
      averageFileCount: average(pairs.map((pair) => pair.candidate.fileCount)),
      averageElapsedMs: average(pairs.map((pair) => pair.candidate.elapsedMs)),
    },
    providerParityCount: pairs.filter((pair) => pair.providerParity === true).length,
    providerParityUnknownCount: pairs.filter((pair) => pair.providerParity === null).length,
    warnings,
    pairedRuns: pairs,
    interpretation: [
      'This report compares capture and static diagnostic evidence only; it is not a quality score.',
      'More files, bytes, or regex matches do not imply a better application.',
      'Requirement acceptance remains NOT_EVALUATED until isolated build/browser checks and criterion-specific behavior evidence are attached.',
      'Review provider parity and backend logs before attributing any change to the candidate code.',
    ],
  };
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args['artifacts-dir']);
  const baseline = readJson(path.join(artifactsDir, 'baseline-summary.json'));
  const candidate = readJson(path.join(artifactsDir, 'candidate-summary.json'));
  const report = compareSummaries(baseline, candidate);
  const outputPath = path.resolve(args.out || path.join(artifactsDir, 'baseline-vs-candidate-comparison.json'));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Diagnostic comparison written to ' + outputPath);
  console.log('Paired runs: ' + report.pairedRuns.length +
    '; baseline generations complete: ' + report.baseline.completedGenerations +
    '; candidate generations complete: ' + report.candidate.completedGenerations +
    '; acceptance: NOT_EVALUATED.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Phase 1 comparison failed: ' + error.message);
    process.exitCode = 2;
  }
}

module.exports = { parseArgs, compareSummaries };
