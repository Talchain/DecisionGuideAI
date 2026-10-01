/**
 * ⭐ B3 — A GOAL-FIGURE WITHHOLD APPLIES PER OPTION × CLAIM, NEVER PER RUN (52f8cd #85 5931020890; CEE B2 contract).
 *
 * Before B3 the mapper stripped EVERY option's outcome, spread, downside and share on ANY `GOAL_FIGURES_*` warning,
 * so a run where PLoT computed every option read "Analysis finished without a result". B2 says who a warning covers
 * (`option_ids`) and what it withholds (`withheld_claims`); absent keys keep today's behaviour exactly.
 */
import { describe, it, expect } from 'vitest'
import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import { mapV5Blocks } from '../blocks/mapV5Blocks'
import { hasRenderableAnalysisResult } from '../../canvas/ui/inspector-v2/useAnalysisResults'
import { readGoalFigureWithholds, withheldClaimsFor } from '../../components/results/utils/goalIdentityWithheld'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

const MSG = "Not shown. Olumi can't give each option's figures for this goal from this run."
const entry = (id: string, wp: number, mean: number) => ({
  id, option_id: id, label: id, option_label: id, status: 'computed', win_probability: wp, expected_outcome: mean,
  probability_of_goal: 0.4, probability_of_joint_goal: 0.3,
  outcome: { mean, p10: mean - 2000, p50: mean, p90: mean + 2000 }, downside: { cvar_10: mean - 3000, p05: mean - 2500, expected_regret: 500 },
})
const block = (warning: Record<string, unknown> | null) => ({
  type: 'analysis_result', summary: 's', leading_option_id: 'a',
  win_probabilities: { a: 0.5, b: 0.3, c: 0.2 },
  enrichment: {
    option_comparison: [entry('a', 0.5, 30000), entry('b', 0.3, 20000), entry('c', 0.2, 10000)],
    robustness: { recommended_option_id: 'a' },
    ...(warning ? { inference_warnings: [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', message: MSG, ...warning }] } : {}),
  },
})
type Row = { win_probability?: number; expected?: number; downside?: unknown; goalIdentityWithheld?: true; probability_of_joint_goal?: number; outcome?: { p10?: number | null; p90?: number | null } }
const report = (w: Record<string, unknown> | null) => mapV5AnalysisToReport(block(w) as unknown as AnalysisResultBlock) as unknown as {
  option_probabilities: Record<string, Row>; option_comparison?: Array<{ option_id: string; outcome?: unknown; expected_outcome?: number }>
}
const shows = (r: Row) => ({ mean: r.expected !== undefined, spread: r.outcome?.p10 != null && r.outcome?.p90 != null, downside: r.downside !== undefined, share: r.win_probability !== undefined, goalStamp: r.goalIdentityWithheld === true })

describe('⭐ B3: a goal-figure withhold is per option × claim', () => {
  it('OLD RUN (no B2 keys): every option is stripped exactly as before, and the run is not renderable', () => {
    const r = report({})
    for (const id of ['a', 'b', 'c']) expect(shows(r.option_probabilities[id])).toEqual({ mean: false, spread: false, downside: false, share: false, goalStamp: true })
    expect(hasRenderableAnalysisResult(r as never)).toBe(false)
  })

  it('ONE WITHHELD OPTION: the others keep outcome, spread and downside; shares go (win_share is one comparison)', () => {
    const r = report({ option_ids: ['b'] })
    expect(shows(r.option_probabilities.b)).toEqual({ mean: false, spread: false, downside: false, share: false, goalStamp: true })
    for (const id of ['a', 'c']) expect(shows(r.option_probabilities[id])).toEqual({ mean: true, spread: true, downside: true, share: false, goalStamp: false })
    expect(hasRenderableAnalysisResult(r as never)).toBe(true)
    // The comparison rows the outcome panel reads agree with the option rows.
    const oc = Object.fromEntries((r.option_comparison ?? []).map((o) => [o.option_id, o.outcome !== undefined]))
    expect(oc).toEqual({ a: true, b: false, c: true })
  })

  it('WITHHELD CLAIMS WITHOUT `outcome`: every option shows its spread, no shares, the goal figure stamped', () => {
    const r = report({ withheld_claims: ['goal_probability', 'joint_probability', 'win_share'] })
    for (const id of ['a', 'b', 'c']) expect(shows(r.option_probabilities[id])).toEqual({ mean: true, spread: true, downside: true, share: false, goalStamp: true })
  })

  it('a joint figure withheld on its own is left out; the goal figure is not stamped', () => {
    const r = report({ withheld_claims: ['joint_probability'] })
    expect(r.option_probabilities.a.probability_of_joint_goal).toBeUndefined()
    expect(r.option_probabilities.a.goalIdentityWithheld).toBeUndefined()
    expect(r.option_probabilities.a.win_probability).toBe(0.5)
  })

  it('the block mapper keeps win figures unless a warning withholds win_share', () => {
    const wp = (w: Record<string, unknown> | null) => (mapV5Blocks([block(w)] as never)[0] as { win_probabilities?: unknown }).win_probabilities
    expect(wp({ withheld_claims: ['outcome'] })).toBeDefined()
    expect(wp({ withheld_claims: ['win_share'] })).toBeUndefined()
    expect(wp({})).toBeUndefined()
    expect(wp(null)).toBeDefined()
  })

  it('FAIL-CLOSED: an unreadable scope or an unknown claim withholds everything', () => {
    const w = (extra: Record<string, unknown>) => readGoalFigureWithholds({ inference_warnings: [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', ...extra }] })
    expect([...withheldClaimsFor(w({ option_ids: [] }), 'a')].sort()).toHaveLength(5)
    expect([...withheldClaimsFor(w({ option_ids: 'b' }), 'a')]).toHaveLength(5)
    expect([...withheldClaimsFor(w({ withheld_claims: ['outcome', 'a_new_claim'] }), 'a')]).toHaveLength(5)
    expect([...withheldClaimsFor(w({ option_ids: ['b'] }), 'a')]).toHaveLength(0)
  })
})
