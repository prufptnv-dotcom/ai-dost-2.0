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

  const approvalDetail = (taskId = 'chat-appr') => ({
    id: `${taskId}-gate`,
    taskId,
    type: 'task_approval',
    phase: 'approval',
    label: 'Action requires user explicit approval before execution.',
    ts: Date.now(),
    approval: {
      token: 'tok-abc',
      capabilities: ['sandbox_write'],
      reason: 'Workspace write chahiye',
    },
  });

  it('shows an auto-expanded approval banner with Approve and Reject controls', async () => {
    window.aiDostApproveTask = jest.fn(() => true);
    window.aiDostRejectTask = jest.fn(() => true);

    render(<TaskActivityOverlay />);
    fireEvent(window, new CustomEvent('ai_dost_task_event', { detail: approvalDetail() }));

    expect(await screen.findByTestId('approval-banner')).toBeInTheDocument();
    expect(screen.getByText('Workspace write chahiye')).toBeInTheDocument();
    expect(screen.getByText('sandbox_write')).toBeInTheDocument();
    expect(screen.getByText('Approval chahiye')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve task' }));
    expect(window.aiDostApproveTask).toHaveBeenCalledWith('chat-appr');

    // bridge dispatches a resumed event → banner clears + approving resets
    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: 'chat-appr-resume', taskId: 'chat-appr', type: 'task_phase', phase: 'resuming', resumed: true, label: 'Approval mil gayi', ts: Date.now() },
    }));
    await waitFor(() => expect(screen.queryByTestId('approval-banner')).not.toBeInTheDocument());

    // approval can arrive again (e.g. second gate) → Reject works fresh
    fireEvent(window, new CustomEvent('ai_dost_task_event', { detail: approvalDetail() }));
    expect(await screen.findByTestId('approval-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reject task' }));
    expect(window.aiDostRejectTask).toHaveBeenCalledWith('chat-appr');

    delete window.aiDostApproveTask;
    delete window.aiDostRejectTask;
  });

  it('renders plan checklist, files changed and completion summary', async () => {
    const taskId = 'chat-session';
    render(<TaskActivityOverlay />);

    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: `${taskId}-start`, taskId, type: 'task_started', phase: 'planning', label: 'Planning', ts: Date.now() },
    }));
    fireEvent(window, new CustomEvent('ai_dost_intent_plan', {
      detail: { taskId, plan: { intent: { type: 'task' }, steps: [{ id: 'tool', action: 'generate project' }] } },
    }));
    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: `${taskId}-plan`, taskId, type: 'task_phase', phase: 'planning', label: 'Plan taiyar — 2 steps', serverType: 'plan', payload: { plan: { tasks: [{ title: 'Scaffold app' }, { title: 'Wire API' }] } }, ts: Date.now() },
    }));
    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: `${taskId}-file`, taskId, type: 'task_tool', phase: 'processing', label: 'Likh diya: App.jsx', serverType: 'file_written', payload: { file: 'src/App.jsx' }, ts: Date.now() },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Expand task session' }));
    expect(await screen.findByTestId('plan-checklist')).toBeInTheDocument();
    expect(screen.getByText('Scaffold app')).toBeInTheDocument();
    expect(screen.getByTestId('files-list')).toBeInTheDocument();
    expect(screen.getByText('src/App.jsx')).toBeInTheDocument();

    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: `${taskId}-done`, taskId, type: 'task_complete', phase: 'success', label: 'Project ban gaya', summary: 'Project ban gaya — 3 files', ts: Date.now() },
    }));

    expect(await screen.findByTestId('completion-summary')).toBeInTheDocument();
    expect(screen.getByText(/Project ban gaya — 3 files/)).toBeInTheDocument();
  });

  it('renders a per-file diff view for written files with previous content', async () => {
    const taskId = 'chat-diff';
    render(<TaskActivityOverlay />);

    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: { id: `${taskId}-start`, taskId, type: 'task_started', phase: 'planning', label: 'Planning', ts: Date.now() },
    }));
    // modified file: previous + content + isNew false
    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: {
        id: `${taskId}-file-edit`,
        taskId,
        type: 'task_tool',
        phase: 'processing',
        label: 'Likh diya: App.jsx',
        serverType: 'file_written',
        payload: { file: 'src/App.jsx', previous: 'const a = 1;', content: 'const a = 2;', isNew: false, progress: '1/2' },
        ts: Date.now(),
      },
    }));
    // brand-new file
    fireEvent(window, new CustomEvent('ai_dost_task_event', {
      detail: {
        id: `${taskId}-file-new`,
        taskId,
        type: 'task_tool',
        phase: 'processing',
        label: 'Likh diya: server.js',
        serverType: 'file_written',
        payload: { file: 'server.js', previous: null, content: 'const express = require("express");', isNew: true, progress: '2/2' },
        ts: Date.now(),
      },
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Expand task session' }));
    expect(await screen.findByTestId('files-list')).toBeInTheDocument();

    const rows = screen.getAllByTestId('file-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(rows[0]);
    const diff = await screen.findByTestId('file-diff');
    expect(diff).toBeInTheDocument();
    expect(diff.textContent).toContain('src/App.jsx');
    expect(diff.textContent).toContain('MODIFIED');
    expect(diff.textContent).toContain('- const a = 1;');
    expect(diff.textContent).toContain('+ const a = 2;');
    // stats strip
    expect(diff.textContent).toMatch(/\+1/);
    expect(diff.textContent).toMatch(/-1/);

    // toggle closes, then NEW file shows all-add diff
    fireEvent.click(screen.getAllByTestId('file-row')[0]);
    fireEvent.click(screen.getAllByTestId('file-row')[1]);
    const newDiff = await screen.findByTestId('file-diff');
    expect(newDiff.textContent).toContain('NEW');
    expect(newDiff.textContent).toContain('+ const express');
  });
});
