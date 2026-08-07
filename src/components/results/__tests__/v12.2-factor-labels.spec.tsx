/**
 * V12.2 Fix 5: Factor label resolution in humaniseCritique.
 *
 * The former "Fix 3" describe block (4 mounts) was DELETED, not ported, when
 * the dead `ChallengeSection` wrapper was removed. Its subject was
 * `ChallengeSection`'s own `resolveFactorLabel` + `ChallengeCard` — a THIRD
 * independent id-prettifying fallback (noted as such in
 * tests/contracts/cee-rendering-claims.contract.test.tsx) that had zero
 * production mounts and died with the component. It never exercised
 * `FragileEdgeGroupCard`: none of the four mounts passed `fragileEdges` at
 * all. The live id→label surfaces (useResultsSectionData, humaniseCritique)
 * keep their own coverage, including everything below.
 */

import { describe, it, expect } from 'vitest'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { UncertaintyItem } from '../types'

// ─── Fix 5: Constraint investigate items name the factor ───────────────────

describe('Fix 5: Constraint investigate items name the factor', () => {
  it('CONSTRAINT_TARGET_NO_OBSERVED_VALUE uses factor label in title', () => {
    const nodeLabels = new Map([
      ['fac_customer_churn', 'Customer Churn Rate'],
    ])

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'constraint_fac_customer_churn_max has no observed_state.value set',
      affectedNodes: ['fac_customer_churn'],
      factorId: 'fac_customer_churn',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    expect(result.title).toBe('Customer Churn Rate has no estimate set')
    expect(result.title).not.toContain('This factor')
    expect(result.factorId).toBe('fac_customer_churn')
  })

  it('CONSTRAINT_MISSING_RANGE uses factor label in title', () => {
    const nodeLabels = new Map([
      ['fac_revenue_target', 'Revenue Target'],
    ])

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_MISSING_RANGE',
      message: 'constraint range missing',
      affectedNodes: ['fac_revenue_target'],
      factorId: 'fac_revenue_target',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    expect(result.title).toBe('Revenue Target is missing a range for its constraint')
    expect(result.title).not.toContain('This factor')
  })

  it('derives factor label from ID when not in nodeLabels map', () => {
    const nodeLabels = new Map()  // Empty map

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'No observed value',
      affectedNodes: ['fac_market_penetration'],
      factorId: 'fac_market_penetration',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    // Should derive: fac_market_penetration → Market Penetration
    expect(result.title).toBe('Market Penetration has no estimate set')
    expect(result.title).not.toContain('This factor')
    expect(result.title).not.toContain('fac_')
  })

  it('falls back to "This factor" when no affectedNodes', () => {
    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'No observed value',
      affectedNodes: undefined,
      voi: 0,
    }

    const result = humaniseCritique(item)

    expect(result.title).toBe('This factor has no estimate set')
  })

  it('derives correct labels for various factor ID patterns', () => {
    const testCases = [
      { id: 'fac_customer_acquisition_cost', expected: 'Customer Acquisition Cost' },
      { id: 'fac_churn', expected: 'Churn' },
      { id: 'fac_ltv', expected: 'Ltv' },
      { id: 'fac_sales_cycle_length', expected: 'Sales Cycle Length' },
      { id: 'revenue_target', expected: 'Revenue Target' },  // No fac_ prefix
    ]

    testCases.forEach(({ id, expected }) => {
      const item: UncertaintyItem = {
        code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
        message: 'test',
        affectedNodes: [id],
        factorId: id,
        voi: 0,
      }

      const result = humaniseCritique(item)
      expect(result.title).toBe(`${expected} has no estimate set`)
    })
  })
})
