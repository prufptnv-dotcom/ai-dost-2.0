import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiDostMark } from '../components/brand/AiDostMark';
import { AiDostWordmark } from '../components/brand/AiDostWordmark';
import { CommandRail } from '../components/layout/CommandRail';
import { ContextInspector } from '../components/layout/ContextInspector';
import { AppShell } from '../components/layout/AppShell';
import { ActionSpine } from '../components/chat/ActionSpine';
import { ComposerDock } from '../components/chat/ComposerDock';

describe('Phase 3 Rebuild — Editorial Workbench Design Architecture', () => {
  describe('Brand Components', () => {
    it('renders AiDostMark SVG with aria label', () => {
      render(<AiDostMark size={24} />);
      expect(screen.getByLabelText('AI-Dost')).toBeInTheDocument();
    });

    it('renders AiDostWordmark with editorial typography', () => {
      render(<AiDostWordmark showVersion={true} />);
      expect(screen.getByText(/AI/i)).toBeInTheDocument();
      expect(screen.getByText(/DOST/i)).toBeInTheDocument();
      expect(screen.getByText('v2.4')).toBeInTheDocument();
    });
  });

  describe('CommandRail', () => {
    it('renders icon-first navigation and triggers onSelectView and onNewChat', () => {
      const onSelect = jest.fn();
      const onNew = jest.fn();

      render(
        <CommandRail
          currentView="chat"
          onSelectView={onSelect}
          onNewChat={onNew}
        />
      );

      expect(screen.getByLabelText(/AI-Dost home/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/New chat/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Search chats/i)).toBeInTheDocument();

      const settingsBtn = screen.getByLabelText(/Settings/i);
      fireEvent.click(settingsBtn);
      expect(onSelect).toHaveBeenCalledWith('settings');

      const newBtn = screen.getByLabelText(/New chat/i);
      fireEvent.click(newBtn);
      expect(onNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('ContextInspector', () => {
    it('renders inspector title, metadata rows, and handles close', () => {
      const onClose = jest.fn();
      const metadata = [
        { label: 'Project', value: 'ai-dost-v2' },
        { label: 'Coordinator', value: 'Supervisor' },
      ];

      render(
        <ContextInspector
          title="Task Evidence"
          isOpen={true}
          onClose={onClose}
          metadata={metadata}
        >
          <div>Inspector Child Content</div>
        </ContextInspector>
      );

      expect(screen.getByText('Task Evidence')).toBeInTheDocument();
      expect(screen.getByText('ai-dost-v2')).toBeInTheDocument();
      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Inspector Child Content')).toBeInTheDocument();

      const closeBtn = screen.getByTitle('Close Inspector');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ActionSpine', () => {
    it('renders vertical tool actions and expands output', () => {
      const actions = [
        { tool: 'read_file', target: 'src/auth/middleware.js', duration: '182 ms', status: 'success', output: 'File content (54 lines)' },
      ];

      render(<ActionSpine actions={actions} />);
      expect(screen.getByText('READ')).toBeInTheDocument();
      expect(screen.getByText('src/auth/middleware.js')).toBeInTheDocument();
      expect(screen.getByText('182 ms')).toBeInTheDocument();

      // Click to expand output
      const trigger = screen.getByText('src/auth/middleware.js').closest('button');
      fireEvent.click(trigger);
      expect(screen.getByText('File content (54 lines)')).toBeInTheDocument();
    });
  });

  describe('ComposerDock', () => {
    it('handles typing and triggers onSend on Enter', () => {
      const onChange = jest.fn();
      const onSend = jest.fn();

      render(
        <ComposerDock
          input="Explain async execution loop"
          onChange={onChange}
          onSend={onSend}
        />
      );

      const textarea = screen.getByPlaceholderText(/Type a message/i);
      expect(textarea.value).toBe('Explain async execution loop');

      fireEvent.change(textarea, { target: { value: 'New prompt' } });
      expect(onChange).toHaveBeenCalledWith('New prompt');

      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });
});
