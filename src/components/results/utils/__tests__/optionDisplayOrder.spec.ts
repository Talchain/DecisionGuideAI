/**
 * sortOptionsForDisplay — the ONE presentation order shared by OptionCards
 * (V14.2 / WinGauge parity) and the analysis hero. Extracted verbatim from
 * OptionCards; these cases pin the extraction as behaviour-neutral
 * (check F) and the cross-surface numbering contract.
 */
import { describe, it, expect } from 'vitest'
import { sortOptionsForDisplay } from '../optionDisplayOrder'

type Opt = {
  id: string
  winProbability?: number | null
  expected?: number | null
  goalProbability?: number | null
}

const ids = (opts: readonly Opt[]) => opts.map(o => o.id)

describe('sortOptionsForDisplay', () => {
  it('orders by win probability descending when every option has one', () => {
    // Staging run: expected-value order would be the exact reverse of this —
    // the hero must land on the same ranking the option cards show.
    const options: Opt[] = [
      { id: 'opt_virtual', winProbability: 0.23, expected: 0.404 },
      { id: 'opt_hire_parttime', winProbability: 0.00325, expected: 0.084 },
      { id: 'opt_status_quo', winProbability: 0.3795, expected: -0.018 },
      { id: 'opt_hire_fulltime', winProbability: 0.38725, expected: -0.367 },
    ]
    expect(ids(sortOptionsForDisplay(options))).toEqual([
      'opt_hire_fulltime',
      'opt_status_quo',
      'opt_virtual',
      'opt_hire_parttime',
    ])
  })

  it('falls back to expected descending when ANY option has a NaN win probability (no poisoned comparator)', () => {
    // NaN passes a `!= null` check but poisons the subtraction comparator
    // (NaN ?? 0 stays NaN) — invalid coverage must use the expected order.
    const options: Opt[] = [
      { id: 'a', winProbability: 0.9, expected: 10 },
      { id: 'b', winProbability: Number.NaN, expected: 30 },
      { id: 'c', winProbability: 0.1, expected: 20 },
    ]
    expect(ids(sortOptionsForDisplay(options))).toEqual(['b', 'c', 'a'])
  })

  it('falls back to expected descending when ANY option lacks win probability (no fabricated ranking)', () => {
    const options: Opt[] = [
      { id: 'a', winProbability: 0.9, expected: 10 },
      { id: 'b', winProbability: null, expected: 30 },
      { id: 'c', winProbability: 0.1, expected: 20 },
    ]
    expect(ids(sortOptionsForDisplay(options))).toEqual(['b', 'c', 'a'])
  })

  it('uses goalProbability as the expected fallback, and -Infinity last', () => {
    const options: Opt[] = [
      { id: 'a', expected: null, goalProbability: 0.2 },
      { id: 'b', expected: null, goalProbability: 0.6 },
      { id: 'c', expected: null, goalProbability: null },
    ]
    expect(ids(sortOptionsForDisplay(options))).toEqual(['b', 'a', 'c'])
  })

  it('keeps input order on ties (stable sort — deterministic numbering)', () => {
    const options: Opt[] = [
      { id: 'first', winProbability: 0.5 },
      { id: 'second', winProbability: 0.5 },
      { id: 'third', winProbability: 0.5 },
    ]
    expect(ids(sortOptionsForDisplay(options))).toEqual(['first', 'second', 'third'])
  })

  it('does not mutate the input array and handles empty input', () => {
    const options: Opt[] = [
      { id: 'a', winProbability: 0.1 },
      { id: 'b', winProbability: 0.9 },
    ]
    const before = [...options]
    sortOptionsForDisplay(options)
    expect(options).toEqual(before)
    expect(sortOptionsForDisplay([])).toEqual([])
  })
})
