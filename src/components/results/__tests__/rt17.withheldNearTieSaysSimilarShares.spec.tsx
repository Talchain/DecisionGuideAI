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
 * Run-4 judge (DL 12 Oct, the class): the footer's "not assessed" words are removed and nothing replaces them — in that
 * state the triage footer's leader row is NOT DRAWN. The Analysis surface keeps its `leader_not_assessed` code.
 * The withheld SEMANTICS stay: `checks.leaderWithheld` is still true, so the withhold cause and the commitment
 * block's bullet still fire.
 * Run-4 judge, round 2 (DL 12 Oct, the class, as refined): the triage footer is a RESULTS surface, so the
 * similar-shares line is removed there too and nothing replaces it — the footer draws no leader row in any state. The
 * Analysis "What we checked" list is a REASONING surface: share of runs may stay there as supporting detail, so its
 * `leader_similar_shares` / `leader_not_assessed` codes are unchanged and still pinned below.
 *
 * d5's mutants are the twins below: on the Analysis list, the similar line on a gap ≥ 10 → RED; the figures gate
 * ignored → RED. The footer is pinned absent in all three of d5's states.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import { makeLeaderClaimData } from '../__fixtures__/leaderClaim.fixtures'
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'

const SIMILAR = 'In this model, the options were supported by similar shares of runs'

/** A withheld leader (CEE stripped the near-tie identity): separation unknown, the gap still measured. */
const withheld = (gapPp: number, mode: PermittedAnalysisMode) => {
  const verdict: DecisionVerdict = { leaderId: 'opt_a', separation: 'unknown', hasLeadingOption: false, gapPp, source: 'none' }
  return makeLeaderClaimData({ verdict, leaderDesignationPermitted: false, mode })
}

/**
 * The removed states: the footer itself and its robustness row render (positive control), the leader row inside it does
 * not. Returns the whole footer's text for the negatives that used to read the row.
 */
const footerLeaderRowAbsent = (data: ReturnType<typeof withheld>): string => {
  render(<TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />)
  const el = screen.getByTestId('t1-checks-footer')
  expect(screen.getByTestId('checks-robust')).toBeTruthy()
  expect(screen.queryByTestId('checks-winner')).toBeNull()
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}
const checks = (data: ReturnType<typeof withheld>) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false }).checks

describe('RT-17: a withheld near tie, figures licensed, 1 pt apart', () => {
  it('the footer (Results) draws no leader row — the similar-shares line is removed', () => {
    // Run-4 judge (DL 12 Oct, the class): "similar shares of runs" is removed from the footer; nothing replaces it.
    expect(footerLeaderRowAbsent(withheld(1, 'quantified_provisional'))).not.toContain(SIMILAR)
  })
  it('the Analysis leader row (Reasoning: supporting detail) still says the shares were similar, and the run is STILL withheld (cause + bullet keep firing)', () => {
    const c = checks(withheld(1, 'quantified_provisional'))
    expect(c.items.find((i) => i.id === 'leader')?.code).toBe('leader_similar_shares')
    expect(c.leaderWithheld).toBe(true)
  })
})

describe("RT-17 twins (d5's mutants)", () => {
  it('a withheld gap of 10 or more stays not assessed on Analysis — the similar line is never said of a separated run; no footer row', () => {
    const data = withheld(12, 'quantified_provisional')
    // Run-4 judge (DL 12 Oct, the class): the footer's leader row is removed (Results); nothing replaces it. The
    // Analysis list (Reasoning) keeps its `leader_not_assessed` code.
    expect(footerLeaderRowAbsent(data)).not.toContain(SIMILAR)
    const c = checks(data)
    expect(c.items.find((i) => i.id === 'leader')?.code).toBe('leader_not_assessed')
    expect(c.leaderWithheld).toBe(true)
  })
  it('figures NOT licensed (exploratory) → not assessed on Analysis, even 1 pt apart; no footer row', () => {
    const data = withheld(1, 'exploratory')
    // Run-4 judge (DL 12 Oct, the class): the footer's leader row is removed (Results); nothing replaces it. The
    // Analysis list (Reasoning) keeps its `leader_not_assessed` code.
    expect(footerLeaderRowAbsent(data)).not.toContain(SIMILAR)
    const c = checks(data)
    expect(c.items.find((i) => i.id === 'leader')?.code).toBe('leader_not_assessed')
    expect(c.leaderWithheld).toBe(true)
  })
})

describe('RT-17: the leader check never speaks of a goal chance', () => {
  // Run-4 judge (DL 12 Oct, the class): in every state the row is removed; nothing replaces it, so no row can speak of a
  // goal chance. The whole footer is still swept.
  it('withheld near tie', () => {
    expect(footerLeaderRowAbsent(withheld(1, 'quantified_provisional'))).not.toMatch(/most likely|\bchance\b|\blikely\b/i)
  })
  it.each([
    ['withheld, separated', withheld(12, 'quantified_provisional')],
    ['withheld, figures refused', withheld(1, 'exploratory')],
  ] as const)('%s', (_n, data) => {
    footerLeaderRowAbsent(data)
  })
})
