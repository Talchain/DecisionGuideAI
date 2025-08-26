import { describe, it, expect } from 'vitest';
import { extractMentions } from '../components/CommentPanel';

const users = [
  { id: 'u1', name: 'alex' },
  { id: 'u2', name: 'Alex' },
  { id: 'u3', name: 'José' },
  { id: 'u4', name: 'Jose' },
];

describe('extractMentions()', () => {
  it('maps @alex to ["u1"] when selectedByName points to u1', () => {
    const selected = new Map<string, string>([['alex', 'u1']]);
    const ids = extractMentions('hello @alex', users, selected);
    expect(ids).toEqual(['u1']);
  });

  it('collision resolution prefers selected ID when names collide', () => {
    const selected = new Map<string, string>([['Alex', 'u2']]);
    const ids = extractMentions('ping @Alex', users, selected);
    expect(ids).toEqual(['u2']);
  });

  it('de-duplicates repeated tokens', () => {
    const selected = new Map<string, string>([['alex', 'u1']]);
    const ids = extractMentions('@alex and again @alex', users, selected);
    expect(ids).toEqual(['u1']);
  });

  it('does not create mentions for emails or mid-word @', () => {
    const ids1 = extractMentions('email a@b.com should not match', users);
    const ids2 = extractMentions('c@t midword should not match', users);
    expect(ids1).toEqual([]);
    expect(ids2).toEqual([]);
  });

  it('handles punctuation adjacency like comma/period/paren', () => {
    const selected = new Map<string, string>([['alex', 'u1']]);
    const ids = extractMentions('@alex, then (@alex) and @alex.', users, selected);
    expect(ids).toEqual(['u1']);
  });

  it('unicode/diacritics: matches José only if explicitly selected', () => {
    const idsNoSelect = extractMentions('hi @Jose and @José', users);
    expect(idsNoSelect).toEqual(['u4', 'u3']);

    const selected = new Map<string, string>([['José', 'u3']]);
    const idsSelected = extractMentions('hi @José', users, selected);
    expect(idsSelected).toEqual(['u3']);
  });

  it('case sensitivity: selection decides, matching case-insensitive', () => {
    // Without selection, uses last occurrence of name mapping array (stable rule in impl)
    const ids = extractMentions('@alex and @Alex', users);
    expect(ids).toEqual(['u1', 'u2']);

    // With selection, chosen mapping wins
    const selected = new Map<string, string>([['Alex', 'u2']]);
    const idsSel = extractMentions('@Alex', users, selected);
    expect(idsSel).toEqual(['u2']);
  });
});
