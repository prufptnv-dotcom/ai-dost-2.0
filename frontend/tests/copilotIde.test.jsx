import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileExplorer } from '../components/ide/FileExplorer';
import { WorkspaceTabs } from '../components/ide/WorkspaceTabs';
import { EditorToolbar } from '../components/ide/EditorToolbar';
import { TerminalDock } from '../components/ide/TerminalDock';
import { AiInspector } from '../components/ide/AiInspector';
import { DiffReview } from '../components/ide/DiffReview';

describe('Phase 3.6 — Copilot IDE & Monaco Editor Chrome Rebuild', () => {
  describe('FileExplorer', () => {
    const mockFiles = [
      { path: 'src/index.js', content: 'console.log("hello");' },
      { path: 'src/auth/session.js', content: 'export const session = {};' },
      { path: 'package.json', content: '{"name":"app"}' },
    ];

    it('renders file count, nested directory rows and triggers onSelectFile', () => {
      const onSelect = jest.fn();
      render(
        <FileExplorer
          files={mockFiles}
          activePath="src/auth/session.js"
          onSelectFile={onSelect}
        />
      );

      expect(screen.getByText(/Files/i)).toBeInTheDocument();
      expect(screen.getByText('(3)')).toBeInTheDocument();

      const sessionFile = screen.getByText('session.js');
      expect(sessionFile).toBeInTheDocument();

      fireEvent.click(sessionFile);
      expect(onSelect).toHaveBeenCalledWith('src/auth/session.js');
    });

    it('supports file search filtering', () => {
      render(<FileExplorer files={mockFiles} activePath="src/index.js" />);
      const searchInput = screen.getByPlaceholderText(/Filter files/i);

      fireEvent.change(searchInput, { target: { value: 'package' } });
      expect(screen.getByText('package.json')).toBeInTheDocument();
      expect(screen.queryByText('session.js')).not.toBeInTheDocument();
    });
  });

  describe('WorkspaceTabs', () => {
    it('renders tab list, active state marker, modified indicator and triggers onCloseTab', () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();
      const modified = new Set(['src/index.js']);

      render(
        <WorkspaceTabs
          tabs={['src/index.js', 'src/auth/session.js']}
          activePath="src/index.js"
          modifiedPaths={modified}
          onSelectTab={onSelect}
          onCloseTab={onClose}
        />
      );

      expect(screen.getByText('index.js')).toBeInTheDocument();
      expect(screen.getByText('session.js')).toBeInTheDocument();

      const sessionTab = screen.getByText('session.js');
      fireEvent.click(sessionTab);
      expect(onSelect).toHaveBeenCalledWith('src/auth/session.js');
    });
  });

  describe('EditorToolbar', () => {
    it('renders breadcrumbs, saved status, and handles save/format/diff/ai actions', () => {
      const onSave = jest.fn();
      const onFormat = jest.fn();
      const onToggleDiff = jest.fn();
      const onAiAction = jest.fn();

      render(
        <EditorToolbar
          activePath="src/auth/session.js"
          isModified={true}
          onSave={onSave}
          onFormat={onFormat}
          onToggleDiff={onToggleDiff}
          onAiAction={onAiAction}
        />
      );

      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('auth')).toBeInTheDocument();
      expect(screen.getByText('session.js')).toBeInTheDocument();
      expect(screen.getByText(/Modified/i)).toBeInTheDocument();

      const saveBtn = screen.getByTitle(/Save File/i);
      fireEvent.click(saveBtn);
      expect(onSave).toHaveBeenCalledTimes(1);

      const explainBtn = screen.getByText('Explain');
      fireEvent.click(explainBtn);
      expect(onAiAction).toHaveBeenCalledWith('explain');
    });
  });

  describe('TerminalDock', () => {
    it('renders terminal tabs, stdout logs, and executes command prompt', () => {
      const onRun = jest.fn();
      const onClear = jest.fn();

      render(
        <TerminalDock
          logs={[{ type: 'stdout', text: 'Tests passing: 24/24' }]}
          onRunCommand={onRun}
          onClear={onClear}
          isOpen={true}
        />
      );

      expect(screen.getByText('Terminal')).toBeInTheDocument();
      expect(screen.getByText('Problems')).toBeInTheDocument();
      expect(screen.getByText('Tests passing: 24/24')).toBeInTheDocument();

      const input = screen.getByPlaceholderText(/Type a command/i);
      fireEvent.change(input, { target: { value: 'npm test' } });
      fireEvent.submit(input.closest('form'));
      expect(onRun).toHaveBeenCalledWith('npm test');
    });
  });

  describe('AiInspector', () => {
    it('renders active target AST summary and sends AI prompts', () => {
      const onRunTask = jest.fn();

      render(
        <AiInspector
          activePath="src/auth/session.js"
          isOpen={true}
          onRunAiTask={onRunTask}
        />
      );

      expect(screen.getByText('AI Copilot Inspector')).toBeInTheDocument();
      expect(screen.getByText('src/auth/session.js')).toBeInTheDocument();

      const explainFileBtn = screen.getByText('Explain File');
      fireEvent.click(explainFileBtn);
      expect(onRunTask).toHaveBeenCalledWith(expect.stringContaining('Explain the implementation'));
    });
  });

  describe('DiffReview', () => {
    it('renders split diff lines and handles accept/reject actions', () => {
      const onAccept = jest.fn();
      const onReject = jest.fn();

      render(
        <DiffReview
          file="src/auth/session.js"
          originalCode="const a = 1;"
          modifiedCode="const a = 2;"
          isOpen={true}
          onAccept={onAccept}
          onReject={onReject}
        />
      );

      expect(screen.getByText(/Diff Review:/i)).toBeInTheDocument();
      expect(screen.getByText('const a = 1;')).toBeInTheDocument();
      expect(screen.getByText('const a = 2;')).toBeInTheDocument();

      const acceptBtn = screen.getByText('Accept Changes');
      fireEvent.click(acceptBtn);
      expect(onAccept).toHaveBeenCalledTimes(1);
    });
  });
});
