import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CopilotAurora from '../components/aurora/CopilotAurora';

/**
 * P11 A1 — the from-scratch copilot shell must stay standing:
 * three panes, run spine rows, composer send, stage tabs, stop + classic escape.
 */
describe('CopilotAurora (P11 A1 shell)', () => {
  const base = { projectId: 'p1', projectName: 'todo-app', onToast: jest.fn() };

  beforeEach(() => {
    window.localStorage.clear();
  });

  test('renders the three-pane cockpit with a live run spine', () => {
    render(<CopilotAurora {...base} />);

    expect(screen.getByTestId('aurora-shell')).toHaveAttribute('data-project', 'p1');
    expect(screen.getByTestId('aurora-rail')).toBeInTheDocument();
    expect(screen.getByTestId('aurora-head')).toBeInTheDocument();
    expect(screen.getByTestId('aurora-stage')).toBeInTheDocument();
    expect(screen.getByTestId('aurora-stream')).toBeInTheDocument();

    // spine: at least the 6 mock events
    expect(screen.getAllByTestId('spine-row').length).toBeGreaterThanOrEqual(6);

    // run instrument
    expect(screen.getByTestId('aurora-plan-count')).toHaveTextContent('plan 3/6');
    expect(screen.getByTestId('aurora-timer')).toHaveTextContent('0:47');
    expect(screen.getByTestId('aurora-stop')).not.toBeDisabled();

    // plan checklist (rail)
    expect(screen.getAllByTestId('plan-row')).toHaveLength(6);
    expect(screen.getByText('todo-app')).toBeInTheDocument();

    // permission segment defaults to auto
    expect(screen.getByTestId('perm-auto')).toHaveAttribute('aria-pressed', 'true');
  });

  test('composer appends the user message onto the spine and clears', () => {
    render(<CopilotAurora {...base} />);

    const input = screen.getByTestId('aurora-composer-input');
    const before = screen.getAllByTestId('spine-row').length;

    // send stays disabled while empty
    expect(screen.getByTestId('aurora-send')).toBeDisabled();

    fireEvent.change(input, { target: { value: 'build me a kanban board' } });
    expect(screen.getByTestId('aurora-send')).not.toBeDisabled();

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    const rows = screen.getAllByTestId('spine-row');
    expect(rows.length).toBe(before + 1);
    const last = rows[rows.length - 1];
    expect(last).toHaveAttribute('data-kind', 'user');
    expect(last).toHaveTextContent('build me a kanban board');
    expect(input.value).toBe('');
    expect(screen.getByTestId('aurora-send')).toBeDisabled();
  });

  test('stage tabs switch between preview and changed files', () => {
    render(<CopilotAurora {...base} />);

    // preview-first (Bolt-style default)
    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('aurora-files')).toBeNull();

    fireEvent.click(screen.getByTestId('stage-tab-files'));
    expect(screen.getByTestId('aurora-files')).toBeInTheDocument();
    expect(screen.queryByTestId('aurora-preview')).toBeNull();
    expect(screen.getAllByTestId('file-row')).toHaveLength(3);

    fireEvent.click(screen.getByTestId('stage-tab-preview'));
    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
  });

  test('stop ends the mock run once (idempotent, emits a status row)', () => {
    render(<CopilotAurora {...base} />);

    const stop = screen.getByTestId('aurora-stop');
    fireEvent.click(stop);

    expect(stop).toBeDisabled();
    const rows = screen.getAllByTestId('spine-row');
    expect(rows[rows.length - 1]).toHaveAttribute('data-kind', 'status');
    expect(rows[rows.length - 1]).toHaveTextContent('run stopped');
    expect(base.onToast).toHaveBeenCalledWith('Run stopped');

    // second click must not append another row
    fireEvent.click(stop);
    expect(screen.getAllByTestId('spine-row').length).toBe(rows.length);
  });

  test('classic escape hatch writes the fallback flag', () => {
    render(<CopilotAurora {...base} />);

    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBeNull();
    fireEvent.click(screen.getByTestId('aurora-classic-btn'));
    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBe('classic');
  });

  test('permission segment is switchable', () => {
    render(<CopilotAurora {...base} />);

    fireEvent.click(screen.getByTestId('perm-turbo'));
    expect(screen.getByTestId('perm-turbo')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('perm-auto')).toHaveAttribute('aria-pressed', 'false');
  });
});
