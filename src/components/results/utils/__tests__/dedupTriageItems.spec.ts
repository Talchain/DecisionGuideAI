import { describe, it, expect } from 'vitest'
import { dedupTriageItems, triageItemIdentity } from '../dedupTriageItems'

describe('triageItemIdentity', () => {
  it('returns prefixed trimmed targetNodeId when present', () => {
    expect(triageItemIdentity({ targetNodeId: '  node_x  ', title: 'Whatever' })).toBe('node:node_x')
  })

  it('falls back to normalised title when targetNodeId is absent', () => {
    expect(triageItemIdentity({ title: '  Foo Bar  ' })).toBe('title:foo bar')
  })

  it('falls back to normalised title when targetNodeId is empty', () => {
    expect(triageItemIdentity({ targetNodeId: '', title: 'Foo' })).toBe('title:foo')
  })

  it('collapses internal whitespace runs in the title fallback', () => {
    expect(triageItemIdentity({ title: 'Foo   Bar\tBaz' })).toBe('title:foo bar baz')
  })

  it('namespaces target ids and titles separately so they cannot collide', () => {
    // A targetNodeId literally equal to "title:foo" must not collide with
    // a different item whose title is "foo".
    expect(triageItemIdentity({ targetNodeId: 'title:foo' })).toBe('node:title:foo')
    expect(triageItemIdentity({ title: 'foo' })).toBe('title:foo')
  })

  it('returns null when neither identity source yields a usable key', () => {
    expect(triageItemIdentity({})).toBeNull()
    expect(triageItemIdentity({ title: '   ' })).toBeNull()
    expect(triageItemIdentity({ targetNodeId: '', title: '' })).toBeNull()
  })
})

describe('dedupTriageItems', () => {
  it('drops later items that share a targetNodeId with an earlier item', () => {
    const items = [
      { targetNodeId: 'node_a', title: 'First' },
      { targetNodeId: 'node_b', title: 'Second' },
      { targetNodeId: 'node_a', title: 'Duplicate of first' },
    ]
    expect(dedupTriageItems(items)).toEqual([
      { targetNodeId: 'node_a', title: 'First' },
      { targetNodeId: 'node_b', title: 'Second' },
    ])
  })

  it('uses normalised-title fallback when targetNodeId is missing', () => {
    const items = [
      { title: 'Foo  Bar' },
      { title: 'foo bar' },
      { title: '  FOO BAR  ' },
      { title: 'Foo Bar Baz' },
    ]
    // First wins; cases 2 + 3 collapse to the same identity as case 1.
    expect(dedupTriageItems(items)).toEqual([
      { title: 'Foo  Bar' },
      { title: 'Foo Bar Baz' },
    ])
  })

  it('keeps items that have neither targetNodeId nor a usable title', () => {
    const items = [
      { title: '   ' },
      { title: '' },
      {},
      { title: 'Real one' },
    ]
    expect(dedupTriageItems(items)).toHaveLength(4)
  })

  it('preserves order; first occurrence wins', () => {
    const items = [
      { targetNodeId: 'a', title: 'A1' },
      { targetNodeId: 'b', title: 'B1' },
      { targetNodeId: 'a', title: 'A2' },
      { targetNodeId: 'c', title: 'C1' },
    ]
    expect(dedupTriageItems(items).map(i => i.title)).toEqual(['A1', 'B1', 'C1'])
  })
})
