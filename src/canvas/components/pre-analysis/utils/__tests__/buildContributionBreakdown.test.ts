/**
 * Brief 5.8A D3c — contribution-breakdown selector tests.
 *
 * Pure classifier. Confirms the three-bucket count + total invariants the
 * spectrum bar relies on, plus the unknown-source fallback behaviour
 * documented in the source file.
 */

import { describe, it, expect } from 'vitest'
import {
  buildContributionBreakdown,
  type FactorNodeLike,
} from '../buildContributionBreakdown'

const factor = (source: string | undefined, value: unknown = 0.5): FactorNodeLike => ({
  data: {
    observedState: source !== undefined ? { source, value } : { value },
  },
})

const noValueFactor: FactorNodeLike = { data: { observedState: null } }

describe('buildContributionBreakdown (Brief 5.8A D3c)', () => {
  it('returns all-zero buckets for an empty array', () => {
    expect(buildContributionBreakdown([])).toEqual({ brief: 0, estimated: 0, verified: 0, total: 0 })
  })

  it('skips factors with no observed value', () => {
    const result = buildContributionBreakdown([noValueFactor, noValueFactor])
    expect(result.total).toBe(0)
  })

  it('counts user_confirmed as verified', () => {
    const result = buildContributionBreakdown([factor('user_confirmed')])
    expect(result).toEqual({ brief: 0, estimated: 0, verified: 1, total: 1 })
  })

  it('counts user_assumption and user as verified', () => {
    const result = buildContributionBreakdown([
      factor('user_assumption'),
      factor('user'),
    ])
    expect(result.verified).toBe(2)
    expect(result.total).toBe(2)
  })

  it('counts brief_extraction as brief', () => {
    const result = buildContributionBreakdown([factor('brief_extraction')])
    expect(result.brief).toBe(1)
    expect(result.total).toBe(1)
  })

  it('counts every AI source flavour as estimated', () => {
    const result = buildContributionBreakdown([
      factor('ai'),
      factor('cee_inference'),
      factor('inferred'),
      factor('engine'),
      factor('ai_estimate'),
    ])
    expect(result.estimated).toBe(5)
    expect(result.total).toBe(5)
  })

  it('counts unknown sources as estimated (CEE-default path)', () => {
    const result = buildContributionBreakdown([factor(undefined), factor('mystery_source')])
    expect(result.estimated).toBe(2)
    expect(result.total).toBe(2)
  })

  it('classifies a mixed graph correctly', () => {
    const result = buildContributionBreakdown([
      factor('user_confirmed'),
      factor('user_confirmed'),
      factor('brief_extraction'),
      factor('ai'),
      factor('cee_inference'),
      factor('cee_inference'),
      noValueFactor,
    ])
    expect(result).toEqual({ brief: 1, estimated: 3, verified: 2, total: 6 })
  })

  it('treats a node with explicit null value as missing', () => {
    const f: FactorNodeLike = { data: { observedState: { source: 'user_confirmed', value: null } } }
    const result = buildContributionBreakdown([f])
    expect(result.total).toBe(0)
  })

  it('reads source from observed_state (snake_case) when observedState is absent', () => {
    const f: FactorNodeLike = { data: { observed_state: { source: 'user_confirmed', value: 1 } } }
    const result = buildContributionBreakdown([f])
    expect(result.verified).toBe(1)
  })
})
