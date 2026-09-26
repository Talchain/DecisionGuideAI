/**
 * ⭐ A WITHHELD RUN SAYS WHICH CHECK FAILED — where the producer typed it.
 *
 * Paul's manual test `1a298d6d` (25 Sep 2026, scenario `cbd15f83`): the run
 * withheld its recommendation (`constraint_verdict_withheld`) and carried
 * `CONSTRAINT_TARGET_UNRELIABLE` — his churn limit could not be scored. The
 * Reasoning tab's "Still open" bullet said only that Olumi's checks do not
 * support putting one option forward, and named no cause.
 *
 * The corpus below is NOT authored here: it is the run's `inference_warnings`
 * copied verbatim from the debug export (`olumi-debug-1a298d6d-20260925.json`,
 * `payloads.cee_response.blocks[0].enrichment.inference_warnings`).
 *
 * Bound by IDENTITY to the canvas's own selector, so the tab and the canvas
 * cannot drift into two authorities on which codes withhold a recommendation.
 */
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { selectWithheldLeaderDisclosureFromWarnings } from '../../../../canvas/nodes/withheldLeaderDisclosure'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const PAUL_1A298D6D_WARNINGS = [
  {
    "code": "CONSTRAINT_TARGET_UNRELIABLE",
    "message": "The target on \"Monthly churn\" can't be scored against this model: \"Monthly churn\" is calculated from the factors feeding into it, so the analysis produces a modelled change for it, not a reading on the same scale as your target. Comparing the two would report a near-zero chance for every option no matter how good the options are, so goal-fit probabilities were withheld for this run rather than shown. Setting a current value for \"Monthly churn\" would not change that — it is calculated from its inputs, so it has no measured starting point of its own to anchor to. Your limit is recorded and was left unscored rather than scored against the wrong number.",
    "severity": "warning"
  },
  {
    "code": "EDGE_E_VALUE_NON_FINITE_DROPPED",
    "message": "6 edge E-value entries were omitted from edge_e_values: 6 carried no finite E-value from the analysis engine (an unflippable edge, whose current and flip means coincide, has no evidence ratio). edge_e_values is shorter because those entries could not be represented, not because they were computed empty. All other analyses are unaffected.",
    "severity": "info"
  },
  {
    "code": "CONSTRAINT_FRAME_UNSPECIFIED",
    "field": "goal_constraints[0].value_frame",
    "message": "constraint value=1.0 was supplied without goal_constraints[0].value_frame, so the frame it is expressed in is unknown. A level threshold compared against the target's change-from-origin samples yields a structurally impossible probability, so constraint_analysis is omitted rather than guessed. Stamp 'level' or 'delta'.",
    "severity": "warning"
  },
  {
    "code": "GOAL_DIRECTION_UNATTESTED",
    "field": "goal_direction",
    "message": "No objective sense was stated for the goal node, so options were ranked by largest goal value. That is an assumption, not the team's stated aim: if the goal is a quantity to reduce, or the aim is to land near a target rather than as high as possible, this ranking answers a different question. Send goal_direction to rank against the stated objective.",
    "severity": "warning"
  },
  {
    "code": "GOAL_THRESHOLD_NOT_CONVERTIBLE",
    "field": "nodes[mrr].observed_state.baseline",
    "message": "A 'level' frame requires goal node 'mrr' to carry observed_state.baseline to convert the level into the samples' frame, but it carries no observed_state at all.",
    "severity": "warning"
  },
  {
    "code": "EVPI_UNAVAILABLE",
    "field": "p_win_sensitivity",
    "message": "Win-probability sensitivity (p_win_sensitivity) was skipped: its metric is P(joint_goal) and at least one goal constraint could not be resolved into its target's sample frame. Base analysis is unaffected.",
    "severity": "warning",
    "elapsed_ms": 1022.7
  }
] as const

const withWarnings = (data: ResultsSectionDataReturn, warnings: readonly unknown[]): ResultsSectionDataReturn =>
  ({ ...data, confidence: { ...data.confidence, inferenceWarnings: warnings } }) as ResultsSectionDataReturn

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'h',
    producerLeaderWithholdReason: 'constraint_verdict_withheld',
  })

describe('a withheld run says which check failed', () => {
  const disclosure = selectWithheldLeaderDisclosureFromWarnings(PAUL_1A298D6D_WARNINGS)

  it('PRECONDITION: the captured warnings carry a withholding code the canvas selector names', () => {
    expect(disclosure?.code).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    expect(disclosure?.title.length ?? 0).toBeGreaterThan(0)
  })

  it('⭐ the "Still open" bullet states the cause AND the failed check, in that order', () => {
    const vm = vmOf(withWarnings(decisionWithLeaderWithheld(), PAUL_1A298D6D_WARNINGS))
    expect(vm.checks.leaderWithheld).toBe(true)
    expect(vm.checks.leaderWithholdDetail).toBe(disclosure!.title)
    const open = buildCommitmentSynthesis(vm).open
    const lead = vm.checks.leaderWithholdCause ?? ''
    expect(lead.length, 'the withheld sentence itself is still there').toBeGreaterThan(0)
    expect(open?.text).toBe(`${lead} ${disclosure!.title}`)
  })

  it('⛔ never the producer\'s raw message, and never the remedy that does not work on a calculated node', () => {
    const open = buildCommitmentSynthesis(vmOf(withWarnings(decisionWithLeaderWithheld(), PAUL_1A298D6D_WARNINGS))).open!.text
    expect(open).not.toContain('observed_state')
    expect(open).not.toContain('calculated from the factors')
    // Bound to the remedy's own words: since AI Quality #70 5843266323 the
    // template prescribes none (`suggestion` is ''), and "not contains ''" can
    // never pass, so the literal phrases are what this row guards.
    expect(disclosure!.suggestion).toBe('')
    expect(open).not.toContain('Set a current value')
    expect(open).not.toContain('Set a value or range')
  })

  it('CONTRAST: the same withheld run with no withholding code reads exactly as before', () => {
    const notWithholding = PAUL_1A298D6D_WARNINGS.filter((w) => w.code !== 'CONSTRAINT_TARGET_UNRELIABLE')
    const vm = vmOf(withWarnings(decisionWithLeaderWithheld(), notWithholding))
    expect(vm.checks.leaderWithholdDetail).toBeNull()
    expect(buildCommitmentSynthesis(vm).open?.text).toBe(vm.checks.leaderWithholdCause)
  })

  it('CONTRAST: a run that put an option forward states no withheld detail even with the code present', () => {
    const vm = vmOf(withWarnings(genuineDecision(), PAUL_1A298D6D_WARNINGS))
    expect(vm.checks.leaderWithheld).toBe(false)
    expect(vm.checks.leaderWithholdDetail).toBeNull()
  })
})
