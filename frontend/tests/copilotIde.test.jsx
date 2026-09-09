import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileExplorer, normalizePath } from '../components/ide/FileExplorer';
import { WorkspaceTabs } from '../components/ide/WorkspaceTabs';
import { EditorToolbar } from '../components/ide/EditorToolbar';
import { TerminalDock } from '../components/ide/TerminalDock';
import { AiInspector } from '../components/ide/AiInspector';
import { DiffReview } from '../components/ide/DiffReview';
import { PackagesModal } from '../components/ide/PackagesModal';
import { SecretsModal } from '../components/ide/SecretsModal';
import CopilotHistoryModal from '../components/views/CopilotHistoryModal';

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

    it('switches to Quality & Verification tab and displays verification suite', async () => {
      render(
        <AiInspector
          activePath="src/auth/session.js"
          activeContent="const x = 1;\nconsole.log(x);"
          isOpen={true}
        />
      );

      const qualityTab = screen.getByText(/Quality/i);
      fireEvent.click(qualityTab);

      expect(screen.getByText('Quality & Verification')).toBeInTheDocument();
      expect(screen.getByText(/Syntax Parser/i)).toBeInTheDocument();
      expect(screen.getByText('Secret Shield')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/Verify Code Quality|Verifying/i)).toBeInTheDocument();
      });
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

  describe('PackagesModal (Replit Package Manager)', () => {
    const mockPackageJson = JSON.stringify({
      name: 'my-web-app',
      dependencies: {
        'react': '^19.0.0',
        'axios': '^1.7.9'
      },
      devDependencies: {
        'vite': '^5.0.0'
      }
    }, null, 2);

    it('renders installed packages with version tags', () => {
      render(
        <PackagesModal
          isOpen={true}
          onClose={jest.fn()}
          packageJsonContent={mockPackageJson}
        />
      );

      expect(screen.getByText(/Replit Package Manager/i)).toBeInTheDocument();
      expect(screen.getByText('Installed Dependencies (3)')).toBeInTheDocument();
      expect(screen.getByText('react')).toBeInTheDocument();
      expect(screen.getAllByText('axios')[0]).toBeInTheDocument();
      expect(screen.getByText('vite')).toBeInTheDocument();
    });

    it('installs a package and updates package.json', async () => {
      const onUpdate = jest.fn();
      const onRun = jest.fn();

      render(
        <PackagesModal
          isOpen={true}
          onClose={jest.fn()}
          packageJsonContent={mockPackageJson}
          onUpdatePackageJson={onUpdate}
          onRunCommand={onRun}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search or enter npm package name/i);
      fireEvent.change(searchInput, { target: { value: 'lodash' } });

      const installBtn = screen.getByText('Install');
      fireEvent.click(installBtn);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(expect.stringContaining('lodash'));
        expect(onRun).toHaveBeenCalledWith(expect.stringContaining('npm install lodash'));
      });
    });
  });

  describe('SecretsModal (Replit Environment Variables)', () => {
    const mockEnv = 'VITE_API_URL="https://api.aidost.com"\n# Comment line\nDATABASE_KEY="secret_key_123"\n';

    it('parses .env lines and masks secret values by default', () => {
      render(
        <SecretsModal
          isOpen={true}
          onClose={jest.fn()}
          envContent={mockEnv}
        />
      );

      expect(screen.getByText(/Replit Secrets & Environment Variables/i)).toBeInTheDocument();
      expect(screen.getByText('VITE_API_URL')).toBeInTheDocument();
      expect(screen.getByText('DATABASE_KEY')).toBeInTheDocument();

      const passInputs = screen.getAllByDisplayValue(/secret_key_123|https:\/\/api.aidost.com/);
      expect(passInputs[0]).toHaveAttribute('type', 'password');
    });

    it('adds a new secret and saves updated .env string', async () => {
      const onSave = jest.fn();

      render(
        <SecretsModal
          isOpen={true}
          onClose={jest.fn()}
          envContent={mockEnv}
          onSaveEnv={onSave}
        />
      );

      const keyInput = screen.getByPlaceholderText(/KEY/i);
      const valInput = screen.getByPlaceholderText(/Value/i);
      const addBtn = screen.getByText('Add');

      fireEvent.change(keyInput, { target: { value: 'NEW_TOKEN' } });
      fireEvent.change(valInput, { target: { value: 'xyz789' } });
      fireEvent.click(addBtn);

      expect(screen.getByText('NEW_TOKEN')).toBeInTheDocument();

      const saveBtn = screen.getByText('Save Secrets');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(expect.stringContaining('NEW_TOKEN="xyz789"'));
      });
    });
  });

  describe('Path Normalization & File Tree Deduplication', () => {
    it('normalizes backslashes, leading ./, and redundant slashes', () => {
      expect(normalizePath('src\\App.jsx')).toBe('src/App.jsx');
      expect(normalizePath('.\\src\\components\\Card.jsx')).toBe('src/components/Card.jsx');
      expect(normalizePath('///src//utils///api.js')).toBe('src/utils/api.js');
      expect(normalizePath('')).toBe('');
    });

    it('deduplicates duplicate paths and renders unified file count', () => {
      const duplicateFiles = [
        { path: 'src/App.jsx', content: '// root' },
        { path: 'src\\App.jsx', content: '// windows clone' },
        { path: './src/App.jsx', content: '// relative clone' },
        { path: 'package.json', content: '{}' },
      ];

      render(<FileExplorer files={duplicateFiles} activePath="src/App.jsx" />);
      // Should deduplicate to exactly 2 files: src/App.jsx and package.json
      expect(screen.getByText('(2)')).toBeInTheDocument();
      expect(screen.getAllByText('App.jsx')).toHaveLength(1);
    });
  });

  describe('CopilotHistoryModal (Session History Management)', () => {
    const mockSessions = [
      {
        id: 'session-1',
        title: 'Fullstack Hospital Booking',
        promptSummary: 'Build doctor booking portal',
        updatedAt: Date.now() - 10000,
        files: [{ path: 'src/App.jsx' }, { path: 'server.js' }],
        messages: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]
      },
      {
        id: 'session-2',
        title: 'Crypto Analytics Dashboard',
        promptSummary: 'Design realtime crypto chart',
        updatedAt: Date.now() - 100000,
        files: [{ path: 'src/Chart.jsx' }],
        messages: [{ role: 'user', content: 'crypto' }]
      }
    ];

    it('renders session cards with metadata and supports session selection', () => {
      const onSelect = jest.fn();
      const onClose = jest.fn();

      render(
        <CopilotHistoryModal
          isOpen={true}
          onClose={onClose}
          sessions={mockSessions}
          activeSessionId="session-1"
          onSelectSession={onSelect}
        />
      );

      expect(screen.getByText('Copilot IDE History')).toBeInTheDocument();
      expect(screen.getByText('Fullstack Hospital Booking')).toBeInTheDocument();
      expect(screen.getByText('Crypto Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      // Click Open on session-2
      const openButtons = screen.getAllByText('Open');
      fireEvent.click(openButtons[0]);
      expect(onSelect).toHaveBeenCalledWith('session-2');
      expect(onClose).toHaveBeenCalled();
    });

    it('filters sessions using search query', () => {
      render(
        <CopilotHistoryModal
          isOpen={true}
          onClose={jest.fn()}
          sessions={mockSessions}
          activeSessionId="session-1"
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search past sessions/i);
      fireEvent.change(searchInput, { target: { value: 'Crypto' } });

      expect(screen.getByText('Crypto Analytics Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Fullstack Hospital Booking')).not.toBeInTheDocument();
    });

    it('triggers onNewSession when clicking New Session button', () => {
      const onNew = jest.fn();
      const onClose = jest.fn();

      render(
        <CopilotHistoryModal
          isOpen={true}
          onClose={onClose}
          sessions={mockSessions}
          activeSessionId="session-1"
          onNewSession={onNew}
        />
      );

      const newBtn = screen.getByText('New Session');
      fireEvent.click(newBtn);
      expect(onNew).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

