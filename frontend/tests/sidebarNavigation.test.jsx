import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';

describe('Phase 3.3 — Sidebar Navigation System', () => {
  const allNavItems = ['Chat', 'Agent', 'Copilot IDE', 'Projects', 'Images', 'Resume', 'Voice', 'MCP Connectors', 'History', 'Settings'];

  it('renders all nav items with aria labels', () => {
    render(
      <Sidebar
        isOpen={true}
        onToggle={() => {}}
        activeItem="chat"
        onItemClick={() => {}}
      />
    );

    for (const name of allNavItems) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('indicates active page with aria-current', () => {
    render(
      <Sidebar
        isOpen={true}
        onToggle={() => {}}
        activeItem="agent"
        onItemClick={() => {}}
      />
    );
    const agentBtn = screen.getByRole('button', { name: 'Agent' });
    expect(agentBtn).toHaveAttribute('aria-current', 'page');

    const chatBtn = screen.getByRole('button', { name: 'Chat' });
    expect(chatBtn).not.toHaveAttribute('aria-current');
  });

  it('triggers onItemClick when navigation button is clicked', () => {
    const onItemClick = jest.fn();
    render(
      <Sidebar
        isOpen={true}
        onToggle={() => {}}
        activeItem="chat"
        onItemClick={onItemClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copilot IDE' }));
    expect(onItemClick).toHaveBeenCalledWith('copilot');
  });

  it('toggles collapse button', () => {
    const onToggle = jest.fn();
    render(
      <Sidebar
        isOpen={true}
        onToggle={onToggle}
        activeItem="chat"
        onItemClick={() => {}}
      />
    );
    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders user projects and allows creation click', () => {
    const onNewProject = jest.fn();
    const projects = [{ project_id: 'p_1', project_name: 'Test Project' }];
    render(
      <Sidebar
        isOpen={true}
        onToggle={() => {}}
        activeItem="chat"
        onItemClick={() => {}}
        userProjects={projects}
        onNewProject={onNewProject}
      />
    );
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    const addBtn = screen.getByLabelText('Create new project');
    fireEvent.click(addBtn);
    expect(onNewProject).toHaveBeenCalledTimes(1);
  });
});
