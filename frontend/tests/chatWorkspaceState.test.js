import { createWorkspaceState } from '../components/chat/chatWorkspaceState';

describe('chat workspace state', () => {
  it('creates versioned workspace state for a planned task', () => {
    const state = createWorkspaceState({
      type: 'artifact',
      title: 'Build landing page',
      source: 'task-plan',
      payload: { taskId: 'chat-1' },
    });

    expect(state.version).toBe(1);
    expect(state.open).toBe(true);
    expect(state.type).toBe('artifact');
    expect(state.title).toBe('Build landing page');
    expect(state.payload.taskId).toBe('chat-1');
    expect(typeof state.updatedAt).toBe('number');
  });
});
