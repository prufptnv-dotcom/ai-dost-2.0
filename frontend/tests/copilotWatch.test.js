/**
 * Phase 3b — Devin-style watch mode for the Copilot IDE.
 * Workspace lives in SQLite workspace_files; backend write paths emit on the
 * projectStore bus → GET /api/agent/watch/:projectId SSE → CopilotIDE
 * live-refresh (debounced) + muted activity rows, without polling.
 * Mutation-verified: drop the file_changed guard, the EventSource URL, the
 * persist/hydrate key, or the toggle testid → the corresponding tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('watch mode state (static audit)', () => {
  test('watching state defaults off and hydrates from localStorage', () => {
    expect(SRC).toMatch(/const \[watching, setWatching\] = useState\(false\)/);
    expect(SRC).toContain("window.localStorage.getItem('ai_dost_copilot_watch') === '1') setWatching(true)");
  });

  test('toggle persists to ai_dost_copilot_watch and announces state', () => {
    expect(SRC).toContain("localStorage.setItem('ai_dost_copilot_watch', next ? '1' : '0')");
    expect(SRC).toContain("Watch mode ON — live workspace updates");
    expect(SRC).toContain('Watch mode OFF');
  });

  test('watch toggle button is exposed with aria-pressed + eye icon', () => {
    expect(SRC).toContain('data-testid="watch-toggle"');
    expect(SRC).toContain('aria-pressed={watching}');
    const start = SRC.indexOf('data-testid="watch-toggle"');
    expect(start).toBeGreaterThan(-1);
    const slice = SRC.slice(start, start + 1600);
    expect(slice).toContain('name="eye"');
    expect(slice).toContain('setWatching((prev)');
  });
});

describe('watch SSE wiring (static audit)', () => {
  const effectStart = SRC.indexOf('Phase 3b watch mode');
  const effect = effectStart === -1 ? '' : SRC.slice(effectStart, effectStart + 2600);

  test('opens an EventSource on /api/agent/watch/:projectId', () => {
    expect(effect).toContain('new EventSource(`/api/agent/watch/${encodeURIComponent(projectId)}`)');
    expect(effect).toMatch(/if \(!watching \|\| !projectId\) return undefined/);
  });

  test('file_changed frames push a muted activity row (suppressed mid-run)', () => {
    expect(effect).toContain("data.type !== 'file_changed' || running");
    expect(effect).toContain("kind: 'thought'");
    expect(effect).toContain('↻ watch · ');
    expect(effect).toContain("data.action || 'write'}: ${data.path}");
  });

  test('workspace refresh is debounced and the stream closes on cleanup', () => {
    expect(effect).toMatch(/watchDebounceRef\.current = setTimeout\(\(\) => \{ loadWorkspaceFiles\(\); \}, 400\)/);
    expect(effect).toContain('try { es.close(); } catch (_)');
    expect(effect).toContain('clearTimeout(watchDebounceRef.current)');
  });

  test('effect deps cover watching/projectId/running and it runs after load', () => {
    expect(effect).toContain('[watching, projectId, running, loadWorkspaceFiles, setCopilotMessages]');
    // The mount-time initial load effect must appear BEFORE the watch effect.
    expect(SRC.search(/loadWorkspaceFiles\(\);\s*\}, \[loadWorkspaceFiles\]\)/))
      .toBeLessThan(effectStart);
  });
});

describe('backend watch contract (cross-check)', () => {
  test('backend exposes the SSE route and projectStore emits the bus', () => {
    const agentSrc = fs.readFileSync(
      path.resolve(__dirname, '../../backend/routes/agent.js'),
      'utf8'
    );
    expect(agentSrc).toContain("router.get('/watch/:projectId'");
    expect(agentSrc).toContain("type: 'file_changed'");
    expect(agentSrc).toContain('onWorkspaceChange');

    const storeSrc = fs.readFileSync(
      path.resolve(__dirname, '../../backend/projectStore.js'),
      'utf8'
    );
    expect(storeSrc).toContain("emitChange(projectId, cleanPath, 'write')");
    expect(storeSrc).toContain("emitChange(projectId, cleanPath, 'delete')");
    expect(storeSrc).toContain('onWorkspaceChange');
  });
});
