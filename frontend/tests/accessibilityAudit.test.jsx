import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Tabs } from '../components/ui/Tabs';

describe('Phase 3.8 — Accessibility & Keyboard Navigation Audit', () => {
  it('ensures buttons have accessible focus rings and disabled states', () => {
    render(<Button disabled>Disabled Action</Button>);
    const btn = screen.getByRole('button', { name: /Disabled Action/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('focus-ring');
  });

  it('ensures modal dialogs have role="dialog" and aria-modal="true"', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="System Confirmation">
        <p>Are you sure you want to proceed?</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('ensures tabs have role="tablist" and aria-selected on active tabs', () => {
    const items = [
      { id: 'tab1', label: 'Overview' },
      { id: 'tab2', label: 'Diagnostics' },
    ];
    render(<Tabs tabs={items} activeTab="tab1" onChange={jest.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();

    const activeTab = screen.getByRole('tab', { name: 'Overview' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');

    const inactiveTab = screen.getByRole('tab', { name: 'Diagnostics' });
    expect(inactiveTab).toHaveAttribute('aria-selected', 'false');
  });
});
