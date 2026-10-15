import { initWebSocket, __testables } from '../services/websocket';

describe('websocket service', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete global.WebSocket;
  });

  it('bounds reconnect backoff with jitter', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    expect(__testables.computeReconnectDelay(1)).toBe(500);
    expect(__testables.computeReconnectDelay(8)).toBe(15000);
    Math.random = originalRandom;
  });

  it('reconnects after an unexpected close and stops after explicit close', () => {
    jest.useFakeTimers();

    class MockWebSocket {
      static OPEN = 1;
      static CLOSED = 3;
      static instances = [];

      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CLOSED;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }

      send(value) {
        this.sent.push(value);
      }

      close(code = 1000, reason = '') {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ code, reason });
      }

      open() {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) this.onopen();
      }

      failClose(code = 1006, reason = 'network') {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ code, reason });
      }
    }

    global.WebSocket = MockWebSocket;

    const statuses = [];
    const manager = initWebSocket(
      'project-1',
      'token',
      jest.fn(),
      jest.fn(),
      jest.fn(),
      status => statuses.push(status)
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    MockWebSocket.instances[0].open();
    expect(statuses).toContain('connected');

    MockWebSocket.instances[0].failClose();
    expect(statuses).toContain('reconnecting');

    jest.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);

    manager.close();
    const countAfterClose = MockWebSocket.instances.length;
    MockWebSocket.instances[1].failClose();
    jest.runOnlyPendingTimers();
    expect(MockWebSocket.instances).toHaveLength(countAfterClose);
  });
});
