/**
 * Static audit of every AppIcon call site in the source tree.
 *
 * Why static? Mangled/duplicate-icon bugs are invisible to unit tests that
 * render a component in isolation. Two real regressions this guards against:
 *  1. A blind lucide→AppIcon rename turned `<PackagesModal>` into
 *     `<AppIcon name="package"sModal` — the Packages Manager modal silently
 *     stopped rendering (no test rendered CopilotIDE itself).
 *  2. `name="typo"` silently falls back to `circle`, so the icon "works" but
 *     shows the wrong glyph forever.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'coverage', '.next', '.swc', '.git']);
// Tests may pass fake/unknown names on purpose (the fallback is unit-tested).
const SKIP_FILES = new Set([
  'appIcon.test.jsx',
  'appIconSourceAudit.test.js',
  '_debugTitle.test.jsx',
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name) && !SKIP_FILES.has(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

describe('AppIcon source audit (static)', () => {
  const files = walk(ROOT);
  // Imported lazily so the audit itself never imports React/DOM code.
  const { APP_ICONS } = require('../components/ui/AppIcon');

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no mangled <AppIcon> tags (missing whitespace after the name value)', () => {
    // `name="x"className=...` / `name="x"size=...` / `name="x"Modal` all match.
    const bad = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/<AppIcon\s+name="[^"]*"[A-Za-z]/.test(line)) {
          bad.push(`${path.relative(ROOT, file)}:${i + 1} :: ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('every literal name= used with AppIcon exists in APP_ICONS (no silent circle fallback)', () => {
    const unknown = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const m = line.match(/<AppIcon[^>]*?\sname="([a-zA-Z][\w-]*)"/);
        if (m && !APP_ICONS[m[1]]) {
          unknown.push(`${path.relative(ROOT, file)}:${i + 1} name="${m[1]}"`);
        }
      });
    }
    expect(unknown).toEqual([]);
  });

  it('APP_ICONS values are all real Font Awesome definitions', () => {
    const bad = Object.entries(APP_ICONS)
      .filter(([, def]) => !def || !def.iconName || !def.prefix)
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
