import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../components/TopBar';
import ProjectSwitcher from '../components/ui/ProjectSwitcher';
import { AppShell } from '../components/layout/AppShell';

describe('Phase 3.3 — TopBar & ProjectSwitcher', () => {
  describe('TopBar', () => {
    it('renders title, subtitle, and action buttons', () => {
      const onOpenPalette = jest.fn();
      render(
        <TopBar
          title="Autonomous Agent"
          subtitle="Plan → Tools → Verification"
          onOpenCommandPalette={onOpenPalette}
        />
      );
      expect(screen.getByText('Autonomous Agent')).toBeInTheDocument();
      expect(screen.getByText('Plan → Tools → Verification')).toBeInTheDocument();

      const paletteBtn = screen.getByTitle('Command Palette (Ctrl+K)');
      expect(paletteBtn).toBeInTheDocument();
      fireEvent.click(paletteBtn);
      expect(onOpenPalette).toHaveBeenCalledTimes(1);
    });

    it('toggles model switcher menu and selects model', () => {
      const onModelChange = jest.fn();
      render(
        <TopBar
          title="Chat"
          model="gemini"
          onModelChange={onModelChange}
        />
      );
      const modelBtn = screen.getByLabelText('Select AI Model');
      expect(modelBtn).toBeInTheDocument();
      fireEvent.click(modelBtn);

      const groqOption = screen.getByRole('option', { name: /Groq Llama/i });
      expect(groqOption).toBeInTheDocument();
      fireEvent.click(groqOption);
      expect(onModelChange).toHaveBeenCalledWith('groq');
    });

    it('renders runtime status when provided', () => {
      render(
        <TopBar
          title="Chat"
          runtimeStatus={{ status: 'running', label: 'Agent Verifying' }}
        />
      );
      expect(screen.getByText('Agent Verifying')).toBeInTheDocument();
    });
  });

  describe('ProjectSwitcher', () => {
    const mockProjects = [
      { project_id: 'p1', project_name: 'Alpha Project' },
      { project_id: 'p2', project_name: 'Beta Engine' },
    ];

    it('renders active project name and toggles dropdown list', () => {
      const onSelect = jest.fn();
      render(
        <ProjectSwitcher
          projects={mockProjects}
          activeProjectId="p1"
          onSelectProject={onSelect}
        />
      );
      expect(screen.getByText('Alpha Project')).toBeInTheDocument();

      const triggerBtn = screen.getByRole('button', { name: /Alpha Project/i });
      fireEvent.click(triggerBtn);

      expect(screen.getByRole('option', { name: /Beta Engine/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('option', { name: /Beta Engine/i }));
      expect(onSelect).toHaveBeenCalledWith('p2');
    });

    it('renders empty message when no projects exist', () => {
      render(
        <ProjectSwitcher
          projects={[]}
          onSelectProject={() => {}}
        />
      );
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      expect(screen.getByText('No projects created yet')).toBeInTheDocument();
    });
  });
});
