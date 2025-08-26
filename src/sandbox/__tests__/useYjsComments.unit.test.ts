import { describe, it, expect, beforeEach } from 'vitest';
import React, { FC, useEffect } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { useYjsComments } from '../state/useYjsComments';

const TestHarness: FC<{ edgeId: string; onReady: (api: ReturnType<typeof useYjsComments>) => void }> = ({ edgeId, onReady }) => {
  const api = useYjsComments(edgeId);
  useEffect(() => { onReady(api); }, [api]);
  return null;
};

describe('useYjsComments - reactions and timestamps', () => {
  beforeEach(() => {
    // nothing yet; ydoc is a singleton but tests are isolated per run
  });

  it('toggleReaction is idempotent and supports multi-user counts', async () => {
    const edgeId = 'edge-1';
    let api!: ReturnType<typeof useYjsComments>;
    let resolveReady!: () => void;
    const ready = new Promise<void>(res => { resolveReady = res; });
    render(React.createElement(TestHarness, { edgeId, onReady: (a) => { api = a; resolveReady(); } }));
    await ready;
    // allow effects inside hook to settle
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      api.addComment({ targetId: edgeId, author: 'a', text: 'hi' });
      await Promise.resolve();
    });
    await waitFor(() => expect(api.comments.length).toBeGreaterThanOrEqual(1), { timeout: 2000 });
    const comment = api.comments[0]!;

    await act(async () => {
      api.toggleReaction(comment.id, '👍', 'u1');
      await new Promise(r => setTimeout(r, 300));
      api.toggleReaction(comment.id, '👍', 'u1'); // off
      await new Promise(r => setTimeout(r, 300));
      api.toggleReaction(comment.id, '👍', 'u2'); // on
      await new Promise(r => setTimeout(r, 50));
    });

    await waitFor(() => {
      const updated = api.comments.find(c => c.id === comment.id)!;
      const arr = updated.reactions?.['👍'] ?? [];
      expect(arr.length).toBe(1);
      expect(arr.includes('u2')).toBe(true);
      expect(arr.includes('u1')).toBe(false);
    }, { timeout: 3000 });
  });

  it('lastCommentAt ignores soft-deleted', async () => {
    const edgeId = 'edge-2';
    let api!: ReturnType<typeof useYjsComments>;
    let resolveReady!: () => void;
    const ready = new Promise<void>(res => { resolveReady = res; });
    render(React.createElement(TestHarness, { edgeId, onReady: (a) => { api = a; resolveReady(); } }));
    await ready;

    await act(async () => {
      api.addComment({ targetId: edgeId, author: 'a', text: 't1' });
      await new Promise(r => setTimeout(r, 600));
      api.addComment({ targetId: edgeId, author: 'a', text: 't2' });
      await Promise.resolve();
    });
    await waitFor(() => expect(api.comments.length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
    const c2 = api.comments[1]!;
    await act(async () => {
      api.deleteComment(c2.id);
    });
    await waitFor(() => {
      const visible = api.comments.filter(c => !c.isDeleted);
      const expectedLast = Math.max(...visible.map(c => c.updatedAt ?? c.createdAt));
      expect(api.lastCommentAt).toBe(expectedLast);
    });
  });
});
