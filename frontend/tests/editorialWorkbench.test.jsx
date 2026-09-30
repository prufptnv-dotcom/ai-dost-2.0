import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiDostMark } from '../components/brand/AiDostMark';
import { AiDostWordmark } from '../components/brand/AiDostWordmark';
import { CommandRail } from '../components/layout/CommandRail';

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
});
