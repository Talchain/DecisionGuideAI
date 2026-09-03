/**
 * `rowCarriesMagnitudeMetric` — and the FAIL-LOUD completeness guard for the
 * field list it depends on.
 *
 * ⚠ THIS IS THE TRAP-12 REMEDY, NOT A UNIT TEST. `MAGNITUDE_FIELDS` in
 * `driverDisplayModel.ts` is a hand-written mirror of the chain
 * `normalizeFactorSensitivity` (in `useResultsSectionData.ts`, another lane's
 * file) actually consults. A hand-maintained mirror drifts silently and the
 * drift always reads as green — so the list is checked BEHAVIOURALLY, by
 * driving the REAL feed, in both directions:
 *
 *   - EVERY listed field must genuinely be in the chain (a field removed from
 *     the chain REDs the first block);
 *   - every plausible NON-member must genuinely be absent from it (a field
 *     ADDED to the chain REDs the second block).
 *
 * ⭐ A derived guard proves agreement and can never prove completeness on its
 * own (CLAUDE.md 12d). The second block is the hand-written corpus that
 * notices the list is SHORT; neither block supersedes the other and both ship.
 */
import { describe, it, expect } from 'vitest'
import {
  rowCarriesMagnitudeMetric,
  hasMeaningfulMagnitude,
  MAGNITUDE_FIELD_NAMES,
  MAGNITUDE_DATA_EPSILON,
} from '../driverDisplayModel'
import { selectDriverPolicyFeed } from '../useResultsSectionData'
import type { ResultsReport } from '../types'

const feedFor = (factors: Array<Record<string, unknown>>) =>
  selectDriverPolicyFeed({
    schema: 'report.v1',
    factor_sensitivity: factors,
  } as unknown as ResultsReport)

/** A magnitude value distinct from every threshold, so a hit is unambiguous. */
const PROBE = 0.5

describe('MAGNITUDE_FIELD_NAMES — completeness against the real feed', () => {
  it('the list is non-empty and is the one the policy consumes', () => {
    // A guard over an empty list would pass vacuously — assert it can fail.
    expect(MAGNITUDE_FIELD_NAMES.length).toBeGreaterThan(0)
    expect([...MAGNITUDE_FIELD_NAMES]).toEqual([
      'elasticity',
      'sensitivity_score',
      'sensitivity',
      'importance_score',
    ])
  })

  it.each([...MAGNITUDE_FIELD_NAMES])(
    'EVERY listed field really is in the feed\'s magnitude chain: %s',
    (field) => {
      const feed = feedFor([{ factor_id: 'fac_probe', [field]: PROBE }])
      expect(feed.policyRows).toHaveLength(1)
      expect(feed.policyRows[0].key).toBe('fac_probe')
      // If this field were NOT in the chain the row would fall through to the
      // terminal 0 — so a non-zero magnitude here IS the proof of membership.
      expect(feed.policyRows[0].rawElasticity).toBe(PROBE)
      expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_probe', [field]: PROBE })).toBe(true)
    },
  )

  it.each([
    // `contribution` is the sharp one: `getRawElasticity` names it in its own
    // priority chain, but the FEED normalises rows first and that normaliser's
    // chain stops at importance_score — so it never reaches the feed. If the
    // normaliser ever gains it, this REDs and the list must grow.
    'contribution',
    'impact',
    'weight',
    'magnitude',
    'effect_size',
  ])('a NON-member field really is absent from the chain: %s', (field) => {
    const feed = feedFor([{ factor_id: 'fac_probe', [field]: PROBE }])
    expect(feed.policyRows).toHaveLength(1)
    expect(feed.policyRows[0].rawElasticity).toBe(0)
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_probe', [field]: PROBE })).toBe(false)
  })
})

describe('rowCarriesMagnitudeMetric — absence fails closed, an explicit zero survives', () => {
  it('a row with no metric field at all carries none', () => {
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', label: 'Unmeasured' })).toBe(false)
  })

  it('an EXPLICIT zero in the MAGNITUDE chain is a measurement, not an absence', () => {
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', elasticity: 0 })).toBe(true)
  })

  // ⚠⚠ THESE TWO ROWS ARE THE ROUND-2 CORRECTION, AND THEY REPLACE TWO TESTS
  // THAT ASSERTED THE OPPOSITE (2026-09-04). The earlier pair — "a producer
  // influence_score alone is enough" and an `influence_score: 0` limb on the
  // explicit-zero test — encoded the function's own reading of "carries a
  // metric" rather than the consumer's question. The consumer asks: *did the
  // field that produced this row's `rawElasticity` carry data?* and
  // `influence_score` does not feed `rawElasticity` at all. The precondition
  // is pinned BEHAVIOURALLY below rather than asserted, so this is a claim
  // about the real feed and not about my reading of it.
  it('a producer influence_score is NOT a magnitude — it does not feed rawElasticity', () => {
    // PRECONDITION, driven through the real feed: the producer score lands on
    // `influenceScore`, and the magnitude falls through to the terminal 0.
    const feed = feedFor([{ factor_id: 'fac_probe', influence_score: PROBE }])
    expect(feed.policyRows).toHaveLength(1)
    expect(feed.policyRows[0].influenceScore).toBe(PROBE)
    expect(feed.policyRows[0].rawElasticity).toBe(0)
    // So the presence check must NOT license the manufactured zero.
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', influence_score: 0.4 })).toBe(false)
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', influence_score: 0 })).toBe(false)
  })

  it('CONTRAST: the same row WITH a magnitude field carries one', () => {
    // Binds the row above to the missing magnitude and not to some property of
    // `influence_score` rows generally.
    expect(
      rowCarriesMagnitudeMetric({ factor_id: 'fac_a', influence_score: 0.4, elasticity: 1.2 }),
    ).toBe(true)
  })

  it('non-finite and non-numeric values are not measurements', () => {
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', elasticity: Number.NaN })).toBe(false)
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', elasticity: Infinity })).toBe(false)
    expect(rowCarriesMagnitudeMetric({ factor_id: 'fac_a', elasticity: '0.5' })).toBe(false)
  })

  it('null, undefined and non-objects carry nothing', () => {
    expect(rowCarriesMagnitudeMetric(null)).toBe(false)
    expect(rowCarriesMagnitudeMetric(undefined)).toBe(false)
    expect(rowCarriesMagnitudeMetric(42)).toBe(false)
  })
})

describe('hasMeaningfulMagnitude — the complement of the all-zero sentinel', () => {
  it('is false exactly where computeNormalisedInfluences degenerates', () => {
    expect(hasMeaningfulMagnitude([])).toBe(false)
    expect(hasMeaningfulMagnitude([{ rawElasticity: 0 }])).toBe(false)
    expect(hasMeaningfulMagnitude([{ rawElasticity: MAGNITUDE_DATA_EPSILON / 2 }])).toBe(false)
  })

  it('is true at and above the floor', () => {
    expect(hasMeaningfulMagnitude([{ rawElasticity: MAGNITUDE_DATA_EPSILON }])).toBe(true)
    expect(hasMeaningfulMagnitude([{ rawElasticity: 0 }, { rawElasticity: 2.5 }])).toBe(true)
  })

  it('reads magnitudes, not signs, and ignores non-finite entries', () => {
    expect(hasMeaningfulMagnitude([{ rawElasticity: -2.5 }])).toBe(true)
    expect(hasMeaningfulMagnitude([{ rawElasticity: Number.NaN }])).toBe(false)
  })
})
