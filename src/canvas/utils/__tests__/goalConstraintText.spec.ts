import { describe, expect, it } from 'vitest'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'
import { goalConstraintText } from '../goalConstraintText'

const constraint: CEEGoalConstraint = {
  label: 'Budget',
  operator: '<=',
  value: 50000,
  unit: '£',
}

describe('goalConstraintText provenance', () => {
  it.each([
    ['inferred', 'Budget ≤ £50,000 · Inferred limit'],
    ['proxy', 'Budget ≤ £50,000 · Proxy limit'],
    ['explicit', 'Budget ≤ £50,000'],
    [undefined, 'Budget ≤ £50,000'],
  ] as const)('states %s origin without inventing verification', (provenance, expected) => {
    expect(goalConstraintText({ ...constraint, provenance })).toBe(expected)
  })

  it('retains an inferred origin when the limit value was not captured', () => {
    expect(goalConstraintText({ ...constraint, value: Number.NaN, provenance: 'inferred' }))
      .toBe('Budget · limit not captured · Inferred limit')
  })

  it('does not let confidence or computed probability turn a proxy into an explicit limit', () => {
    expect(goalConstraintText({ ...constraint, provenance: 'proxy', confidence: 1, probability: 1 }))
      .toBe('Budget ≤ £50,000 · Proxy limit')
  })
})
