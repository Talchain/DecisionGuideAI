import { describe, it, expect, vi } from 'vitest';
import { canEdit } from '../components/CommentPanel';
import type { RTComment } from '../state/useYjsComments';

function makeComment(overrides: Partial<RTComment> = {}): RTComment {
  const now = Date.now();
  return {
    id: overrides.id ?? 'c1',
    targetId: overrides.targetId ?? 'edge-1',
    author: overrides.author ?? 'alice',
    text: overrides.text ?? 'hello',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt,
    isDeleted: overrides.isDeleted ?? false,
    reactions: overrides.reactions ?? {},
    mentions: overrides.mentions ?? [],
    parentId: overrides.parentId,
  } as RTComment;
}

describe('canEdit (edit window enforcement)', () => {
  it('≤15 minutes allows edit', () => {
    const fixed = Date.now();
    vi.setSystemTime(fixed);
    const tenMinAgo = fixed - 10 * 60 * 1000;
    const c = makeComment({ createdAt: tenMinAgo });
    expect(canEdit(c, 'alice', false, fixed)).toBe(true);
  });

  it('>15 minutes blocks', () => {
    const fixed = Date.now();
    vi.setSystemTime(fixed);
    const sixteenMinAgo = fixed - 16 * 60 * 1000;
    const c = makeComment({ createdAt: sixteenMinAgo });
    expect(canEdit(c, 'alice', false, fixed)).toBe(false);
  });

  it('Moderator bypass', () => {
    const fixed = Date.now();
    const hourAgo = fixed - 60 * 60 * 1000;
    const c = makeComment({ createdAt: hourAgo });
    expect(canEdit(c, 'alice', true, fixed)).toBe(true);
  });
});
