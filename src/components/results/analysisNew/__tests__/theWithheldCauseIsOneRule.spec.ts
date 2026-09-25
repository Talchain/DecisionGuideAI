/**
 * ⭐ THE WITHHELD LEADER'S CAUSE IS ONE RULE, EXPORTED FOR EVERY SURFACE.
 *
 * Canvas asked to import the Reasoning tab's rule rather than copy it
 * (#63 5826170658): the option card states the same cause from the same
 * inputs. `withheldLeaderCause` is that rule, and the tab's own
 * `checks.leaderWithholdCause` is built from it. This spec pins the two as
 * EQUAL across every token × admission combination, so a later edit to one
 * cannot quietly diverge from the other (trap 12: no mirrors).
 */
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import {
  leaderWithholdCause,
  LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS,
  withheldLeaderCause,
} from '../analysisNewCopy'
import { decisionWithLeaderWithheld, decisionWithLeaderWithheldAndReason } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const TOKENS = ['constraint_verdict_withheld', 'unrequested_analysis_withheld', 'separation_unavailable', 'options_do_not_separate', 'an_unknown_token', null] as const

const tabCause = (data: ResultsSectionDataReturn, token: string | null) =>
  buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'h', producerLeaderWithholdReason: token,
  }).checks.leaderWithholdCause

describe('the withheld cause is one rule', () => {
  it.each(TOKENS)('⭐ token %s: the tab states exactly what the exported rule states, whether or not the admission refused', (token) => {
    // decisionWithLeaderWithheldAndReason carries a captured REFUSING admission; the other carries none.
    expect(tabCause(decisionWithLeaderWithheldAndReason(), token)).toBe(withheldLeaderCause(token, true))
    expect(tabCause(decisionWithLeaderWithheld(), token)).toBe(withheldLeaderCause(token, false))
  })

  it('⭐ a refusal NOT about estimates is handed over as false: the tab matches the rule with `false`, not `true`', () => {
    // Independent review of #1993 (5826650947): "Name at least two different
    // options" refuses the claim but asks for no estimate.
    const data = decisionWithLeaderWithheldAndReason()
    const adm = data.recommendation.analysisAdmission as unknown as { reasons: { field: string; code: string }[] }
    const nothingToCompare = {
      ...data,
      recommendation: {
        ...data.recommendation,
        analysisAdmission: {
          ...adm,
          reasons: adm.reasons.map((r) => (r.field === 'permitted_analysis_mode' ? { ...r, code: 'NOTHING_TO_COMPARE' } : r)),
        },
      },
    } as ResultsSectionDataReturn
    expect(tabCause(nothingToCompare, 'constraint_verdict_withheld')).toBe(withheldLeaderCause('constraint_verdict_withheld', false))
    expect(tabCause(nothingToCompare, 'constraint_verdict_withheld')).not.toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
  })

  it('the rule itself: the estimates cause only behind a refusing admission AND a token it can explain', () => {
    expect(withheldLeaderCause('constraint_verdict_withheld', true)).toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(withheldLeaderCause('unrequested_analysis_withheld', true)).toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(withheldLeaderCause(' constraint_verdict_withheld ', true), 'trimmed, as the token map trims').toBe(LEADER_WITHHELD_UNTIL_AN_ESTIMATE_IS_YOURS)
    expect(withheldLeaderCause('separation_unavailable', true)).toBe(leaderWithholdCause('separation_unavailable'))
    expect(withheldLeaderCause('constraint_verdict_withheld', false)).toBe(leaderWithholdCause('constraint_verdict_withheld'))
    expect(withheldLeaderCause('unrequested_analysis_withheld', false)).toBeNull()
    expect(withheldLeaderCause(null, true)).toBeNull()
  })
})
