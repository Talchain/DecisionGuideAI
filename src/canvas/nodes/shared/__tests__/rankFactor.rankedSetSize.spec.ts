/**
 * `rankFactor` publishes `rankedSetSize` — how many factors its rule ranks —
 * beside `influenceSetSize` (the analysed set). Contract v3.1 pt 5 made the
 * ranked count the printed M ("Driver 1 of 3 ranked in this run"); ED #63
 * 5806207128 briefly restored the analysed set; design-gap row 39 restores
 * pt 5. `rankedSetSize` is both the printed M and the publication GUARD
 * `driverRankFor` and the attention plan read. The
 * invariant pinned here still holds and is what makes it a sound guard: over
 * the whole feed, the published ranks are EXACTLY 1..M_ranked, one factor
 * each — no card claims a rank beyond the ranked count.
 *
 * Positive control on every case: at least one factor is ranked, so a loop over
 * ranked factors cannot pass by testing nothing.
 */
import { describe, it, expect } from 'vitest'
import { rankFactor } from '../rankFactor'
import { selectDriverPolicyFeed } from '../../../../components/results/useResultsSectionData'
import type { ResultsReport } from '../../../../components/results/types'

const report = (factorSensitivity: Array<Record<string, unknown>>) =>
  ({
    schema: 'report.v1',
    meta: { seed: 1, elapsed_ms: 100 },
    result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
    bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
    factor_sensitivity: factorSensitivity,
  }) as unknown as ResultsReport

const ranksOf = (factorSensitivity: Array<Record<string, unknown>>) => {
  const feed = selectDriverPolicyFeed(report(factorSensitivity))
  const ids = [...new Set(factorSensitivity.map((f) => f.factor_id as string))]
  return ids.map((id) => ({ id, ...rankFactor(feed.policyRows, feed.displayModel, id) }))
}

/** Six clearly separated factors: the cap (MAX_BADGED_RANK = 3) binds. */
const SIX_CLEAR = [
  { factor_id: 'fac_a', influence_score: 1.0, elasticity: 3.6 },
  { factor_id: 'fac_b', influence_score: 0.8, elasticity: 2.9 },
  { factor_id: 'fac_c', influence_score: 0.6, elasticity: 2.1 },
  { factor_id: 'fac_d', influence_score: 0.4, elasticity: 1.4 },
  { factor_id: 'fac_e', influence_score: 0.2, elasticity: 0.7 },
  { factor_id: 'fac_f', influence_score: 0.1, elasticity: 0.3 },
]

/** A clear leader and a tie below it: the tie gate cuts the depth to 1. */
const LEADER_THEN_TIE = [
  { factor_id: 'fac_lead', influence_score: 1.0, elasticity: 0.8 },
  { factor_id: 'fac_x', influence_score: 0.5, elasticity: 0.4 },
  { factor_id: 'fac_y', influence_score: 0.5, elasticity: 0.4 },
  { factor_id: 'fac_z', influence_score: 0.2, elasticity: 0.1 },
]

const assertRanksAreExactlyOneToM = (rows: ReturnType<typeof ranksOf>) => {
  const ranked = rows.filter((r) => r.sensitivityRank != null)
  expect(ranked.length).toBeGreaterThan(0) // positive control
  const m = rows[0].rankedSetSize
  // Set-level: every factor in the feed reads the same M.
  for (const r of rows) expect(r.rankedSetSize).toBe(m)
  expect(ranked.map((r) => r.sensitivityRank).sort()).toEqual(Array.from({ length: m }, (_, i) => i + 1))
}

describe('the ranked count — the number of factors the rule ranked (the publication guard)', () => {
  it('six clear factors: the licence set is 6, M is 3, and ranks 1..3 each land on one factor', () => {
    const rows = ranksOf(SIX_CLEAR)
    expect(rows[0].influenceSetSize).toBe(6)
    expect(rows[0].rankedSetSize).toBe(3)
    assertRanksAreExactlyOneToM(rows)
    expect(rows.find((r) => r.id === 'fac_d')!.sensitivityRank).toBeNull()
  })

  it('DISCRIMINATING — a tie below the leader makes M 1, not 3 and not the set size 4', () => {
    const rows = ranksOf(LEADER_THEN_TIE)
    expect(rows[0].influenceSetSize).toBe(4)
    expect(rows[0].rankedSetSize).toBe(1)
    assertRanksAreExactlyOneToM(rows)
  })

  it('a factor absent from the feed still reads the set-level M (it is not a property of the node)', () => {
    const feed = selectDriverPolicyFeed(report(SIX_CLEAR))
    const absent = rankFactor(feed.policyRows, feed.displayModel, 'fac_not_in_run')
    expect(absent.sensitivityRank).toBeNull()
    expect(absent.rankedSetSize).toBe(3)
  })
})
