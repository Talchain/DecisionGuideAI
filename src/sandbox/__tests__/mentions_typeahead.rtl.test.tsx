import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommentPanel } from '../components/CommentPanel';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const mentionUsers = [
  { id: 'u1', name: 'alex' },
  { id: 'u2', name: 'Alex' },
  { id: 'u3', name: 'José' },
];

describe('CommentPanel mentions typeahead (RTL)', () => {
  it('debounce + keyboard selection with name collision saves selected ID', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const notify = { mention: vi.fn() };

    render(
      <Wrapper>
        <CommentPanel
          targetId="edge-mentions-1"
          author="alice"
          currentUserId="cu"
          onClose={onClose}
          mentionUsers={mentionUsers}
          mentionDebounceMs={200}
          idleMarkMs={200}
          notify={notify}
        />
      </Wrapper>
    );

    const composer = screen.getByRole('textbox', { name: /add comment/i });
    // Type '@al' and wait for debounce
    fireEvent.change(composer, { target: { value: '@al' } });
    await act(async () => { vi.advanceTimersByTime(200); });

    // Listbox appears with up to 20 results; should include both alex and Alex
    screen.getByRole('listbox');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Keyboard navigate to second (Alex -> u2) and select with Enter
    await act(async () => { fireEvent.keyDown(composer, { key: 'ArrowDown' }); });
    await act(async () => { fireEvent.keyDown(composer, { key: 'Enter' }); });

    // Send the comment
    const addBtn = screen.getByRole('button', { name: 'Add comment' });
    await act(async () => { fireEvent.click(addBtn); vi.runOnlyPendingTimers(); });

    // Notify should be called exactly once with selected ID u2
    expect(notify.mention).toHaveBeenCalledTimes(1);
    const arg = (notify.mention as any).mock.calls[0][0];
    expect(arg.userId).toBe('u2');

    vi.useRealTimers();
  });

  it('no ghost mentions when mention text is deleted before send', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const notify = { mention: vi.fn() };

    render(
      <Wrapper>
        <CommentPanel
          targetId="edge-mentions-2"
          author="alice"
          currentUserId="cu"
          onClose={onClose}
          mentionUsers={mentionUsers}
          mentionDebounceMs={200}
          idleMarkMs={200}
          notify={notify}
        />
      </Wrapper>
    );

    const composer = screen.getByRole('textbox', { name: /add comment/i });
    fireEvent.change(composer, { target: { value: 'hello @al' } });
    await act(async () => { vi.advanceTimersByTime(200); });

    // Select first option (alex -> u1)
    const options = screen.getAllByRole('option');
    await act(async () => { fireEvent.click(options[0]); });

    // Now delete the mention token text before sending
    await act(async () => { fireEvent.change(composer, { target: { value: 'hello' } }); });

    // Send
    const addBtn = screen.getByRole('button', { name: 'Add comment' });
    await act(async () => { fireEvent.click(addBtn); vi.runOnlyPendingTimers(); });

    // No notification fired
    expect(notify.mention).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
