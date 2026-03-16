import { describe, it, expect } from 'vitest'
import {
  _computeQuartiles as computeQuartiles,
  _getSensitivityValue as getSensitivityValue,
  _buildFragileEdgeSet as buildFragileEdgeSet,
} from '../useLensFilter'

describe('getSensitivityValue', () => {
  it('prioritises elasticity over other fields', () => {
    expect(getSensitivityValue({ elasticity: 0.8, sensitivity_score: 0.5 })).toBe(0.8)
  })

  it('falls back through sensitivity_score > sensitivity > importance_score', () => {
    expect(getSensitivityValue({ sensitivity_score: 0.6 })).toBe(0.6)
    expect(getSensitivityValue({ sensitivity: 0.4 })).toBe(0.4)
    expect(getSensitivityValue({ importance_score: 0.3 })).toBe(0.3)
  })

  it('returns 0 when all fields are missing', () => {
    expect(getSensitivityValue({})).toBe(0)
  })
})

describe('computeQuartiles', () => {
  it('computes quartile boundaries for sorted values', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    const { q25, q75 } = computeQuartiles(values)
    expect(q25).toBe(0.3) // index 2
    expect(q75).toBe(0.7) // index 6
  })

  it('handles empty array', () => {
    const { q25, q75 } = computeQuartiles([])
    expect(q25).toBe(0)
    expect(q75).toBe(0)
  })

  it('handles single value', () => {
    const { q25, q75 } = computeQuartiles([0.5])
    expect(q25).toBe(0.5)
    expect(q75).toBe(0.5)
  })
})

describe('buildFragileEdgeSet', () => {
  const graphEdges = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c' },
    { id: 'e3', source: 'c', target: 'd' },
  ]

  it('matches fragile edges by edge_id', () => {
    const fragile = [
      { edge_id: 'e1', switch_probability: 0.7 },
      { edge_id: 'e2', switch_probability: 0.5 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.has('e1')).toBe(true)
    expect(result.has('e2')).toBe(true)
    expect(result.has('e3')).toBe(false)
  })

  it('matches fragile edges by from_id/to_id when edge_id not in graph', () => {
    const fragile = [
      { edge_id: 'unknown', from_id: 'a', to_id: 'b', switch_probability: 0.6 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.has('e1')).toBe(true) // matched by source/target
  })

  it('excludes edges with switch_probability <= 0.3', () => {
    const fragile = [
      { edge_id: 'e1', switch_probability: 0.2 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.size).toBe(0)
  })

  it('handles camelCase field names', () => {
    const fragile = [
      { edgeId: 'e3', switchProbability: 0.8 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.has('e3')).toBe(true)
  })

  it('excludes edges with switch_probability exactly 0.3 (boundary)', () => {
    const fragile = [
      { edge_id: 'e1', switch_probability: 0.3 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.size).toBe(0)
  })

  it('includes edges with switch_probability just above 0.3', () => {
    const fragile = [
      { edge_id: 'e1', switch_probability: 0.31 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.has('e1')).toBe(true)
  })

  it('matches via marginalSwitchProbability (camelCase fallback)', () => {
    const fragile = [
      { edgeId: 'e2', marginalSwitchProbability: 0.65 },
    ]
    const result = buildFragileEdgeSet(fragile, graphEdges)
    expect(result.has('e2')).toBe(true)
  })

  it('returns empty set for empty fragile edges', () => {
    const result = buildFragileEdgeSet([], graphEdges)
    expect(result.size).toBe(0)
  })
})
