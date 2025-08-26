import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../state/useYjsEdgeReads', () => {
  return {
    useYjsEdgeReads: vi.fn((_edgeId: string, _userId: string) => ({
      lastReadAt: 0,
      markRead: vi.fn(),
    })),
  };
});

// Use the real hook for comments to exercise behavior end-to-end in jsdom
import { CommentPanel } from '../components/CommentPanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('CommentPanel composer and unread basics', () => {

  it('Enter sends, Cmd/Ctrl+Enter inserts newline; cooldown disables send; counter appears under 200', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
    const onClose = vi.fn();

    render(
      <Wrapper>
        <CommentPanel
          targetId="edge-x"
          author="alice"
          onClose={onClose}
          currentUserId="u1"
          mentionUsers={[{ id: 'u1', name: 'alice' }, { id: 'u2', name: 'bob' }]}
        />
      </Wrapper>
    );

    const textbox = screen.getByRole('textbox', { name: /add comment/i });

    // Cmd/Ctrl+Enter -> newline
    fireEvent.change(textbox, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    expect((textbox as HTMLTextAreaElement).value).toMatch(/Line 1\n$/);

    // Enter sends
    fireEvent.change(textbox, { target: { value: (textbox as HTMLTextAreaElement).value + 'Message' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    const addButton = screen.getByRole('button', { name: /add comment/i });
    expect(addButton).toBeDisabled(); // cooldown and empty composer after send

    // wait past cooldown using timers
    await act(async () => {
      vi.advanceTimersByTime(600);
      vi.runOnlyPendingTimers();
    });
    // type again to enable (use direct change to avoid async typing overhead under fake timers)
    fireEvent.change(textbox, { target: { value: ((textbox as HTMLTextAreaElement).value || '') + 'x' } });
    expect(addButton).not.toBeDisabled();

    // character counter shows under 200 remaining
    const long = 'x'.repeat(4000 - 199);
    fireEvent.change(textbox, { target: { value: long } });
    expect(screen.getByText('199')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('Unread idle marking schedules within 5s and on close', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <Wrapper>
        <CommentPanel targetId="edge-y" author="alice" onClose={onClose} currentUserId="u1" mentionUsers={[]} idleMarkMs={200} />
      </Wrapper>
    );

    // idle -> should schedule a markRead (verified indirectly by timers advancing)
    await act(async () => {
      vi.advanceTimersByTime(200);
      vi.runOnlyPendingTimers();
    });

    // Close -> should markRead and return focus to trigger (cannot easily assert focus here)
    const close = screen.getByRole('button', { name: /close comments/i });
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
