import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkspaceChangesPanel from '../components/agent/WorkspaceChangesPanel';

describe('Phase 3.5 — Agent Workspace States & Changes', () => {
  it('renders modified and added workspace changes with file paths', () => {
    const changes = [
      { type: 'create', path: 'backend/services/auth.js', lines: '+54' },
      { type: 'modify', path: 'backend/routes/user.js', lines: '+12 -3' },
    ];

    render(
      <WorkspaceChangesPanel
        changes={changes}
      />
    );

    expect(screen.getByText(/Workspace Changes \(2 files\)/i)).toBeInTheDocument();
    expect(screen.getByText('backend/services/auth.js')).toBeInTheDocument();
    expect(screen.getByText('+54')).toBeInTheDocument();
    expect(screen.getByText('backend/routes/user.js')).toBeInTheDocument();
  });
});
