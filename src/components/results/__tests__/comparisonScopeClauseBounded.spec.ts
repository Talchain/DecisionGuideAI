/**
 * comparisonScopeClauseBounded — the excluded-options clause is BOUNDED, and
 * never reads as complete when it is not.
 *
 * ## The defect this pins (live on staging, 31 Aug 2026)
 *
 * `COMPARISON_SCOPE_COPY.excludedClause` named EVERY excluded label, with no
 * cap and no count:
 *
 *     return `${joinLabels(scope.excludedLabels)} ${verb} left out`
 *
 * Two harms, one line:
 *
 * 1. **Unbounded.** Thirty excluded options produced a thirty-name sentence
 *    under the headline number, on four mounted surfaces (`WinGauge` ×2,
 *    `OptionCards`, `AnalysisHeroPanel`, `AtAGlance`).
 *
 * 2. **Silently partial — the more serious one.** `excludedLabels` MAY BE
 *    SHORTER than `total - analysed`; the type says so in its own doc, because
 *    an option with no usable label (or one labelled with its own node id) is
 *    deliberately dropped rather than invented. The clause then named the
 *    nameable ones and said NOTHING about the rest, while reading as a complete
 *    list:
 *
 *        "Comparing 1 of your 31 options — Alpha, Bravo, Charlie, Delta and
 *         Echo were left out."
 *
 *    Thirty were left out. Nothing in the sentence signalled it was partial.
 *
 * ## The invariant, written against the SPEC and not the failure mode
 *
 * The clause must account for **`total - analysed`** — the arithmetic truth —
 * never for `excludedLabels.length`, which is a presentation input. Writing the
 * invariant against the label array would reproduce the code's own blind spot
 * (CLAUDE.md trap 13d). So every case below asserts against the MISSING COUNT.
 *
 * The two names-at-rest cases and the count-only case are the same three states
 * the surface already distinguishes; the cap is shared with the row cap in
 * `AtAGlance` so the sentence and the rows cannot name different sets.
 */
import { describe, it, expect } from 'vitest'
import {
  COMPARISON_SCOPE_COPY,
  EXCLUDED_LABEL_NAME_CAP,
  type ComparisonScope,
} from '../utils/goalAnchorCopy'

const scope = (
  analysed: number,
  total: number,
  excludedLabels: readonly string[],
): ComparisonScope => ({ analysed, total, excludedLabels })

/** Every excluded option accounted for, whether named or counted. */
function accountedFor(s: ComparisonScope, clause: string): number {
  const named = s.excludedLabels
    .slice(0, EXCLUDED_LABEL_NAME_CAP)
    .filter((l) => clause.includes(l)).length
  const others = /(\d+)\s+others?\b/.exec(clause)
  const counted = others ? Number(others[1]) : 0
  // A count-only clause ("30 were left out") names none and counts all.
  const bare = /^(\d+)\s+(?:was|were)\s+left out$/.exec(clause)
  if (bare) return Number(bare[1])
  return named + counted
}

describe('excludedClause is bounded and never reads as complete when partial', () => {
  it('names at most the shared cap, however many labels arrive', () => {
    const s = scope(1, 31, ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
    const clause = COMPARISON_SCOPE_COPY.excludedClause(s)

    // Bound: the sixth name and beyond must not appear at rest.
    expect(clause).not.toContain('Charlie')
    expect(clause).not.toContain('Delta')
    expect(clause).not.toContain('Echo')
  })

  it('accounts for EVERY missing option, not just the nameable ones', () => {
    // 30 missing, only 5 nameable — the exact shape that shipped the lie.
    const s = scope(1, 31, ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
    const clause = COMPARISON_SCOPE_COPY.excludedClause(s)

    expect(accountedFor(s, clause)).toBe(s.total - s.analysed)
  })

  it('accounts for every missing option when NONE is nameable', () => {
    const s = scope(1, 31, [])
    const clause = COMPARISON_SCOPE_COPY.excludedClause(s)

    expect(accountedFor(s, clause)).toBe(30)
    expect(clause).toBe('30 were left out')
  })

  it('stays exact — no "others" — when the names are complete', () => {
    const s = scope(2, 4, ['Alpha', 'Bravo'])
    const clause = COMPARISON_SCOPE_COPY.excludedClause(s)

    expect(clause).toBe('Alpha and Bravo were left out')
    expect(clause).not.toMatch(/others?\b/)
    expect(accountedFor(s, clause)).toBe(2)
  })

  it('keeps singular agreement for exactly one excluded option', () => {
    expect(COMPARISON_SCOPE_COPY.excludedClause(scope(3, 4, ['Alpha']))).toBe(
      'Alpha was left out',
    )
    expect(COMPARISON_SCOPE_COPY.excludedClause(scope(3, 4, []))).toBe('1 was left out')
  })

  it('says "1 other" not "1 others" when exactly one is unnamed', () => {
    // 3 missing, cap names 2, remainder is 1.
    const s = scope(1, 4, ['Alpha', 'Bravo', 'Charlie'])
    const clause = COMPARISON_SCOPE_COPY.excludedClause(s)

    expect(clause).toBe('Alpha, Bravo and 1 other were left out')
    expect(accountedFor(s, clause)).toBe(3)
  })

  it('the full sentence always carries the count, whatever the clause does', () => {
    const s = scope(1, 31, ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
    // The count is the half that is never behind a disclosure control.
    expect(COMPARISON_SCOPE_COPY.sentence(s)).toContain('Comparing 1 of your 31 options')
  })
})
