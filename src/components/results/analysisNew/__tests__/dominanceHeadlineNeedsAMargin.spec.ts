/**
 * "<Factor> dominates the model" is a COMPARATIVE, quantitative claim, and the
 * only thing standing between it and a falsehood was `if (rec.dominantFactorLabel)`
 * — a PRESENCE check.
 *
 * ⚠ THE PRODUCER'S GUARANTEE DOES NOT REACH THIS SURFACE, AND THAT IS THE
 * WHOLE REASON THIS FILE EXISTS. PLoT's `detectDominantFactor`
 * (`plot-lite-service/src/trust/factor-dominance.ts:72-101`) decides dominance
 * on `influence_score` ALONE: rank 1 must be `> 0.5` and more than `2×` the
 * strongest OTHER row whose `influence_score` is a finite number `> 0`. Two
 * consequences it cannot see:
 *
 *   · A row carrying NO `influence_score` is filtered out of its rival scan
 *     entirely, so it can never suppress the verdict — while the UI's shared
 *     display policy (`selectDriverDisplayModel`) drops the WHOLE set onto
 *     normalised |elasticity| the moment any one row lacks that field. The
 *     number the headline asserts dominance about and the number the bars
 *     render are then two different quantities.
 *   · Nothing downstream re-checks the verdict against what the user can see.
 *
 * The sibling surface already learned this the expensive way: the dominance
 * nudge in `TriageActionCardsBody.tsx:480-491` carries its own tie gate,
 * added 2026-08-19 because it "still asserted a dominant factor on a run where
 * three factors tied at 100%". That is a witnessed production shape, not a
 * hypothetical, and this surface had no equivalent.
 *
 * ⭐ THE DISCRIMINATING PAIR IS THE POINT. A tie must go RED without the guard
 * and GREEN with it, while a genuinely dominant factor stays GREEN in BOTH —
 * otherwise the "fix" is just deleting the insight (CLAUDE.md trap 19: a test
 * that binds by a value predicate another object could satisfy proves nothing
 * about the object it names).
 */

import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { INFLUENCE_TIE_EPSILON } from '../../driverDisplayModel'
import type { DriverItem } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeDriver } from './analysisNewFixtures'

const DOMINANT_INSIGHT_ID = 'insight:dominant-factor'

const build = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

const insightIds = (data: ResultsSectionDataReturn) =>
  build(data).keyInsights.insights.map((i) => i.id)

/**
 * A driver row on the ABSOLUTE producer basis, stamped consistently.
 *
 * `resolveDriverClaimBasis` rejects a stamped pair whose value disagrees with
 * the field attesting its basis, so `influenceScore` and `displayInfluence`
 * must carry the same number — writing only one of them would make every case
 * here fail closed for a reason that has nothing to do with dominance.
 */
const producerDriver = (factorKey: string, factorLabel: string, value: number): DriverItem =>
  makeDriver({
    factorKey,
    factorLabel,
    influenceScore: value,
    displayInfluence: value,
    displayProvenance: 'influence_score',
    normalisedInfluence: value,
    rawElasticity: value,
  })

/** The producer named `namedId`; these are the rows the panel would render. */
const withDominant = (namedId: string, drivers: DriverItem[]): ResultsSectionDataReturn =>
  makeData({
    recommendation: {
      dominantFactorId: namedId,
      dominantFactorLabel: drivers.find((d) => d.factorKey === namedId)?.factorLabel ?? namedId,
    },
    drivers: { drivers, topDrivers: drivers, totalCount: drivers.length },
  })

describe('"dominates the model" may not outrun the influence distribution', () => {
  // ── The RED half of the pair ───────────────────────────────────────────────
  it('WITHHOLDS the headline when the top two factors are tied', () => {
    const data = withDominant('f_a', [
      producerDriver('f_a', 'Supplier lead time', 1),
      producerDriver('f_b', 'Demand volatility', 1),
    ])
    expect(insightIds(data)).not.toContain(DOMINANT_INSIGHT_ID)
  })

  it('WITHHOLDS the headline at a NEAR-tie inside the shared epsilon', () => {
    // Bound to the owner's constant, not to a literal another lane could move
    // underneath this file.
    const data = withDominant('f_a', [
      producerDriver('f_a', 'Supplier lead time', 1),
      producerDriver('f_b', 'Demand volatility', 1 - INFLUENCE_TIE_EPSILON / 2),
    ])
    expect(insightIds(data)).not.toContain(DOMINANT_INSIGHT_ID)
  })

  // ── The GREEN half — the insight must survive the guard ────────────────────
  it('KEEPS the headline when one factor genuinely leads', () => {
    const data = withDominant('f_a', [
      producerDriver('f_a', 'Supplier lead time', 1),
      producerDriver('f_b', 'Demand volatility', 0.3),
    ])
    const insight = build(data).keyInsights.insights.find((i) => i.id === DOMINANT_INSIGHT_ID)
    expect(insight).toBeDefined()
    // Bound by identity: the finding must be ABOUT the named factor, so a
    // guard that kept some other row's insight cannot pass this.
    expect(insight!.headline).toBe('Supplier lead time dominates the model')
    expect(insight!.targetId).toBe('f_a')
  })

  it('KEEPS the headline a hair OUTSIDE the epsilon — the guard is a margin, not a ban', () => {
    const data = withDominant('f_a', [
      producerDriver('f_a', 'Supplier lead time', 1),
      producerDriver('f_b', 'Demand volatility', 1 - INFLUENCE_TIE_EPSILON * 2),
    ])
    expect(insightIds(data)).toContain(DOMINANT_INSIGHT_ID)
  })

  it('KEEPS the headline for a SOLE factor — nothing to be tied with', () => {
    // The producer has an explicit branch for this ("Sole factor with any
    // influence: dominant by definition"), and the consumer agrees with it
    // rather than inventing a third rule.
    const data = withDominant('f_a', [producerDriver('f_a', 'Supplier lead time', 0.9)])
    expect(insightIds(data)).toContain(DOMINANT_INSIGHT_ID)
  })

  // ── The two producer forks the presence check could not see ───────────────
  it('WITHHOLDS when the named factor is NOT the leader of the displayed set', () => {
    // The identity case. `f_a` is named by the producer; `f_b` is what the
    // panel shows on top. A guard that only asked "is there a clear leader?"
    // would pass this and print a headline about the wrong factor.
    const data = withDominant('f_a', [
      producerDriver('f_a', 'Supplier lead time', 0.3),
      producerDriver('f_b', 'Demand volatility', 1),
    ])
    expect(insightIds(data)).not.toContain(DOMINANT_INSIGHT_ID)
  })

  it('WITHHOLDS when the displayed basis is SET-RELATIVE, not the producer scale', () => {
    // `normalised_elasticity` means "largest in this set", never "carries most
    // of the influence". This is the basis fork: PLoT decided on
    // `influence_score`, the panel is rendering something else entirely.
    const drivers = [
      makeDriver({
        factorKey: 'f_a',
        factorLabel: 'Supplier lead time',
        displayInfluence: 1,
        normalisedInfluence: 1,
        displayProvenance: 'normalised_elasticity',
        rawElasticity: 0.9,
      }),
      makeDriver({
        factorKey: 'f_b',
        factorLabel: 'Demand volatility',
        displayInfluence: 0.2,
        normalisedInfluence: 0.2,
        displayProvenance: 'normalised_elasticity',
        rawElasticity: 0.18,
      }),
    ]
    expect(insightIds(withDominant('f_a', drivers))).not.toContain(DOMINANT_INSIGHT_ID)
  })

  it('WITHHOLDS when there is no displayed influence distribution at all', () => {
    // "carries most of the influence HERE" is a claim about a distribution the
    // user can see. With no drivers there is nothing for it to be true of.
    const data = makeData({
      recommendation: { dominantFactorId: 'f_a', dominantFactorLabel: 'Supplier lead time' },
      drivers: { drivers: [], topDrivers: [], totalCount: 0 },
    })
    expect(insightIds(data)).not.toContain(DOMINANT_INSIGHT_ID)
  })

  // ── Positive control: this spec can SEE the surface it is asserting about ──
  it('control — the same builder does emit OTHER insights on these fixtures', () => {
    const data = makeData({
      recommendation: {
        coachingHeadline: 'What this run found',
        // An insight with no implication sentence is dropped by design, so the
        // control needs a body or it would "fire" for the wrong reason.
        coachingDecisionStatement: 'The margin holds under most of the tested range.',
        dominantFactorId: 'f_a',
        dominantFactorLabel: 'Supplier lead time',
      },
      drivers: {
        drivers: [producerDriver('f_a', 'Supplier lead time', 1), producerDriver('f_b', 'Demand volatility', 1)],
        topDrivers: [],
        totalCount: 2,
      },
    })
    const ids = insightIds(data)
    expect(ids).toContain('insight:executive-summary')
    expect(ids).not.toContain(DOMINANT_INSIGHT_ID)
  })
})
