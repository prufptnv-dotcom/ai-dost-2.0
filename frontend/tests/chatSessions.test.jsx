import { renderHook, act } from '@testing-library/react';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Heavy chrome is irrelevant to session state — stub it. SmartChatHeader drags in
// @google/genai (ESM-only, untransformable in jest) via LiveMultimodalExperience.
jest.mock('../components/chat/SmartChatHeader', () => ({
  __esModule: true,
  default: () => null,
}));

import { useChatHistory } from '../hooks/useChatHistory';
import { useChatView } from '../hooks/useChatView';

describe('Chat session lifecycle — undefined setter regression', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('useChatHistory exposes setSessionId and setBackendHistory (useChatView consumers)', () => {
    const { result } = renderHook(() => useChatHistory());
    expect(typeof result.current.setSessionId).toBe('function');
    expect(typeof result.current.setBackendHistory).toBe('function');
  });

  it('setSessionId updates the active session id and persists it', () => {
    const { result } = renderHook(() => useChatHistory());
    act(() => result.current.setSessionId('chat_abc123'));
    expect(result.current.sessionId).toBe('chat_abc123');
  });

  // Bug #14: createSession/switchSession/deleteSession called setSessionId +
  // setBackendHistory, which useChatHistory never returned → hard
  // ReferenceError crash ("setSessionId is not defined") on every new chat.
  it('createSession does not throw and switches to a fresh session', () => {
    const { result } = renderHook(() => useChatView({ model: 'auto' }));
    let thrown = null;
    act(() => {
      try {
        result.current.createSession();
      } catch (e) {
        thrown = e;
      }
    });
    expect(thrown).toBeNull();
    expect(result.current.sessionId).toBeTruthy();
    expect(result.current.sessionId).not.toBe('default');
    expect(JSON.parse(window.localStorage.getItem('ai_dost_chat_sessions') || '[]')).toHaveLength(1);
  });

  it('switchSession loads stored messages without throwing', () => {
    window.localStorage.setItem('ai_dost_messages_prev', JSON.stringify([
      { id: 1, role: 'user', content: 'pichli baat' },
    ]));
    const { result } = renderHook(() => useChatView({ model: 'auto' }));
    let thrown = null;
    act(() => {
      try {
        result.current.switchSession('prev');
      } catch (e) {
        thrown = e;
      }
    });
    expect(thrown).toBeNull();
    expect(result.current.sessionId).toBe('prev');
    expect(result.current.messages.some((m) => m.content === 'pichli baat')).toBe(true);
  });

  it('deleteSession on the active session resets to default without throwing', () => {
    const { result } = renderHook(() => useChatView({ model: 'auto' }));
    act(() => result.current.createSession());
    const activeId = result.current.sessionId;
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    let thrown = null;
    act(() => {
      try {
        result.current.deleteSession(activeId);
      } catch (e) {
        thrown = e;
      }
    });
    confirmSpy.mockRestore();
    expect(thrown).toBeNull();
    expect(result.current.sessionId).toBe('default');
  });
});