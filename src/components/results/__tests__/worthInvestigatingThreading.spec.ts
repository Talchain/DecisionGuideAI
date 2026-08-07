/**
 * Producer worth_investigating threading pins (Strengthen parity, punch 1).
 *
 * The flag must reach driver rows via TWO producer paths, strictly:
 * - factor_sensitivity rows carrying worth_investigating (snake or camel);
 * - robustness.value_of_information suggestions joined by factor id.
 * STRICT read: only an explicit `true` counts — never derived from EVPI
 * locally (that would fake producer provenance in the Strengthen source line).
 */
import { describe, expect, it } from 'vitest'
import {
  buildWorthInvestigatingIdSet,
  normalizeFactorSensitivity,
} from '../useResultsSectionData'

const labels = new Map<string, string>()

describe('normalizeFactorSensitivity — worth_investigating strict read', () => {
  it('threads an explicit snake_case true', () => {
    const row = normalizeFactorSensitivity(
      { node_id: 'fac_1', label: 'Churn', worth_investigating: true },
      labels,
    )
    expect(row.worthInvestigating).toBe(true)
  })

  it('threads an explicit camelCase true (UI-side transforms)', () => {
    const row = normalizeFactorSensitivity(
      { node_id: 'fac_1', label: 'Churn', worthInvestigating: true },
      labels,
    )
    expect(row.worthInvestigating).toBe(true)
  })

  it('absent, false, and truthy-but-not-true values stay undefined (fail-closed)', () => {
    for (const value of [undefined, false, 'true', 1]) {
      const row = normalizeFactorSensitivity(
        { node_id: 'fac_1', label: 'Churn', worth_investigating: value },
        labels,
      )
      expect(row.worthInvestigating).toBeUndefined()
    }
  })

  it('never derives the flag from EVPI locally', () => {
    const row = normalizeFactorSensitivity(
      { node_id: 'fac_1', label: 'Churn', evpi_percentage_points: 40 },
      labels,
    )
    expect(row.worthInvestigating).toBeUndefined()
  })
})

describe('buildWorthInvestigatingIdSet — robustness VOI join', () => {
  it('collects node_id and parameter_id from explicitly flagged suggestions only', () => {
    const ids = buildWorthInvestigatingIdSet([
      { node_id: 'fac_1', worth_investigating: true },
      { parameter_id: 'fac_2', worth_investigating: true },
      { node_id: 'fac_3', worth_investigating: false },
      { node_id: 'fac_4' }, // absent flag — never defaulted from evpi
      { node_id: 'fac_5', evpi: 0.9 },
    ])
    expect(ids.has('fac_1')).toBe(true)
    expect(ids.has('fac_2')).toBe(true)
    expect(ids.has('fac_3')).toBe(false)
    expect(ids.has('fac_4')).toBe(false)
    expect(ids.has('fac_5')).toBe(false)
  })

  it('tolerates malformed input (non-array, junk rows)', () => {
    expect(buildWorthInvestigatingIdSet(undefined).size).toBe(0)
    expect(buildWorthInvestigatingIdSet('nope').size).toBe(0)
    expect(buildWorthInvestigatingIdSet([null, 42, { worth_investigating: true }]).size).toBe(0)
  })
})
