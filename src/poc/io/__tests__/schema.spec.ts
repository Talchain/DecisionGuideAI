import { describe, it, expect } from 'vitest'
import { validateState } from '../validate'

describe('json schema validateState()', () => {
  it('accepts valid state', () => {
    const s = { schemaVersion: 1, nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [{ from: 'n1', to: 'n1' }], renames: { n1: 'Node' } }
    const r = validateState(s)
    expect(r.ok).toBe(true)
    expect(r.data?.schemaVersion).toBe(1)
    expect(Array.isArray(r.data?.nodes)).toBe(true)
  })

  it('rejects invalid state', () => {
    const bad = { schemaVersion: 2, nodes: [{ notId: 1 }], edges: [{}] } as any
    const r = validateState(bad)
    expect(r.ok).toBe(false)
    expect(r.errors && r.errors.length).toBeGreaterThan(0)
  })
})
