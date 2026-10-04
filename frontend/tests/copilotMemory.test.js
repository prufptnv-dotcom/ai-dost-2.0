/**
 * Self-learning memory panel (durable notes — survive project deletion).
 * Static audit of CopilotIDE wiring. Mutation-verified: drop the memory-btn
 * testid, the list/count endpoints, or the delete/clear handlers → the
 * corresponding tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('memory state + loaders (static audit)', () => {
  test('memory panel state + per-note loaders hit the copilot memory API', () => {
    expect(SRC).toMatch(/const \[memoryOpen, setMemoryOpen\] = useState\(false\)/);
    expect(SRC).toMatch(/const \[memoryNotes, setMemoryNotes\] = useState\(\[\]\)/);
    expect(SRC).toMatch(/const \[memoryCount, setMemoryCount\] = useState\(0\)/);
    expect(SRC).toContain("api.get('/copilot/memory/list?limit=40')");
    expect(SRC).toContain("api.get('/copilot/memory/count')");
    expect(SRC).toContain('api.delete(`/copilot/memory/${id}`)');
    expect(SRC).toContain("api.delete('/copilot/memory/clear')");
  });

  test('count badge loads once on mount via a dedicated effect', () => {
    const idx = SRC.indexOf('Learning-notes badge count');
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 420);
    expect(slice).toContain("api.get('/copilot/memory/count')");
    expect(slice).toMatch(/return \(\) => \{ alive = false; \}/);
  });
});

describe('memory UI (static audit)', () => {
  test('toolbar memory button exposes testid, aria-expanded and brain icon + count badge', () => {
    expect(SRC).toContain('data-testid="memory-btn"');
    expect(SRC).toContain('aria-expanded={memoryOpen}');
    const start = SRC.indexOf('data-testid="memory-btn"');
    const slice = SRC.slice(start, start + 1400);
    expect(slice).toContain('name="brain"');
    expect(slice).toContain('setMemoryOpen(next)');
    expect(slice).toContain('if (next) loadMemoryNotes()');
    expect(slice).toMatch(/\{memoryCount > 0 && \(/);
  });

  test('panel modal renders rows, per-note delete, clear-all and the durability note', () => {
    expect(SRC).toContain('data-testid="memory-panel"');
    expect(SRC).toContain('data-testid="memory-note-row"');
    expect(SRC).toContain('data-testid="memory-note-delete"');
    expect(SRC).toContain('data-testid="memory-clear-btn"');
    expect(SRC).toContain('onClick={clearMemoryNotes}');
    expect(SRC).toContain('onClick={() => deleteMemoryNote(n.id)}');
    expect(SRC).toContain('Notes stay even if you delete the project.');
    expect(SRC).toContain('survive project deletion');
  });

  test('panel opens only via the button and closes on backdrop/close control', () => {
    expect(SRC).toMatch(/\{memoryOpen && \(/);
    expect(SRC).toMatch(/onClick=\{\(\) => setMemoryOpen\(false\)\}/);
    expect(SRC).toContain('<AppIcon name="brain" size={15}');
  });
});

describe('backend memory contract (cross-check)', () => {
  test('backend exposes learn/list/delete and notes table has no FK to projects', () => {
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, '../../backend/routes/copilotMemory.js'),
      'utf8'
    );
    expect(routeSrc).toContain("router.post('/learn'");
    expect(routeSrc).toContain("router.get('/list'");
    expect(routeSrc).toContain("router.delete('/:id'");
    expect(routeSrc).toContain("router.delete('/clear'");

    const migrationSrc = fs.readFileSync(
      path.resolve(__dirname, '../../backend/db/migrations/010_copilot_memory.js'),
      'utf8'
    );
    expect(migrationSrc).toContain('CREATE TABLE IF NOT EXISTS copilot_notes');
    expect(migrationSrc).not.toMatch(/REFERENCES\s+projects/i);

    const agentSrc = fs.readFileSync(
      path.resolve(__dirname, '../../backend/routes/agent.js'),
      'utf8'
    );
    expect(agentSrc).toContain('retrieveNotes({');
    expect(agentSrc).toContain('LESSONS FROM YOUR EARLIER RUNS');
    expect(agentSrc).toContain('extractRunNotes({ prompt: userPrompt');
    expect(agentSrc).toContain('errorHint:');
  });
});
