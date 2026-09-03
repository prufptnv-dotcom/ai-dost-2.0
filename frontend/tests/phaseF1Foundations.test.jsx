import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import HistoryView from '../components/views/HistoryView';
import SettingsView from '../components/views/SettingsView';
import { PromptModal, QuickOpen } from '../components/views/IDEOverlays';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Phase F1 — Interaction Foundations Behavioral Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('GAP-P1-06: AppShell Offline State Banner', () => {
    it('displays offline indicator when window offline event is dispatched', async () => {
      render(
        <AppShell currentView="chat">
          <div>Workspace Content</div>
        </AppShell>
      );

      // Initially online
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      // Dispatch offline event
      fireEvent(window, new Event('offline'));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/Working offline/i)).toBeInTheDocument();
      });

      // Dispatch online event
      fireEvent(window, new Event('online'));

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('GAP-P1-02: Accessible Confirmation Modals', () => {
    it('HistoryView replaces window.confirm with accessible deletion modal', async () => {
      api.get.mockResolvedValue({
        data: [{ id: '1', session_id: 'sess-1', message: 'Hello', timestamp: Date.now() }],
      });
      api.delete.mockResolvedValue({ data: { success: true } });

      render(<HistoryView onToast={() => {}} />);

      await waitFor(() => {
        expect(screen.getByText('Clear History')).toBeInTheDocument();
      });

      // Click Clear History button
      fireEvent.click(screen.getByText('Clear History'));

      // Modal should appear
      expect(screen.getByRole('heading', { name: 'Clear All History' })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete all recorded conversation history/i)).toBeInTheDocument();

      // Click confirmation button
      const confirmButton = screen.getByRole('button', { name: 'Clear All History' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/chat/history', { params: { session_id: 'default' } });
      });
    });

    it('SettingsView replaces window.confirm with accessible reset modal', () => {
      render(<SettingsView onToast={() => {}} />);

      const resetBtn = screen.getByRole('button', { name: 'Reset' });
      fireEvent.click(resetBtn);

      expect(screen.getByText('Reset All Settings')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to reset all custom API keys/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: 'Reset to Defaults' });
      fireEvent.click(confirmBtn);

      expect(screen.queryByText('Reset All Settings')).not.toBeInTheDocument();
    });
  });

  describe('GAP-P1-03: IDEOverlays Semantic Token Usage', () => {
    it('PromptModal uses semantic CSS token variables for background and border', () => {
      const modal = { title: 'Create File', placeholder: 'filename.js' };
      const { container } = render(<PromptModal modal={modal} onClose={() => {}} onSubmit={() => {}} />);

      const card = container.querySelector('.animate-fadeIn');
      expect(card).toBeInTheDocument();
      expect(card.style.background).toBe('var(--color-canvas-surface)');
      expect(card.style.border).toBe('1px solid var(--color-border-default)');
    });

    it('QuickOpen uses semantic CSS token variables', () => {
      const files = [{ path: 'src/index.js' }];
      const { container } = render(<QuickOpen files={files} onPick={() => {}} onClose={() => {}} />);

      const card = container.querySelector('.animate-fadeIn');
      expect(card).toBeInTheDocument();
      expect(card.style.background).toBe('var(--color-canvas-surface)');
      expect(card.style.border).toBe('1px solid var(--color-border-default)');
    });
  });
});
