/**
 * HOW MUCH OF THIS ANSWER IS STILL OPEN — the domain half.
 *
 * ⚠⚠ THIS SPEC HAS NOT BEEN RUN. The lane that wrote it was barred from running
 * any test runner, installing anything, or invoking `tsc`. Every expectation
 * below was derived by reading the implementation and the ladder it consults,
 * line by line. Treat it as an UNVERIFIED claim about behaviour until CI or a
 * later lane executes it; do not quote a passing result that nobody has seen.
 *
 * ── WHAT IS PINNED, AND WHY EACH ONE IS HERE
 * The load-bearing assertion is the REFUSAL: an unstamped spread must produce
 * `known: false`, because `USER_EDGE_DEFAULTS.strengthStd = 0.15` is fabricated
 * on every hand-drawn edge and a sentence built on it would be the product
 * inventing an uncertainty nobody stated.
 *
 * Every refusal test is paired with a CONTRAST that must SUCCEED on the same
 * value with a stamp added. Without the pair, an implementation that returned
 * `known: false` unconditionally would pass the refusal tests perfectly — and
 * that is a different, worse product (platform trap 13: an absence assertion
 * needs a positive control, and the control has to differ only in the thing
 * under test).
 *
 * ── CLAIM TYPE
 * Pure function claims. No rendering, no layout, no visibility — jsdom is not
 * involved and nothing here claims anything about what a user sees.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveStrengthSpread,
  inlineStrengthLabel,
  strengthCutsCrossed,
} from '../strengthBandSpan'
import { STRENGTH_BAND_LADDER, getStrengthLabel } from '../vocabulary'
import { resolveEdgeValueDisplay, type EdgeValueDisplay } from '../edgeValueProvenance'
import { USER_EDGE_DEFAULTS } from '../edges'

/** A stated value, with a named source. The only way to reach `known: true`. */
const stated = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'cee' })
/** A value nobody stated — what every UI default resolves to. */
const unstated: EdgeValueDisplay = { show: false, reason: 'not_set' }
const absent: EdgeValueDisplay = { show: false, reason: 'absent' }

describe('resolveStrengthSpread refuses anything nobody stated', () => {
  it('refuses when the SPREAD is not stated, however firm the strength is', () => {
    const r = resolveStrengthSpread(stated(0.55), unstated)
    expect(r.known).toBe(false)
    if (!r.known) expect(r.reason).toBe('spread_not_stated')
  })

  it('refuses when the STRENGTH is not stated, however real the spread is', () => {
    // ⭐ THE ASYMMETRY WORTH PINNING. A genuine CEE spread is not enough: both
    // ends of the interval are `magnitude ± spread`, so an unstamped magnitude
    // makes the band WORDS fabrications even though the spread is honest.
    const r = resolveStrengthSpread(unstated, stated(0.1))
    expect(r.known).toBe(false)
    if (!r.known) expect(r.reason).toBe('strength_not_stated')
  })

  it('reports the two refusals APART rather than collapsing them', () => {
    // They are different facts about the edge. A single `known: false` with no
    // reason would let a surface say the wrong true thing.
    const noStrength = resolveStrengthSpread(unstated, stated(0.1))
    const noSpread = resolveStrengthSpread(stated(0.5), unstated)
    expect(noStrength.known).toBe(false)
    expect(noSpread.known).toBe(false)
    if (!noStrength.known && !noSpread.known) {
      expect(noStrength.reason).not.toBe(noSpread.reason)
    }
  })

  it('treats an ABSENT value the same as an unstamped one', () => {
    expect(resolveStrengthSpread(stated(0.5), absent).known).toBe(false)
    expect(resolveStrengthSpread(absent, stated(0.1)).known).toBe(false)
  })

  it('refuses a NEGATIVE spread — not a tighter spread, not a quantity at all', () => {
    // `EDGE_VALUE_DOMAINS.strengthStd` is declared OPEN, so the read gate lets
    // this through; the same refusal `uncertaintyBandHalfWidth` makes.
    const r = resolveStrengthSpread(stated(0.5), stated(-0.2))
    expect(r.known).toBe(false)
    if (!r.known) expect(r.reason).toBe('not_a_spread')
  })

  /**
   * ⭐⭐ THE LOAD-BEARING CASE, bound to the REAL default object rather than to
   * a literal 0.15 — so if `USER_EDGE_DEFAULTS` changes its number this test
   * still asks the question it was written to ask. It goes through the SAME read
   * gate the panel uses; nothing here is a hand-built display.
   *
   * Note what this edge would otherwise have produced: weight 0.3, spread 0.15
   * runs 0.15 → 0.45, which crosses BOTH the 0.20 and the 0.40 cuts. The
   * ungated sentence on a freshly-drawn connection would have read "anywhere
   * from slight to strong" — maximally alarming, and entirely invented.
   */
  it('refuses a user-drawn edge carrying the unstamped UI defaults', () => {
    const data = { ...USER_EDGE_DEFAULTS } as Record<string, unknown>
    const strength = resolveEdgeValueDisplay(data, 'weight')
    const spread = resolveEdgeValueDisplay(data, 'strengthStd')
    expect(strength.show).toBe(false)
    expect(spread.show).toBe(false)
    expect(resolveStrengthSpread(strength, spread).known).toBe(false)
  })

  /** CONTRAST CONTROL: the same two numbers WITH stamps must resolve. Without
   *  this, an implementation that always refused would pass every test above. */
  it('resolves once a source stamps those same two values', () => {
    const data = {
      ...USER_EDGE_DEFAULTS,
      weightSource: 'user',
      strengthStdSource: 'user',
    } as Record<string, unknown>
    const r = resolveStrengthSpread(
      resolveEdgeValueDisplay(data, 'weight'),
      resolveEdgeValueDisplay(data, 'strengthStd'),
    )
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.magnitude).toBeCloseTo(0.3, 10)
      expect(r.spread).toBeCloseTo(0.15, 10)
    }
  })
})

describe('the band span — does the adjective survive the spread?', () => {
  it('says a tight spread inside one band does NOT cross', () => {
    // 0.55 ± 0.05 → [0.50, 0.60]. Both sit in Strong [0.40, 0.70).
    const r = resolveStrengthSpread(stated(0.55), stated(0.05))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.lowLabel).toBe('Strong')
      expect(r.highLabel).toBe('Strong')
      expect(r.crossesBand).toBe(false)
    }
  })

  it('⭐ says a spread that reaches across a cut DOES cross', () => {
    // 0.45 ± 0.10 → [0.35, 0.55]. Moderate [0.20, 0.40) → Strong [0.40, 0.70).
    const r = resolveStrengthSpread(stated(0.45), stated(0.1))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.lowLabel).toBe('Moderate')
      expect(r.highLabel).toBe('Strong')
      expect(r.crossesBand).toBe(true)
    }
  })

  it('crosses on a NEGATIVE effect exactly as it does on a positive one', () => {
    // Sign is direction, not strength. -0.45 has magnitude 0.45.
    const neg = resolveStrengthSpread(stated(-0.45), stated(0.1))
    const pos = resolveStrengthSpread(stated(0.45), stated(0.1))
    expect(neg).toEqual(pos)
  })

  it('floors the low end at zero — a magnitude cannot be negative', () => {
    const r = resolveStrengthSpread(stated(0.1), stated(0.3))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.low).toBe(0)
      expect(r.lowLabel).toBe('Slight')
    }
  })

  it('does NOT clamp the high end — a stated range is not narrowed to look tidy', () => {
    const r = resolveStrengthSpread(stated(0.9), stated(0.2))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.high).toBeCloseTo(1.1, 10)
      expect(r.highLabel).toBe('Very strong')
    }
  })

  /**
   * ⛔ THE BOUNDARY, PINNED BECAUSE IT IS WHERE AN OFF-BY-ONE WOULD LIVE.
   * `getStrengthLabel` uses `>=`, so a value exactly ON a cut belongs to the
   * band ABOVE it. An interval whose high end lands exactly on 0.40 therefore
   * DOES cross, and one whose low end lands exactly on 0.40 does not.
   */
  it('a high end landing exactly on a cut counts as crossing it', () => {
    const r = resolveStrengthSpread(stated(0.3), stated(0.1)) // [0.20, 0.40]
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.lowLabel).toBe('Moderate')
      expect(r.highLabel).toBe('Strong')
      expect(r.crossesBand).toBe(true)
    }
  })

  it('a low end landing exactly on a cut does not', () => {
    const r = resolveStrengthSpread(stated(0.5), stated(0.1)) // [0.40, 0.60]
    expect(r.known).toBe(true)
    if (r.known) expect(r.crossesBand).toBe(false)
  })

  /**
   * ⭐⭐ THE FLOAT HAZARD, PINNED AT THE VALUE THAT EXPOSED IT.
   *
   * This is not a hypothetical. Writing this spec is what caught it: the test
   * above was drafted asserting "Moderate", and reading `0.3 - 0.1` in IEEE 754
   * — `0.19999999999999998`, one ulp BELOW the 0.20 cut — showed it would have
   * failed, because the band lookup would have said "Slight".
   *
   * The consequence was a whole band of over-statement on the one surface whose
   * job is to be trustworthy about uncertainty, AND it was checkable by the
   * reader: the panel prints `0.30 ± 0.10` immediately beside the sentence, so
   * anyone doing the subtraction in their head would have caught the product
   * being wrong. `snapToCut` in the implementation is what closes it.
   *
   * This test binds to the ARITHMETIC RESULT, not to the fix's internals, so it
   * still asks the right question if the remedy is ever replaced.
   */
  it('bands the low end by the arithmetic a reader would do, not by float error', () => {
    expect(0.3 - 0.1).not.toBe(0.2) // the hazard itself, stated rather than assumed
    const r = resolveStrengthSpread(stated(0.3), stated(0.1))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.low).toBe(0.2)
      expect(r.high).toBe(0.4)
      // Not 'Slight', which is what the raw subtraction would have produced.
      expect(r.lowLabel).toBe('Moderate')
    }
  })

  it('does not disturb a value no float error touches', () => {
    // Contrast control for the snap: exact binary values must pass through
    // unchanged, or the remedy is quietly rewriting honest numbers.
    const r = resolveStrengthSpread(stated(0.5), stated(0.25))
    expect(r.known).toBe(true)
    if (r.known) {
      expect(r.low).toBe(0.25)
      expect(r.high).toBe(0.75)
      expect(r.magnitude).toBe(0.5)
      expect(r.spread).toBe(0.25)
    }
  })
})

describe('the ladder is the ONE authority, and these derive from it', () => {
  /**
   * ⭐ NOT A HAND-WRITTEN TABLE. This iterates the ladder itself, so moving a cut
   * or adding a band extends the coverage automatically instead of leaving a
   * mirror to drift — the defect class `vocabulary.ts` records happening once.
   */
  it('every interior cut is crossable, and crossing it changes the word', () => {
    for (const band of STRENGTH_BAND_LADDER) {
      if (band.min <= 0) continue
      const below = band.min - 0.01
      const above = band.min + 0.01
      expect(getStrengthLabel(below)).not.toBe(getStrengthLabel(above))
      const magnitude = band.min
      const r = resolveStrengthSpread(stated(magnitude), stated(0.01))
      expect(r.known).toBe(true)
      if (r.known) expect(r.crossesBand).toBe(true)
    }
  })

  it('counts interior cuts crossed, and never counts the floor', () => {
    // [0.15, 0.45] crosses 0.20 and 0.40, but not the 0 floor.
    const two = resolveStrengthSpread(stated(0.3), stated(0.15))
    expect(strengthCutsCrossed(two)).toBe(2)
    // Wholly inside one band.
    const none = resolveStrengthSpread(stated(0.55), stated(0.02))
    expect(strengthCutsCrossed(none)).toBe(0)
    // A refusal crosses nothing, and must not throw.
    expect(strengthCutsCrossed(resolveStrengthSpread(unstated, unstated))).toBe(0)
  })

  it('the ladder is ordered descending and floored at zero', () => {
    // Order is load-bearing: the lookup returns the FIRST band cleared.
    const mins = STRENGTH_BAND_LADDER.map(b => b.min)
    expect([...mins].sort((a, b) => b - a)).toEqual(mins)
    expect(mins[mins.length - 1]).toBe(0)
  })
})

describe('inlineStrengthLabel', () => {
  it('lowercases only the first character, for every label on the ladder', () => {
    for (const band of STRENGTH_BAND_LADDER) {
      const inline = inlineStrengthLabel(band.label)
      expect(inline).toBe(`${band.label.charAt(0).toLowerCase()}${band.label.slice(1)}`)
      // "Very strong" must become "very strong", never "very Strong".
      expect(inline.toLowerCase()).toBe(band.label.toLowerCase())
    }
  })
})
