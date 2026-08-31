import React from 'react';
import { render, screen } from '@testing-library/react';
import { CommandRail } from '../components/layout/CommandRail';

describe('Smart Workspace navigation', () => {
  it('exposes minimal primary navigation surfaces', () => {
    render(<CommandRail currentView="chat" onSelectView={jest.fn()} onNewChat={jest.fn()} onToggleTheme={jest.fn()} />);
    expect(screen.getByLabelText('AI-Dost home')).toBeInTheDocument();
    expect(screen.getByLabelText('New chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Search chats')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('History')).toBeInTheDocument();
  });
});

