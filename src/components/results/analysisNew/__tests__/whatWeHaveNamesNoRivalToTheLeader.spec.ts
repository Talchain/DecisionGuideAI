/**
 * ⭐ "WHAT WE HAVE" NAMES NO RIVAL TO THE PRODUCER'S LEADER.
 *
 * Witnessed 25 Sep 2026 03:07Z. Build: local #1978 + bundle 3 + #1983, CEE
 * `21e3b38`, OpenAI. Run: Paul's hiring brief, starting point approved, then
 * Run.
 * - The producer PERMITTED a leader: "Hire Two Developers" (42% win share,
 *   `decision_brief` "slightly ahead", `leading_option_id`).
 * - The highest expected value was a different option: "Hire Lead Then
 *   Developer" (mean 0.0588 against 0.0507).
 * - With no target, "Move towards commitment" led with "What we have: In this
 *   model, Hire Lead Then Developer has the highest expected outcome: +6%".
 *   The chart's order and the chat both named Two Developers, and the glance
 *   named no option at all.
 *
 * Both readings are true. Stated alone, the expected-value one reads as the
 * answer and contradicts the leader. Where the two point at different options,
 * the first bullet says so, in the diverged state's reviewed lead.
 */
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis } from '../commitmentSynthesis'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/** genuineDecision (producer leader `opt_b`, permitted, no target) with expected values set. */
function withExpected(data: ResultsSectionDataReturn, a: number, b: number): ResultsSectionDataReturn {
  const rec = data.recommendation as { allOptions?: Array<{ id: string }> }
  const allOptions = (rec.allOptions ?? []).map((o) => ({ ...o, expected: o.id === 'opt_a' ? a : b }))
  return { ...data, recommendation: { ...data.recommendation, allOptions } } as ResultsSectionDataReturn
}

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'h' })

describe('"What we have" and the producer\'s leader', () => {
  it('PRECONDITION: the fixture\'s producer leader is opt_b, permitted, with no target', () => {
    const rec = genuineDecision().recommendation as { verdict?: { leaderId?: string }; leaderDesignationPermitted?: boolean; goalThreshold?: unknown }
    expect(rec.verdict?.leaderId).toBe('opt_b')
    expect(rec.leaderDesignationPermitted).toBe(true)
    expect(rec.goalThreshold ?? null).toBeNull()
  })

  it('⭐ the highest expected value is ANOTHER option → the first bullet states the divergence, naming neither', () => {
    const vm = vmOf(withExpected(genuineDecision(), 12, 6))
    expect(vm.modelImplication.kind).toBe('needs_target')
    expect(vm.modelImplication).toMatchObject({ outcome: { optionId: 'opt_a' }, leaderIsAnotherOption: true })
    const founded = buildCommitmentSynthesis(vm).founded
    expect(founded?.text).toBe(COPY.implications.divergedLead)
    expect(founded?.text).not.toContain('Hold price')
  })

  it('OPPOSITE CONTROL: the highest expected value IS the leader → the outcome claim stands', () => {
    const vm = vmOf(withExpected(genuineDecision(), 6, 12))
    expect(vm.modelImplication).toMatchObject({ kind: 'needs_target', outcome: { optionId: 'opt_b' } })
    expect('leaderIsAnotherOption' in vm.modelImplication).toBe(false)
    expect(buildCommitmentSynthesis(vm).founded?.text).toContain('Raise price')
  })

  it('CONTROL: a withheld leader is not a reading to diverge from (the bullet is silent, as before)', () => {
    const vm = vmOf(withExpected(decisionWithLeaderWithheld(), 12, 6))
    expect(buildCommitmentSynthesis(vm).founded).toBeNull()
  })
})
