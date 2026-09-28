/**
 * "No value yet" is said only of a node that holds NEITHER a value NOR a
 * complete range (served pricing-model, UI 11e919b6, 28 Sep 2026: the card
 * printed "Driver 1 of 1 · no value yet" above its own "Range: Very low to
 * Medium", and the Question repeated it as its evidence priority).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { holdsValueOrRange } from '../observedStateHelpers'
import { noValueDriverIds } from '../../../components/results/noValueDriverIds'
import { PRIOR_IS_UNQUANTIFIED_FIELD } from '../../domain/nodes'

// The run's own rows: the prior-only factor has no value_source, a lever carries one (the contrast the rule needs).
const feed = {
  policyRows: [{ key: 'fac_top_account_concentration' }, { key: 'fac_usage_exposure' }],
  rawFactors: [{}, { value_source: 'brief_extraction' }],
} as never

// Served shape (pricing-model starter): an external factor with a uniform prior and no observed_state.
const priorOnly = { id: 'fac_top_account_concentration', data: { kind: 'factor', category: 'external', prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6 } } }
const nothing = { id: 'fac_top_account_concentration', data: { kind: 'factor', category: 'external' } }
const unquantified = { id: 'fac_top_account_concentration', data: { kind: 'factor', category: 'external', prior: { distribution: 'uniform', range_min: 0, range_max: 1, [PRIOR_IS_UNQUANTIFIED_FIELD]: true } } }

describe('a complete range is not "no value yet"', () => {
  it('the predicate: a value or a complete range holds; an unquantified prior or nothing does not', () => {
    expect(holdsValueOrRange(priorOnly.data)).toBe(true)
    expect(holdsValueOrRange({ observedState: { value: 0.3 } })).toBe(true)
    expect(holdsValueOrRange(nothing.data)).toBe(false)
    expect(holdsValueOrRange(unquantified.data)).toBe(false)
  })

  it('served shape: the run held no value for a prior-only factor, and it is NOT flagged "no value yet"', () => {
    expect(noValueDriverIds(feed, [priorOnly]).has('fac_top_account_concentration')).toBe(false)
  })

  it('CONTROL: the same factor with no range IS flagged; an explicitly unquantified prior IS flagged', () => {
    expect(noValueDriverIds(feed, [nothing]).has('fac_top_account_concentration')).toBe(true)
    expect(noValueDriverIds(feed, [unquantified]).has('fac_top_account_concentration')).toBe(true)
  })

  it('SOURCE: every "no value yet" site asks the one owner, never hasAnyStatedValue alone', () => {
    for (const f of ['../../hooks/useNodeDisplayMetadata.ts', '../../nodes/shared/useNodeAttention.ts', '../../../components/results/noValueDriverIds.ts']) {
      const src = readFileSync(resolve(__dirname, f), 'utf8')
      expect(src, f).toMatch(/holdsValueOrRange\(/)
      expect(src, f).not.toMatch(/runHoldsNoValueFor\([^)]*\)\s*&&\s*!hasAnyStatedValue\(/)
    }
  })
})
