import { describe, it, expect } from 'vitest'
import { validatePlcImport, validatePlcImportText } from '../validate'

const VALID_MIN = { nodes: [{ id: 'a', x: 0, y: 0 }], edges: [{ from: 'a', to: 'a' }] }

describe('PLC IO validate', () => {
  it('invalid JSON via text', () => {
    const r = validatePlcImportText('{')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/invalid JSON/i)
  })
  it('missing nodes/edges', () => {
    const r = validatePlcImport({})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/\/nodes.*array/)
  })
  it('wrong types: x as string', () => {
    const r = validatePlcImport({ nodes: [{ id: 'a', x: '12', y: 0 }], edges: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/x must be a finite number/)
  })
  it('duplicate ids', () => {
    const r = validatePlcImport({ nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 1, y: 1 }], edges: [] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/duplicate/i)
  })
  it('edge missing ref', () => {
    const r = validatePlcImport({ nodes: [{ id: 'a', x: 0, y: 0 }], edges: [{ from: 'a', to: 'b' }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/references missing id/i)
  })
  it('valid minimal object', () => {
    const r = validatePlcImport(VALID_MIN)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.nodes[0].id).toBe('a')
  })
  it('large payload rejected by size guard via text', () => {
    const big = 'x'.repeat(1_000_001)
    const r = validatePlcImportText(big)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/too large/i)
  })
  it('items cap enforced', () => {
    const nodes = Array.from({ length: 5001 }, (_, i) => ({ id: `n${i}`, x: 0, y: 0 }))
    const edges: any[] = []
    const r = validatePlcImport({ nodes, edges })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/too many items/i)
  })
})
