import React from 'react';
import { render, screen } from '@testing-library/react';
import ActivityTimeline from '../components/agent/ActivityTimeline';

describe('Phase 3.5 — Agent Activity Timeline', () => {
  it('renders chronological event list with roles and statuses', () => {
    const events = [
      { id: '1', time: '10:02', role: 'SUPERVISOR', text: 'Execution plan generated', status: 'success' },
      { id: '2', time: '10:04', role: 'CODER', text: 'Implemented database schema', status: 'success' },
    ];

    render(<ActivityTimeline events={events} />);

    expect(screen.getByText(/Activity Timeline \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('Execution plan generated')).toBeInTheDocument();
    expect(screen.getByText('10:02')).toBeInTheDocument();
    expect(screen.getByText('SUPERVISOR')).toBeInTheDocument();
    expect(screen.getByText('Implemented database schema')).toBeInTheDocument();
    expect(screen.getByText('CODER')).toBeInTheDocument();
  });

  it('renders empty message when no events exist', () => {
    render(<ActivityTimeline events={[]} />);
    expect(screen.getByText('No activity logged yet.')).toBeInTheDocument();
  });
});
