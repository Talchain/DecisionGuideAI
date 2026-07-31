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
