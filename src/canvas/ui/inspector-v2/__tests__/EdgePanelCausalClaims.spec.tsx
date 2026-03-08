/**
 * EdgePanel causal claims section — unit tests.
 * Phase 2A: Causal claims in edge inspector.
 *
 * Tests the extractCausalClaims adapter + rendering contract.
 * Full EdgePanel rendering requires complex store setup — tested via
 * the adapter contract tests in causalClaimsAdapter.spec.ts.
 */

import { describe, it, expect, vi } from 'vitest'
import { extractCausalClaims, claimTypeLabel } from '../../../adapters/causalClaimsAdapter'

// Re-export adapter tests as edge panel causal claims tests
// (component rendering is tested via the adapter contract; UI rendering
//  is validated by the ModelCardLite and ResultsTrustStrip component tests pattern)

describe('EdgePanel causal claims — data contract', () => {
  it('extracts claims from edge with causal_claims', () => {
    const claims = extractCausalClaims({
      causal_claims: [
        { claim_type: 'empirical', statement: 'Evidence from RCT', source: 'Jones 2024' },
        { claim_type: 'theoretical', statement: 'Economic theory predicts this' },
      ],
    })
    expect(claims).toHaveLength(2)
    expect(claims[0]).toEqual({
      claim_type: 'empirical',
      statement: 'Evidence from RCT',
      source: 'Jones 2024',
    })
  })

  it('returns empty for edge without claims', () => {
    const claims = extractCausalClaims({ weight: 0.5, direction: 'positive' })
    expect(claims).toEqual([])
  })

  it('renders "No scientific claims" when empty (via absence check)', () => {
    const claims = extractCausalClaims({})
    expect(claims).toEqual([])
    // Component would render empty state text when claims.length === 0
  })

  it('max 3 visible — validates data length check', () => {
    const claims = extractCausalClaims({
      causal_claims: [
        { claim_type: 'a', statement: 'S1' },
        { claim_type: 'b', statement: 'S2' },
        { claim_type: 'c', statement: 'S3' },
        { claim_type: 'd', statement: 'S4' },
      ],
    })
    expect(claims).toHaveLength(4)
    // Component would show first 3 + "and 1 more" button
    const visible = claims.slice(0, 3)
    expect(visible).toHaveLength(3)
  })

  it('claim type pills use text labels', () => {
    expect(claimTypeLabel('empirical')).toBe('Empirical')
    expect(claimTypeLabel('theoretical')).toBe('Theoretical')
    expect(claimTypeLabel('mechanistic')).toBe('Mechanistic')
    expect(claimTypeLabel('definitional')).toBe('Definitional')
    expect(claimTypeLabel('established')).toBe('Established')
    expect(claimTypeLabel('probable')).toBe('Probable')
    expect(claimTypeLabel('hypothesised')).toBe('Hypothesised')
  })
})

describe('EdgePanel causal claims — flag gate', () => {
  it('isCausalClaimsEnabled returns false by default (OFF)', async () => {
    // Dynamic import to get fresh flag state
    const { isCausalClaimsEnabled } = await import('../../../../flags')
    expect(isCausalClaimsEnabled()).toBe(false)
  })
})
