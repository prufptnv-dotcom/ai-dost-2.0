import {
  createTaskId,
  normalizeServerEvent,
  parseSseLines,
} from '../components/chat/taskRuntime';

describe('task runtime', () => {
  test('creates unique task ids', () => {
    const first = createTaskId('chat');
    const second = createTaskId('chat');
    expect(first).toMatch(/^chat-/);
    expect(second).toMatch(/^chat-/);
    expect(second).not.toBe(first);
  });

  test('normalizes real SSE server events into task phases', () => {
    expect(normalizeServerEvent('task-1', {
      type: 'web_search_start',
      status: 'Searching live web...',
    })).toMatchObject({ phase: 'searching', label: 'Searching live web...' });

    expect(normalizeServerEvent('task-1', {
      type: 'web_search_sources',
      sources: [{ title: 'one' }, { title: 'two' }],
    })).toMatchObject({ phase: 'reading', label: '2 sources found' });

    expect(normalizeServerEvent('task-1', { chunk: 'hello' })).toMatchObject({
      type: 'task_chunk',
      phase: 'generating',
      label: 'Writing',
    });

    expect(normalizeServerEvent('task-1', { done: true })).toMatchObject({
      type: 'task_complete',
      phase: 'success',
    });
  });

  test('parses SSE lines and preserves incomplete trailing data', () => {
    const events = [];
    const rest = parseSseLines('data: {"type":"language_lock"}\n\ndata: {"chunk":"hi"}\ndata: {"done":true}', (value) => events.push(value));
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('language_lock');
    expect(events[1].chunk).toBe('hi');
    expect(rest).toBe('data: {"done":true}');
  });
});
