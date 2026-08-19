/**
 * useWebContainer hook tests — @webcontainer/api fully mocked.
 * Verifies boot lifecycle, retry-after-failure, and command runner contract.
 *
 * NOTE: useWebContainer caches the instance at module scope; __resetWebContainer()
 * clears that cache between tests.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWebContainer, getWebContainer, __resetWebContainer } from '../hooks/useWebContainer';

jest.mock('@webcontainer/api', () => ({
  WebContainer: { boot: jest.fn() },
}), { virtual: true });

const { WebContainer } = require('@webcontainer/api');

function fakeInstance() {
  return {
    fs: {
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue('file content'),
      rm: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([
        { name: 'index.html', isDirectory: () => false },
        { name: 'src', isDirectory: () => true },
      ]),
    },
    spawn: jest.fn(),
    on: jest.fn().mockReturnValue(() => {}),
  };
}

describe('useWebContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('boots and transitions to ready', async () => {
    __resetWebContainer();
    const inst = fakeInstance();
    WebContainer.boot.mockResolvedValue(inst);

    const { result } = renderHook(() => useWebContainer());
    expect(result.current.status).toBe('booting');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.instance).toBe(inst);
    expect(WebContainer.boot).toHaveBeenCalledTimes(1);
  });

  it('reports error when boot fails', async () => {
    __resetWebContainer();
    WebContainer.boot.mockRejectedValue(new Error('Cross-Origin-Opener-Policy missing'));

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/Cross-Origin-Opener-Policy|boot/i);
    expect(result.current.instance).toBeNull();
  });

  it('getWebContainer retries after a failed boot', async () => {
    __resetWebContainer();
    WebContainer.boot
      .mockRejectedValueOnce(new Error('first boot failed'))
      .mockResolvedValueOnce(fakeInstance());

    await expect(getWebContainer()).rejects.toThrow('first boot failed');
    const second = await getWebContainer();
    expect(WebContainer.boot).toHaveBeenCalledTimes(2);
    expect(second).toBeTruthy();
  });

  it('writeFile/readFile/listFiles work against the instance', async () => {
    __resetWebContainer();
    const inst = fakeInstance();
    WebContainer.boot.mockResolvedValue(inst);

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.writeFile('/workspace/a.js', 'console.log(1)');
      expect(inst.fs.writeFile).toHaveBeenCalledWith('/workspace/a.js', 'console.log(1)');

      const content = await result.current.readFile('/workspace/a.js');
      expect(content).toBe('file content');

      const files = await result.current.listFiles('/workspace');
      expect(files).toEqual([
        { name: 'index.html', type: 'file', path: '/workspace/index.html' },
        { name: 'src', type: 'directory', path: '/workspace/src' },
      ]);
    });
  });

  it('runCommand resolves success with exitCode 0', async () => {
    __resetWebContainer();
    const inst = fakeInstance();
    inst.spawn.mockResolvedValue({
      output: { pipeTo: jest.fn().mockResolvedValue(undefined) },
      exit: Promise.resolve(0),
      kill: jest.fn(),
    });
    WebContainer.boot.mockResolvedValue(inst);

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const out = await act(() => result.current.runCommand('ls -la', { cwd: '/workspace' }));
    expect(out.success).toBe(true);
    expect(out.exitCode).toBe(0);
    expect(inst.spawn).toHaveBeenCalledWith('sh', ['-c', 'ls -la'], expect.objectContaining({ cwd: '/workspace' }));
  });

  it('runCommand resolves failure with non-zero exit and captures output', async () => {
    __resetWebContainer();
    const inst = fakeInstance();
    inst.spawn.mockResolvedValue({
      output: {
        pipeTo: (stream) => {
          const writer = stream.getWriter();
          writer.write(new TextEncoder().encode('boom output'));
          writer.close();
          return Promise.resolve();
        },
      },
      exit: Promise.resolve(2),
      kill: jest.fn(),
    });
    WebContainer.boot.mockResolvedValue(inst);

    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const out = await act(() => result.current.runCommand('false', { timeout: 100 }));
    expect(out.success).toBe(false);
    expect(out.exitCode).toBe(2);
    expect(out.stdout).toContain('boom output');
  });

  it('methods throw when instance is not ready', async () => {
    __resetWebContainer();
    WebContainer.boot.mockRejectedValue(new Error('no wc'));
    const { result } = renderHook(() => useWebContainer());
    await waitFor(() => expect(result.current.status).toBe('error'));

    await expect(result.current.writeFile('/x', 'y')).rejects.toThrow('not ready');
    await expect(result.current.runCommand('ls')).rejects.toThrow('not ready');
  });
});
