import { classifyUniversalIntent } from '../components/chat/universalIntent';

describe('classifyUniversalIntent', () => {
  test.each([
    ['projects kholo', 'projects'],
    ['open copilot', 'copilot'],
    ['meri purani chats dikhao', 'history'],
    ['agent mode chalao', 'agent'],
    ['settings kholo', 'settings'],
    ['automations dikhao', 'automations'],
    ['data analytics open karo', 'analytics'],
  ])('routes %s to %s', (input, action) => {
    expect(classifyUniversalIntent(input)).toMatchObject({ kind: 'command', action });
  });

  test('recognizes new-chat and delete-chat commands', () => {
    expect(classifyUniversalIntent('nayi chat shuru karo')).toMatchObject({ kind: 'command', action: 'new-chat' });
    expect(classifyUniversalIntent('current chat delete karo')).toMatchObject({ kind: 'command', action: 'delete-chat' });
  });

  test('does not hijack normal conversational prompts', () => {
    expect(classifyUniversalIntent('projects ka architecture samjhao')).toMatchObject({ kind: 'chat' });
    expect(classifyUniversalIntent('mere project ke liye login page banao')).toMatchObject({ kind: 'chat' });
  });
});
