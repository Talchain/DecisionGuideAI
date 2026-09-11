/**
 * ⭐⭐ `unitIsDisplayable` — THE ONE ANSWER TO "DOES THIS UNIT CONTRIBUTE A WORD
 * THE READER SHOULD SEE?"
 *
 * ROADMAP 2.315(c) limb (c). The question was answered four times over before
 * this existed, each copy hand-written, and they disagreed:
 *
 *   formatGoalTarget.ts:84     `kind === 'none' || trimmed === 'count'`
 *   goalConstraintText.ts:24   `kind === 'other' && canonical !== 'count'`
 *   NodeInspector.tsx:463      `unitStr && unitStr !== 'count'`
 *   model-tab/utils.ts:57      `GENERIC_PLACEHOLDER_UNITS` — which omits 'count'
 *   model-tab-v2/adapters.ts   no answer at all → "800,000 count" at a reader
 *
 * ⚠ TWO QUESTIONS THAT LOOK LIKE ONE, AND MUST NOT BE COLLAPSED (trap 21).
 * `GENERIC_PLACEHOLDER_UNITS` answers "is this value on a normalised /
 * qualitative scale?" — roughly twenty consumers read it to decide ×100
 * scaling, qualitative words ("very high"), editor seeding and calibration
 * gating. `unitIsDisplayable` answers "does the word print?". They overlap but
 * are not the same set: `count` is a real magnitude on a real scale AND a word
 * that must not print. The overlap is DECLARED and asserted below rather than
 * discovered.
 */

import { describe, it, expect } from 'vitest'
import {
  unitIsDisplayable,
  BARE_MAGNITUDE_UNITS,
  GENERIC_PLACEHOLDER_UNITS,
  COUNT_UNITS,
  classifyUnit,
} from '../unitClassifier'

describe('unitIsDisplayable', () => {
  // ── FALSE: units that name no real-world scale ────────────────────────────
  it('is false for the "count" sentinel CEE mints for a plain number of things', () => {
    expect(unitIsDisplayable('count')).toBe(false)
  })

  it('normalises case and whitespace, as the producer is not guaranteed to', () => {
    for (const spelling of ['Count', 'COUNT', '  count  ', ' CoUnT ']) {
      expect(unitIsDisplayable(spelling), spelling).toBe(false)
    }
  })

  it('is false when there is no unit at all', () => {
    for (const absent of [null, undefined, '', '   ']) {
      expect(unitIsDisplayable(absent), JSON.stringify(absent)).toBe(false)
    }
  })

  it.each([...GENERIC_PLACEHOLDER_UNITS])(
    'is false for the generic placeholder "%s"',
    unit => {
      expect(unitIsDisplayable(unit)).toBe(false)
    },
  )

  // ── TRUE: the opposite-direction twin ─────────────────────────────────────
  it.each(['£', '$', '€', '¥'])('is true for the currency symbol %s', unit => {
    expect(unitIsDisplayable(unit)).toBe(true)
  })

  it.each(['USD', 'GBP', 'chf', 'kr', 'R$'])('is true for the ISO code %s', unit => {
    expect(unitIsDisplayable(unit)).toBe(true)
  })

  it.each(['%', 'percent', 'percentage'])('is true for the percent spelling %s', unit => {
    expect(unitIsDisplayable(unit)).toBe(true)
  })

  it.each(['months', 'customers', 'engineers', 'FTE', 'days', 'tonnes'])(
    'is true for the real unit %s',
    unit => {
      expect(unitIsDisplayable(unit)).toBe(true)
    },
  )

  // ── THE SET SEPARATION, DECLARED RATHER THAN DISCOVERED ───────────────────
  it('BARE_MAGNITUDE_UNITS and GENERIC_PLACEHOLDER_UNITS are disjoint', () => {
    /**
     * They answer different questions, so a spelling in both would mean one of
     * them is wrong. In particular `count` must stay OUT of the placeholder
     * set: its ~20 consumers would then treat a 0.8 count as a normalised
     * magnitude and render it as the qualitative word "very high".
     */
    for (const unit of BARE_MAGNITUDE_UNITS) {
      expect(GENERIC_PLACEHOLDER_UNITS.has(unit), `${unit} is in both sets`).toBe(false)
    }
  })

  it('adding a bare-magnitude spelling did NOT move its unit class', () => {
    // The guard on the semantic blast radius: `count` is still classified
    // 'other', so nothing that branches on `kind === 'placeholder'` changes.
    expect(classifyUnit('count').kind).toBe('other')
    expect(classifyUnit('count').canonical).toBe('count')
  })

  it('every COUNT_UNITS member stays displayable — that set is about ROUNDING', () => {
    /**
     * Contrast control, and a third question kept apart from the first two:
     * COUNT_UNITS ('customers', 'engineers', …) decides whole-number rounding,
     * not visibility. "500 customers" must keep its word. If this ever REDs,
     * a rounding concern has leaked into a display decision.
     */
    expect(COUNT_UNITS.size).toBeGreaterThan(0)
    for (const unit of COUNT_UNITS) {
      expect(unitIsDisplayable(unit), unit).toBe(true)
    }
  })

  it('the suppressed class is exactly none ∪ placeholder ∪ bare-magnitude', () => {
    /**
     * A union assertion rather than a re-listing: it fails loud if a future
     * edit suppresses a class it was not meant to (e.g. all of `other`), which
     * is the mirror defect of the one being fixed.
     */
    const suppressed = ['', 'count', ...GENERIC_PLACEHOLDER_UNITS]
    const shown = ['£', 'USD', '%', 'percent', 'months', 'customers', 'FTE']
    expect(suppressed.every(u => !unitIsDisplayable(u))).toBe(true)
    expect(shown.every(u => unitIsDisplayable(u))).toBe(true)
    // Non-vacuity: both arms must be populated.
    expect(suppressed.length).toBeGreaterThan(1)
    expect(shown.length).toBeGreaterThan(1)
  })
})
