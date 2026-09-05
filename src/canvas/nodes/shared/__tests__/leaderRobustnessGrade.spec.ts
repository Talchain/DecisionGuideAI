/**
 * THE SHARED OWNER OF "how much should you trust this leader claim".
 *
 * A pure unit suite over the helper both canvas consumers import. It exists
 * because the node suites drive React and jsdom, so they are slow and coarse;
 * the PREDICATE'S DOMAIN is cheap to enumerate here and is where the defects in
 * this class actually live (CLAUDE.md trap 22 — the invariant is usually true
 * as stated, and the breadth of the predicate is what is wrong).
 *
 * ⭐ EVERY CASE HAS ITS OPPOSITE-DIRECTION TWIN. A grade that hedges too widely
 * invents a caveat on a sound run; one that hedges too narrowly is the harm
 * this lane was opened for. They cannot share a threshold, so both directions
 * are pinned explicitly rather than inferred from one another.
 */
import { describe, it, expect } from 'vitest'

import { leaderRobustnessGrade } from '../leaderRobustnessGrade'

const withRobustness = (robustness: unknown) => ({ robustness })

describe('leaderRobustnessGrade — the hedged grades, and only those', () => {
  it('very_low yields the producer-owned "Highly sensitive"', () => {
    expect(leaderRobustnessGrade(withRobustness({ level: 'very_low' }))).toMatchObject({
      level: 'very_low',
      label: 'Highly sensitive',
    })
  })

  it('low yields "Sensitive"', () => {
    expect(leaderRobustnessGrade(withRobustness({ level: 'low' }))).toMatchObject({
      level: 'low',
      label: 'Sensitive',
    })
  })

  // ── TWINS: a sound run must never acquire a caveat ────────────────────────
  it('TWIN — high yields null', () => {
    expect(leaderRobustnessGrade(withRobustness({ level: 'high' }))).toBeNull()
  })

  it('TWIN — moderate yields null', () => {
    expect(leaderRobustnessGrade(withRobustness({ level: 'moderate' }))).toBeNull()
  })

  // ── FAIL-CLOSED: absence is "say nothing", never "invent a caveat" ────────
  it.each([
    ['null report', null],
    ['undefined report', undefined],
    ['a string', 'very_low'],
    ['no robustness block', {}],
    ['a null robustness block', withRobustness(null)],
    ['a robustness block that is a string', withRobustness('very_low')],
    ['an empty robustness block', withRobustness({})],
  ])('fail-closed on %s', (_name, report) => {
    expect(leaderRobustnessGrade(report)).toBeNull()
  })

  it('an UNRECOGNISED level is a refusal, not a fall-through', () => {
    expect(
      leaderRobustnessGrade(withRobustness({ level: 'catastrophic', recommendation_stability: 0.05 })),
    ).toBeNull()
  })

  // ── THE WITHHELD FIELD IS NEVER READ ─────────────────────────────────────
  // ⚠⚠ THESE ARE THE MOST IMPORTANT CASES IN THE FILE, and they pin the
  // ABSENCE of a behaviour the first cut of this helper actually had.
  //
  // PLoT deliberately withholds `robustness.recommendation_stability`: ISL
  // derives it as `option_wins[winner] / n_samples`, i.e. the leader's
  // `win_probability` RELABELLED, carrying "zero independent information"
  // (see `withheldFieldReadBan.spec.ts`, which REDs on a grown pin and is what
  // caught this). Grading a run from it would fabricate a robustness statistic
  // out of the very number the badge sits beside.
  //
  // So a grade is shown ONLY when the producer sent a categorical `level`.
  // These cases would all have PASSED-BY-FALLBACK before the fix and now assert
  // an honest silence instead.
  it.each([
    ['a fragile-looking numeric', 0.05],
    ['a low numeric', 0.2],
    ['a high numeric', 0.95],
    ['NaN', Number.NaN],
  ])('no `level`, only recommendation_stability (%s): stays silent', (_n, stability) => {
    expect(leaderRobustnessGrade(withRobustness({ recommendation_stability: stability }))).toBeNull()
  })

  it('the numeric cannot OVERRIDE an explicit level in either direction', () => {
    // Both directions, so neither a fabricated hedge nor a fabricated
    // reassurance can enter through the numeric.
    expect(leaderRobustnessGrade(withRobustness({ level: 'high', recommendation_stability: 0.05 }))).toBeNull()
    expect(
      leaderRobustnessGrade(withRobustness({ level: 'very_low', recommendation_stability: 0.99 })),
    ).toMatchObject({ level: 'very_low' })
  })

  it('every returned grade carries a non-empty title naming what it qualifies', () => {
    for (const level of ['low', 'very_low'] as const) {
      const grade = leaderRobustnessGrade(withRobustness({ level }))
      expect(grade?.title).toMatch(/flip/i)
      expect(grade?.label.length).toBeGreaterThan(0)
    }
  })
})
