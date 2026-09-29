/**
 * Absent stays absent under the typed identity withhold (PLoT #416's warning, AIQ #72 5886183999 follow-up; census
 * R3-B 5886351619 step 3, UI half).
 *
 * The win %, means, ranges and downside come from the same invalid walk as the withheld goal figure. The census
 * found the UI would re-show them from fallbacks even after the producer stripped them: the label-keyed
 * `win_probabilities` map, `decision_brief.options[]`, `expected_outcome`, the CI midpoint. With the warning present
 * no carrier may yield a figure, and no leader may be derived from one. Control: the same block without the
 * warning keeps every figure.
 */
import { describe, it, expect } from 'vitest'
import { buildV5VerdictReportLike, mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import { mapV5Blocks } from '../blocks/mapV5Blocks'
import { GOAL_IDENTITY_NOT_EVALUATED_CODE } from '../../components/results/utils/goalIdentityWithheld'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

const WARNING = {
  code: GOAL_IDENTITY_NOT_EVALUATED_CODE,
  severity: 'warning',
  node_ids: ['savings'],
  message: "Not shown. 'Reserved-instance savings' depends on steady spend × coverage × discount, but this run couldn't calculate it that way, so the figures for each option would be wrong.",
}

/** Every carrier the census named, all populated, so a fallback has something to re-show. */
function block(withWarning: boolean) {
  const entry = (id: string, label: string, wp: number, mean: number) => ({
    id, option_id: id, label, option_label: label, status: 'computed',
    win_probability: wp, expected_outcome: mean, confidence_interval: [mean - 1000, mean + 1000],
    outcome: { mean, p10: mean - 2000, p50: mean, p90: mean + 2000 },
    downside: { p10: mean - 2000 },
  })
  return {
    type: 'analysis_result',
    summary: 's',
    leading_option_id: 'buy_ri',
    win_probabilities: { 'Buy reserved instances': 0.7, 'Stay on demand': 0.3 },
    enrichment: {
      option_comparison: [entry('buy_ri', 'Buy reserved instances', 0.7, 37900), entry('stay', 'Stay on demand', 0.3, 41400)],
      decision_brief: { options: [{ id: 'buy_ri', label: 'Buy reserved instances', win_probability: 0.7 }, { id: 'stay', label: 'Stay on demand', win_probability: 0.3 }] },
      robustness: { recommended_option_id: 'buy_ri' },
      ...(withWarning ? { inference_warnings: [WARNING] } : {}),
    },
  }
}

type Row = { win_probability?: number; expected?: number; downside?: unknown; outcome?: { p10?: number | null; p50?: number | null; p90?: number | null } }
const rows = (withWarning: boolean) =>
  Object.values((mapV5AnalysisToReport(block(withWarning) as unknown as AnalysisResultBlock) as unknown as { option_probabilities: Record<string, Row> }).option_probabilities)

describe('the typed identity withhold: no carrier re-shows a win %, mean, range or downside', () => {
  it('WITHHELD: every option row is empty of figures', () => {
    const r = rows(true)
    expect(r).toHaveLength(2)
    for (const o of r) {
      expect(o.win_probability).toBeUndefined()
      expect(o.expected).toBeUndefined()
      expect(o.downside).toBeUndefined()
      expect([o.outcome?.p10 ?? null, o.outcome?.p50 ?? null, o.outcome?.p90 ?? null]).toEqual([null, null, null])
    }
  })

  it('CONTROL: without the warning every figure is kept', () => {
    const r = rows(false)
    expect(r.map((o) => o.win_probability)).toEqual([0.7, 0.3])
    expect(r.map((o) => o.expected)).toEqual([37900, 41400])
    expect(r[0].outcome?.p10).toBe(35900)
  })

  it('no leader is derived from withheld win figures (the verdict view)', () => {
    expect(Object.keys(buildV5VerdictReportLike(block(true)).option_probabilities ?? {})).toEqual([])
    expect(Object.keys(buildV5VerdictReportLike(block(false)).option_probabilities ?? {})).toHaveLength(2)
  })

  it('the chat analysis block carries no win figures under the withhold', () => {
    const [withheld] = mapV5Blocks([block(true)] as never, [] as never) as unknown as Array<Record<string, unknown>>
    const [kept] = mapV5Blocks([block(false)] as never, [] as never) as unknown as Array<Record<string, unknown>>
    expect(withheld.win_probabilities).toBeUndefined()
    expect(kept.win_probabilities).toEqual({ 'Buy reserved instances': 0.7, 'Stay on demand': 0.3 })
  })
})
