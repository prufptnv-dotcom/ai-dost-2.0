import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskStepItem from '../components/views/TaskStepItem';
import CopilotPlanCard from '../components/ide/CopilotPlanCard';
import CopilotStatusBar, { stripEmoji, formatElapsed } from '../components/ide/CopilotStatusBar';
import IdeFooter from '../components/ide/IdeFooter';
import { PreviewPane } from '../components/ide/PreviewPane';
import { ToastProvider } from '../context/ToastContext';

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
    render(<CopilotStatusBar running={false} status={{ label: 'scaffold failed', tone: 'error' }} />);
    expect(screen.getByTestId('copilot-status-bar')).toHaveTextContent('scaffold failed');
    expect(screen.queryByTestId('copilot-elapsed')).toBeNull();
  });
});

describe('CopilotDevinUI - IdeFooter (run meter)', () => {
  const noop = () => {};

  test('shows plan step, token estimate, elapsed timer and model label while running', () => {
    render(
      <IdeFooter
        activePath="src/App.jsx"
        handleAutoFixProblems={noop}
        running
        problems={0}
        stepLabel="4/6"
        approxTokens={12400}
        elapsedSec={134}
        modelLabel="Gemini first"
      />
    );
    expect(screen.getByTestId('footer-step')).toHaveTextContent('step 4/6');
    expect(screen.getByTestId('footer-tokens')).toHaveTextContent('12.4k tok · ₹0');
    expect(screen.getByTestId('footer-elapsed')).toHaveTextContent('2:14');
    expect(screen.getByText('Gemini first')).toBeInTheDocument();
  });

  test('hides step + timer when no plan or not running; small token counts stay exact', () => {
    render(<IdeFooter handleAutoFixProblems={noop} running={false} approxTokens={80} />);
    expect(screen.queryByTestId('footer-step')).toBeNull();
    expect(screen.queryByTestId('footer-elapsed')).toBeNull();
    expect(screen.getByTestId('footer-tokens')).toHaveTextContent('80 tok · ₹0');
    expect(screen.getByText('Auto (cascade)')).toBeInTheDocument();
  });
});

describe('CopilotDevinUI - PreviewPane QA badge', () => {
  const renderPreview = (qaStatus) =>
    render(
      <ToastProvider>
        <PreviewPane qaStatus={qaStatus} />
      </ToastProvider>
    );

  test('renders QA passed badge when verification succeeded', () => {
    renderPreview('passed');
    expect(screen.getByTestId('qa-badge')).toHaveTextContent('QA passed');
  });

  test('renders QA running badge while verification is in flight', () => {
    renderPreview('running');
    expect(screen.getByTestId('qa-badge')).toHaveTextContent('QA running');
  });

  test('no badge in idle state', () => {
    renderPreview('idle');
    expect(screen.queryByTestId('qa-badge')).toBeNull();
  });
});
