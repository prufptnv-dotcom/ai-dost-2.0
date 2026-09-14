import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatExperienceLayerV3 from '../components/chat/ChatExperienceLayerV3';

jest.mock('../services/api', () => ({ post: jest.fn(async () => ({ data: { reply: 'analysis complete' } })) }));

describe('ChatExperienceLayerV3', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-chat-theme');
    document.body.removeAttribute('data-chat-theme');
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  test('opens universal controls and exposes multi-file + activity surfaces', () => {
    render(<ChatExperienceLayerV3 />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    expect(screen.getByText('Universal Chat')).toBeInTheDocument();
    expect(screen.getByText('Live work')).toBeInTheDocument();
    expect(screen.getByText('Multi-file context')).toBeInTheDocument();
    expect(screen.getByText('Premium themes')).toBeInTheDocument();
  });

  test('theme choice changes project-wide CSS variables and persists', () => {
    render(<ChatExperienceLayerV3 />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    fireEvent.click(screen.getByTitle('Ocean'));
    expect(localStorage.getItem('ai_dost_chat_theme_premium')).toBe('ocean');
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#38bdf8');
    expect(document.documentElement.style.getPropertyValue('--color-canvas-base')).toBe('#050914');
    expect(document.body.style.getPropertyValue('--background')).toBe('#050914');
  });

  test('commands are delegated to the main application', () => {
    const onNavigate = jest.fn();
    const onNewChat = jest.fn();
    const onDeleteChat = jest.fn();
    render(<ChatExperienceLayerV3 onNavigate={onNavigate} onNewChat={onNewChat} onDeleteChat={onDeleteChat} />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));

    const box = screen.getByRole('textbox', { name: /universal chat command/i });
    fireEvent.change(box, { target: { value: 'projects' } });
    fireEvent.click(screen.getByText('Open projects'));
    expect(onNavigate).toHaveBeenCalledWith('projects');

    fireEvent.change(box, { target: { value: 'new chat' } });
    fireEvent.click(screen.getByText('New chat'));
    expect(onNewChat).toHaveBeenCalledTimes(1);

    fireEvent.change(box, { target: { value: 'delete chat' } });
    fireEvent.click(screen.getByText('Delete current chat'));
    expect(onDeleteChat).toHaveBeenCalledTimes(1);
  });

  test('voice transcript populates the existing primary composer', () => {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', 'Ask AI-Dost anything');
    document.body.appendChild(textarea);

    window.SpeechRecognition = class {
      start() { this.onresult?.({ results: [[{ transcript: 'mere projects kholo' }]] }); }
      stop() { this.onend?.(); }
    };

    render(<ChatExperienceLayerV3 />);
    fireEvent.click(screen.getByRole('button', { name: /open chat control center/i }));
    fireEvent.click(screen.getByRole('button', { name: /voice input/i }));
    expect(textarea.value).toBe('mere projects kholo');

    delete window.SpeechRecognition;
    textarea.remove();
  });
});
