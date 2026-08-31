import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock ESM marked and dompurify
jest.mock('marked', () => ({
  marked: { parse: (s) => String(s), setOptions: () => {} },
}));

jest.mock('dompurify', () => {
  const fn = (s) => String(s);
  fn.sanitize = (s) => String(s);
  return { __esModule: true, default: fn, sanitize: fn.sanitize };
});

import MessageStream from '../components/chat/MessageStream';

describe('Phase 3.4 — Chat Stream & Message States', () => {
  const mockMessages = [
    {
      id: 'msg_1',
      role: 'user',
      content: 'Hello AI-Dost, check codebase status.',
    },
    {
      id: 'msg_2',
      role: 'assistant',
      content: 'Codebase inspection completed. Everything is healthy.',
      toolExecutions: [
        {
          tool: 'read_file',
          target: 'backend/server.js',
          status: 'success',
          duration: '12ms',
        },
      ],
      verification: {
        verdict: 'PASS',
        checks: [{ name: 'UNIT_TEST', status: 'PASS' }],
        summary: 'Unit test suite passed cleanly.',
      },
    },
  ];

  it('renders user and assistant messages with structured cards', () => {
    render(<MessageStream messages={mockMessages} />);
    expect(screen.getByText('Hello AI-Dost, check codebase status.')).toBeInTheDocument();
    expect(screen.getByText(/Codebase inspection completed/i)).toBeInTheDocument();
    expect(screen.getByText('read_file')).toBeInTheDocument();
    expect(screen.getByText('backend/server.js')).toBeInTheDocument();
    expect(screen.getByText('Independent Verification')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('renders thinking state when isThinking=true', () => {
    render(
      <MessageStream
        messages={[]}
        isThinking={true}
        thinkingText="Searching relevant codebase context..."
      />
    );
    expect(screen.getByText('Searching relevant codebase context...')).toBeInTheDocument();
  });
});
