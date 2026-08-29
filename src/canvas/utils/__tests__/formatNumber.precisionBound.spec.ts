/**
 * `formatNumber` — a displayed number may not claim precision nobody has.
 *
 * ── THE DEFECT (CLASS 1, display-side: unearned precision) ──────────────────
 *
 *     export function formatNumber(n: number): string {
 *       if (Math.abs(n) >= 1000) return NUMBER_FMT.format(n)   // en-GB, bounded
 *       return String(n)                                        // RAW
 *     }
 *
 * The guard is INVERTED relative to risk. Large values — typically a user's own
 * round figure — got locale formatting; small values, which is every strength,
 * probability, ratio and rescaled coefficient, went out at full float width.
 *
 * Measured on a 104-edge corpus drawn from five dated append-only staging
 * captures: **30 of 104 shipped causal-edge means carry more than four decimal
 * places**, e.g. `0.24782608695652172`. They are minted by a rescale —
 * CEE `unified-pipeline/stages/repair/graph-enforcement.ts:257-263`
 * (`const newMean = oldMean * scale`, a raw float division) — and nothing
 * rounds them afterwards: UI ingest at `applyDraftResult.ts:98` CLAMPS but does
 * not round, so all seventeen significant figures survive to the screen.
 *
 * Seventeen figures assert a precisely-known quantity. The same estimates are
 * not stable even in their ORDERING between two independent passes (Spearman
 * rho 0.325 global, 0.077 on one brief). Unearned precision is how a soft
 * estimate acquires false authority.
 *
 * ── WHY FOUR DECIMAL PLACES, AND WHY THE OTHER BRANCH IS UNTOUCHED ──────────
 *
 * Four is the measurement's own threshold — the corpus finding is stated as
 * "more than four decimal places", so a 4dp bound removes exactly the class
 * that was measured as wrong and nothing else. It is deliberately GENEROUS: a
 * tighter bound would be the REVERSE error, rounding away a figure the user
 * genuinely supplied, and this helper's contract (see its module header) is
 * "ALREADY-DENORMALISED (raw) values" — i.e. it renders user-scale numbers as
 * often as model-derived ones.
 *
 * The `>= 1000` branch is left exactly as it was. Changing it would ADD a
 * digit (en-GB defaults to 3 fraction digits), which is the wrong direction for
 * a precision fix, and no measurement implicates it.
 *
 * ── SCOPE: THIS CHANGES HOW PRECISELY A NUMBER IS CLAIMED, NEVER WHICH ──────
 * No magnitude changes, nothing is hidden, and nothing that is stored changes.
 * Which magnitudes to display at all is a separate open question owned by
 * another lane.
 *
 * ── BINDING (CLAUDE.md trap 19) ─────────────────────────────────────────────
 * Each case binds to its own INPUT, and the inputs are chosen so no two share
 * an expected output — a value predicate satisfied by a neighbour would prove
 * nothing. The unbounded/bounded pair is asserted in the same run so a helper
 * that simply stopped rendering could not pass.
 */
import { describe, it, expect } from 'vitest'
import { formatNumber } from '../formatValueWithUnit'

describe('formatNumber — bounds claimed precision without inventing or destroying it', () => {
  it('bounds a rescaled coefficient to four decimal places', () => {
    // The exact shape measured on the staging corpus.
    expect(formatNumber(0.24782608695652172)).toBe('0.2478')
  })

  it('bounds a second, differently-valued rescaled coefficient', () => {
    // A DIFFERENT input with a DIFFERENT expected output: proves the helper is
    // rounding rather than returning a constant that happens to match above.
    expect(formatNumber(0.6147829310112233)).toBe('0.6148')
  })

  it('leaves a value that already fits well within the bound exactly as it is', () => {
    // Positive control, and the reverse-error guard: no digits are added and
    // none are taken away.
    expect(formatNumber(0.5)).toBe('0.5')
    expect(formatNumber(0.6147)).toBe('0.6147')
    expect(formatNumber(12)).toBe('12')
    expect(formatNumber(0)).toBe('0')
  })

  it('preserves the sign of a negative coefficient', () => {
    expect(formatNumber(-0.24782608695652172)).toBe('-0.2478')
  })

  it('still groups thousands, unchanged', () => {
    // The `>= 1000` branch is deliberately untouched.
    expect(formatNumber(5000)).toBe('5,000')
  })
})
