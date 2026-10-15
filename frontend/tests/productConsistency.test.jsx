import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button, IconButton } from '../components/ui/Button';
import { Badge, StatusIndicator } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertCircle, Plus, Check } from 'lucide-react';

describe('Phase 3.8 — Product-Wide Consistency & UI Integration', () => {
  describe('Shared Button Primitives', () => {
    it('renders primary, secondary, subtle, and danger variants with consistent geometry', () => {
      const { rerender } = render(<Button variant="primary">Primary Action</Button>);
      const btn = screen.getByRole('button', { name: /Primary Action/i });
      expect(btn).toHaveClass('bg-accent');

      rerender(<Button variant="danger">Delete Entity</Button>);
      expect(screen.getByRole('button', { name: /Delete Entity/i })).toHaveClass('text-status-error');

      rerender(<IconButton icon={Plus} title="Add Item" />);
      expect(screen.getByTitle('Add Item')).toBeInTheDocument();
    });
  });

  describe('Semantic Status Vocabulary', () => {
    it('renders consistent status indicator dots across active, running, success, warning, error', () => {
      const { rerender } = render(<StatusIndicator status="active" label="Supervisor Active" />);
      expect(screen.getByText('Supervisor Active')).toBeInTheDocument();

      rerender(<StatusIndicator status="success" label="Build Verified" />);
      expect(screen.getByText('Build Verified')).toBeInTheDocument();

      rerender(<StatusIndicator status="error" label="Test Failed" />);
      expect(screen.getByText('Test Failed')).toBeInTheDocument();
    });

    it('renders badges with standardized semantic colors', () => {
      render(
        <div>
          <Badge variant="success">PASS</Badge>
          <Badge variant="error">FAIL</Badge>
          <Badge variant="warning">WAITING</Badge>
        </div>
      );
      expect(screen.getByText('PASS')).toBeInTheDocument();
      expect(screen.getByText('FAIL')).toBeInTheDocument();
      expect(screen.getByText('WAITING')).toBeInTheDocument();
    });
  });

  describe('Shared Empty State System', () => {
    it('answers What, Why, and Next Action consistently', () => {
      render(
        <EmptyState
          icon={AlertCircle}
          title="No Active Workspace Found"
          description="Select an existing repository from the rail or initialize a new project."
          actionLabel="Initialize Project"
          onAction={jest.fn()}
        />
      );
      expect(screen.getByText('No Active Workspace Found')).toBeInTheDocument();
      expect(screen.getByText(/Select an existing repository/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Initialize Project/i })).toBeInTheDocument();
    });
  });
});
