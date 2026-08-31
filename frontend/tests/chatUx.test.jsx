import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolExecutionCard from '../components/chat/ToolExecutionCard';
import VerificationCard from '../components/chat/VerificationCard';
import ArtifactCard from '../components/chat/ArtifactCard';
import ChatComposer from '../components/chat/ChatComposer';

describe('Phase 3.4 — Chat UX Modular Components', () => {
  describe('ToolExecutionCard', () => {
    it('renders tool name, target, status, and expands output', () => {
      render(
        <ToolExecutionCard
          tool="write_file"
          target="backend/server.js"
          status="success"
          duration="45ms"
          output="File successfully written (120 lines)"
        />
      );
      expect(screen.getByText('write_file')).toBeInTheDocument();
      expect(screen.getByText('backend/server.js')).toBeInTheDocument();
      expect(screen.getByText('success')).toBeInTheDocument();
      expect(screen.getByText('45ms')).toBeInTheDocument();

      // Expand output
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      expect(screen.getByText(/File successfully written/i)).toBeInTheDocument();
    });
  });

  describe('VerificationCard', () => {
    it('renders PASS verdict with individual check pills', () => {
      const checks = [
        { name: 'UNIT_TEST', status: 'PASS' },
        { name: 'LINT', status: 'PASS' },
        { name: 'SECURITY', status: 'PASS' },
      ];
      render(
        <VerificationCard
          verdict="PASS"
          checks={checks}
          summary="All 3 independent verification checks passed cleanly."
        />
      );
      expect(screen.getByText('Independent Verification')).toBeInTheDocument();
      expect(screen.getByText('PASS')).toBeInTheDocument();
      expect(screen.getByText('All 3 independent verification checks passed cleanly.')).toBeInTheDocument();
      expect(screen.getByText('UNIT_TEST')).toBeInTheDocument();
      expect(screen.getByText('LINT')).toBeInTheDocument();
      expect(screen.getByText('SECURITY')).toBeInTheDocument();
    });

    it('renders FAIL verdict with error indicators', () => {
      render(
        <VerificationCard
          verdict="FAIL"
          checks={[{ name: 'UNIT_TEST', status: 'FAIL' }]}
          summary="1 check failed: broken assertion in user auth."
        />
      );
      expect(screen.getByText('FAIL')).toBeInTheDocument();
      expect(screen.getByText('1 check failed: broken assertion in user auth.')).toBeInTheDocument();
    });
  });

  describe('ArtifactCard', () => {
    it('renders PDF artifact preview and download triggers', () => {
      const onPreview = jest.fn();
      render(
        <ArtifactCard
          type="pdf"
          title="Bihar Development Report.pdf"
          size="2.4 MB"
          downloadUrl="/downloads/bihar_report.pdf"
          onOpenCanvas={onPreview}
        />
      );
      expect(screen.getByText('Bihar Development Report.pdf')).toBeInTheDocument();
      expect(screen.getByText(/2.4 MB/i)).toBeInTheDocument();

      const previewBtn = screen.getByRole('button', { name: 'Preview' });
      fireEvent.click(previewBtn);
      expect(onPreview).toHaveBeenCalledTimes(1);

      const downloadLink = screen.getByRole('link', { name: /Download/i });
      expect(downloadLink).toHaveAttribute('href', '/downloads/bihar_report.pdf');
    });
  });

  describe('ChatComposer', () => {
    it('handles typing and triggers onSend on Enter', () => {
      const onChange = jest.fn();
      const onSend = jest.fn();
      render(
        <ChatComposer
          input="Create a Next.js app"
          onChange={onChange}
          onSend={onSend}
        />
      );
      const textarea = screen.getByPlaceholderText(/Ask anything/i);
      expect(textarea.value).toBe('Create a Next.js app');

      fireEvent.change(textarea, { target: { value: 'New prompt' } });
      expect(onChange).toHaveBeenCalledWith('New prompt');

      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it('shows Stop button when isStreaming=true', () => {
      const onStop = jest.fn();
      render(
        <ChatComposer
          input="Streaming message..."
          isStreaming={true}
          onStop={onStop}
        />
      );
      const stopBtn = screen.getByLabelText('Stop Generation');
      expect(stopBtn).toBeInTheDocument();
      fireEvent.click(stopBtn);
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });
});
