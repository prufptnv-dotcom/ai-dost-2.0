import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskStepItem from '../components/views/TaskStepItem';
import CopilotPlanCard from '../components/ide/CopilotPlanCard';
import CopilotStatusBar, { stripEmoji, formatElapsed } from '../components/ide/CopilotStatusBar';

describe('CopilotDevinUI — TaskStepItem (checklist row)', () => {
  const base = { id: 't1', title: 'Scaffold Vite app' };

  test('pending row renders title + empty marker', () => {
    render(<TaskStepItem step={{ ...base, status: 'pending' }} index={0} />);
    const row = screen.getByTestId('plan-row');
    expect(row).toHaveAttribute('data-status', 'pending');
    expect(row).toHaveTextContent('Scaffold Vite app');
  });

  test('running row shows target + live log snippet', () => {
    render(
      <TaskStepItem
        step={{ ...base, status: 'in_progress', target: 'npm install', logSnippet: 'installing deps…' }}
        index={1}
      />
    );
    const row = screen.getByTestId('plan-row');
    expect(row).toHaveAttribute('data-status', 'in_progress');
    expect(row).toHaveTextContent('npm install');
    expect(row).toHaveTextContent('installing deps…');
  });

  test('completed row strikes title and shows done tag', () => {
    render(<TaskStepItem step={{ ...base, status: 'completed', file: 'src/App.jsx' }} index={2} />);
    const row = screen.getByTestId('plan-row');
    expect(row).toHaveAttribute('data-status', 'completed');
    expect(row.querySelector('p')).toHaveClass('line-through');
    expect(row).toHaveTextContent('done');
  });

  test('error row renders error status', () => {
    render(<TaskStepItem step={{ ...base, status: 'error' }} index={3} />);
    expect(screen.getByTestId('plan-row')).toHaveAttribute('data-status', 'error');
  });
});

describe('CopilotDevinUI — CopilotPlanCard', () => {
  const tasks = [
    { id: 'a', title: 'Plan architecture', status: 'completed' },
    { id: 'b', title: 'Generate files', status: 'in_progress' },
    { id: 'c', title: 'Verify build', status: 'pending' },
  ];

  test('renders checklist with progress counter', () => {
    render(<CopilotPlanCard tasks={tasks} expanded onToggle={() => {}} />);
    expect(screen.getByTestId('copilot-plan-card')).toBeInTheDocument();
    expect(screen.getByTestId('plan-progress')).toHaveTextContent('1/3');
    expect(screen.getAllByTestId('plan-row')).toHaveLength(3);
  });

  test('toggle collapses rows but keeps header', () => {
    const onToggle = jest.fn();
    const { rerender } = render(<CopilotPlanCard tasks={tasks} expanded onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('copilot-plan-card').querySelector('button'));
    expect(onToggle).toHaveBeenCalled();
    rerender(<CopilotPlanCard tasks={tasks} expanded={false} onToggle={onToggle} />);
    expect(screen.queryAllByTestId('plan-row')).toHaveLength(0);
    expect(screen.getByTestId('plan-progress')).toHaveTextContent('1/3');
  });

  test('renders nothing without tasks', () => {
    const { container } = render(<CopilotPlanCard tasks={[]} expanded onToggle={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CopilotDevinUI — CopilotStatusBar', () => {
  test('stripEmoji removes emoji, formatElapsed formats M:SS', () => {
    expect(stripEmoji('🤖 Agent thinking & planning...')).toBe('Agent thinking & planning...');
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(125)).toBe('2:05');
  });

  test('running state shows label + elapsed timer', () => {
    render(
      <CopilotStatusBar running status={{ label: '✍️ Writing source code...', tone: 'work' }} elapsedSec={65} />
    );
    const bar = screen.getByTestId('copilot-status-bar');
    expect(bar).toHaveTextContent('Writing source code...');
    expect(screen.getByTestId('copilot-elapsed')).toHaveTextContent('1:05');
  });

  test('idle with empty status renders nothing', () => {
    const { container } = render(<CopilotStatusBar running={false} status={{ label: '', tone: 'info' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('idle error status renders without timer', () => {
    render(<CopilotStatusBar running={false} status={{ label: '⚠️ scaffold failed', tone: 'error' }} />);
    expect(screen.getByTestId('copilot-status-bar')).toHaveTextContent('scaffold failed');
    expect(screen.queryByTestId('copilot-elapsed')).toBeNull();
  });
});
