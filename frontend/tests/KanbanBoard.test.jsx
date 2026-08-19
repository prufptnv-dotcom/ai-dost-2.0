import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KanbanBoard from '../components/agent/KanbanBoard';

describe('KanbanBoard', () => {
  const TASK_TITLES = [
    'Implement agent loop',
    'Add RAG integration',
    'Terminal integration',
    'Add live preview',
    'Deploy service',
  ];

  it('renders 5 status columns with counts', async () => {
    render(<KanbanBoard agentId="a1" onTaskUpdate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('Planned')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getAllByText('(1)')).toHaveLength(5);
    });
  });

  it('renders the mock task titles', async () => {
    render(<KanbanBoard agentId="a1" onTaskUpdate={() => {}} />);
    await waitFor(() => {
      for (const title of TASK_TITLES) {
        expect(screen.getByText(title)).toBeInTheDocument();
      }
    });
  });

  it('adds a task from the New Task input and notifies parent', async () => {
    const onTaskUpdate = jest.fn();
    render(<KanbanBoard agentId="a1" onTaskUpdate={onTaskUpdate} />);
    const input = screen.getByPlaceholderText('Describe a new task...');
    fireEvent.change(input, { target: { value: 'Write test suite' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Write test suite')).toBeInTheDocument();
    });
    expect(onTaskUpdate).toHaveBeenCalledWith('a1', expect.objectContaining({ type: 'newTask' }));
    expect(onTaskUpdate.mock.calls[0][1].task.title).toBe('Write test suite');
  });

  it('ignores empty task input', async () => {
    const onTaskUpdate = jest.fn();
    render(<KanbanBoard agentId="a1" onTaskUpdate={onTaskUpdate} />);
    const input = screen.getByPlaceholderText('Describe a new task...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await new Promise((r) => setTimeout(r, 10));
    expect(onTaskUpdate).not.toHaveBeenCalled();
  });

  it('renders without crashing even when onTaskUpdate is missing', async () => {
    render(<KanbanBoard agentId="a1" />);
    await waitFor(() => {
      expect(screen.getByText('Agent Tasks')).toBeInTheDocument();
    });
  });
});
