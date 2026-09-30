/**
 * Agent-run chat parity: an empty stream that was answered by an agent run
 * must NOT fire the REST cascade (duplicate "provider busy" bubble). The hook
 * awaits the bridge's agent marker and uses the run's terminal reply.
 */
import { streamChatResponse } from '../hooks/useChatStream';
import api from '../services/api';
import { BLOCK_FALLBACK_KEY } from '../components/chat/taskRuntime';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const makeStream = (events) => {
  const encoder = new TextEncoder();
  const payload = events
    .map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`)
    .join('');
  return new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(payload));
      c.close();
    },
  });
};

function makeHarness() {
  const state = {
    messages: [{ id: 1, role: 'assistant', content: '', isStreaming: true }],
    lastReply: null,
    followUps: false,
  };
  const setMessages = (updater) => {
    state.messages = typeof updater === 'function' ? updater(state.messages) : updater;
  };
  return {
    state,
    args: {
      content: 'todo app banao with login and database',
      selectedModel: 'auto',
      history: [],
      persona: 'dost',
      aiMsgId: 1,
      setMessages,
      setThinking: jest.fn(),
      setThinkingLabel: jest.fn(),
      setActiveArtifact: jest.fn(),
      setLastReply: jest.fn((r) => { state.lastReply = r; }),
      setShowFollowUps: jest.fn((v) => { state.followUps = v; }),
    },
  };
}

function makeAgentMarker() {
  const marker = { kind: 'agent', taskId: 't1', settled: false, reply: '', _settle: null };
  marker.done = new Promise((resolve) => { marker._settle = resolve; });
  return marker;
}

afterEach(() => {
  delete window[BLOCK_FALLBACK_KEY];
  jest.clearAllMocks();
});

describe('streamChatResponse — agent-run marker vs REST fallback', () => {
  test('pending marker: waits for run terminal event, no REST cascade', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: makeStream([]) });
    const marker = makeAgentMarker();
    window[BLOCK_FALLBACK_KEY] = marker;

    const h = makeHarness();
    const promise = streamChatResponse(h.args);

    // Run completes while the hook is waiting on the marker.
    setTimeout(() => {
      marker.settled = true;
      marker.reply = '🚀 Project Generated & Verified: Todo App (12 files)';
      marker._settle(marker.reply);
    }, 25);

    await promise;

    expect(api.post).not.toHaveBeenCalled();
    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('🚀 Project Generated & Verified: Todo App (12 files)');
    expect(finalMsg.isStreaming).toBe(false);
    expect(h.state.followUps).toBe(true);
  });

  test('already-settled marker resolves immediately with the run reply', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: makeStream([]) });
    const marker = makeAgentMarker();
    marker.settled = true;
    marker.reply = '⚠️ Scaffold failed: quota exhausted';
    marker._settle(marker.reply);
    window[BLOCK_FALLBACK_KEY] = marker;

    const h = makeHarness();
    await streamChatResponse(h.args);

    expect(api.post).not.toHaveBeenCalled();
    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('⚠️ Scaffold failed: quota exhausted');
  });

  test('no marker: genuine empty stream still uses the REST fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: makeStream([]) });
    api.post.mockResolvedValue({ data: { reply: 'fallback reply' } });

    const h = makeHarness();
    await streamChatResponse(h.args);

    expect(api.post).toHaveBeenCalledTimes(1);
    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('fallback reply');
  });

  test('abort while awaiting marker surfaces AbortError (stopped placeholder)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: makeStream([]) });
    const marker = makeAgentMarker();
    window[BLOCK_FALLBACK_KEY] = marker;

    const controller = new AbortController();
    const h = makeHarness();
    const promise = streamChatResponse({ ...h.args, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    await promise;

    expect(api.post).not.toHaveBeenCalled();
    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('⏹ Response stopped.');
    expect(finalMsg.meta.stopped).toBe(true);
  });

  test('gate-pause: marker unsettled after first stream keeps waiting (no busy bubble)', async () => {
    // Gate pause: run's first stream ends with a synthetic done, marker stays
    // unsettled → hook must NOT settle for the REST cascade / busy message.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeStream([{ done: true, message: '⏸️ Execution paused: Awaiting user explicit approval.' }]),
    });
    api.post.mockResolvedValue({ data: { reply: 'BUSY-BUBBLE' } });
    const marker = makeAgentMarker();
    window[BLOCK_FALLBACK_KEY] = marker;

    const h = makeHarness();
    let resolved = false;
    const promise = streamChatResponse(h.args).then(() => { resolved = true; });

    await new Promise((r) => setTimeout(r, 60));
    expect(resolved).toBe(false); // still awaiting approval cycle
    expect(api.post).not.toHaveBeenCalled();

    marker.settled = true;
    marker.reply = '🚀 Project Generated & Verified: Todo App';
    marker._settle(marker.reply);
    await promise;

    expect(api.post).not.toHaveBeenCalled();
    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('🚀 Project Generated & Verified: Todo App');
  });
});
