/**
 * R1 regression: stop-generation (AbortError) keeps partial reply + meta
 * (provider/ttfb/stopped) is attached on both normal and aborted streams.
 */
import { streamChatResponse } from '../hooks/useChatStream';

const makeSse = (events) =>
  events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');

function makeStream(events, { keepOpen = false, signal } = {}) {
  const encoder = new TextEncoder();
  let controllerRef = null;
  const stream = new ReadableStream({
    start(c) {
      controllerRef = c;
      c.enqueue(encoder.encode(makeSse(events)));
      if (!keepOpen) c.close();
    },
  });
  if (signal) {
    signal.addEventListener('abort', () => {
      try {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        controllerRef.error(err);
      } catch (_) {}
    });
  }
  return stream;
}

function makeHarness() {
  const state = {
    messages: [{ id: 1, role: 'assistant', content: '', isStreaming: true }],
    lastReply: null,
    thinking: true,
    artifacts: [],
    followUps: false,
  };
  const setMessages = (updater) => {
    state.messages = typeof updater === 'function' ? updater(state.messages) : updater;
  };
  return {
    state,
    args: {
      content: 'hello',
      selectedModel: 'auto',
      history: [],
      persona: 'dost',
      aiMsgId: 1,
      setMessages,
      setThinking: jest.fn((v) => { state.thinking = v; }),
      setThinkingLabel: jest.fn(),
      setActiveArtifact: jest.fn((a) => state.artifacts.push(a)),
      setLastReply: jest.fn((r) => { state.lastReply = r; }),
      setShowFollowUps: jest.fn((v) => { state.followUps = v; }),
    },
  };
}

describe('streamChatResponse — meta + stop', () => {
  test('normal stream attaches meta with provider and timing', async () => {
    const events = [
      { type: 'language_lock', detectedResponseLanguage: 'hinglish' },
      { chunk: 'Namaste ' },
      { chunk: 'dost!' },
      { done: true, model: 'groq (openai/gpt-oss-120b)', sources: [] },
      '[DONE]',
    ];
    global.fetch = jest.fn().mockResolvedValue({ ok: true, body: makeStream(events) });

    const h = makeHarness();
    await streamChatResponse(h.args);

    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.isStreaming).toBe(false);
    expect(finalMsg.content).toBe('Namaste dost!');
    expect(finalMsg.meta).toBeDefined();
    expect(finalMsg.meta.provider).toBe('groq (openai/gpt-oss-120b)');
    expect(finalMsg.meta.stopped).toBe(false);
    expect(finalMsg.meta.totalMs).toBeGreaterThanOrEqual(0);
    expect(h.state.followUps).toBe(true);
    expect(h.state.thinking).toBe(false);
  });

  test('abort keeps partial reply and marks meta.stopped', async () => {
    const events = [
      { type: 'language_lock', detectedResponseLanguage: 'hinglish' },
      { chunk: 'Adha jawab ' },
    ];
    const controller = new AbortController();
    global.fetch = jest.fn().mockImplementation((_url, init) =>
      Promise.resolve({ ok: true, body: makeStream(events, { keepOpen: true, signal: init.signal }) })
    );
    const restMock = jest.fn();
    global.__restMock = restMock;

    const h = makeHarness();
    const promise = streamChatResponse({ ...h.args, signal: controller.signal });
    setTimeout(() => controller.abort(), 15);
    await promise;

    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.isStreaming).toBe(false);
    expect(finalMsg.content).toContain('Adha jawab');
    expect(finalMsg.meta).toBeDefined();
    expect(finalMsg.meta.stopped).toBe(true);
    expect(h.state.thinking).toBe(false);
    // no REST fallback should have run on user abort
    expect(h.state.followUps).toBe(false);
  });

  test('abort before any chunk yields stopped placeholder', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn().mockImplementation((_url, init) =>
      Promise.resolve({ ok: true, body: makeStream([], { keepOpen: true, signal: init.signal }) })
    );

    const h = makeHarness();
    const promise = streamChatResponse({ ...h.args, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    await promise;

    const finalMsg = h.state.messages.find((m) => m.id === 1);
    expect(finalMsg.content).toBe('⏹ Response stopped.');
    expect(finalMsg.meta.stopped).toBe(true);
    expect(h.state.thinking).toBe(false);
  });
});
