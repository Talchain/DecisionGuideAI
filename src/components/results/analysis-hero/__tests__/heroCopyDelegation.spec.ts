/**
 * HERO_COPY delegates to the house registers — the ONE-COPY guarantee.
 *
 * The re-anchoring (Paul's ruling, 2026-07-31) made `utils/goalAnchorCopy` the
 * single home of the A register and the comparative register. `HERO_COPY`
 * does not restate either: it calls them. This file pins that, so a future
 * edit that "helpfully" inlines one of these strings back into `heroCopy`
 * goes RED instead of quietly creating a second voice for one claim.
 *
 * ⚠ WHY THIS FILE LIVES HERE and not beside `goalAnchorCopy`. The hero module
 * is under a mount guard (`inertness.spec.ts`) that permits exactly two
 * importers of `analysis-hero/**` repo-wide. A spec in `utils/__tests__`
 * asserting this would have to import `HERO_COPY` and would REDs that guard —
 * it did, on the first draft. A claim about `heroCopy` belongs inside the
 * module that owns it; the dependency arrow then points the permitted way.
 */

import { describe, expect, it } from 'vitest'
import { HERO_COPY } from '../heroCopy'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../../utils/goalAnchorCopy'
import { FLIP_THRESHOLD_COPY } from '../../utils/flipThresholdDisplay'

const N = '72%'

describe('HERO_COPY.detail — the A register exists once', () => {
  it.each([
    ['goalFit', false, (r: string) => HERO_COPY.detail.goalFit(r)],
    ['goalFitJointBasis', true, (r: string) => HERO_COPY.detail.goalFitJointBasis(r)],
  ])('%s IS GOAL_ANCHOR_COPY.sentence(_, %s)', (_name, substituted, build) => {
    expect(build(N)).toBe(GOAL_ANCHOR_COPY.sentence(N, substituted as boolean))
  })

  it('keeps the possessive discipline the selector publishes', () => {
    expect(HERO_COPY.detail.goalFit(N).toLowerCase()).toContain('your goal')
    expect(HERO_COPY.detail.goalFitJointBasis(N).toLowerCase()).not.toContain('your goal')
  })
})

describe('HERO_COPY.headline — the A register exists once here too', () => {
  const L = 'Option A'

  /**
   * The ONE-COPY guarantee above covered `detail.*` and missed the HEADLINES,
   * which is where the same claim is loudest: `headline.goalOnly` restated
   * `GOAL_ANCHOR_COPY.headline(_, _, true)` byte-for-byte plus a full stop.
   */
  it.each([
    ['goalOnly', true, (label: string, r: string) => HERO_COPY.headline.goalOnly(label, r)],
  ])('%s IS GOAL_ANCHOR_COPY.headline(_, _, %s) plus a full stop', (_name, substituted, build) => {
    expect(build(L, N)).toBe(`${GOAL_ANCHOR_COPY.headline(L, N, substituted as boolean)}.`)
  })

  /**
   * `goalWithLimits` is the SAME SHAPE but names a third basis — goal AND
   * limits — and the register is a two-arm boolean by design ("Do not invent a
   * third A-register"). It therefore cannot delegate today. This asserts the
   * GAP rather than assuming it: if the register ever grows that arm, this
   * goes RED and the string above must delegate instead of sitting as a quiet
   * duplicate.
   */
  it('goalWithLimits cannot delegate — the register carries no goal-and-limits arm', () => {
    const withLimits = HERO_COPY.headline.goalWithLimits(L, N)
    for (const substituted of [true, false]) {
      expect(withLimits).not.toBe(`${GOAL_ANCHOR_COPY.headline(L, N, substituted)}.`)
    }
    // It is still the register's SHAPE, so a reader sees one voice.
    expect(withLimits).toMatch(/^Option A has the highest chance of .+: 72%\.$/)
  })
})

describe('HERO_COPY — the comparative register exists once', () => {
  it('detail.winChance IS the comparative sentence', () => {
    expect(HERO_COPY.detail.winChance(N)).toBe(COMPARATIVE_COPY.sentence(N))
  })

  it('the retired un-anchored wording is gone from both registers', () => {
    const all = [
      HERO_COPY.detail.winChance(N),
      HERO_COPY.detail.goalFit(N),
      HERO_COPY.detail.goalFitJointBasis(N),
      HERO_COPY.headline.mostLikelyStrongest('Option A', N),
    ].join(' ').toLowerCase()
    for (const retired of ['strongest option overall', 'strongest overall', 'win probability']) {
      expect(all).not.toContain(retired)
    }
  })
})

describe('HERO_COPY — the no-target action is not duplicated', () => {
  it('lensUnavailable.goalDefineSuccess IS the shared CTA', () => {
    expect(HERO_COPY.lensUnavailable.goalDefineSuccess).toBe(GOAL_ANCHOR_COPY.noTargetCta)
  })
})

describe('HERO_COPY.headline.mostLikelyStrongest — no magnitude, no placeholder', () => {
  /**
   * REGRESSION PIN for a defect this change introduced and an existing
   * readout-tie spec caught: with no comparative probability for the leader,
   * the builder passed the missing-value glyph INTO the sentence, producing
   * "came out ahead in — of simulated scenarios". A placeholder rendered
   * where a quantity belongs is exactly the dishonesty this whole re-anchoring
   * exists to remove.
   */
  it('drops the magnitude clause rather than printing a placeholder', () => {
    const sentence = HERO_COPY.headline.mostLikelyStrongest('Option A', null)
    expect(sentence).toBe(`Option A ${COMPARATIVE_COPY.phraseNoMagnitude}.`)
    expect(sentence).not.toContain(HERO_COPY.readout.missing)
    expect(sentence).not.toMatch(/came out ahead in\s/)
  })

  it('carries the magnitude when there is one', () => {
    expect(HERO_COPY.headline.mostLikelyStrongest('Option A', N)).toContain(N)
  })
})

describe('HERO_COPY.evidence — the flip-threshold register exists once (ROADMAP 2.291)', () => {
  /**
   * The flip sentences moved to `utils/flipThresholdDisplay` so the V7 signal
   * chip — outside this mount-guarded module — can render the same producer
   * rows with the same words. `HERO_COPY.evidence` delegates BY REFERENCE:
   * these are identity assertions, so re-inlining any of them here (a second
   * voice for one claim) goes RED even if the restated string starts out
   * byte-identical.
   */
  it.each([
    ['switchMeta'],
    ['flipRiskWithAlternative'],
    ['flipRiskNoAlternative'],
    ['fallsBelow'],
    ['risesAbove'],
    ['crosses'],
  ] as const)('%s IS the shared register member', (name) => {
    expect(HERO_COPY.evidence[name]).toBe(FLIP_THRESHOLD_COPY[name])
  })
})
