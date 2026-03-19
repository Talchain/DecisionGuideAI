/**
 * Regression tests for fragileEdgeMatch utilities.
 * Covers isEdgeFragile and getFragileEdgeSwitchProbability with edge_id,
 * source/target fallback, threshold boundary, and camelCase field aliases.
 */

import { describe, it, expect } from 'vitest'
import { isEdgeFragile, getFragileEdgeSwitchProbability, type FragileEdgeCandidate } from '../fragileEdgeMatch'

const ABOVE = 0.42
const AT_THRESHOLD = 0.3
const BELOW = 0.29

describe('isEdgeFragile', () => {
  it('matches by edge_id when above threshold', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: ABOVE }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(true)
  })

  it('returns false when switch_probability is exactly at threshold (0.3)', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: AT_THRESHOLD }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(false)
  })

  it('returns false when switch_probability is below threshold', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: BELOW }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(false)
  })

  it('falls back to source/target matching when edge_id is absent', () => {
    const fragile: FragileEdgeCandidate[] = [{ source: 'n1', target: 'n2', switch_probability: ABOVE }]
    expect(isEdgeFragile('any-id', 'n1', 'n2', fragile)).toBe(true)
  })

  it('returns false when source/target pair does not match', () => {
    const fragile: FragileEdgeCandidate[] = [{ source: 'n1', target: 'n2', switch_probability: ABOVE }]
    expect(isEdgeFragile('any-id', 'n1', 'n3', fragile)).toBe(false)
  })

  it('supports camelCase edgeId alias', () => {
    const fragile: FragileEdgeCandidate[] = [{ edgeId: 'e2', switchProbability: ABOVE }]
    expect(isEdgeFragile('e2', 'a', 'b', fragile)).toBe(true)
  })

  it('supports marginal_switch_probability alias', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e3', marginal_switch_probability: ABOVE }]
    expect(isEdgeFragile('e3', 'a', 'b', fragile)).toBe(true)
  })

  it('returns false for empty array', () => {
    expect(isEdgeFragile('e1', 'a', 'b', [])).toBe(false)
  })
})

describe('getFragileEdgeSwitchProbability', () => {
  it('returns the switch probability when matched by edge_id', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: ABOVE }]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeCloseTo(ABOVE)
  })

  it('returns null when edge_id not found and source/target do not match', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: ABOVE }]
    expect(getFragileEdgeSwitchProbability('e99', 'x', 'y', fragile)).toBeNull()
  })

  it('returns null when switch_probability is at threshold', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: AT_THRESHOLD }]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeNull()
  })

  it('falls back to source/target when edge_id absent', () => {
    const fragile: FragileEdgeCandidate[] = [{ from_id: 'n1', to_id: 'n2', switch_probability: ABOVE }]
    expect(getFragileEdgeSwitchProbability('any', 'n1', 'n2', fragile)).toBeCloseTo(ABOVE)
  })

  it('returns null for empty array', () => {
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', [])).toBeNull()
  })
})
