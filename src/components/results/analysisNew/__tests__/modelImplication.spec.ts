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
import { GOAL_ANCHOR_COPY } from '../../utils/goalAnchorCopy'
import { selectGoalLeader } from '../../utils/selectGoalLeader'
import { getExpectedValue } from '../../utils/getExpectedValue'
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
 * ⚠ A VERDICT CANNOT EXPRESS ENTITLEMENT ON ITS OWN. `ENTITLED` answers Q2
 * (did THIS RESULT separate the arms?) and says nothing about Q1 (does the
 * MODEL license a comparative claim at all?). `leaderDesignationPermitted` is
 * the conjunction, and `useResultsSectionData` publishes it as a SIBLING of the
 * verdict on every real run — so a fixture that sets only the verdict is not a
 * smaller version of an entitled run, it is a shape the producer never emits.
 * Spread this pair wherever a fixture means "a run entitled to name a leader".
 */
const ENTITLED_RUN = { verdict: ENTITLED, leaderDesignationPermitted: true }

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
      ...ENTITLED_RUN,
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

  it('DELEGATES the goal sentence to the SHARED anchor, so the surfaces cannot drift', () => {
    const result = implicationOf(divergingRun())
    if (result.kind !== 'diverged') throw new Error('expected divergence')

    // `GOAL_ANCHOR_COPY` is the owner the retiring hero's own copy also calls,
    // so pinning against it — rather than against a re-typed literal — is what
    // stops this file going green against wording the product no longer prints.
    expect(result.goal.sentence).toBe(
      `${GOAL_ANCHOR_COPY.headline('RudderStack', '80%', true)}.`,
    )
    // ⚠ AND IT IS THE BOTH-CASES-TRUE WORDING. The producer sends no signal to
    // tell goal-only from joint, so the possessive would be a claim the contract
    // cannot support.
    expect(result.goal.sentence).not.toContain('your goal')
  })

  it('the goal claim IS selectGoalLeader\'s crown — never a second argmax', () => {
    const data = divergingRun()
    const result = implicationOf(data)
    if (result.kind !== 'diverged') throw new Error('expected divergence')

    // Called with the SAME gates the builder passes. Pinning the equality is
    // what stops a future edit substituting a local argmax that does not carry
    // the complete-field, unique-max, user-target and sub-1% gates.
    const crown = selectGoalLeader(
      data.recommendation.allOptions ?? [],
      (o) => o.goalProbability ?? null,
      { designationsWithheld: false, hasUserTarget: true },
    )
    expect(crown).not.toBeNull()
    expect(result.goal.optionId).toBe(crown!.id)
  })

  it('⭐ an option with NO MEAN makes the outcome reading unentitled — a median is not a substitute', () => {
    /**
     * ⚠⚠ THE FIRST VERSION OF THIS TEST WAS VACUOUS, AND ITS OWN MUTANT PROVED
     * IT. It gave the option BOTH an `expected` and a divergent `p50`, so a
     * builder mutated to `getExpectedValue(o) ?? p50` never reached the
     * fallback — `??` only fires on null — and the mutant SURVIVED against a
     * test whose stated purpose was to kill it. A guard agreeing with itself
     * (trap 13b).
     *
     * The fixture that discriminates gives `opt_b` NO mean at all and a `p50`
     * large enough to WIN if it were ever consulted:
     *   · correct builder — `getExpectedValue` is null, the field is
     *     incomplete, and a maximum over an unmeasured rival cannot claim
     *     "highest", so the whole reading is withheld;
     *   · median-substituting builder — `opt_b` acquires a centre of 400,
     *     wins the reading, and the surface names it.
     * The two outcomes are `none` versus a claim about a specific option, so
     * the assertion cannot pass under both.
     */
    const a = rangedOption('opt_a', 'Segment', 120, 0.3)
    const b = rangedOption('opt_b', 'RudderStack', 60, 0.8)
    const medianOnly = {
      ...b,
      expected: null,
      outcome: { mean: null, p10: 50, p50: 400, p90: 70 },
      p50: 400,
    } as typeof b

    // PIN THE PRECONDITION IN-TEST: this option really does carry no mean, so
    // the outcome below is the code's doing and not the fixture's failure.
    expect(getExpectedValue(medianOnly)).toBeNull()
    expect(medianOnly.outcome.p50).toBe(400)

    const result = implicationOf(
      makeData({
        recommendation: {
          allOptions: [a, medianOnly],
          recommendedOption: a,
          goalThreshold: 100,
          ...ENTITLED_RUN,
        },
      }),
    )
    expect(result.kind).toBe('none')
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
          ...ENTITLED_RUN,
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
          ...ENTITLED_RUN,
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
          ...ENTITLED_RUN,
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
    // ⚠ BOTH HALVES OF THE OVERRIDE ARE REQUIRED. `divergingRun` spreads
    // `ENTITLED_RUN`, so overriding the verdict alone would leave the COMPOSED
    // answer saying "permitted" beside a verdict saying "no leader" — a shape
    // `useResultsSectionData` cannot emit (`Q1 && Q2` is false whenever Q2 is),
    // and one on which this arm would be testing the composed field rather than
    // the withholding it names.
    const result = implicationOf(divergingRun({ verdict: WITHHELD, leaderDesignationPermitted: false }))
    expect(result.kind).toBe('none')
  })

  /**
   * ⭐ THE OTHER WAY A LEADER CLAIM IS WITHHELD, and the one this file could not
   * see: Q2 PERMITS — the numbers did separate — and the MODEL refuses to
   * license a comparative claim. The surface must fall to silence on it exactly
   * as it does on a tied run.
   */
  it('says NOTHING AT ALL when the MODEL refuses while the RESULT separates', () => {
    const data = divergingRun({ leaderDesignationPermitted: false })
    expect(
      data.recommendation?.verdict?.hasLeadingOption,
      'Q2 must still be TRUE here, or this arm is testing Q2 rather than the model’s refusal',
    ).toBe(true)
    expect(implicationOf(data).kind).toBe('none')
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
          ...ENTITLED_RUN,
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
          ...ENTITLED_RUN,
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
