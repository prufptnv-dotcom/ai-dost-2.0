import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UnifiedChatAttachments, {
  MAX_CHAT_ATTACHMENTS,
  getComposerAttachments,
} from '../components/chat/UnifiedChatAttachments';

describe('UnifiedChatAttachments', () => {
  beforeEach(() => {
    delete window.__aiDostComposerAttachments;
  });

  it('upgrades the chat file input to multi-file mode', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.txt,.md';
    document.body.appendChild(input);

    render(<UnifiedChatAttachments />);

    expect(input.multiple).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Attach files');
    input.remove();
  });

  it('accepts at most 15 files and exposes them to the runtime', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.md';
    document.body.appendChild(input);
    render(<UnifiedChatAttachments />);

    const files = Array.from({ length: MAX_CHAT_ATTACHMENTS + 2 }, (_, index) => (
      new File([`file-${index}`], `note-${index}.txt`, { type: 'text/plain' })
    ));

    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(screen.getByText('15/15 files ready for this chat')).toBeInTheDocument());
    expect(getComposerAttachments()).toHaveLength(15);
    expect(screen.getByText('note-0.txt')).toBeInTheDocument();
    input.remove();
  });
});
