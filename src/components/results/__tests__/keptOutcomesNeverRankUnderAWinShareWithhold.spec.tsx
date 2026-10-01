/**
 * B3 · DL 5932590056 condition: under a goal-figure withhold that KEEPS outcomes but withholds `win_share`, the UI must
 * not name a leader, re-sort, or colour/number options from those kept outcomes. `sortOptionsForDisplay` falls back to
 * `expected` when shares are absent, so on a run whose leader licence holds, the kept means would otherwise re-rank the
 * list: a designation the producer withheld, re-made by the UI from a different number (R7/X4).
 *
 * WHY IT HOLDS (pinned here, not added): `deriveDecisionVerdict` measures separation on win shares only, so with the shares
 * withheld fewer than two options are comparable, the run has no leader entitlement, and `designationsWithheld` stops
 * every sort, ordinal and leader surface. A future fallback to `expected` in either place turns this row RED.
 *
 * Served run `0303ef5` (pricing): outcome means rank £59 > £54 > Keep £49, while the canvas order is Keep £49, £59, £54,
 * so a sort by kept outcome is visible.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../useResultsSectionData'
import { rankingWasWithheld } from '../leaderDesignation'
import served from '../../../canvas/__tests__/fixtures/served-0303ef5-pricing-withheld-run.json'

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
})

const CANVAS_ORDER = served.options.map((o) => o.id)
const BY_SHARE = ['59_with_next_release', 'keep_49_price', '54_with_next_release']
const BY_KEPT_OUTCOME = ['59_with_next_release', '54_with_next_release', 'keep_49_price']

const WITHHOLD = {
  code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE',
  severity: 'warning',
  message: "Not shown. Olumi can't give each option's figures for this goal from this run.",
  withheld_claims: ['goal_probability', 'joint_probability', 'win_share'],
}

function seed(withhold: boolean) {
  const ar = served.analysis_result as unknown as { enrichment: { inference_warnings: unknown[] } }
  const block = withhold
    ? { ...ar, enrichment: { ...ar.enrichment, inference_warnings: [...ar.enrichment.inference_warnings, WITHHOLD] } }
    : ar
  const report = mapV5AnalysisToReport(block as never, {} as never) as unknown as Record<string, unknown>
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'MRR', kind: 'outcome' } },
      ...served.options.map((o, i) => ({ id: o.id, type: 'option', position: { x: i * 220, y: 200 }, data: { label: o.label, kind: 'option' } })),
    ] as never,
    edges: [] as never,
    results: {
      status: 'complete',
      progress: 100,
      // A PERMITTED run (the producer separates the arms), so only the withhold can stop the ranking.
      report: {
        ...report,
        robustness: {
          ...(report.robustness as object),
          near_tie: { is_tie: false, top_option_id: '59_with_next_release', second_option_id: 'keep_49_price', gap: 0.69, threshold: 0.1 },
        },
      },
    } as never,
  } as never)
}

const recommendation = () => renderHook(() => useResultsSectionData()).result.current.recommendation

describe('B3: kept outcomes never rank options when win shares are withheld', () => {
  it('⛔ no leader, no re-sort, no ordinal: the list keeps the canvas order', () => {
    seed(true)
    const rec = recommendation()
    // PRECONDITIONS: the outcomes are KEPT (so a sort by them is possible) and the shares are gone.
    expect(rec.allOptions.every((o) => o.expected != null), 'outcomes kept').toBe(true)
    expect(rec.allOptions.every((o) => o.winProbability == null), 'shares withheld').toBe(true)
    expect(BY_KEPT_OUTCOME).not.toEqual(CANVAS_ORDER)

    expect(rankingWasWithheld(rec)).toBe(true)
    expect(rec.allOptions.map((o) => o.id)).toEqual(CANVAS_ORDER)
    expect(rec.allOptions.map((o) => o.id)).not.toEqual(BY_KEPT_OUTCOME)
    expect(rec.allOptions.filter((o) => typeof o.rank === 'number' && o.rank > 0 && rec.leaderDesignationPermitted)).toEqual([])
  })

  it('CONTRAST: the same permitted run with no withhold is still sorted by share and designates', () => {
    seed(false)
    const rec = recommendation()
    expect(rankingWasWithheld(rec), 'PRECONDITION: a permitted run').toBe(false)
    expect(rec.allOptions.map((o) => o.id)).toEqual(BY_SHARE)
  })
})
