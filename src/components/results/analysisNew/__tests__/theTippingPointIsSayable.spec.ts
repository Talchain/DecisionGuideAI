/**
 * The run found a tipping point and the tab said nothing.
 *
 * Corpus is Paul's run `1dd2133d` verbatim: three `flip_thresholds` rows, one
 * `found` and two no-flip. The tab's only reader of this array was
 * `attestsNoFactorFlip` — the NEGATIVE attestation — so the one row carrying a
 * real threshold rendered nowhere.
 */
import { describe, it, expect } from 'vitest'

import { buildTippingPoints } from '../tippingPoints'

/** Verbatim from the debug export, in the shape `useResultsSectionData` emits. */
const REAL_ROWS = [
  {
    label: 'Tech Lead Presence',
    node_id: '3457913d',
    current_value: 0.6,
    flip_value: 0.9619,
    alternative_winner_label: 'Two Developers',
    flip_reason: 'found',
  },
  {
    label: 'Additional Developer Headcount',
    node_id: '634c5855',
    current_value: 1.2,
    flip_value: null,
    alternative_winner_label: undefined,
    flip_reason: 'no_effect_within_bounds',
  },
  {
    label: 'Hiring and Onboarding Cost',
    node_id: '7809def4',
    current_value: 93000,
    flip_value: null,
    alternative_winner_label: undefined,
    flip_reason: 'structurally_invariant',
  },
]

describe('buildTippingPoints', () => {
  it('states the row the producer says it found, and only that one', () => {
    const points = buildTippingPoints(REAL_ROWS)
    expect(points).toEqual([
      {
        factorLabel: 'Tech Lead Presence',
        currentValue: 0.6,
        flipValue: 0.9619,
        alternativeLabel: 'Two Developers',
        unit: '',
      },
    ])
  })

  it('gates on the producer’s reason, not on the value being present', () => {
    // `no_effect_within_bounds` means "we looked and there is none";
    // `unresolved` means "we could not look". Both carry a null value, and
    // reading the value alone would collapse them (trap 21).
    const withValueButNotFound = [
      { ...REAL_ROWS[0], flip_reason: 'unresolved' },
    ]
    expect(buildTippingPoints(withValueButNotFound)).toEqual([])
  })

  it('drops a found row that cannot be stated, rather than completing it', () => {
    const cases = [
      { ...REAL_ROWS[0], current_value: null },
      { ...REAL_ROWS[0], flip_value: null },
      { ...REAL_ROWS[0], alternative_winner_label: '' },
      { ...REAL_ROWS[0], label: '   ' },
      { ...REAL_ROWS[0], current_value: Number.NaN },
      { ...REAL_ROWS[0], flip_value: Number.POSITIVE_INFINITY },
    ]
    for (const c of cases) expect(buildTippingPoints([c])).toEqual([])
  })

  it('drops a threshold equal to where the factor already sits', () => {
    expect(buildTippingPoints([{ ...REAL_ROWS[0], flip_value: 0.6 }])).toEqual([])
  })

  it('carries the producer’s unit and never invents one', () => {
    expect(buildTippingPoints([{ ...REAL_ROWS[0], unit: '£' }])[0]!.unit).toBe('£')
    expect(buildTippingPoints([REAL_ROWS[0]])[0]!.unit).toBe('')
  })

  it('is empty, never throwing, on absence and on rubbish', () => {
    expect(buildTippingPoints(null)).toEqual([])
    expect(buildTippingPoints(undefined)).toEqual([])
    expect(buildTippingPoints([])).toEqual([])
    expect(buildTippingPoints([null as never, 7 as never, 'x' as never])).toEqual([])
  })
})
