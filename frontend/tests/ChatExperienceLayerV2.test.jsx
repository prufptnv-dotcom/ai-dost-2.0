import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatExperienceLayerV2 from '../components/chat/ChatExperienceLayerV2';

jest.mock('../services/api', () => ({
  post: jest.fn(),
}));

describe('ChatExperienceLayerV2', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  test('opens the universal chat control center', () => {
    render(<ChatExperienceLayerV2 />);
    expect(screen.queryByText('Universal Chat')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    expect(screen.getByText('Universal Chat')).toBeInTheDocument();
    expect(screen.getByText('Live work')).toBeInTheDocument();
    expect(screen.getByText('Multi-file context')).toBeInTheDocument();
  });

  test('exposes eight premium theme combinations and persists the selection', () => {
    render(<ChatExperienceLayerV2 />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    expect(screen.getByTitle('Aurora')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Aurora'));
    expect(localStorage.getItem('ai_dost_chat_theme_premium')).toBe('aurora');
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#22c55e');
    expect(document.documentElement.style.getPropertyValue('--color-canvas-base')).toBe('#050907');
  });

  test('universal command routes navigation and new chat actions', () => {
    const onNavigate = jest.fn();
    const onNewChat = jest.fn();
    const onDeleteChat = jest.fn();
    render(<ChatExperienceLayerV2 onNavigate={onNavigate} onNewChat={onNewChat} onDeleteChat={onDeleteChat} />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));

    fireEvent.change(screen.getByRole('textbox', { name: /universal chat command/i }), { target: { value: 'open projects' } });
    fireEvent.click(screen.getByText('Open projects'));
    expect(onNavigate).toHaveBeenCalledWith('projects');

    fireEvent.change(screen.getByRole('textbox', { name: /universal chat command/i }), { target: { value: 'new chat' } });
    fireEvent.click(screen.getByText('New chat'));
    expect(onNewChat).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('textbox', { name: /universal chat command/i }), { target: { value: 'delete chat' } });
    fireEvent.click(screen.getByText('Delete current chat'));
    expect(onDeleteChat).toHaveBeenCalledTimes(1);
  });

  test('voice transcript is inserted into the main chat composer', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', 'Ask AI-Dost anything');
    document.body.appendChild(textarea);

    window.SpeechRecognition = class {
      start() { this.onresult?.({ results: [[{ transcript: 'mere projects kholo' }]] }); }
      stop() { this.onend?.(); }
    };

    render(<ChatExperienceLayerV2 />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    fireEvent.click(screen.getByRole('button', { name: /voice input/i }));
    expect(textarea.value).toBe('mere projects kholo');

    delete window.SpeechRecognition;
    textarea.remove();
  });
});
