import { describe, it, expect, vi } from 'vitest';
// no React import needed with JSX runtime
import { render, screen } from '@testing-library/react';
import { EdgeOverlayPill } from '../components/EdgeOverlayPill';

vi.mock('../state/useYjsComments', () => {
  return {
    useYjsComments: vi.fn((_edgeId: string) => ({
      comments: [
        { id: 'c1', text: 'a', author: 'u1', createdAt: 1, isDeleted: false },
        { id: 'c2', text: 'b', author: 'u1', createdAt: 2, isDeleted: true },
        { id: 'c3', text: 'c', author: 'u1', createdAt: 3, isDeleted: false },
      ],
      lastCommentAt: 3,
    })),
  };
});

vi.mock('../state/useYjsEdgeReads', () => {
  return {
    useYjsEdgeReads: vi.fn((_edgeId: string, _userId: string) => ({
      lastReadAt: 0,
      markRead: vi.fn(),
    })),
  };
});

describe('EdgeOverlayPill - badge and unread', () => {
  it('shows count of visible comments only and unread dot when newer than lastReadAt', async () => {
    render(
      <EdgeOverlayPill
        edge={{ id: 'e1', source: 'n1', target: 'n2' } as any}
        likelihood={50}
        selected={true}
        hovered={false}
        onShowComments={() => {}}
        onPillFocus={() => {}}
        onPillBlur={() => {}}
        currentUserId="u1"
      />
    );

    // Two visible (c1, c3). Badge shows 2.
    const badge = await screen.findByText('2');
    expect(badge).toBeInTheDocument();

    // unread dot present
    const btn = screen.getByRole('button', { name: /show comments/i });
    const dot = btn.querySelector('.bg-red-500');
    expect(dot).toBeTruthy();
  });
});
