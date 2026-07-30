/**
 * Regression tests for fragileEdgeMatch utilities.
 * Covers isEdgeFragile and getFragileEdgeSwitchProbability with edge_id,
 * source/target fallback, threshold boundary, and camelCase field aliases.
 */

import { describe, it, expect } from 'vitest'
import { isEdgeFragile, getFragileEdgeSwitchProbability, isTopFragileEdge, type FragileEdgeCandidate } from '../fragileEdgeMatch'

const ABOVE = 0.42
const AT_THRESHOLD = 0.15 // Spec Section 6.3: threshold = 0.15
const BELOW = 0.14

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

// ─── Presence branch (schemas 0.30.0; marginal-quantity honesty batch) ──────
//
// getFragileEdgeSwitchProbability is a DISPLAY accessor: its value renders as
// "NN% flip risk" (EdgePanel context + tech disclosure) and "Sensitive · NN%"
// (StyledEdge badge/popover). switch_probability ABSENT means NOT COMPUTED,
// and marginal_switch_probability is a DIFFERENT Monte Carlo — never a
// fallback for a rendered number. The MATCHING tier (isEdgeFragile /
// isTopFragileEdge) deliberately keeps marginal eligibility — that is
// visibility, not a displayed quantity (rowed follow-up).

describe('getFragileEdgeSwitchProbability — presence branch on the MEASURED quantity', () => {
  it('PIN: a marginal-only entry yields NO display value (never the marginal substitute)', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', marginal_switch_probability: 0.42 }]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeNull()
  })

  it('PIN: a camelCase marginal-only entry yields NO display value either', () => {
    const fragile: FragileEdgeCandidate[] = [{ edgeId: 'e1', marginalSwitchProbability: 0.42 }]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeNull()
  })

  it('CONTROL: a measured value renders, never displaced by a larger marginal', () => {
    const fragile: FragileEdgeCandidate[] = [
      { edge_id: 'e1', switch_probability: 0.42, marginal_switch_probability: 0.99 },
    ]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeCloseTo(0.42)
  })

  it('CONTROL: a measured 0 is a measurement below the floor — null, and never falls through to marginal', () => {
    const fragile: FragileEdgeCandidate[] = [
      { edge_id: 'e1', switch_probability: 0, marginal_switch_probability: 0.9 },
    ]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeNull()
  })

  it('CONTROL: the camelCase MEASURED shape still renders', () => {
    const fragile: FragileEdgeCandidate[] = [{ edgeId: 'e1', switchProbability: 0.42 }]
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeCloseTo(0.42)
  })
})

// ---------------------------------------------------------------------------
// QA Brief G-series — fragile edge threshold boundary cases
// ---------------------------------------------------------------------------

describe('fragileEdgeMatch — QA Brief G-series boundary cases', () => {
  // G5: switch_probability=0.15 → NOT fragile (strictly >0.15, spec Section 6.3)
  it('G5: switch_probability=0.15 is NOT treated as fragile (boundary)', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: 0.15 }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(false)
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeNull()
  })

  // G6: switch_probability=0.16 → fragile
  it('G6: switch_probability=0.16 IS treated as fragile', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: 0.16 }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(true)
    expect(getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)).toBeCloseTo(0.16)
  })

  // G4: Non-fragile edge (below threshold) — not treated as fragile
  it('G4: switch_probability=0.1 is not fragile', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: 0.1 }]
    expect(isEdgeFragile('e1', 'a', 'b', fragile)).toBe(false)
  })

  // G1: Actual fragile edge badge shows correct percentage
  it('G1: switch_probability=0.42 returns 0.42 for display', () => {
    const fragile: FragileEdgeCandidate[] = [{ edge_id: 'e1', switch_probability: 0.42 }]
    const prob = getFragileEdgeSwitchProbability('e1', 'a', 'b', fragile)
    expect(prob).toBeCloseTo(0.42)
    // Display would be Math.round(0.42 * 100) = 42%
    expect(Math.round((prob ?? 0) * 100)).toBe(42)
  })
})

describe('isTopFragileEdge — E4 single default-view fragility badge', () => {
  const set: FragileEdgeCandidate[] = [
    { edge_id: 'e1', switch_probability: 0.35 },
    { edge_id: 'e2', switch_probability: 0.62 },
    { edge_id: 'e3', switch_probability: 0.4 },
  ]

  it('is true only for the highest-switch-probability fragile edge', () => {
    expect(isTopFragileEdge('e2', 'a', 'b', set)).toBe(true)
    expect(isTopFragileEdge('e1', 'a', 'b', set)).toBe(false)
    expect(isTopFragileEdge('e3', 'a', 'b', set)).toBe(false)
  })

  it('ignores entries below the visibility floor when picking the top', () => {
    const withBelowFloor: FragileEdgeCandidate[] = [
      { edge_id: 'e1', switch_probability: 0.9 } as FragileEdgeCandidate, // below floor? no — 0.9 is above
    ]
    // A single above-floor entry is the top.
    expect(isTopFragileEdge('e1', 'a', 'b', withBelowFloor)).toBe(true)
    // An edge that is only below-floor is never the top.
    expect(isTopFragileEdge('e9', 'x', 'y', [{ edge_id: 'e9', switch_probability: 0.1 }])).toBe(false)
  })

  it('returns false when nothing is fragile above the floor', () => {
    expect(isTopFragileEdge('e1', 'a', 'b', [])).toBe(false)
    expect(isTopFragileEdge('e1', 'a', 'b', [{ edge_id: 'e1', switch_probability: 0.05 }])).toBe(false)
  })

  it('matches by source/target pair when edge_id is absent', () => {
    const bySrcTgt: FragileEdgeCandidate[] = [
      { from_id: 'a', to_id: 'b', switch_probability: 0.7 },
      { from_id: 'c', to_id: 'd', switch_probability: 0.5 },
    ]
    expect(isTopFragileEdge('anyid', 'a', 'b', bySrcTgt)).toBe(true)
    expect(isTopFragileEdge('anyid', 'c', 'd', bySrcTgt)).toBe(false)
  })
})

