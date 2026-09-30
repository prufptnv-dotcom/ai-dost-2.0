import {
  createTaskId,
  normalizeServerEvent,
  parseSseLines,
  TASK_EVENT_TYPES,
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

  test('normalizes user cancellation as a terminal canceled event', () => {
    expect(normalizeServerEvent('task-1', {
      canceled: true,
      error: 'Task canceled by user',
    })).toMatchObject({
      type: 'task_canceled',
      phase: 'canceled',
      label: 'Task canceled by user',
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

  test('normalizes agent done events with message summary and plan', () => {
    const event = normalizeServerEvent('task-1', {
      type: 'done',
      message: '✅ **Project ban gaya** — 11 files written',
      plan: { tasks: [{ title: 'setup' }] },
    });
    expect(event).toMatchObject({ type: TASK_EVENT_TYPES.COMPLETE, phase: 'success' });
    expect(event.summary).toBe('✅ Project ban gaya — 11 files written');
    expect(event.plan).toEqual({ tasks: [{ title: 'setup' }] });
  });

  test('normalizes gate approval required into approval event with token', () => {
    const event = normalizeServerEvent('task-1', {
      type: 'gate_approval_required',
      message: 'Action requires user explicit approval before execution.',
      gate: {
        decision: 'REQUIRE_EXPLICIT_APPROVAL',
        approval_token: 'tok-123',
        capabilities: [{ capability_id: 'sandbox_write', reason: 'Workspace write' }],
      },
    });
    expect(event).toMatchObject({ type: TASK_EVENT_TYPES.APPROVAL, phase: 'approval' });
    expect(event.approval).toMatchObject({ token: 'tok-123', decision: 'REQUIRE_EXPLICIT_APPROVAL' });
    expect(event.approval.capabilities).toEqual(['sandbox_write']);
    expect(event.approval.reason).toContain('Workspace write');
  });

  test('normalizes gate blocked and invalid approval as errors', () => {
    expect(normalizeServerEvent('task-1', { type: 'gate_blocked', message: 'Blocked by policy' }))
      .toMatchObject({ type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: 'Blocked by policy' });
    expect(normalizeServerEvent('task-1', { type: 'gate_approval_invalid', message: 'token expired' }))
      .toMatchObject({ type: TASK_EVENT_TYPES.ERROR, phase: 'error', label: 'token expired' });
  });

  test('normalizes file_written with path and screenshot with data url', () => {
    const file = normalizeServerEvent('task-1', { type: 'file_written', file: 'src/App.jsx', progress: '2/11' });
    expect(file).toMatchObject({ type: TASK_EVENT_TYPES.TOOL, filePath: 'src/App.jsx', fileProgress: '2/11' });
    expect(file.label).toContain('App.jsx');

    const shot = normalizeServerEvent('task-1', { type: 'screenshot', data: 'AAAA', mimeType: 'image/png' });
    expect(shot.screenshotUrl).toBe('data:image/png;base64,AAAA');
  });

  test('normalizes plan, agent_status, step and gate_approved events', () => {
    expect(normalizeServerEvent('task-1', { type: 'plan', plan: { tasks: [1, 2, 3] } }))
      .toMatchObject({ type: TASK_EVENT_TYPES.PHASE, phase: 'planning', label: 'Plan taiyar — 3 steps', tasks: [1, 2, 3] });
    expect(normalizeServerEvent('task-1', { type: 'agent_status', agent: 'Coder', message: 'Writing files' }))
      .toMatchObject({ type: TASK_EVENT_TYPES.PHASE, label: 'Writing files' });
    expect(normalizeServerEvent('task-1', { type: 'step', stepLog: { action: 'Scaffold project' } }))
      .toMatchObject({ type: TASK_EVENT_TYPES.PHASE, label: 'Scaffold project' });
    expect(normalizeServerEvent('task-1', { type: 'gate_approved', message: 'verified' }))
      .toMatchObject({ type: TASK_EVENT_TYPES.PHASE, phase: 'resuming', resumed: true });
  });

  test('plan_tasks carries the updated task list for live checklists', () => {
    const tasks = [
      { id: 'task-1', title: 'Scaffold app', status: 'completed', files: ['package.json'] },
      { id: 'task-2', title: 'Wire API', status: 'in_progress' },
    ];
    const event = normalizeServerEvent('task-1', { type: 'plan_tasks', tasks });
    expect(event).toMatchObject({ type: TASK_EVENT_TYPES.PHASE, tasks });
    expect(event.payload.tasks).toBe(tasks);
  });

  test('file_written keeps diff payload (content/previous/isNew) accessible via payload', () => {
    const event = normalizeServerEvent('task-1', {
      type: 'file_written',
      file: 'src/App.jsx',
      content: 'new content',
      previous: 'old content',
      isNew: false,
      progress: '3/12',
    });
    expect(event.filePath).toBe('src/App.jsx');
    expect(event.payload.content).toBe('new content');
    expect(event.payload.previous).toBe('old content');
    expect(event.payload.isNew).toBe(false);
  });
});
