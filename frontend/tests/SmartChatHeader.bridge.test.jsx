import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import SmartChatHeader from '../components/chat/SmartChatHeader';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../components/chat/LiveMultimodalExperience', () => function MockLiveMultimodalExperience() {
  return <div data-testid="live-multimodal" />;
});

describe('SmartChatHeader composer bridges', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('main composer mic dispatches the universal voice event', () => {
    const voiceHandler = jest.fn();
    window.addEventListener('ai_dost_chat_voice_toggle', voiceHandler);
    render(<SmartChatHeader />);

    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Voice input');
    document.body.appendChild(button);
    fireEvent.click(button);

    expect(voiceHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener('ai_dost_chat_voice_toggle', voiceHandler);
  });

  test('main composer paperclip dispatches the universal attachment event', () => {
    const attachHandler = jest.fn();
    window.addEventListener('ai_dost_chat_attach', attachHandler);
    render(<SmartChatHeader />);

    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Attach file');
    document.body.appendChild(button);
    fireEvent.click(button);

    expect(attachHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener('ai_dost_chat_attach', attachHandler);
  });
});
