import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollaboratorCursors from '../components/canvas/CollaboratorCursors';
import CollaboratorsBar from '../components/canvas/CollaboratorsBar';
import ShareCollaborationModal from '../components/canvas/ShareCollaborationModal';

describe('Pillar 3: Real-Time Collaborative Canvas Components', () => {
  describe('CollaboratorCursors', () => {
    test('renders remote cursors with name tags and typing indicators', () => {
      const mockParticipants = [
        {
          socketId: 'sock-1',
          userId: 'user-1',
          name: 'Sarah Engineer',
          color: '#ec4899',
          cursor: { x: 120, y: 80 },
          isTyping: true,
        },
        {
          socketId: 'ai-dost-copilot',
          userId: 'ai-dost-copilot',
          name: 'AI-Dost Copilot',
          color: '#a855f7',
          isAi: true,
          cursor: { x: 250, y: 160 },
          isTyping: false,
        },
      ];

      render(<CollaboratorCursors participants={mockParticipants} />);

      expect(screen.getByText('Sarah Engineer')).toBeInTheDocument();
      expect(screen.getByText('AI-Dost Copilot')).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    test('returns null when participants list is empty or cursor not present', () => {
      const { container } = render(<CollaboratorCursors participants={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('CollaboratorsBar', () => {
    test('renders active user avatars, live status, and trigger buttons', () => {
      const onOpenShare = jest.fn();
      const onAiCoEdit = jest.fn();

      const participants = [
        { socketId: 'peer-1', name: 'Alex', color: '#06b6d4' },
      ];
      const currentUser = {
        socketId: 'local-1',
        name: 'Vikash',
        color: '#8b5cf6',
      };

      render(
        <CollaboratorsBar
          participants={participants}
          currentUser={currentUser}
          connected={true}
          onOpenShare={onOpenShare}
          onAiCoEdit={onAiCoEdit}
        />
      );

      // Verify avatars are shown
      expect(screen.getByText('V')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();

      // Verify connection pill
      expect(screen.getByText(/Live \(2\)/i)).toBeInTheDocument();

      // Verify button triggers
      const inviteBtn = screen.getByTitle(/Invite collaborators to this canvas/i);
      fireEvent.click(inviteBtn);
      expect(onOpenShare).toHaveBeenCalledTimes(1);

      const aiBtn = screen.getByTitle(/Summon AI Virtual Collaborator/i);
      fireEvent.click(aiBtn);
      expect(onAiCoEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('ShareCollaborationModal', () => {
    test('renders shareable link, room code, and copies to clipboard', async () => {
      const onClose = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockImplementation(() => Promise.resolve()),
        },
      });

      render(
        <ShareCollaborationModal
          isOpen={true}
          onClose={onClose}
          roomId="room-test-777"
          participants={[{ socketId: 'peer-1', name: 'Alex', color: '#06b6d4' }]}
          currentUser={{ socketId: 'local-1', name: 'Vikash', color: '#8b5cf6' }}
        />
      );

      expect(screen.getByText('Invite to Live Canvas')).toBeInTheDocument();
      expect(screen.getByText('room-test-777')).toBeInTheDocument();
      expect(screen.getByText(/2 online/i)).toBeInTheDocument();

      const copyBtn = screen.getByRole('button', { name: /Copy/i });
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    test('returns null when isOpen is false', () => {
      const { container } = render(
        <ShareCollaborationModal isOpen={false} roomId="room-test-777" />
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
