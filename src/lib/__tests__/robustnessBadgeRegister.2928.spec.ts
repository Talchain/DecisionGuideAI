/**
 * ROADMAP 2.928 member (d) — ONE ROBUSTNESS BADGE REGISTER, DERIVED.
 *
 * THE STATE THIS REPLACES
 * -----------------------
 * The same four badge words lived, hand-copied, in THREE places:
 *   · `lib/stability.ts`               `getStabilityClassification().badgeLabel`
 *   · `lib/mappers/constants.ts`       `ROBUSTNESS_LEVEL_DISPLAY[*].label`
 *   · `components/results/constants.ts` `ROBUSTNESS_LEVEL_LABELS`
 * `stability.spec.ts` even names the other two in a comment explaining that
 * ROADMAP 2.580 member 3 deliberately did not touch them. That comment is the
 * tell: a register whose copies have to be remembered is CLAUDE.md trap 12 —
 * the hand-maintained mirror — and it drifts silently, in the direction that
 * always reads green.
 *
 * They agreed at `b9b1374e`. That is the point: this row is not repairing a
 * live divergence, it is removing the mechanism that produces one.
 *
 * WHAT THIS FILE GUARDS, AND WHY IT IS TWO KINDS OF GUARD (trap 12d)
 * -----------------------------------------------------------------
 * Deriving the siblings from one canonical map proves the copies AGREE. It can
 * never prove the canonical is COMPLETE — a level missing from the map is
 * invisible to every derived guard, exactly as `thousand` was invisible to the
 * magnitude-alphabet guards. So this file ships both:
 *
 *   1. AGREEMENT — iterate the canonical map; every sibling must resolve
 *      identically for every key. Adding a level extends this automatically.
 *   2. COMPLETENESS — derived from `getStabilityClassification`'s OWN
 *      behaviour, by sweeping its numeric domain and collecting the levels it
 *      actually emits. That set comes from the classifier, NOT from the map, so
 *      a level the map forgot fails here rather than passing everywhere.
 *
 * The type system carries a third: the canonical map is typed
 * `Record<RobustnessLevel, string>`, so a new union member with no label is a
 * compile error in the named typecheck gate, not a runtime surprise.
 *
 * ⚠ SCOPE, STATED SO IT IS NOT OVER-READ. This row makes the register SINGLE.
 * It does NOT re-adjudicate the WORDS. Whether "Robust" still over-claims now
 * that ROADMAP 2.580 member 3 scoped the hero family to the RANKING is a copy
 * ruling with a real argument on both sides, and it is rowed in the PR body —
 * not taken silently by a lane whose brief was the duplication.
 */

import { describe, it, expect } from 'vitest'
import {
  ROBUSTNESS_BADGE_LABELS,
  getStabilityClassification,
} from '../stability'
import { ROBUSTNESS_LEVEL_DISPLAY } from '../mappers/constants'
import { ROBUSTNESS_LEVEL_LABELS } from '../../components/results/constants'
import type { RobustnessLevel } from '../mappers/types'

/** The canonical keys, derived from the map itself — never hand-listed. */
const CANONICAL_LEVELS = Object.keys(ROBUSTNESS_BADGE_LABELS) as RobustnessLevel[]

/**
 * The levels `getStabilityClassification` can actually emit, derived by
 * sweeping its numeric domain. This is the COMPLETENESS oracle and it is
 * deliberately independent of `ROBUSTNESS_BADGE_LABELS`: a level the map
 * forgot shows up here as a key with no label.
 */
function levelsTheClassifierEmits(): Set<string> {
  const seen = new Set<string>()
  for (let v = 0; v <= 1.0001; v += 0.001) {
    const c = getStabilityClassification(Math.min(v, 1))
    if (c) seen.add(c.level)
  }
  return seen
}

describe('ROADMAP 2.928 (d) — agreement: every sibling map derives from the canonical', () => {
  it('the canonical register is non-empty (the iteration below is not vacuous)', () => {
    expect(CANONICAL_LEVELS.length).toBeGreaterThan(0)
    for (const level of CANONICAL_LEVELS) {
      expect(typeof ROBUSTNESS_BADGE_LABELS[level]).toBe('string')
      expect(ROBUSTNESS_BADGE_LABELS[level].length).toBeGreaterThan(0)
    }
  })

  it.each(CANONICAL_LEVELS.map((level) => ({ level })))(
    'ROBUSTNESS_LEVEL_DISPLAY.$level.label matches the canonical',
    ({ level }) => {
      expect(ROBUSTNESS_LEVEL_DISPLAY[level].label).toBe(ROBUSTNESS_BADGE_LABELS[level])
    },
  )

  it.each(CANONICAL_LEVELS.map((level) => ({ level })))(
    'ROBUSTNESS_LEVEL_LABELS.$level matches the canonical',
    ({ level }) => {
      expect(ROBUSTNESS_LEVEL_LABELS[level]).toBe(ROBUSTNESS_BADGE_LABELS[level])
    },
  )

  it('getStabilityClassification().badgeLabel matches the canonical at every level', () => {
    // Bound to the level the classifier itself reports — never to a numeric
    // threshold this spec re-derives, which would be a second mirror.
    for (let v = 0; v <= 1.0001; v += 0.001) {
      const c = getStabilityClassification(Math.min(v, 1))
      if (!c) continue
      expect(c.badgeLabel).toBe(ROBUSTNESS_BADGE_LABELS[c.level])
    }
  })
})

describe('ROADMAP 2.928 (d) — completeness: the canonical covers every emitted level', () => {
  it('every level the classifier emits has a canonical label', () => {
    const emitted = levelsTheClassifierEmits()
    expect(emitted.size).toBeGreaterThan(1) // the sweep discriminates
    for (const level of emitted) {
      expect(
        Object.prototype.hasOwnProperty.call(ROBUSTNESS_BADGE_LABELS, level),
        `no canonical badge label for emitted level "${level}"`,
      ).toBe(true)
    }
  })

  it('every key of every sibling map resolves through the canonical', () => {
    // The UNION assertion (trap 12d). A sibling carrying a key the canonical
    // does not know is a hand-written entry that escaped the derivation — the
    // one thing a derived guard is structurally blind to.
    const siblingKeys = new Set<string>([
      ...Object.keys(ROBUSTNESS_LEVEL_DISPLAY),
      ...Object.keys(ROBUSTNESS_LEVEL_LABELS),
    ])
    expect(siblingKeys.size).toBeGreaterThan(0)

    const canonical = new Set<string>(CANONICAL_LEVELS)
    // `medium` is a DECLARED alias of `moderate` carried by both display maps
    // for legacy producer values. It is derived from the canonical too, so it
    // is named here rather than silently tolerated.
    const ALIASES: Record<string, RobustnessLevel> = { medium: 'moderate' }

    for (const key of siblingKeys) {
      const resolved = canonical.has(key) ? key : ALIASES[key]
      expect(resolved, `sibling key "${key}" resolves to nothing canonical`).toBeDefined()
      const expected = ROBUSTNESS_BADGE_LABELS[resolved as RobustnessLevel]
      if (key in ROBUSTNESS_LEVEL_DISPLAY) {
        expect(ROBUSTNESS_LEVEL_DISPLAY[key].label).toBe(expected)
      }
      if (key in ROBUSTNESS_LEVEL_LABELS) {
        expect(ROBUSTNESS_LEVEL_LABELS[key as keyof typeof ROBUSTNESS_LEVEL_LABELS]).toBe(expected)
      }
    }
  })

  it('the `medium` alias states the same word as `moderate`, on both maps', () => {
    expect(ROBUSTNESS_LEVEL_DISPLAY.medium.label).toBe(ROBUSTNESS_BADGE_LABELS.moderate)
    expect(ROBUSTNESS_LEVEL_LABELS.medium).toBe(ROBUSTNESS_BADGE_LABELS.moderate)
  })
})

describe('ROADMAP 2.928 (d) — what this guard can and cannot prove', () => {
  /**
   * ⚠ STATED PLAINLY SO NOBODY READS MORE INTO THIS FILE THAN IT PROVES.
   *
   * These are VALUE assertions. Two identical string literals are `toBe`-equal,
   * so no test here can tell "derived from the canonical" apart from "re-typed
   * and currently identical". A guard that claimed otherwise would be exactly
   * the guarantee theatre this estate hunts.
   *
   * What makes the register SINGLE is the source: `ROBUSTNESS_LEVEL_DISPLAY`
   * and `ROBUSTNESS_LEVEL_LABELS` reference `ROBUSTNESS_BADGE_LABELS.*` rather
   * than literals. What this FILE does is narrower and still worth having —
   * it REDs the moment anyone re-types one, because the re-typed copy has to
   * differ to be worth typing, and it REDs on a level or alias that escapes the
   * register entirely. Mutation evidence for both is in the PR body.
   */
  it('the sibling labels equal the canonical at every level', () => {
    for (const level of CANONICAL_LEVELS) {
      expect(ROBUSTNESS_LEVEL_DISPLAY[level].label).toBe(ROBUSTNESS_BADGE_LABELS[level])
      expect(ROBUSTNESS_LEVEL_LABELS[level]).toBe(ROBUSTNESS_BADGE_LABELS[level])
    }
  })

  it('the COLOUR channel stays local to its map and out of the shared register', () => {
    // Colour is a per-surface display decision. Folding it into the shared
    // register would give the register a second owner and a second reason to
    // change — the way one-owner rules quietly become two.
    expect(Object.keys(ROBUSTNESS_LEVEL_DISPLAY.high)).toContain('colour')
    expect(Object.keys(ROBUSTNESS_BADGE_LABELS)).not.toContain('colour')
    for (const level of CANONICAL_LEVELS) {
      expect(typeof ROBUSTNESS_BADGE_LABELS[level]).toBe('string')
    }
  })
})
