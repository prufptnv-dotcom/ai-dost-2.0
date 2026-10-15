import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentPanel from '../components/AgentPanel';

function createSseResponse(events) {
  const encoder = new TextEncoder();
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n`).join('');
  let sent = false;

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: jest.fn(async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: encoder.encode(payload) };
        }),
        cancel: jest.fn(async () => {}),
      }),
    },
  };
}

describe('AgentPanel', () => {
  const previousFetch = global.fetch;

  afterEach(() => {
    global.fetch = previousFetch;
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('sends the task, syncs changed files, and keeps the original prompt in run history', async () => {
    const submittedPrompt = 'Implement a health-check endpoint';
    const onFileSync = jest.fn();
    const projectFiles = Array.from({ length: 12 }, (_, index) => ({
      path: index === 0 ? 'src/App.jsx' : `src/file-${index}.js`,
      content: index === 0 ? 'x'.repeat(2200) : `content-${index}`,
    }));

    global.fetch = jest.fn(async () => {
      // Let React commit the cleared prompt before the stream finishes.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return createSseResponse([
        { type: 'start', message: 'Planning task' },
        {
          type: 'step',
          stepLog: {
            step: 1,
            action: 'write_file',
            parameters: { path: 'src/App.jsx' },
            result: {
              success: true,
              changedFile: 'src/App.jsx',
              newContent: 'export default function App() { return <main>Ready</main>; }',
            },
          },
        },
        { type: 'done', message: 'Health endpoint completed', steps: [{ step: 1 }] },
      ]);
    });

    render(
      <AgentPanel
        projectId="project-123"
        projectPath="/workspace/project-123"
        projectFiles={projectFiles}
        onFileSync={onFileSync}
      />,
    );

    const input = screen.getByPlaceholderText(/Task for the Agent/i);
    fireEvent.change(input, { target: { value: submittedPrompt } });
    // Let the prompt-ref effect run before the simulated click event.
    await new Promise((resolve) => setTimeout(resolve, 0));

    fireEvent.click(screen.getByTitle('Run agent (Enter)'));
    expect(await screen.findByText('Health endpoint completed')).toBeInTheDocument();
    await waitFor(() => expect(input).toBeEnabled());

    expect(global.fetch).toHaveBeenCalledWith('/api/agent/run', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.userPrompt).toBe(submittedPrompt);
    expect(requestBody.projectId).toBe('project-123');
    expect(requestBody.projectPath).toBe('/workspace/project-123');
    expect(requestBody.projectFiles).toHaveLength(10);
    expect(requestBody.projectFiles[0].content).toHaveLength(2000);
    expect(onFileSync).toHaveBeenCalledWith({
      file: 'src/App.jsx',
      content: 'export default function App() { return <main>Ready</main>; }',
    });

    fireEvent.click(screen.getByRole('button', { name: /History/i }));
    expect(await screen.findByText(submittedPrompt)).toBeInTheDocument();
    expect(screen.getByText('Health endpoint completed')).toBeInTheDocument();
    expect(screen.getByText('1 steps')).toBeInTheDocument();
    expect(screen.queryByText('Quick task')).not.toBeInTheDocument();
  });

  it('shows a visible error when the backend rejects a run', async () => {
    global.fetch = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };
    });

    render(<AgentPanel />);
    const input = screen.getByPlaceholderText(/Task for the Agent/i);
    fireEvent.change(input, { target: { value: 'Run a test' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    fireEvent.click(screen.getByTitle('Run agent (Enter)'));
    expect(await screen.findByText(/Network error: Server responded with 503/)).toBeInTheDocument();
    await waitFor(() => expect(input).toBeEnabled());
  });

  it('does not start a request when the prompt is empty', () => {
    global.fetch = jest.fn();
    render(<AgentPanel />);

    expect(screen.getByTitle('Run agent (Enter)')).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
