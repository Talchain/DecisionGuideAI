/**
 * ⛔ THE CARD AND THE ANALYSIS TAB NAMED DIFFERENT MAIN DRIVERS (design audit
 * §2 #7, served 853feeb7, pricing starter, one Run, no chat turns).
 *
 * On one screen:
 *   · the canvas card on `fac_top_account_concentration` read
 *     "Driver 1 of 5 analysed" (and `fac_enterprise_revenue_risk` read
 *     "Not ranked in this run");
 *   · the Analysis tab hero read "Main driver: Enterprise Revenue
 *     Cannibalization Risk".
 *
 * ── WHICH RANKING IS RIGHT, FROM THE SERVED PAYLOAD (fixture, verbatim) ──────
 *   factor                                 importance_rank influence_rank elasticity
 *   Top Account Revenue Concentration             1              3          0.600
 *   Competitive Pressure for Usage Pricing        2              5          0.013
 *   Enterprise Revenue Cannibalization Risk       3              1          0
 *   Usage-Based Pricing Exposure                  4              2          0
 *   Bottom-Up Adoption Friction                   5              4          0
 * PLoT's canonical order (`driver_order`: the emitted `factor_sensitivity[]`
 * order, projected into `importance_rank`, `decision_brief.top_drivers[0]` and
 * `dominant_factor`) puts Top Account Revenue Concentration first, and the
 * producer's own DOMINANT_FACTOR warning names it. Enterprise Revenue
 * Cannibalization Risk is an option-set lever (every option sets it): its
 * elasticity and sensitivity_score are 0. The hero crowned it on
 * `influence_score` — structural weight — which `rankFactor.ts` already
 * documents as the wrong quantity for a driver rank.
 *
 * The card's rank (`rankFactor`) is the authority; the hero now reads it.
 * Assertions bind by identity: the factor id, and the exact text on the
 * exact test id.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'

import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { selectDriverPolicyFeed, useResultsSectionData } from '../../useResultsSectionData'
import type { ResultsReport } from '../../types'
import { rankFactor, sensitivityLeader } from '../../../../canvas/nodes/shared/rankFactor'
import { DRIVER_LINE_COPY } from '../../../../canvas/nodes/shared/metricVocabulary'
import { useAnalysisHero } from '../useAnalysisHero'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import served from './fixtures/served-853feeb7-pricing-drivers-run.json'

type AnalysisBlock = Parameters<typeof mapV5AnalysisToReport>[0]

const TOP = 'fac_top_account_concentration'
const LEVER = 'fac_enterprise_revenue_risk'

function servedReport(): ResultsReport {
  return mapV5AnalysisToReport(served.analysis_result as unknown as AnalysisBlock) as unknown as ResultsReport
}

function seedServedRun() {
  useCanvasStore.setState({
    nodes: served.draft_graph_nodes.map((n, i) => ({
      id: n.id,
      type: n.kind,
      position: { x: i * 10, y: 0 },
      data: { label: n.label, kind: n.kind },
    })) as never,
    results: { status: 'complete', progress: 100, report: servedReport() } as never,
    hasCompletedFirstRun: true,
  } as never)
}

function heroModel(): HeroChartModel {
  const { result } = renderHook(() => useAnalysisHero(useResultsSectionData()))
  expect(result.current.model.kind).toBe('chart')
  return result.current.model as HeroChartModel
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
  } as never)
})

describe('served pricing run — ONE main driver across the card and the Analysis tab', () => {
  it('evidence: the producer ranks Top Account first, and the lever has zero elasticity', () => {
    const rows = served.analysis_result.enrichment.factor_sensitivity
    const top = rows.find((r) => r.factor_id === TOP)!
    const lever = rows.find((r) => r.factor_id === LEVER)!
    expect(rows[0].factor_id).toBe(TOP)
    expect(top.importance_rank).toBe(1)
    expect(lever.influence_rank).toBe(1)
    expect(lever.elasticity).toBe(0)
    expect(served.analysis_result.enrichment.decision_brief.top_drivers[0].factor_label).toBe(
      'Top Account Revenue Concentration',
    )
  })

  it('the card authority on the served run: "Driver 1 of 5 analysed" on Top Account, no rank on the lever', () => {
    const feed = selectDriverPolicyFeed(servedReport())
    const top = rankFactor(feed.policyRows, feed.displayModel, TOP)
    expect(top.sensitivityRank).toBe(1)
    expect(DRIVER_LINE_COPY.rank(top.sensitivityRank!, top.influenceSetSize)).toBe(
      served.served_dom['fac_top_account_concentration factor-driver-line-caption'],
    )
    expect(rankFactor(feed.policyRows, feed.displayModel, LEVER).sensitivityRank).toBeNull()
  })

  it('the hero names the SAME factor, bound by id, with a clear lead', () => {
    seedServedRun()
    expect(heroModel().quickLinks.mainDriver).toEqual({
      label: 'Top Account Revenue Concentration',
      targetId: TOP,
      leadIsClear: true,
    })
  })

  it('the rendered pill reads exactly "Main driver: Top Account Revenue Concentration"', () => {
    seedServedRun()
    const model = heroModel()
    render(<AnalysisHeroPanel model={model} rerunDisabled={false} onFocusTarget={() => {}} />)
    expect(screen.getByTestId('hero-quicklink-driver').textContent).toBe(
      'Main driver: Top Account Revenue Concentration',
    )
    expect(screen.queryByText(/Main driver: Enterprise Revenue Cannibali[sz]ation Risk/)).toBeNull()
  })

  it('the pill-less footer line names the same factor', () => {
    seedServedRun()
    expect(heroModel().mainReason).toBe('Main driver: Top Account Revenue Concentration.')
  })

  describe('the leader follows the card in both directions (served rows, one field changed)', () => {
    function leaderWith(patch: (r: Record<string, unknown>) => Record<string, unknown>) {
      const block = JSON.parse(JSON.stringify(served.analysis_result))
      block.enrichment.factor_sensitivity = block.enrichment.factor_sensitivity.map(patch)
      const feed = selectDriverPolicyFeed(
        mapV5AnalysisToReport(block as unknown as AnalysisBlock) as unknown as ResultsReport,
      )
      return { leader: sensitivityLeader(feed.policyRows, feed.displayModel), feed }
    }

    it('served as-is: a clear leader, and it is the card\'s Driver 1', () => {
      const { leader } = leaderWith((r) => r)
      expect(leader).toEqual({ key: TOP, leadIsClear: true })
    })

    it('TIE on the card\'s basis: the card ranks nobody, the leader is hedged', () => {
      const { leader, feed } = leaderWith((r) =>
        r.factor_id === 'fac_market_competition'
          ? { ...r, elasticity: 0.6001452960406829, sensitivity_score: -0.29931159420289855 }
          : r,
      )
      expect(rankFactor(feed.policyRows, feed.displayModel, TOP).sensitivityRank).toBeNull()
      expect(leader?.leadIsClear).toBe(false)
    })

    it('NO magnitude on the card\'s basis: no leader at all', () => {
      const { leader } = leaderWith((r) => ({ ...r, elasticity: 0, sensitivity_score: 0 }))
      expect(leader).toBeNull()
    })
  })
})
