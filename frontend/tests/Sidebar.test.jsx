import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

describe('Sidebar', () => {
  const navLabels = ['Chat', 'Projects', 'Copilot IDE', 'Agent', 'Voice', 'MCP Connectors', 'Images', 'Resume', 'History', 'Settings'];

  it('renders all nav items with labels when open', () => {
    render(<Sidebar isOpen onToggle={() => {}} activeItem="chat" onItemClick={() => {}} />);
    for (const label of navLabels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('fires onItemClick with nav id', () => {
    const onItemClick = jest.fn();
    render(<Sidebar isOpen onToggle={() => {}} activeItem="chat" onItemClick={onItemClick} />);
    fireEvent.click(screen.getByText('Agent'));
    expect(onItemClick).toHaveBeenCalledWith('agent');
  });

  it('fires onToggle from the collapse button', () => {
    const onToggle = jest.fn();
    render(<Sidebar isOpen onToggle={onToggle} activeItem="chat" onItemClick={() => {}} />);
    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders New Chat button and project section when open', () => {
    render(<Sidebar isOpen onToggle={() => {}} activeItem="chat" onItemClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Start new chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create new project' })).toBeInTheDocument();
    expect(screen.getByText(/No projects yet/i)).toBeInTheDocument();
  });

  it('fires onNewChat when the New Chat button is clicked', () => {
    const onNewChat = jest.fn();
    render(<Sidebar isOpen onToggle={() => {}} activeItem="chat" onItemClick={() => {}} onNewChat={onNewChat} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start new chat' }));
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it('renders user projects from props', () => {
    render(
      <Sidebar
        isOpen
        onToggle={() => {}}
        activeItem="chat"
        onItemClick={() => {}}
        userProjects={[{ project_id: 'x1', project_name: 'Bihar Portal' }]}
      />
    );
    expect(screen.getByText('Bihar Portal')).toBeInTheDocument();
  });
});
