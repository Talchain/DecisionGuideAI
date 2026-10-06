/**
 * ⭐ RT-17 — A WITHHELD NEAR TIE SAYS WHAT THE SHARES SHOW, NOT "NOT ASSESSED" (red team #87 6008162592; Science d5
 * #87 6008176400).
 *
 * Served on UI f915751a / CEE 231affbe, shares 45.3 / 44.0. The hero said the results "overlap too much to tell apart";
 * the leader check said "Which option is most likely in this model: not assessed". CEE strips
 * `near_tie.top_option_id` when it withholds, so the verdict cannot call 'tied' and the row fell to "not assessed".
 *
 * d5's ruling, implemented on BOTH leader-check surfaces (triage footer + Analysis "What we checked"):
 *   · "In this model, the options were supported by similar shares of runs" ONLY when the run's comparative figures
 *     may be shown (`analysisClaimPolicy(rec).mayShowComparativeFigures`) AND the top two are within 10 pts;
 *   · a withheld gap of 10 or more stays "not assessed";
 *   · the check's labels never speak of a goal chance ("most likely").
 * The withheld SEMANTICS stay: `checks.leaderWithheld` is still true, so the withhold cause and the commitment
 * block's bullet still fire.
 *
 * d5's mutants are the twins below: the similar line on a gap ≥ 10 → RED; the figures gate ignored → RED.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import { makeLeaderClaimData } from '../__fixtures__/leaderClaim.fixtures'
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'

const SIMILAR = 'In this model, the options were supported by similar shares of runs'
const NOT_ASSESSED = 'Which option most runs supported, in this model: not assessed'

/** A withheld leader (CEE stripped the near-tie identity): separation unknown, the gap still measured. */
const withheld = (gapPp: number, mode: PermittedAnalysisMode) => {
  const verdict: DecisionVerdict = { leaderId: 'opt_a', separation: 'unknown', hasLeadingOption: false, gapPp, source: 'none' }
  return makeLeaderClaimData({ verdict, leaderDesignationPermitted: false, mode })
}

const footer = (data: ReturnType<typeof withheld>): string => {
  render(<TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />)
  return (screen.getByTestId('checks-winner').textContent ?? '').replace(/\s+/g, ' ').trim()
}
const checks = (data: ReturnType<typeof withheld>) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false }).checks

describe('RT-17: a withheld near tie, figures licensed, 1 pt apart', () => {
  it('the footer states the shares were similar', () => {
    expect(footer(withheld(1, 'quantified_provisional'))).toContain(SIMILAR)
  })
  it('the Analysis leader row says the same, and the run is STILL withheld (cause + bullet keep firing)', () => {
    const c = checks(withheld(1, 'quantified_provisional'))
    expect(c.items.find((i) => i.id === 'leader')?.code).toBe('leader_similar_shares')
    expect(c.leaderWithheld).toBe(true)
  })
})

describe("RT-17 twins (d5's mutants)", () => {
  it('a withheld gap of 10 or more stays not assessed — the similar line is never said of a separated run', () => {
    const data = withheld(12, 'quantified_provisional')
    expect(footer(data)).toContain(NOT_ASSESSED)
    expect(checks(data).items.find((i) => i.id === 'leader')?.code).toBe('leader_not_assessed')
  })
  it('figures NOT licensed (exploratory) → not assessed, even 1 pt apart', () => {
    const data = withheld(1, 'exploratory')
    expect(footer(data)).toContain(NOT_ASSESSED)
    expect(checks(data).items.find((i) => i.id === 'leader')?.code).toBe('leader_not_assessed')
  })
})

describe('RT-17: the leader check never speaks of a goal chance', () => {
  it.each([
    ['withheld near tie', withheld(1, 'quantified_provisional')],
    ['withheld, separated', withheld(12, 'quantified_provisional')],
    ['withheld, figures refused', withheld(1, 'exploratory')],
  ] as const)('%s', (_n, data) => {
    expect(footer(data)).not.toMatch(/most likely|\bchance\b|\blikely\b/i)
  })
})
