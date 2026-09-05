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

  it('an UNRECOGNISED level is not silently re-derived from the numeric', () => {
    // The producer said something we do not understand. Falling through to the
    // stability number here would let an unknown vocabulary quietly acquire our
    // meaning — so an unrecognised level is a refusal, even when a numeric that
    // WOULD hedge sits beside it.
    expect(
      leaderRobustnessGrade(withRobustness({ level: 'catastrophic', recommendation_stability: 0.05 })),
    ).toBeNull()
  })

  // ── NUMERIC FALLBACK, for the runs where PLoT omits `level` ───────────────
  it('a low numeric stability stands in when the level is absent', () => {
    expect(leaderRobustnessGrade(withRobustness({ recommendation_stability: 0.2 }))?.level)
      .toMatch(/^(low|very_low)$/)
  })

  it('TWIN — a high numeric stability yields null', () => {
    expect(leaderRobustnessGrade(withRobustness({ recommendation_stability: 0.95 }))).toBeNull()
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a numeric string', '0.2'],
  ])('TWIN — a non-finite stability (%s) yields null rather than a coerced grade', (_n, stability) => {
    expect(leaderRobustnessGrade(withRobustness({ recommendation_stability: stability }))).toBeNull()
  })

  it('the explicit level WINS over a disagreeing numeric', () => {
    // Precondition pinned in-test: the numeric alone WOULD hedge. So this case
    // is provably about precedence and not about a fixture that hedges nothing.
    expect(leaderRobustnessGrade(withRobustness({ recommendation_stability: 0.05 }))).not.toBeNull()
    expect(leaderRobustnessGrade(withRobustness({ level: 'high', recommendation_stability: 0.05 }))).toBeNull()
  })

  it('every returned grade carries a non-empty title naming what it qualifies', () => {
    for (const level of ['low', 'very_low'] as const) {
      const grade = leaderRobustnessGrade(withRobustness({ level }))
      expect(grade?.title).toMatch(/flip/i)
      expect(grade?.label.length).toBeGreaterThan(0)
    }
  })
})
