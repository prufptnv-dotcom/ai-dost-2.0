import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArtifactsView from '../components/views/ArtifactsView';
import HistoryView from '../components/views/HistoryView';
import SettingsView from '../components/views/SettingsView';
import VoiceView from '../components/views/VoiceView';
import McpPanel from '../components/McpPanel';
import api from '../services/api';

jest.mock('../services/api');

describe('Phase 3.7 — Secondary Product Surfaces Rebuild', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ArtifactsView', () => {
    it('renders empty state when no artifacts stored', () => {
      localStorage.setItem('ai_dost_generated_artifacts', '[]');
      render(<ArtifactsView />);
      expect(screen.getByText(/Document & Artifact Shelf/i)).toBeInTheDocument();
      expect(screen.getByText(/No generated artifacts yet/i)).toBeInTheDocument();
    });

    it('renders archived artifact items from localStorage', () => {
      const mockArtifacts = [
        { id: 'art_1', title: 'Q3 Financial Report.pdf', type: 'PDF', url: '/downloads/q3.pdf', created_at: Date.now() },
      ];
      localStorage.setItem('ai_dost_generated_artifacts', JSON.stringify(mockArtifacts));
      render(<ArtifactsView />);
      expect(screen.getByText('Q3 Financial Report.pdf')).toBeInTheDocument();
      expect(screen.getAllByText('PDF').length).toBeGreaterThan(0);
    });
  });

  describe('HistoryView', () => {
    it('renders conversation history timeline from API', async () => {
      api.get.mockResolvedValueOnce({
        data: [
          { session_id: 'default', message: 'How do I configure SQLite?', role: 'user', created_at: Date.now() },
          { session_id: 'default', message: 'You can use Universal Project Store DAO.', role: 'assistant', created_at: Date.now() },
        ],
      });

      render(<HistoryView />);
      expect(screen.getByText(/Conversation & Task History/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getAllByText(/How do I configure SQLite/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe('SettingsView', () => {
    it('renders model options, API key fields, and saves preferences', () => {
      const onToast = jest.fn();
      const onModelChange = jest.fn();

      render(<SettingsView onToast={onToast} onModelChange={onModelChange} />);
      expect(screen.getByText(/Workspace Settings/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Model Cascade/i)).toBeInTheDocument();
      expect(screen.getByText(/API Keys & Providers/i)).toBeInTheDocument();

      const saveBtn = screen.getByText('Save Changes');
      fireEvent.click(saveBtn);
      expect(onToast).toHaveBeenCalledWith('Settings saved locally', 'success');
    });
  });

  describe('VoiceView', () => {
    it('renders flat waveform, status indicators, and handles text input fallback', async () => {
      api.post.mockResolvedValueOnce({ data: { reply: 'Handshake acknowledged' } });
      const onTranscript = jest.fn();
      render(<VoiceView onTranscript={onTranscript} />);
      expect(screen.getByText(/Voice Assistant/i)).toBeInTheDocument();
      expect(screen.getByText(/Microphone Idle/i)).toBeInTheDocument();

      const input = screen.getByPlaceholderText(/Type your message/i);
      fireEvent.change(input, { target: { value: 'Explain coordinator handshake' } });
      const sendBtn = screen.getByText('Send');
      fireEvent.click(sendBtn);
      expect(onTranscript).toHaveBeenCalledWith('Explain coordinator handshake');
    });
  });

  describe('McpPanel', () => {
    it('renders technical connector table and triggers add modal', () => {
      render(<McpPanel />);
      expect(screen.getByText(/Model Context Protocol/i)).toBeInTheDocument();
      expect(screen.getByText('SQLite DB Server')).toBeInTheDocument();

      const addBtn = screen.getByText('Add Connector');
      fireEvent.click(addBtn);
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();
    });
  });
});
