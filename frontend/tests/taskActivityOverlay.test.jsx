import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskActivityOverlay from '../components/chat/TaskActivityOverlay';

describe('TaskActivityOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
    window.aiDostCancelTask = undefined;
  });

  afterEach(() => {
    delete window.aiDostCancelTask;
  });

  it('restores an interrupted task and exposes retry controls', async () => {
    localStorage.setItem('__aiDostInterruptedTask', JSON.stringify({
      taskId: 'chat-recovery-1',
      message: 'Project ka build continue karo',
      startedAt: Date.now(),
    }));

    render(<TaskActivityOverlay />);

    expect(await screen.findByText('Pichla task ruk gaya tha')).toBeInTheDocument();
    expect(screen.getByText('Project ka build continue karo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry interrupted task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss interrupted task recovery' })).toBeInTheDocument();
  });

  it('clears recovery state when a new task starts', async () => {
    localStorage.setItem('__aiDostInterruptedTask', JSON.stringify({
      taskId: 'chat-recovery-2',
      message: 'Resume the previous task',
      startedAt: Date.now(),
    }));

    render(<TaskActivityOverlay />);
    expect(await screen.findByText('Pichla task ruk gaya tha')).toBeInTheDocument();

    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: {
        id: 'chat-new-start',
        taskId: 'chat-new',
        type: 'task_started',
        phase: 'understanding',
        label: 'Understanding',
        ts: Date.now(),
      },
    }));

    await waitFor(() => expect(screen.queryByText('Pichla task ruk gaya tha')).not.toBeInTheDocument());
    expect(screen.getByText('AI-Dost is working')).toBeInTheDocument();
  });
});
