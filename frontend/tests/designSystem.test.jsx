import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, IconButton } from '../components/ui/Button';
import { Badge, StatusIndicator } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { Modal } from '../components/ui/Modal';
import { Skeleton, EmptyState } from '../components/ui/EmptyState';
import { AppShell } from '../components/layout/AppShell';

describe('Phase 3.2 — Core Design System Primitives', () => {
  describe('Button & IconButton', () => {
    it('renders Button with label and fires onClick', () => {
      const onClick = jest.fn();
      render(<Button onClick={onClick}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: 'Click Me' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('handles disabled and loading states', () => {
      const onClick = jest.fn();
      const { rerender } = render(<Button disabled onClick={onClick}>Disabled</Button>);
      const btn = screen.getByRole('button', { name: 'Disabled' });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();

      rerender(<Button loading onClick={onClick}>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders IconButton with accessible label', () => {
      const onClick = jest.fn();
      render(<IconButton title="Settings" onClick={onClick} />);
      const btn = screen.getByRole('button', { name: 'Settings' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Badge & StatusIndicator', () => {
    it('renders Badge with text and variant classes', () => {
      render(<Badge variant="success">Verified</Badge>);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders StatusIndicator with label', () => {
      render(<StatusIndicator status="running" label="Executing Plan" />);
      expect(screen.getByText('Executing Plan')).toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('renders tabs and handles tab switching', () => {
      const onChange = jest.fn();
      const tabs = [
        { id: 'tab_code', label: 'Code' },
        { id: 'tab_preview', label: 'Preview' },
      ];
      render(<Tabs tabs={tabs} activeTab="tab_code" onChange={onChange} />);
      expect(screen.getByRole('tab', { name: 'Code' })).toBeInTheDocument();
      const previewTab = screen.getByRole('tab', { name: 'Preview' });
      expect(previewTab).toBeInTheDocument();
      fireEvent.click(previewTab);
      expect(onChange).toHaveBeenCalledWith('tab_preview');
    });
  });

  describe('Modal', () => {
    it('renders modal content when open and triggers onClose', () => {
      const onClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" subtitle="Modal subtitle">
          <p>Modal body content</p>
        </Modal>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal subtitle')).toBeInTheDocument();
      expect(screen.getByText('Modal body content')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Close modal' });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render when isOpen=false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Hidden">
          <p>Hidden body</p>
        </Modal>
      );
      expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    });

    it('closes on Escape key press', () => {
      const onClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Escape Test">
          <p>Body</p>
        </Modal>
      );
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Skeleton & EmptyState', () => {
    it('renders Skeleton component', () => {
      const { container } = render(<Skeleton width="100px" height="20px" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders EmptyState with title, description, and action callback', () => {
      const onAction = jest.fn();
      render(
        <EmptyState
          title="No Projects"
          description="Create your first project to get started."
          actionLabel="Create Project"
          onAction={onAction}
        />
      );
      expect(screen.getByText('No Projects')).toBeInTheDocument();
      expect(screen.getByText('Create your first project to get started.')).toBeInTheDocument();
      const actionBtn = screen.getByRole('button', { name: 'Create Project' });
      fireEvent.click(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Layout Primitives (AppShell)', () => {
    it('renders AppShell with CommandRail, top strip, and canvas content', () => {
      render(
        <AppShell
          currentView="chat"
          inspector={<div>Inspector Drawer</div>}
        >
          <div>Main Canvas Content</div>
        </AppShell>
      );
      expect(screen.getAllByText(/AI-Dost/i)[0]).toBeInTheDocument();
      expect(screen.getByText('Main Canvas Content')).toBeInTheDocument();
      expect(screen.getByText('Inspector Drawer')).toBeInTheDocument();
    });
  });
});
