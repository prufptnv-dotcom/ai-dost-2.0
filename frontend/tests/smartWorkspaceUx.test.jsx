import React from 'react';
import { render, screen } from '@testing-library/react';
import { CommandRail } from '../components/layout/CommandRail';

describe('Smart Workspace navigation', () => {
  it('exposes all primary workspace and tool surfaces', () => {
    render(<CommandRail currentView="chat" onSelectView={jest.fn()} onNewChat={jest.fn()} onToggleTheme={jest.fn()} />);
    expect(screen.getByRole('button', { name: /AI-Dost Home/i })).toBeInTheDocument();
    ['Chat','Agent Workbench','Copilot IDE','Projects','Artifacts','Resume Builder','Voice Studio','Image Studio','MCP Integrations','History'].forEach((label) => {
      expect(screen.getByTitle(new RegExp(label))).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /New task/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Settings/i })).toBeInTheDocument();
  });

  it('marks the active view for assistive technology', () => {
    render(<CommandRail currentView="copilot" onSelectView={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Copilot IDE/i })).toHaveAttribute('aria-current', 'page');
  });
});
