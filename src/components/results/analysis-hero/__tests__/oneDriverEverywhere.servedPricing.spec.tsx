/**
 * ⛔ THE ANALYSIS TAB STILL NAMED A DIFFERENT "MAIN" FACTOR THAN THE CARD
 * (served 853feeb7, pricing starter, one Run, no chat turns — the SAME run as
 * `oneMainDriver.servedPricing.spec.tsx`, which fixed the hero pill).
 *
 * After #2124 the hero says "Main driver: Top Account Revenue Concentration",
 * the card's Driver 1. Three more readers on the same tab still named
 * Enterprise Revenue Cannibalization Risk — a factor every option sets, whose
 * elasticity and sensitivity are 0, and whose own card reads "Not ranked in
 * this run":
 *
 *   1. `t1-dominant-nudge`   "Dominant factor: Enterprise Revenue Cannibalization
 *                              Risk has relative influence of 100% within this
 *                              analysis." — crowned on the Drivers panel's
 *                              STRUCTURAL order, not the card's.
 *   2. `hero-act-on-it-row-title` "Verify Enterprise Revenue Cannibalization
 *                              Risk / If the estimate changes for …" — from the
 *                              top fragile EDGE, while the same run's flip
 *                              thresholds carry the algebraic proof
 *                              (`structurally_invariant`) that no value of this
 *                              factor can move the winner. The EDGE finding is
 *                              real; the row now names the relationship.
 *   3. `strengthen-rec-strengthen:next-input:…` "Give Enterprise Revenue
 *                              Cannibalization Risk a value of your own / Most
 *                              influential of 5 factors compared in this model"
 *                              — ranked by displayed influence.
 *
 * Every served string below is read from the fixture (captured DOM), never
 * typed here. Assertions bind by identity: factor id, row key, rec id, and the
 * exact text on the exact test id.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'

import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData, type ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ResultsReport } from '../../types'
import { TriageActionCardsBody } from '../../TriageActionCardsBody'
import { rankActOnItRows } from '../actOnIt/rankActOnItRows'
import { ActOnItSection } from '../actOnIt/ActOnItSection'
import { buildStrengthenInputsForAnalysisNew } from '../../analysisNew/buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../../strengthen/buildRecommendations'
import served from './fixtures/served-853feeb7-pricing-drivers-run.json'
import readers from './fixtures/served-853feeb7-pricing-analysis-tab-readers.json'

type AnalysisBlock = Parameters<typeof mapV5AnalysisToReport>[0]
type Block = typeof served.analysis_result

const TOP = 'fac_top_account_concentration'
const LEVER = 'fac_enterprise_revenue_risk'
const LEVER_LABEL = 'Enterprise Revenue Cannibalization Risk'
const DOM = readers.served_dom

function blockWith(patch?: (b: Block) => void): Block {
  const block = JSON.parse(JSON.stringify(served.analysis_result)) as Block
  patch?.(block)
  return block
}

function seed(block: Block, awaiting?: string[]) {
  const admission = JSON.parse(JSON.stringify(readers.analysis_admission))
  if (awaiting) admission.semantic_signals.material_parameters_awaiting_user_node_ids = awaiting
  useCanvasStore.setState({
    nodes: served.draft_graph_nodes.map((n, i) => ({
      id: n.id,
      type: n.kind,
      position: { x: i * 10, y: 0 },
      data: { label: n.label, kind: n.kind },
    })) as never,
    results: {
      status: 'complete',
      progress: 100,
      report: mapV5AnalysisToReport(block as unknown as AnalysisBlock) as unknown as ResultsReport,
    } as never,
    ceeAnalysisReady: { analysis_admission: admission } as never,
    hasCompletedFirstRun: true,
  } as never)
}

function sectionData(): ResultsSectionDataReturn {
  return renderHook(() => useResultsSectionData()).result.current
}

function renderTriage(data: ResultsSectionDataReturn) {
  return render(
    <TriageActionCardsBody data={data} onFocusNode={() => {}} suppressTriageQueue useV17Copy />,
  )
}

function renderActOnIt(data: ResultsSectionDataReturn) {
  const rows = rankActOnItRows(data, { readyToBrief: false })
  render(
    <ActOnItSection rows={rows} hiddenRows={[]} dispatchRowAction={() => {}} chatAvailable={false} />,
  )
  return rows
}

function nextInputRecs(data: ResultsSectionDataReturn) {
  const inputs = buildStrengthenInputsForAnalysisNew({
    data,
    guidanceItems: [],
    biasSignals: null,
    currentStage: null,
    analysisIdentityIsCurrent: true,
  })
  return buildRecommendations(inputs).filter((r) => r.id.startsWith('strengthen:next-input:'))
}

function flipRow(block: Block, id: string) {
  return block.enrichment.flip_thresholds.find((r) => r.factor_id === id)!
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    ceeAnalysisReady: null as never,
    hasCompletedFirstRun: false,
  } as never)
})

describe('served pricing run — the evidence the three readers contradicted', () => {
  it('the lever is set by every option, has zero sensitivity, and is proven unable to move the winner', () => {
    const lever = served.analysis_result.enrichment.factor_sensitivity.find((r) => r.factor_id === LEVER)!
    expect(lever.elasticity).toBe(0)
    expect(lever.sensitivity_score).toBe(0)
    expect(lever.influence_rank).toBe(1)
    for (const interventions of Object.values(readers.option_interventions)) {
      expect(Object.keys(interventions)).toContain(LEVER)
    }
    const ft = flipRow(served.analysis_result, LEVER)
    expect(ft.flip_reason).toBe('structurally_invariant')
    expect(ft.flip_value).toBeNull()
  })

  it('CEE awaits the three levers, not the card\'s Driver 1', () => {
    const awaiting = readers.analysis_admission.semantic_signals.material_parameters_awaiting_user_node_ids
    expect(awaiting).toContain(LEVER)
    expect(awaiting).not.toContain(TOP)
  })

  it('the view-model carries the card\'s leader, by id, with a clear lead', () => {
    seed(blockWith())
    expect(sectionData().drivers.driverLeader).toEqual({ key: TOP, leadIsClear: true })
  })
})

describe('1 · "Dominant factor" nudge reads the card\'s ranking', () => {
  it('served: no nudge names the lever the card does not rank', () => {
    seed(blockWith())
    renderTriage(sectionData())
    // Served, pre-fix: this element read DOM['t1-dominant-nudge-label'].
    expect(DOM['t1-dominant-nudge-label']).toBe(LEVER_LABEL)
    expect(screen.queryByTestId('t1-dominant-nudge')).toBeNull()
    expect(screen.queryByText(DOM['t1-dominant-nudge-metric'])).toBeNull()
  })

  it('served: the view-model crowns no dominant factor (the producer sent none)', () => {
    seed(blockWith())
    expect(sectionData().drivers.dominantFactorId).toBeUndefined()
  })

  it('the local dominance heuristic may not crown a factor the card does not rank', () => {
    // Served rows, influence scores only: the lever now clears the heuristic's
    // 2:1 structural ratio (1.0 vs 0.3). Elasticities untouched — the card's
    // Driver 1 is still Top Account.
    seed(blockWith((b) => {
      for (const r of b.enrichment.factor_sensitivity) {
        r.influence_score = r.factor_id === LEVER ? 1 : 0.3
      }
    }))
    const data = sectionData()
    expect(data.drivers.driverLeader).toEqual({ key: TOP, leadIsClear: true })
    expect(data.drivers.topDrivers[0].factorKey).toBe(LEVER)
    expect(data.drivers.dominantFactorId).toBeUndefined()
    renderTriage(data)
    expect(screen.queryByTestId('t1-dominant-nudge')).toBeNull()
  })

  it('AI Conversation B1: the producer names the card\'s Driver 1 as dominant, but the list\'s TOP ROW is still the lever — no nudge (its number would be the lever\'s 100%)', () => {
    // Served rows and elasticities: the card's Driver 1 is Top Account, the structural top row is the lever.
    seed(blockWith())
    const served = sectionData()
    expect(served.drivers.driverLeader).toEqual({ key: TOP, leadIsClear: true })
    expect(served.drivers.topDrivers[0].factorKey).toBe(LEVER)
    // PLoT sends `dominant_factor` naming Top Account (it does on runs where its DOMINANT_FACTOR warning fires).
    const data = { ...served, drivers: { ...served.drivers, dominantFactorId: TOP, dominantFactorLabel: 'Top Account Revenue Concentration' } }
    renderTriage(data as typeof served)
    // Without the "top row IS Driver 1" clause this would print Top Account beside the LEVER's structural 100%.
    expect(screen.queryByTestId('t1-dominant-nudge')).toBeNull()
  })

  it('control: when the structural top IS the card\'s Driver 1, the nudge names exactly that factor', () => {
    // Served rows, influence scores only: Top Account becomes the structural
    // top as well as the sensitivity top. Elasticities are untouched.
    seed(blockWith((b) => {
      for (const r of b.enrichment.factor_sensitivity) {
        r.influence_score = r.factor_id === TOP ? 0.9 : 0.2
      }
    }))
    const data = sectionData()
    // The heuristic crowns the SAME factor the card ranks first.
    expect(data.drivers.dominantFactorId).toBe(TOP)
    renderTriage(data)
    expect(screen.getByTestId('t1-dominant-nudge-label').textContent).toBe('Top Account Revenue Concentration')
    expect(screen.getByTestId('t1-dominant-nudge-metric').textContent).toBe(
      'has relative influence of 90% within this analysis.',
    )
  })
})

describe('2 · the flip-risk row never offers "Verify X" for a factor the run proves cannot flip it', () => {
  const LINK_TITLE = `Verify how ${LEVER_LABEL} affects Enterprise Account Revenue Loss`
  const LINK_REASON = 'If this relationship is stronger or weaker than assumed, the result could change.'

  it('served: the top fragile edge IS from the lever (the finding the row carries)', () => {
    const top = served.analysis_result.enrichment.robustness.fragile_edges[0]
    expect(top.edge_id).toBe(`${LEVER}->risk_enterprise_churn`)
    expect(top.to_label).toBe('Enterprise Account Revenue Loss')
  })

  it('served: the row names the relationship, not "Verify {lever}", and keeps the finding', () => {
    seed(blockWith())
    const rows = renderActOnIt(sectionData())
    expect(DOM['hero-act-on-it-row-title']).toBe(`Verify ${LEVER_LABEL}`)
    const row = rows.find((r) => r.key === `risk-${LEVER}`)
    expect(row?.title).toBe(LINK_TITLE)
    expect(row?.reason).toBe(LINK_REASON)
    expect(row?.targetNodeId).toBe(LEVER)
    const titles = screen.getAllByTestId('hero-act-on-it-row-title').map((e) => e.textContent)
    expect(titles).toContain(LINK_TITLE)
    expect(titles).not.toContain(DOM['hero-act-on-it-row-title'])
    expect(screen.queryByText(DOM['hero-act-on-it-row-reason'])).toBeNull()
  })

  it('control: a FOUND flip on the same factor keeps the factor wording', () => {
    seed(blockWith((b) => {
      const ft = flipRow(b, LEVER) as Record<string, unknown>
      ft.flip_reason = 'found'
      ft.flip_value = 0.5
      ft.no_flip_in_range = false
    }))
    const rows = renderActOnIt(sectionData())
    const row = rows.find((r) => r.key === `risk-${LEVER}`)
    expect(row?.title).toBe(DOM['hero-act-on-it-row-title'])
    expect(row?.reason).toBe(DOM['hero-act-on-it-row-reason'])
  })

  it('control: "no_effect_within_bounds" is not a proof, so the factor wording stays', () => {
    seed(blockWith((b) => {
      ;(flipRow(b, LEVER) as Record<string, unknown>).flip_reason = 'no_effect_within_bounds'
    }))
    const rows = renderActOnIt(sectionData())
    expect(rows.find((r) => r.key === `risk-${LEVER}`)?.title).toBe(DOM['hero-act-on-it-row-title'])
  })
})

describe('3 · "next input to set" names the card\'s Driver 1 or nothing', () => {
  it('served: names nothing, because the card\'s Driver 1 is not an input CEE is waiting on', () => {
    seed(blockWith())
    expect(DOM[`strengthen-rec-strengthen:next-input:${LEVER} title`]).toBe(
      `Give ${LEVER_LABEL} a value of your own`,
    )
    const recs = nextInputRecs(sectionData())
    expect(recs.map((r) => r.id)).toEqual([])
    expect(recs.map((r) => r.signal)).not.toContain(DOM[`strengthen-rec-strengthen:next-input:${LEVER} signal`])
  })

  it('when CEE also awaits the card\'s Driver 1, it names THAT factor', () => {
    seed(blockWith(), [...readers.analysis_admission.semantic_signals.material_parameters_awaiting_user_node_ids, TOP])
    const recs = nextInputRecs(sectionData())
    expect(recs.map((r) => r.id)).toEqual([`strengthen:next-input:${TOP}`])
    expect(recs[0].title).toBe('Give Top Account Revenue Concentration a value of your own')
  })
})
