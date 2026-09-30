import { diffLines, diffStats } from '../lib/lineDiff';

describe('lineDiff', () => {
  test('new file (empty previous) renders every line as an add', () => {
    const ops = diffLines('', 'line1\nline2');
    expect(ops.map((o) => o.type)).toEqual(['add', 'add']);
    expect(diffStats(ops)).toEqual({ added: 2, removed: 0 });
  });

  test('identical content renders context only', () => {
    const ops = diffLines('a\nb\nc', 'a\nb\nc');
    expect(ops.every((o) => o.type === 'ctx')).toBe(true);
    expect(diffStats(ops)).toEqual({ added: 0, removed: 0 });
  });

  test('middle edit produces ctx/del/add ops around the change', () => {
    const ops = diffLines('keep1\nold\nkeep2', 'keep1\nnew\nkeep2');
    const types = ops.map((o) => o.type);
    expect(types).toContain('del');
    expect(types).toContain('add');
    expect(types.filter((t) => t === 'ctx')).toHaveLength(2);
    expect(ops.find((o) => o.type === 'del').text).toBe('old');
    expect(ops.find((o) => o.type === 'add').text).toBe('new');
  });

  test('added and removed lines are reported when lines shift', () => {
    const ops = diffLines('a\nb\nc', 'a\nx\ny\nc');
    const stats = diffStats(ops);
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(1);
  });

  test('handles CRLF input and nullish values', () => {
    // both nullish -> [''] vs [''] = single context line, no changes
    expect(diffStats(diffLines(null, undefined))).toEqual({ added: 0, removed: 0 });
    const ops = diffLines('a\r\nb', 'a\nb');
    expect(ops.every((o) => o.type === 'ctx')).toBe(true);
  });

  test('large asymmetric middle falls back to delete-all/add-all without throwing', () => {
    const bigOld = Array.from({ length: 900 }, (_, i) => `old-${i}`).join('\n');
    const bigNew = Array.from({ length: 900 }, (_, i) => `new-${i}`).join('\n');
    const ops = diffLines(bigOld, bigNew);
    expect(diffStats(ops)).toEqual({ added: 900, removed: 900 });
  });
});
