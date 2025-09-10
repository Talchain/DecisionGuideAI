import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { getConfidence, setConfidence } from '@/sandbox/probabilities/store'

describe('confidence store (Yjs + local fallback)', () => {
  it('local-only mode persists and retrieves', () => {
    const d = 'dec-local'
    const o = 'opt-1'
    expect(getConfidence(d, o)).toBeNull()
    setConfidence(d, o, 0.7, 1000)
    const r1 = getConfidence(d, o)
    expect(r1).toBeTruthy()
    expect(r1!.conf).toBeCloseTo(0.7, 6)
    expect(r1!.updatedAt).toBe(1000)

    setConfidence(d, o, 0.2, 2500)
    const r2 = getConfidence(d, o)
    expect(r2!.conf).toBeCloseTo(0.2, 6)
    expect(r2!.updatedAt).toBe(2500)
  })

  it('Yjs mode reads/writes from sandboxMock.probRows', () => {
    const doc = new Y.Doc()
    const mock = doc.getMap('sandboxMock') as Y.Map<unknown>
    const arr = new Y.Array<Y.Map<unknown>>()
    mock.set('probRows', arr)

    const item = new Y.Map<unknown>()
    item.set('id', 'opt-2')
    item.set('conf', 0.5)
    item.set('updatedAt', 500)
    arr.push([item])

    const d = 'dec-yjs'
    const ctx = { doc }

    const r0 = getConfidence(d, 'opt-2', ctx)
    expect(r0).toEqual({ conf: 0.5, updatedAt: 500 })

    // Update existing
    setConfidence(d, 'opt-2', 0.9, 2000, ctx)
    const r1 = getConfidence(d, 'opt-2', ctx)
    expect(r1!.conf).toBeCloseTo(0.9, 6)
    expect(r1!.updatedAt).toBe(2000)

    // Create new item when missing
    expect(getConfidence(d, 'opt-3', ctx)).toBeNull()
    setConfidence(d, 'opt-3', 0.8, 3000, ctx)
    const r2 = getConfidence(d, 'opt-3', ctx)
    expect(r2).toEqual({ conf: 0.8, updatedAt: 3000 })
  })
})
