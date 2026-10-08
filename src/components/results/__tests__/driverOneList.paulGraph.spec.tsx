/** Paul's conflicting quantities: subscribers lead structurally; churn moves the result most. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { selectDriverPolicyFeed, useResultsSectionData } from '../useResultsSectionData'
import { rankFactor } from '../../../canvas/nodes/shared/rankFactor'
import { ResultsBody } from '../ResultsBody'
import { useAnalysisHero } from '../analysis-hero/useAnalysisHero'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import { DriverInfluenceChart } from '../analysisNew/sections/DriverInfluenceChart'
import { DecisionMatrix } from '../analysisNew/sections/DecisionMatrix'
import type { ResultsReport } from '../types'
import served from '../analysis-hero/__tests__/fixtures/served-7ad369b7-pricing-drivers-accordion.json'

// Authentication is outside this read-only ranking projection.
vi.mock('../../../lib/supabase', () => ({ supabase: {}, getProfile: vi.fn() }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, authenticated: true, loading: false }) }))

const CHURN = 'monthly_churn'
const SUBSCRIBERS = 'pro_paying_subscribers'
const GATED = 'option_dependent_factor'
const OPTION_IDS = served.draft_graph_nodes.filter(n => n.kind === 'option').map(n => n.id)
const HEADING = 'What the result moves most with'
const initialState = useCanvasStore.getState()

function seedPaulGraph(withheldChance = false) {
  const block = structuredClone(served.analysis_result)
  // Producer influence order is subscribers 100%, churn 63%. Elasticity disagrees.
  block.enrichment.factor_sensitivity = [
    { factor_id: SUBSCRIBERS, factor_label: 'Pro paying subscribers', elasticity: 0.5, influence_score: 1, direction: 'positive' },
    { factor_id: CHURN, factor_label: 'Monthly churn', elasticity: -0.8, influence_score: 0.63, direction: 'negative' },
    // This bigger row must not enter either ranking, exactly as on the card.
    { factor_id: GATED, factor_label: 'Option-dependent factor', elasticity: 10, influence_score: null, influence_gated_by: [OPTION_IDS[0]] },
  ] as never
  const report = mapV5AnalysisToReport(block as never) as unknown as ResultsReport
  const licence = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: OPTION_IDS,
    pct_by_option: Object.fromEntries(OPTION_IDS.filter(id => !withheldChance || id !== OPTION_IDS[0]).map((id, i) => [id, 40 + i * 10])),
    withheld_option_ids: withheldChance ? [OPTION_IDS[0]] : [],
    target: { comparator: 'at_least', value: 20000, unit: '£' },
    driver_by_option: {},
  }
  useCanvasStore.setState({
    nodes: [
      ...served.draft_graph_nodes.filter(n => n.kind === 'option' || n.kind === 'goal').map((n, i) => ({
        id: n.id, type: n.kind, position: { x: i * 10, y: 0 }, data: { label: n.label, kind: n.kind },
      })),
      ...[
        { id: CHURN, label: 'Monthly churn', value: 0.03 },
        { id: SUBSCRIBERS, label: 'Pro paying subscribers', value: 250 },
        { id: GATED, label: 'Option-dependent factor', value: 1 },
      ].map(n => ({ id: n.id, type: 'factor', position: { x: 0, y: 0 }, data: { label: n.label, kind: 'factor', observed_state: { value: n.value, source: 'user' } } })),
    ],
    edges: [],
    results: { status: 'complete', progress: 100, report: { ...report, inference_warnings: [licence] } },
    goalThreshold: 20000,
    ceeAnalysisReady: { goal_threshold_raw: 20000, goal_threshold_unit: '£' },
    hasCompletedFirstRun: true,
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

afterEach(() => { cleanup(); useCanvasStore.setState(initialState, true) })

describe('Paul graph — one outcome-sensitivity list, separate gated chance driver', () => {
  it('binds hero, first Analysis row/100%, and first Reasoning bar to Monthly churn', () => {
    const data = seedPaulGraph()
    const report = useCanvasStore.getState().results.report as unknown as ResultsReport
    const feed = selectDriverPolicyFeed(report)
    // Establish the disagreement and the common authority by factor identity.
    expect(feed.policyRows.find(r => r.key === SUBSCRIBERS)?.influenceScore).toBe(1)
    expect(feed.policyRows.find(r => r.key === CHURN)?.influenceScore).toBe(0.63)
    expect(feed.displayModel.get(SUBSCRIBERS)).toMatchObject({ value: 0.625, provenance: 'normalised_elasticity' })
    expect(feed.displayModel.get(CHURN)).toMatchObject({ value: 1, provenance: 'normalised_elasticity' })
    expect(data.drivers.drivers.map(r => r.factorKey)).toEqual([CHURN, SUBSCRIBERS])
    expect(feed.displayModel.has(GATED)).toBe(false)
    expect(rankFactor(feed.policyRows, feed.displayModel, GATED).sensitivityRank).toBeNull()
    expect(rankFactor(feed.policyRows, feed.displayModel, CHURN).relativeSensitivity).toBe(1)
    const hero = renderHook(() => useAnalysisHero(data)).result.current.model
    expect(hero.kind).toBe('chart')
    if (hero.kind !== 'chart') throw new Error('Paul graph must produce the real hero')
    expect(hero.quickLinks.mainDriver?.targetId).toBe(CHURN)

    render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} driversExpanded />)
    expect(screen.getByTestId('hero-quicklink-driver').textContent).toBe('Moves the result most: Monthly churn')
    const ranking = within(screen.getByTestId('accordion-drivers'))
    expect(ranking.getByText(HEADING, { exact: true })).toBeInTheDocument()
    fireEvent.click(ranking.getByTestId('influence-details-toggle'))
    const list = ranking.getByTestId('drivers-list')
    const pills = list.querySelectorAll('[data-testid^="driver-influence-pill-"]')
    expect(Array.from(pills).map(p => p.getAttribute('data-testid'))).toEqual([
      `driver-influence-pill-${CHURN}`, `driver-influence-pill-${SUBSCRIBERS}`,
    ])
    const firstRow = pills[0].closest('.results-card-hover')!
    expect(within(firstRow as HTMLElement).getByRole('progressbar', { name: 'Monthly churn influence: 100%' })).toHaveAttribute('aria-valuenow', '100')
    expect(within(firstRow as HTMLElement).getByText('Monthly churn', { exact: true })).toBeInTheDocument()
    expect(within(list).getByRole('progressbar', { name: 'Pro paying subscribers influence: 63%' })).toHaveAttribute('aria-valuenow', '63')
    expect(screen.queryByTestId(`driver-influence-pill-${GATED}`)).toBeNull()

    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    render(<DriverInfluenceChart rows={vm.drivers.influenceRows} onCommitOutcome={() => {}} testId="paul-reasoning-chart" />)
    const bars = screen.getAllByTestId('paul-reasoning-chart-bar')
    expect(bars[0].closest('li')).toHaveAttribute('data-node-id', CHURN)
    expect(within(bars[0].closest('li')!).getByText('Monthly churn', { exact: true })).toBeInTheDocument()
    expect(bars[0]).toHaveAttribute('data-fraction', '100')
    expect(bars[1].closest('li')).toHaveAttribute('data-node-id', SUBSCRIBERS)
    expect(bars[1]).toHaveAttribute('data-fraction', '63')
    expect(vm.drivers.influenceRows.map(r => r.id)).toEqual([CHURN, SUBSCRIBERS])
  })

  it.each([false, true])('is silent in the chance-driver cell when CEE withholds that driver (chance withheld: %s)', withheldChance => {
    const data = seedPaulGraph(withheldChance)
    expect(data.drivers.driverLeader?.key).toBe(CHURN)
    expect(data.goalChanceLicence).not.toBeNull()
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={OPTION_IDS} run={{ runId: 'paul-graph' }} isStale={false} />)
    fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
    expect(screen.getByRole('columnheader', { name: 'Its chance rests most on' }).textContent).toBe('Its chance rests most on')
    const cell = screen.getByTestId(`decision-matrix-driver-${OPTION_IDS[0]}`)
    expect(cell.textContent).toBe('')
    expect(cell).not.toHaveTextContent('None shown')
    expect(cell).not.toHaveTextContent('Monthly churn')
    expect(cell).not.toHaveTextContent('Pro paying subscribers')
  })
})
