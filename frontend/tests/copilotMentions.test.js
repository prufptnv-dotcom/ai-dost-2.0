/**
 * Phase 2b — Devin-style @file mentions in the Copilot composer.
 * Unit tests cover lib/copilotMentions (pure helpers); static audit covers the
 * CopilotIDE wiring. Mutation-verified: drop contextFiles from the run body or
 * the dropdown JSX → the corresponding tests fail.
 */
import fs from 'fs';
import path from 'path';

import { filePathOf, detectMention, parseMentionPaths } from '../lib/copilotMentions';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('lib/copilotMentions helpers', () => {
  test('filePathOf accepts path strings and { path } objects', () => {
    expect(filePathOf('src/App.jsx')).toBe('src/App.jsx');
    expect(filePathOf({ path: 'server.js', content: 'x' })).toBe('server.js');
    expect(filePathOf(null)).toBe('');
    expect(filePathOf(42)).toBe('');
  });

  test('detectMention finds the active token after whitespace or at start', () => {
    expect(detectMention('@src/A', 6)).toBe('src/A');
    expect(detectMention('fix @src/', 9)).toBe('src/');
    expect(detectMention('fix @src/App.jsx more', 21)).toBeNull(); // closed by a space
    expect(detectMention('mail@home', 9)).toBeNull(); // no space before @
    expect(detectMention('no mention here', 15)).toBeNull();
    expect(detectMention(null, 0)).toBeNull();
  });

  test('parseMentionPaths extracts unique paths, rejects traversal, caps at 20', () => {
    expect(parseMentionPaths('edit @src/App.jsx and @src/App.jsx + @lib/util.js'))
      .toEqual(['src/App.jsx', 'lib/util.js']);
    expect(parseMentionPaths('@../secret.txt @ok.js')).toEqual(['ok.js']);
    expect(parseMentionPaths(null)).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `@f${i}.js`).join(' ');
    expect(parseMentionPaths(many)).toHaveLength(20);
  });
});

describe('CopilotIDE @mention wiring (static audit)', () => {
  test('composer change handler tracks the active mention query', () => {
    expect(SRC).toContain('const handleComposerChange = (e)');
    expect(SRC).toContain('setMentionQuery(detectMention(value, caret))');
    expect(SRC).toMatch(/onChange=\{handleComposerChange\}/);
  });

  test('dropdown renders workspace matches with keyboard + click insert', () => {
    expect(SRC).toContain('data-testid="file-mention-dropdown"');
    expect(SRC).toContain('role="listbox"');
    expect(SRC).toMatch(/onClick=\{\(\) => insertMention\(p\)\}/);
    expect(SRC).toContain('mentionOpen && (e.key === \'ArrowDown\' || e.key === \'ArrowUp\')');
    expect(SRC).toContain('insertMention(mentionMatches[mentionIdx] || mentionMatches[0])');
  });

  test('Escape closes the mention dropdown without leaking to global hotkeys', () => {
    expect(SRC).toMatch(/e\.key === 'Escape' && mentionQuery !== null\) \{\r?\n\s+e\.stopPropagation\(\);/);
  });

  test('run body sends contextFiles and reorders projectFiles mentions-first', () => {
    const runBlock = SRC.slice(SRC.indexOf('const runCopilot'));
    const fetchBody = runBlock.slice(
      runBlock.indexOf('body: JSON.stringify'),
      runBlock.indexOf('signal: controller.signal')
    );
    expect(fetchBody).toContain('projectFiles: orderedFiles,');
    expect(fetchBody).toContain('...(mentionedFiles.length ? { contextFiles: mentionedFiles } : {})');
    expect(SRC).toContain('const mentionedFiles = parseMentionPaths(prompt);');
  });
});
