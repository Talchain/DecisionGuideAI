/**
 * The goal panel showed `✓ 80%` derived by averaging a constant. Full
 * measurement and the call-site comment that predicted it are in
 * `../nodeConfidenceBadge.ts`.
 */
import { describe, it, expect } from 'vitest'
import { nodeConfidenceBadgeReadout } from '../nodeConfidenceBadge'

describe('a node confidence badge needs values that vary', () => {
  it('withholds on Paul’s board — both inbound edges are exactly 0.8', () => {
    // bundle 482ec9e0: e-11 and e-14, belief_exists 0.8, source "cee".
    expect(nodeConfidenceBadgeReadout([0.8, 0.8])).toBeNull()
  })

  it('withholds a sample of one — the same claim with less behind it', () => {
    expect(nodeConfidenceBadgeReadout([0.8])).toBeNull()
  })

  it('withholds when there is nothing to average', () => {
    expect(nodeConfidenceBadgeReadout([])).toBeNull()
  })

  it('CONTRAST CONTROL — genuinely varying values still produce a badge', () => {
    // Without this the rule could be "never badge", which would pass every
    // absence assertion above while deleting a real capability.
    expect(nodeConfidenceBadgeReadout([0.9, 0.7])).toEqual({ level: 'high', value: 80 })
  })

  it('CONTRAST CONTROL — the same mean, one varying and one not', () => {
    // The discriminating pair: identical arithmetic mean, opposite verdicts.
    expect(nodeConfidenceBadgeReadout([0.6, 0.6])).toBeNull()
    expect(nodeConfidenceBadgeReadout([0.5, 0.7])).toEqual({ level: 'medium', value: 60 })
  })

  it('keeps the existing band cuts exactly — 0.7 high, 0.4 medium', () => {
    expect(nodeConfidenceBadgeReadout([0.69, 0.71])?.level).toBe('high')
    expect(nodeConfidenceBadgeReadout([0.3, 0.5])?.level).toBe('medium')
    expect(nodeConfidenceBadgeReadout([0.2, 0.5])?.level).toBe('low') // mean 0.35, just under the cut
    expect(nodeConfidenceBadgeReadout([0.1, 0.3])?.level).toBe('low')
  })

  it('refuses a non-finite input rather than rendering NaN%', () => {
    expect(nodeConfidenceBadgeReadout([0.8, Number.NaN])).toBeNull()
    expect(nodeConfidenceBadgeReadout([0.8, Number.POSITIVE_INFINITY])).toBeNull()
  })
})
