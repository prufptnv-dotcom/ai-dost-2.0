import React from 'react';
import { render, screen } from '@testing-library/react';
import AICompanion from '../components/AICompanion';

// Mock ESM-only / browser-only deps
jest.mock('marked', () => ({
  marked: { parse: (s) => String(s), setOptions: () => {} }
}));

jest.mock('dompurify', () => {
  const fn = (s) => String(s);
  fn.sanitize = (s) => String(s);
  return { __esModule: true, default: fn, sanitize: fn.sanitize };
});

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }) => {
    const React = require('react');
    return React.createElement('img', { src, alt, ...rest });
  },
}));

// Mock contexts
jest.mock('../context/ModeContext', () => ({
  useMode: () => ({ isFocusMode: false })
}));

jest.mock('../context/SocketContext', () => ({
  useSocket: () => ({ socket: null })
}));

jest.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() })
}));



describe('AICompanion', () => {
  it('renders the chat interface when opened', () => {
    render(<AICompanion projectId="test" />);
    const headerTitle = screen.getByText('Ai-Dost');
    expect(headerTitle).toBeInTheDocument();
  });
});
