import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AutomationsView from '../components/views/AutomationsView';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const MOCK_WORKFLOWS = [
  {
    id: 'wf-1',
    name: 'Daily Market & AI Tech Brief',
    description: 'Autonomous research pipeline searching latest AI developments.',
    trigger_type: 'schedule',
    trigger_config: { intervalMinutes: 1440, label: 'Every 24 hours' },
    action_type: 'deep_research',
    action_config: { topic: 'AI Trends', depth: 'deep' },
    notify_channels: ['in_app', 'telegram'],
    status: 'active',
    last_run_at: '2026-09-04T02:00:00.000Z',
    next_run_at: '2026-09-05T02:00:00.000Z',
    run_count: 5,
  },
  {
    id: 'wf-2',
    name: 'Nightly Codebase Health & Git Audit',
    description: 'Automated workspace integrity analysis.',
    trigger_type: 'schedule',
    trigger_config: { intervalMinutes: 720, label: 'Every 12 hours' },
    action_type: 'repo_health_check',
    action_config: { checks: ['git_status'] },
    notify_channels: ['in_app'],
    status: 'active',
    last_run_at: null,
    next_run_at: '2026-09-04T12:00:00.000Z',
    run_count: 2,
  },
];

const MOCK_RUNS = [
  {
    id: 'run-1',
    workflow_id: 'wf-1',
    workflow_name: 'Daily Market & AI Tech Brief',
    status: 'success',
    started_at: '2026-09-04T02:00:00.000Z',
    duration_ms: 1240,
    output_summary: 'Research completed with 6 sources.',
    output_data: { downloadUrl: '/downloads/test.docx' },
  },
];

describe('AutomationsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('/workflows/recent-runs')) {
        return Promise.resolve({ data: { runs: MOCK_RUNS } });
      }
      if (url.includes('/workflows')) {
        return Promise.resolve({ data: { workflows: MOCK_WORKFLOWS } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('loads and renders workflows and metrics from the API', async () => {
    render(<AutomationsView onToast={() => {}} onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Daily Market & AI Tech Brief' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('heading', { name: 'Nightly Codebase Health & Git Audit' }).length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Active Watchers')).toBeInTheDocument();
    expect(screen.getByText('Total Executions')).toBeInTheDocument();
  });

  it('triggers Run Now when clicking button', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    render(<AutomationsView onToast={() => {}} onNavigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Daily Market & AI Tech Brief' })).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole('button', { name: /Run Now/i });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/workflows/wf-1/run');
    });
  });

  it('toggles workflow status between active and paused', async () => {
    api.put.mockResolvedValue({ data: { success: true } });
    render(<AutomationsView onToast={() => {}} onNavigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Daily Market & AI Tech Brief' })).toBeInTheDocument();
    });

    const pauseButtons = screen.getAllByTitle(/Pause watcher/i);
    fireEvent.click(pauseButtons[0]);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/workflows/wf-1', { status: 'paused' });
    });
  });

  it('opens template modal when clicking quick starter template', async () => {
    render(<AutomationsView onToast={() => {}} onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Quick Starter Watcher Templates/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Agent Completion Deliverable Watcher'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configure Autonomous Watcher' })).toBeInTheDocument();
    });
  });
});
