import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskHeader from '../components/agent/TaskHeader';
import AgentHierarchyTree from '../components/agent/AgentHierarchyTree';
import ActiveWorkPanel from '../components/agent/ActiveWorkPanel';
import ApprovalBanner from '../components/agent/ApprovalBanner';

describe('Phase 3.5 — Agent Workbench Modular Primitives', () => {
  describe('TaskHeader', () => {
    it('renders objective, status badge, role, and triggers stop/start', () => {
      const onStop = jest.fn();
      render(
        <TaskHeader
          objective="Refactor Auth Middleware"
          status="working"
          activeRole="CODER"
          elapsedSeconds={75}
          running={true}
          onStop={onStop}
        />
      );

      expect(screen.getByText('Refactor Auth Middleware')).toBeInTheDocument();
      expect(screen.getByText('Working')).toBeInTheDocument();
      expect(screen.getByText('CODER')).toBeInTheDocument();
      expect(screen.getByText('1:15')).toBeInTheDocument();

      const stopBtn = screen.getByRole('button', { name: /Stop Agent/i });
      fireEvent.click(stopBtn);
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('AgentHierarchyTree', () => {
    it('renders Supervisor and delegated Worker nodes', () => {
      const onSelect = jest.fn();
      const agents = [
        { id: 'sup_1', role: 'SUPERVISOR', status: 'running', currentAction: 'Orchestrating plan' },
        { id: 'res_1', role: 'RESEARCHER', status: 'idle', currentAction: 'Codebase search' },
        { id: 'cod_1', role: 'CODER', status: 'working', currentAction: 'Writing routes' },
      ];

      render(
        <AgentHierarchyTree
          agents={agents}
          selectedAgentId="cod_1"
          onSelectAgent={onSelect}
        />
      );

      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Researcher')).toBeInTheDocument();
      expect(screen.getByText('Coder')).toBeInTheDocument();
      expect(screen.getByText(/Delegated Workers \(2\)/i)).toBeInTheDocument();

      const researcherItem = screen.getByText('Researcher').closest('button');
      fireEvent.click(researcherItem);
      expect(onSelect).toHaveBeenCalledWith('res_1');
    });
  });

  describe('ApprovalBanner', () => {
    it('renders WAITING_FOR_USER banner and handles approve/reject', () => {
      const onApprove = jest.fn();
      const onReject = jest.fn();

      render(
        <ApprovalBanner
          reason="Sensitive database migration detected."
          blockedAction="DROP TABLE users_old"
          onApprove={onApprove}
          onReject={onReject}
        />
      );

      expect(screen.getByText(/Action Blocked — Waiting for Your Approval/i)).toBeInTheDocument();
      expect(screen.getByText('Sensitive database migration detected.')).toBeInTheDocument();
      expect(screen.getByText(/Pending: DROP TABLE users_old/i)).toBeInTheDocument();

      const approveBtn = screen.getByRole('button', { name: /Approve & Proceed/i });
      fireEvent.click(approveBtn);
      expect(onApprove).toHaveBeenCalledTimes(1);

      const rejectBtn = screen.getByRole('button', { name: /Reject/i });
      fireEvent.click(rejectBtn);
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });

  describe('ActiveWorkPanel', () => {
    it('renders active agent objective and tool history executions', () => {
      const toolHistory = [
        { id: '1', tool: 'search_code', args: 'findUserByEmail', status: 'done', result: 'Found in src/user.js' },
      ];

      render(
        <ActiveWorkPanel
          agent={{ role: 'RESEARCHER', objective: 'Search user queries' }}
          currentStep="Scanning src/ directory..."
          toolHistory={toolHistory}
        />
      );

      expect(screen.getByText('RESEARCHER')).toBeInTheDocument();
      expect(screen.getByText('Search user queries')).toBeInTheDocument();
      expect(screen.getByText(/Scanning src\/ directory/i)).toBeInTheDocument();
      expect(screen.getByText('search_code')).toBeInTheDocument();
    });
  });
});
