// src/plot/__tests__/add-appends.spec.ts
// Verify Add always appends with deterministic IDs (n1, n2, n3, ...)

import { describe, it, expect } from 'vitest'
import { nextId } from '../utils/id'

describe('Plot Add: deterministic append', () => {
  it('generates n1 for empty list', () => {
    expect(nextId([])).toBe('n1')
  })

  it('generates n2 after n1', () => {
    expect(nextId([{ id: 'n1' }])).toBe('n2')
  })

  it('generates n3 after n1, n2', () => {
    expect(nextId([{ id: 'n1' }, { id: 'n2' }])).toBe('n3')
  })

  it('handles gaps correctly (n1, n3 → n4)', () => {
    expect(nextId([{ id: 'n1' }, { id: 'n3' }])).toBe('n4')
  })

  it('ignores non-numeric IDs', () => {
    expect(nextId([{ id: 'foo' }, { id: 'n2' }])).toBe('n3')
  })

  it('handles mixed order (n3, n1, n2 → n4)', () => {
    expect(nextId([{ id: 'n3' }, { id: 'n1' }, { id: 'n2' }])).toBe('n4')
  })
})
