import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatExperienceLayer from '../components/chat/ChatExperienceLayerV4';

jest.mock('../services/api', () => ({
  post: jest.fn(async () => ({ data: { reply: 'analysis complete' } })),
}));

describe('ChatExperienceLayer', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  test('opens universal chat controls', () => {
    render(<ChatExperienceLayer />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    expect(screen.getByText('Universal Chat')).toBeInTheDocument();
    expect(screen.getByText('Live work')).toBeInTheDocument();
    expect(screen.getByText('Multi-file context')).toBeInTheDocument();
    expect(screen.getByText('Premium themes')).toBeInTheDocument();
  });

  test('premium theme selection updates project-wide variables and persists', () => {
    render(<ChatExperienceLayer />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    fireEvent.click(screen.getByTitle('Ocean'));
    expect(localStorage.getItem('ai_dost_chat_theme_premium')).toBe('ocean');
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#38bdf8');
    expect(document.documentElement.style.getPropertyValue('--color-canvas-base')).toBe('#050914');
    expect(document.body.style.getPropertyValue('--background')).toBe('#050914');
  });

  test('universal commands delegate to the main app', () => {
    const onNavigate = jest.fn();
    const onNewChat = jest.fn();
    const onDeleteChat = jest.fn();
    render(<ChatExperienceLayer onNavigate={onNavigate} onNewChat={onNewChat} onDeleteChat={onDeleteChat} />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    const input = screen.getByRole('textbox', { name: /universal chat command/i });

    fireEvent.change(input, { target: { value: 'projects' } });
    fireEvent.click(screen.getByText('Open projects'));
    expect(onNavigate).toHaveBeenCalledWith('projects');

    fireEvent.change(input, { target: { value: 'new chat' } });
    fireEvent.click(screen.getByText('New chat'));
    expect(onNewChat).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: 'delete chat' } });
    fireEvent.click(screen.getByText('Delete current chat'));
    expect(onDeleteChat).toHaveBeenCalledTimes(1);
  });

  test('voice transcript enters the primary composer and submits', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', 'Ask AI-Dost anything');
    document.body.appendChild(textarea);
    const OriginalSpeechRecognition = window.SpeechRecognition;
    const OriginalWebkitSpeechRecognition = window.webkitSpeechRecognition;

    class MockSpeechRecognition {
      start() { this.onresult?.({ results: [[{ transcript: 'mere projects kholo' }]] }); }
      stop() { this.onend?.(); }
    }
    window.SpeechRecognition = MockSpeechRecognition;

    render(<ChatExperienceLayer />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    fireEvent.click(screen.getByRole('button', { name: /voice input/i }));
    expect(textarea.value).toBe('mere projects kholo');

    window.SpeechRecognition = OriginalSpeechRecognition;
    window.webkitSpeechRecognition = OriginalWebkitSpeechRecognition;
    textarea.remove();
  });
});
