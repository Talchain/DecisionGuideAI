/**
 * WHAT YOUR MODEL IMPLIES — the two readings, and the entitlement that governs
 * naming an option in either of them.
 *
 * ## What this corpus establishes, and what it cannot (trap 22)
 *
 * Every fixture is built from `makeData`/`makeOption`, so the option records are
 * typed `OptionResult` and their SHAPE is the producer's, enforced by the
 * compiler rather than by my memory of it. Every expected SENTENCE is produced
 * by calling the owning module's own copy function (`HERO_COPY.headline.*`)
 * rather than by re-typing its output, so a re-wording in `heroCopy.ts` cannot
 * leave this file green against a string the product no longer prints.
 *
 * It does NOT establish that the producer emits these combinations on a live
 * run. That is bounded separately, and the honest statement about reachability
 * is recorded on `ModelImplication` in `analysisNewTypes.ts`: the outcome
 * reading is available on essentially any successful run, the goal reading
 * requires a user-set success target, and `needs_target` is therefore the state
 * that will fire most often in the field.
 *
 * ## Every assertion binds by IDENTITY
 *
 * Claims are checked with `optionId`, never with a value predicate another
 * option could satisfy — the defect that let an entire extractor be deleted
 * under 23,832 green tests (trap 19). `divergingRun` deliberately gives the two
 * options the SAME goal probability shape and different leaders on the two
 * readings, so an assertion that matched on "the option with a goal figure"
 * could not disambiguate them.
 *
 * ## ⚠ THE HALF THAT IS EASY TO FORGET
 *
 * A guard that only proves the surface SPEAKS when it may is half a guard. The
 * withholding cases below (`verdict.hasLeadingOption === false`, a tied goal
 * maximum, an incomplete goal field, a tied outcome readout, a single option)
 * are the other half, and the mutant kit includes one mutant per direction.
 */

import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { HERO_COPY } from '../../analysis-hero/heroCopy'
import { buildHeroModel } from '../../analysis-hero/buildHeroModel'
import { makeData, makeOption } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DecisionResultData } from '../../types'

const vm = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

const implicationOf = (data: ResultsSectionDataReturn) => vm(data).modelImplication

const ENTITLED = { leaderId: 'opt_a', hasLeadingOption: true } as DecisionResultData['verdict']
const WITHHELD = { leaderId: 'opt_a', hasLeadingOption: false } as DecisionResultData['verdict']

/**
 * A ranged, centred option. `p10`/`p90` are what make the OUTCOME reading
 * available at all (`rows.some(p10 != null && p90 != null)`), so every fixture
 * that expects an outcome claim must carry them.
 */
function rangedOption(
  id: string,
  label: string,
  centre: number,
  goalProbability: number | null,
) {
  return makeOption({
    id,
    label,
    expected: centre,
    p10: centre - 10,
    p50: centre,
    p90: centre + 10,
    outcome: { mean: centre, p10: centre - 10, p50: centre, p90: centre + 10 },
    ...(goalProbability === null ? {} : { goalProbability }),
    nValidSamples: 2000,
  })
}

/**
 * THE CROWN-JEWEL SHAPE. Two options; A wins the OUTCOME reading, B wins the
 * GOAL reading. This is the run the divergence line exists for.
 *
 * `goalThreshold` is the USER TARGET, and it is what makes the second reading
 * exist at all (UI-SEM-071).
 */
function divergingRun(
  overrides: Partial<DecisionResultData> = {},
): ResultsSectionDataReturn {
  const a = rangedOption('opt_a', 'Segment', 120, 0.3)
  const b = rangedOption('opt_b', 'RudderStack', 60, 0.8)
  return makeData({
    recommendation: {
      allOptions: [a, b],
      recommendedOption: a,
      goalThreshold: 100,
      verdict: ENTITLED,
      ...overrides,
    },
  })
}

describe('what your model implies — the two readings', () => {
  it('states BOTH readings and names them as DIVERGENT when they pick different options', () => {
    const result = implicationOf(divergingRun())

    expect(result.kind).toBe('diverged')
    if (result.kind !== 'diverged') throw new Error('unreachable')

    // ⚠ BOUND BY IDENTITY. Not "the claim containing 120", which the other
    // option could come to satisfy after any change to the outcome chain.
    expect(result.outcome.optionId).toBe('opt_a')
    expect(result.goal.optionId).toBe('opt_b')
  })

  it('DELEGATES both claim sentences to the hero, so the two tabs cannot drift', () => {
    const result = implicationOf(divergingRun())
    if (result.kind !== 'diverged') throw new Error('expected divergence')

    // The hero's model for the SAME data — the sentences must be the ones that
    // surface prints, not a second wording of one claim.
    const hero = buildHeroModel(divergingRun())
    if (hero.kind !== 'chart') throw new Error('expected a chart model')
    const outcomeRow = hero.rows.find((r) => r.id === 'opt_a')!
    const goalRow = hero.rows.find((r) => r.id === 'opt_b')!

    expect(result.outcome.sentence).toBe(
      HERO_COPY.headline.outcomeLeader(outcomeRow.label, outcomeRow.outcome.readout),
    )
    // `hasConstraints` is false on this fixture (no constraint analysis), so the
    // goal-alone wording is the correct one and "and limits" would be a claim
    // about a quantity the run did not measure.
    expect(hero.hasConstraints).toBe(false)
    expect(result.goal.sentence).toBe(
      HERO_COPY.headline.goalOnly(goalRow.label, goalRow.goal.readout),
    )
  })

  it('reuses selectGoalLeader TRANSITIVELY — the goal claim IS the hero crown, never a second argmax', () => {
    const data = divergingRun()
    const result = implicationOf(data)
    const hero = buildHeroModel(data)
    if (hero.kind !== 'chart') throw new Error('expected a chart model')
    if (result.kind !== 'diverged') throw new Error('expected divergence')

    // `leaders.goal` is `selectGoalLeader(...)`'s output, withheld-gated
    // (`buildHeroModel.ts:695` and `:1188`). Pinning the equality is what stops
    // a future edit quietly substituting a local argmax that does not carry the
    // complete-field, unique-max and sub-1% gates.
    expect(result.goal.optionId).toBe(hero.leaders.goal)
    expect(result.outcome.optionId).toBe(hero.leaders.outcome)
  })

  it('states AGREEMENT when one option leads both readings', () => {
    // B now wins BOTH: the highest centre and the highest goal probability.
    const a = rangedOption('opt_a', 'Segment', 60, 0.3)
    const b = rangedOption('opt_b', 'RudderStack', 120, 0.8)
    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [a, b],
          recommendedOption: b,
          goalThreshold: 100,
          verdict: ENTITLED,
        },
      }),
    )

    expect(result.kind).toBe('aligned')
    if (result.kind !== 'aligned') throw new Error('unreachable')
    expect(result.outcome.optionId).toBe('opt_b')
    expect(result.goal.optionId).toBe('opt_b')
    expect(result.label).toBe('RudderStack')
  })
})

describe('the second reading is a USER ACTION away, and the surface says so honestly', () => {
  it('offers the target UNLOCK when the goal reading is missing because no target exists', () => {
    // Same run, no `goalThreshold`. Note the options still CARRY goal
    // probabilities: UI-SEM-071 suppresses them at source precisely so a
    // synthesized target cannot open this reading.
    const result = implicationOf(divergingRun({ goalThreshold: undefined }))

    expect(result.kind).toBe('needs_target')
    if (result.kind !== 'needs_target') throw new Error('unreachable')
    // The reading it HAS is still stated — silence would be its own regression.
    expect(result.outcome.optionId).toBe('opt_a')
  })

  it('frames the target as UNLOCKING A SECOND READING, never as a missing field', () => {
    // The wording is the deliverable here: "set a success target" alone reads as
    // housekeeping, and the 30 Aug design ruled it must read as reasoning.
    expect(COPY.implications.needsTargetUnlock).toContain('second reading')
    // ⚠ AND IT PROMISES ONLY WHAT IT CAN DELIVER — "can disagree", never "will".
    // Whether the two readings diverge is not knowable before the target exists.
    expect(COPY.implications.needsTargetUnlock).toContain('can disagree')
    expect(COPY.implications.needsTargetUnlock).not.toContain('will disagree')
  })

  it('⚠ does NOT offer the unlock when a target EXISTS but the crown is unearned', () => {
    // A target IS set, and both options carry goal values — but the maximum is
    // TIED, so `selectGoalLeader` withholds. "Set a success target" here would be
    // advice the user has already followed, and a goal claim would be arbitrary.
    const a = rangedOption('opt_a', 'Segment', 120, 0.5)
    const b = rangedOption('opt_b', 'RudderStack', 60, 0.5)
    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [a, b],
          recommendedOption: a,
          goalThreshold: 100,
          verdict: ENTITLED,
        },
      }),
    )

    expect(result.kind).toBe('none')
  })

  it('⚠ does NOT offer the unlock on an INCOMPLETE goal field — a max over unmeasured rivals is not "highest"', () => {
    const a = rangedOption('opt_a', 'Segment', 120, 0.8)
    const b = rangedOption('opt_b', 'RudderStack', 60, null)
    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [a, b],
          recommendedOption: a,
          goalThreshold: 100,
          verdict: ENTITLED,
        },
      }),
    )

    // Availability (`.some`) is satisfied — A has a value — but ENTITLEMENT
    // (`.every`) is not. The two questions must not be conflated, and this is
    // the case that catches it if they ever are.
    expect(result.kind).toBe('none')
  })
})

describe('WITHHOLDING — the half a "does it speak?" test cannot see', () => {
  it('says NOTHING AT ALL on a run whose verdict withholds the leader claim', () => {
    // ROADMAP 1.267: order, ordinals and crowns are DESIGNATIONS and go. A
    // sentence naming two options is the largest designation on the surface.
    const result = implicationOf(divergingRun({ verdict: WITHHELD }))
    expect(result.kind).toBe('none')
  })

  it('says nothing when the run has a SINGLE option — a superlative over one thing is not a finding', () => {
    const only = rangedOption('opt_a', 'Segment', 120, 0.8)
    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [only],
          recommendedOption: only,
          goalThreshold: 100,
          isSingleOption: true,
          verdict: ENTITLED,
        },
      }),
    )
    expect(result.kind).toBe('none')
  })

  it('says nothing when the top options render the SAME outcome readout (UI-SEM-070)', () => {
    // The chart shows no winner, so no sentence may crown one. Identical centres
    // render identical readouts; the goal values still differ, which is what
    // makes this a test of the OUTCOME gate specifically.
    const a = rangedOption('opt_a', 'Segment', 100, 0.3)
    const b = rangedOption('opt_b', 'RudderStack', 100, 0.8)
    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [a, b],
          recommendedOption: a,
          goalThreshold: 100,
          verdict: ENTITLED,
        },
      }),
    )
    expect(result.kind).toBe('none')
  })

  it('says nothing before a run', () => {
    const result = vm(
      // Same entitled, diverging payload — only `isPreRun` differs, so this
      // pins the GATE rather than the absence of data.
      { ...divergingRun() },
    )
    expect(result.modelImplication.kind).toBe('diverged')

    const preRun = buildAnalysisNewViewModel({
      data: divergingRun(),
      recommendations: [],
      isPreRun: true,
      isRunning: false,
      isStale: false,
    })
    expect(preRun.modelImplication.kind).toBe('none')
  })
})
