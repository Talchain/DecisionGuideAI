import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommentPanel } from '../components/CommentPanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('CommentPanel edit window (RTL)', () => {
  it('blocks editing after >15 minutes and shows toast; UI prevents opening editor', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const T0 = Date.now();
    vi.setSystemTime(T0);

    render(
      <Wrapper>
        <CommentPanel targetId="edge-ew-1" author="alice" onClose={onClose} currentUserId="u1" mentionUsers={[]} idleMarkMs={200} />
      </Wrapper>
    );
    const textbox = screen.getByRole('textbox', { name: /add comment/i });
    fireEvent.change(textbox, { target: { value: 'first' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    await act(async () => { vi.advanceTimersByTime(600); vi.runOnlyPendingTimers(); });

    vi.setSystemTime(T0 + 16 * 60 * 1000);
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await act(async () => { fireEvent.click(editBtn); });
    expect(screen.getByText(/Edit window expired/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /edit comment/i })).toBeNull();
    vi.useRealTimers();
  });

  it('moderator bypasses window and can open editor', async () => {
    const onClose = vi.fn();
    const T0 = Date.now();
    vi.setSystemTime(T0 - 60 * 60 * 1000);
    render(
      <Wrapper>
        <CommentPanel targetId="edge-ew-2" author="alice" onClose={onClose} currentUserId="u1" mentionUsers={[]} isModerator idleMarkMs={200} />
      </Wrapper>
    );
    const textbox = screen.getByRole('textbox', { name: /add comment/i });
    fireEvent.change(textbox, { target: { value: 'old' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    // wait a microtask to flush React updates
    await act(async () => {});
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await act(async () => { fireEvent.click(editBtn); });
    const edits1 = screen.getAllByRole('textbox', { name: /edit comment/i });
    expect(edits1.length).toBeGreaterThan(0);
  });

  it('≤15 minutes allows edit for author', async () => {
    const onClose = vi.fn();
    const T0 = Date.now();
    vi.setSystemTime(T0 - 10 * 60 * 1000);
    render(
      <Wrapper>
        <CommentPanel targetId="edge-ew-3" author="alice" onClose={onClose} currentUserId="u1" mentionUsers={[]} idleMarkMs={200} />
      </Wrapper>
    );
    const textbox = screen.getByRole('textbox', { name: /add comment/i });
    fireEvent.change(textbox, { target: { value: 'recent' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });
    await act(async () => {});
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    await act(async () => { fireEvent.click(editBtn); });
    const edits = screen.getAllByRole('textbox', { name: /edit comment/i });
    expect(edits.length).toBeGreaterThan(0);
  });
});
