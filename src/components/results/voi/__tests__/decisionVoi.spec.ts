/**
 * decisionVoi — the reader's verdict table.
 *
 * ⭐ EVERY EXPECTATION HERE IS DERIVED FROM THE PRODUCER'S DECLARED SEMANTICS,
 * not from my reading of what the number ought to mean (CLAUDE.md trap 13c: a
 * mutant kit validates SENSITIVITY, never CORRECTNESS — a full kill-rate against
 * a self-authored oracle is a perfect score on the wrong exam). The oracle is
 * the pinned schema's own `.describe()` on `enrichment.decision_evpi`, quoted
 * below verbatim from the tarball this tree actually vendors:
 *
 *   "Absence means NOT COMPUTED — never 0. A measured 0 is a real result
 *    (nothing about this decision is worth learning) and must be preserved. The
 *    wire carries no discriminator between the two beyond key presence, so a
 *    consumer coalescing with `?? 0` converts 'we did not compute this' into
 *    'we measured that information is worthless here'."
 *
 * Read at `vendor/talchain-schemas-0.40.0.tgz` → `package/dist/boundary/
 * enrichment.js`. ⚠ NOTE THE PIN: the design doc says the UI is on `0.39.0`;
 * at this tip `package.json` pins **0.40.0**. The field, its absence rule and
 * its keep-list membership are present at 0.40.0, so the design's "zero schemas
 * change" verdict survives the correction — but the doc's SHA table is stale and
 * a lane inheriting "0.39.0" would be reading a tarball this tree does not use.
 *
 * The table below is therefore not a list of cases I imagined; it is the three
 * states that paragraph defines, plus the unreadable values the wire's
 * `z.number().nullable().optional()` admits.
 */
import { describe, expect, it } from 'vitest'
import { readDecisionVoi, type DecisionVoiVerdict } from '../decisionVoi'

describe('readDecisionVoi — the three states the contract defines', () => {
  /**
   * ⚠ WRITTEN AGAINST THE SPEC, NOT AGAINST A FAILURE MODE (trap 13d). The rows
   * are the contract's own partition — absence, measured zero, measured non-zero
   * — widened to every value class `z.number().nullable().optional()` admits at
   * the boundary, INCLUDING the ones a happy-path corpus would omit: a NEGATIVE
   * (the field is documented `>= 0` by construction, so a negative is a producer
   * violation and must not be classified as a real measurement of nothing),
   * `-0`, and the non-finite trio. A corpus that omits a value class the
   * contract admits cannot certify the code over that class.
   */
  const TABLE: ReadonlyArray<readonly [string, unknown, DecisionVoiVerdict]> = [
    // ── Absence: the contract's "NOT COMPUTED — never 0" ──────────────────
    ['undefined (key omitted — the documented absence)', undefined, 'not_computed'],
    ['null (the schema is .nullable())', null, 'not_computed'],
    ['NaN (arrived, unreadable)', NaN, 'not_computed'],
    ['Infinity', Infinity, 'not_computed'],
    ['-Infinity', -Infinity, 'not_computed'],
    // Non-numbers: `Number.isFinite` is the ES2015 STATIC and does not coerce,
    // so a numeric STRING is not a number and must not be read as one.
    ['the string "0"', '0', 'not_computed'],
    ['the string "0.5"', '0.5', 'not_computed'],
    ['an empty string', '', 'not_computed'],
    ['false', false, 'not_computed'],
    ['an object', {}, 'not_computed'],
    ['an array', [], 'not_computed'],
    // ── The measured zero: "a real result … must be preserved" ────────────
    ['0 — the measured zero', 0, 'measured_zero'],
    ['-0 — the same measured zero (field is >= 0 by construction)', -0, 'measured_zero'],
    // ── Measured non-zero ─────────────────────────────────────────────────
    ['0.044601096202867174 (a real captured value)', 0.044601096202867174, 'measured_non_zero'],
    ['0.09581049392821846 (a real captured value)', 0.09581049392821846, 'measured_non_zero'],
    ['1.75 (the honesty suite\'s wire fixture value)', 1.75, 'measured_non_zero'],
    ['Number.MIN_VALUE — tiny but measured, and NOT thresholded away', Number.MIN_VALUE, 'measured_non_zero'],
    // A producer violation (documented `>= 0`). It is still a MEASUREMENT that
    // is not zero, and the only sentence it licenses says exactly that — so
    // classifying it as non-zero is honest, while calling it `measured_zero`
    // would assert a zero nobody measured.
    ['a negative value (contract violation, still not a measured zero)', -0.5, 'measured_non_zero'],
  ]

  it.each(TABLE)('%s → %s', (_label, input, expected) => {
    expect(readDecisionVoi(input)).toBe(expected)
  })

  it('holds ZERO thresholds: no positive value is ever demoted to not_computed', () => {
    // ⭐ THE ANTI-THRESHOLD PIN. The temptation this slice must never yield to is
    // "a small positive is probably noise, so suppress it". It IS probably
    // indistinguishable from noise — which is precisely why the SENTENCE is
    // weak ("did not come back at zero") rather than why the VALUE should be
    // silenced. Silencing it would re-introduce a hand-tuned constant, and the
    // only honest floor would be a decision-level noise floor the wire does not
    // carry. A future lane that adds one must change this test deliberately.
    for (const v of [1e-300, 1e-12, 1e-6, 0.001, 0.5, 1, 1e6]) {
      expect(readDecisionVoi(v), `${v} must stay a measurement`).toBe('measured_non_zero')
    }
  })

  it('never returns a magnitude — the verdict is a closed string enum', () => {
    // Structural guarantee: there is no path by which a digit reaches the DOM
    // from this module, the same property `voiRanking.ts` gives the row family.
    const verdicts: DecisionVoiVerdict[] = [
      readDecisionVoi(0),
      readDecisionVoi(0.0446),
      readDecisionVoi(undefined),
    ]
    for (const v of verdicts) {
      expect(typeof v).toBe('string')
      expect(v).not.toMatch(/\d/)
    }
    expect(new Set(verdicts).size, 'the three inputs must produce three DISTINCT verdicts').toBe(3)
  })
})
