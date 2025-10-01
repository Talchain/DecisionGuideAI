import { describe, it, expect, beforeEach } from 'vitest'
import { add, byTarget, del, type Comment } from '../../lib/comments'

const KEY = 'comments.v1'

describe('comments store (localStorage)', () => {
  beforeEach(() => {
    try { localStorage.removeItem(KEY) } catch {}
  })

  it('add → byTarget → del round-trip with newest-first ordering', () => {
    const targetId = 'n1'
    const older: Comment = { id: 'c1', targetId, label: 'Challenge', text: 'Older', at: '2020-01-01T00:00:00.000Z' }
    const newer: Comment = { id: 'c2', targetId, label: 'Evidence', text: 'Newer', at: '2020-01-01T00:00:01.000Z' }

    add(older)
    add(newer)

    const list1 = byTarget(targetId)
    expect(list1.map((c) => c.id)).toEqual(['c2', 'c1'])

    // Delete the first (newest) and re-check
    del('c2')
    const list2 = byTarget(targetId)
    expect(list2.map((c) => c.id)).toEqual(['c1'])
  })

  it('deleting a non-existent id is a no-op', () => {
    const targetId = 'n2'
    const c: Comment = { id: 'x1', targetId, label: 'Challenge', text: 'Only', at: new Date().toISOString() }
    add(c)
    // Delete an id that does not exist
    del('does-not-exist')
    const list = byTarget(targetId)
    expect(list.map((c) => c.id)).toEqual(['x1'])
  })
})
