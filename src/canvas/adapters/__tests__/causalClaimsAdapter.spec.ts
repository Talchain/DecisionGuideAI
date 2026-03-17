/**
 * Contract-style tests for causalClaimsAdapter — extraction + normalisation.
 * Phase 2A: Causal claims.
 */

import { describe, it, expect, vi } from 'vitest'
import { extractCausalClaims, claimTypeLabel } from '../causalClaimsAdapter'

describe('extractCausalClaims', () => {
  it('returns empty array for null/undefined', () => {
    expect(extractCausalClaims(null)).toEqual([])
    expect(extractCausalClaims(undefined)).toEqual([])
  })

  it('returns empty array when no causal_claims field', () => {
    expect(extractCausalClaims({ weight: 0.5 })).toEqual([])
  })

  it('extracts claims from snake_case field (canonical)', () => {
    const claims = extractCausalClaims({
      causal_claims: [
        { claim_type: 'empirical', statement: 'Studies show X causes Y', source: 'Smith 2023' },
        { claim_type: 'theoretical', statement: 'Theory predicts X→Y' },
      ],
    })
    expect(claims).toHaveLength(2)
    expect(claims[0].claim_type).toBe('empirical')
    expect(claims[0].statement).toBe('Studies show X causes Y')
    expect(claims[0].source).toBe('Smith 2023')
    expect(claims[1].source).toBeUndefined()
  })

  it('extracts claims from camelCase fallback and logs warning in dev', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const claims = extractCausalClaims({
      causalClaims: [
        { claim_type: 'mechanistic', statement: 'Mechanism A drives B' },
      ],
    })

    expect(claims).toHaveLength(1)
    expect(claims[0].claim_type).toBe('mechanistic')
    // Dev warning should be logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('camelCase "causalClaims"'),
    )

    warnSpy.mockRestore()
  })

  it('prefers snake_case over camelCase when both present', () => {
    const claims = extractCausalClaims({
      causal_claims: [{ claim_type: 'a', statement: 'from snake' }],
      causalClaims: [{ claim_type: 'b', statement: 'from camel' }],
    })
    expect(claims).toHaveLength(1)
    expect(claims[0].statement).toBe('from snake')
  })

  it('skips malformed items gracefully', () => {
    const claims = extractCausalClaims({
      causal_claims: [
        null,
        42,
        { claim_type: 'valid', statement: 'OK' },
        { claim_type: 'missing_statement' },
        { statement: 'missing_type' },
        { claim_type: '', statement: '' },
      ],
    })
    // Only the valid one passes (non-empty claim_type and statement)
    expect(claims).toHaveLength(1)
    expect(claims[0].statement).toBe('OK')
  })

  it('normalises claimType (camelCase) to claim_type (snake_case)', () => {
    const claims = extractCausalClaims({
      causal_claims: [
        { claimType: 'empirical', statement: 'Test' },
      ],
    })
    expect(claims).toHaveLength(1)
    expect(claims[0].claim_type).toBe('empirical')
  })

  it('handles non-array causal_claims gracefully', () => {
    expect(extractCausalClaims({ causal_claims: 'not an array' })).toEqual([])
    expect(extractCausalClaims({ causal_claims: 42 })).toEqual([])
    expect(extractCausalClaims({ causal_claims: {} })).toEqual([])
  })
})

describe('claimTypeLabel', () => {
  it('returns capitalised label for known types', () => {
    expect(claimTypeLabel('empirical')).toBe('Empirical')
    expect(claimTypeLabel('theoretical')).toBe('Theoretical')
    expect(claimTypeLabel('mechanistic')).toBe('Mechanistic')
    expect(claimTypeLabel('definitional')).toBe('Definitional')
    expect(claimTypeLabel('hypothesised')).toBe('Hypothesised')
  })

  it('is case-insensitive', () => {
    expect(claimTypeLabel('EMPIRICAL')).toBe('Empirical')
    expect(claimTypeLabel('Theoretical')).toBe('Theoretical')
  })

  it('returns raw value for unknown types', () => {
    expect(claimTypeLabel('custom_type')).toBe('custom_type')
  })
})
