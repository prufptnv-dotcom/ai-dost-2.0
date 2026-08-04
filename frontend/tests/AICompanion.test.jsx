import React from 'react';
import { render, screen } from '@testing-library/react';
import AICompanion from '../components/AICompanion';

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
