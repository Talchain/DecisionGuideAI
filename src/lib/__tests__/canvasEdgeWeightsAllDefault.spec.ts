/**
 * F7 — the diagnostic's `all_default` was a value-equality heuristic for a
 * question the provenance marker answers exactly, and it was wrong in BOTH
 * directions.
 */
import { describe, it, expect } from 'vitest'
import { canvasEdgeWeightsAllDefault } from '../diagnostic-bundle'
import { isEdgeValueSet } from '../../canvas/domain/edgeValueProvenance'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS } from '../../canvas/domain/edges'

const summarise = (edges: Array<{ data?: unknown }>) =>
  canvasEdgeWeightsAllDefault(edges, isEdgeValueSet)

describe('canvasEdgeWeightsAllDefault', () => {
  it('POSITIVE CONTROL: a stamped weight means NOT all default', () => {
    expect(summarise([{ data: { weight: 0.5, weightSource: 'user' } }])).toBe(false)
  })

  it('the OLD heuristic said "not default" here — a canvas of USER_EDGE_DEFAULTS', () => {
    // `every(w => w === 0.5)` was false for 0.3, so a canvas where nobody set
    // anything was reported as carrying real values.
    expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
    expect(summarise([{ data: { ...USER_EDGE_DEFAULTS } }, { data: { ...USER_EDGE_DEFAULTS } }])).toBe(true)
  })

  it('the OLD heuristic said "all default" here — a user who chose 0.5', () => {
    expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    expect(summarise([{ data: { ...DEFAULT_EDGE_DATA, weightSource: 'user' } }])).toBe(false)
  })

  it('one set weight among many defaults is enough to say NOT all default', () => {
    expect(summarise([
      { data: { ...USER_EDGE_DEFAULTS } },
      { data: { ...USER_EDGE_DEFAULTS, weightSource: 'cee' } },
    ])).toBe(false)
  })

  it('accepts CEE back-compat evidence (strength_mean) as a real source', () => {
    expect(summarise([{ data: { ...DEFAULT_EDGE_DATA, strength_mean: 0.42 } }])).toBe(false)
  })
})
