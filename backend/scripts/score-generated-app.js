'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CASES_PATH = path.join(__dirname, '..', 'quality-evaluation', 'phase-1-cases.json');
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);

function usage() {
  console.error('Usage: node scripts/score-generated-app.js --case <case-id> --project-dir <generated-project-path> [--out <report.json>]');
  console.error('Run from backend/. Static matches are diagnostic signals only, not correctness scores.');
}

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
  if (!args.case || !args['project-dir']) throw new Error('Both --case and --project-dir are required');
  return args;
}

function collectFiles(root, current = root, collected = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) collectFiles(root, absolute, collected);
      continue;
    }
    if (!entry.isFile()) continue;
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    collected.push({ absolute, relative, size: fs.statSync(absolute).size });
  }
  return collected;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const casesDoc = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const testCase = casesDoc.cases.find((item) => item.id === args.case);
  if (!testCase) throw new Error('Unknown case "' + args.case + '". Available: ' + casesDoc.cases.map((item) => item.id).join(', '));

  const projectDir = path.resolve(args['project-dir']);
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
    throw new Error('Project directory does not exist or is not a directory: ' + projectDir);
  }

  const files = collectFiles(projectDir);
  const textFiles = files.filter((file) => /\.(?:[cm]?[jt]sx?|html?|css|json|md|vue|svelte)$/i.test(file.relative));
  const source = textFiles.map((file) => {
    try {
      return '\n/* FILE: ' + file.relative + ' */\n' + fs.readFileSync(file.absolute, 'utf8');
    } catch {
      return '';
    }
  }).join('\n');

  const signals = testCase.staticSignals.map((signal) => {
    const pattern = new RegExp(signal.regex, 'i');
    const matches = pattern.test(source);
    return {
      id: signal.id,
      label: signal.label,
      observed: matches,
      matchedPattern: signal.regex,
      interpretation: matches
        ? 'Static text pattern found; inspect the implementation and test its behavior.'
        : 'Pattern not found; this may be a real omission or a false negative from the simple matcher.',
    };
  });

  const placeholderMatches = [];
  const placeholderPattern = /\b(TODO|FIXME|IMPLEMENT ME|coming soon|lorem ipsum)\b/ig;
  let match;
  while ((match = placeholderPattern.exec(source)) !== null) {
    const prefix = source.slice(0, match.index);
    const fileMatches = [...prefix.matchAll(/\/\* FILE: ([^*]+) \*\//g)];
    placeholderMatches.push({
      marker: match[0],
      file: fileMatches.length ? fileMatches[fileMatches.length - 1][1].trim() : 'unknown',
    });
    if (placeholderMatches.length >= 100) break;
  }

  const report = {
    schemaVersion: '1.0',
    evaluator: 'phase-1-static-signal-audit',
    status: 'DIAGNOSTIC_ONLY',
    case: { id: testCase.id, archetype: testCase.archetype, prompt: testCase.prompt },
    project: {
      directory: projectDir,
      fileCount: files.length,
      sourceFileCount: textFiles.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      largestSourceFiles: textFiles
        .slice()
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(({ relative, size }) => ({ path: relative, bytes: size })),
    },
    staticSignals: {
      observedCount: signals.filter((item) => item.observed).length,
      totalCount: signals.length,
      results: signals,
    },
    placeholderMarkers: {
      count: placeholderMatches.length,
      results: placeholderMatches,
    },
    requiredBehaviors: testCase.requiredBehaviors.map((behavior) => ({
      behavior,
      status: 'NOT_EVALUATED',
      evidence: null,
      reviewerNotes: '',
    })),
    mandatoryManualChecks: [
      'Install dependencies and run the documented build/type/lint checks where configured.',
      'Launch the app and exercise each required behavior in the browser; record concrete evidence.',
      'Check narrow/mobile, tablet, and desktop layouts; inspect console/network errors.',
      'Verify API, persistence, authentication, payment, or booking claims against real configuration rather than labels or mock data.',
      'Have a reviewer score visual hierarchy, usability, accessibility, maintainability, and requirement completeness independently.',
    ],
    limitations: [
      'Regex matches can be present in comments, dead code, or unrelated text.',
      'Missing matches can be false negatives when an implementation uses different names or libraries.',
      'This report does not execute code, run tests, inspect the rendered UI, or prove feature correctness.',
      'Do not treat observedCount/totalCount as an application quality score.',
    ],
  };

  const output = JSON.stringify(report, null, 2) + '\n';
  if (args.out) {
    const outputPath = path.resolve(args.out);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log('Diagnostic report written to ' + outputPath);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  usage();
  console.error('Error: ' + error.message);
  process.exitCode = 2;
}
