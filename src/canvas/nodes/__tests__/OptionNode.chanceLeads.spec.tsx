/**
 * ⭐ RunView PR 2 (#87; Science goals §(q), 8 Oct; design RUNVIEW-PHASE1, DL APPROVED): the option card's result line
 * LEADS with the goal chance, CEE's licensed figure (the Run's one view), and the share of runs is hover detail only.
 * DATA: Paul's served run `mrr-90b8f080` (e2e/geometry/fixtures), mapped by the product's own `mapV5AnalysisToReport`.
 * That run predates the licence: the licensed rows add ONE documented GOAL_CHANCE_LICENSED record (CEE's shape); the
 * unlicensed row is the run as served.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { formatWinProbability } from '../../utils/labelUtils'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

interface FxNode { id: string; kind: string; label: string }
const fx = JSON.parse(readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/mrr-90b8f080.fixture.json'), 'utf8')) as {
  draft: { nodes: FxNode[]; edges: Array<{ from: string; to: string }> }
  analysis_ready: { options: Array<Record<string, unknown>> }
  analysis_block: unknown
}
const served = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as Record<string, any>
const nodes = fx.draft.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind } }))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }))
const ID = 'increase_price_to_59'
const OTHER = 'keep_current_49_price'
const LICENCE = {
  code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
  option_ids: [OTHER, ID], pct_by_option: { [OTHER]: 0, [ID]: 41 },
  target: { comparator: 'at_least', value: 100000, unit: '£/month' },
  horizon_untested: true, horizon_line: 'This model doesn’t yet say whether any option gets there within 12 months.',
}

const seed = (report: Record<string, any>) => useCanvasStore.setState({
  nodes, edges, viewMode: 'standard', analysisStateV1: null,
  ceeAnalysisReady: { ...fx.analysis_ready, options: fx.analysis_ready.options.map((o) => ({ ...o, id: o.id ?? o.option_id })) },
  analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-27T09:41:42.494Z' },
  analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: 'mrr-90b8f080',
  v5AnalysisFact: { scenarioId: 'mrr-90b8f080', analysisHash: 'run-90b8', hasRunAnalysisFact: true },
  hasCompletedFirstRun: true,
  results: { status: 'complete', hash: 'run-90b8', report },
} as never)
const withWarnings = (extra: Record<string, unknown>[], base = served) => ({ ...base, inference_warnings: [...(base.inference_warnings ?? []), ...extra] })
const renderCard = (id: string) => {
  const n = nodes.find((x) => x.id === id)!
  return render(<ReactFlowProvider><OptionNode
    id={n.id} type="option" data={n.data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></ReactFlowProvider>)
}
const share = formatWinProbability(served.option_probabilities[ID].win_probability)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null } } as never)
})

describe('RunView PR 2: the card leads with the goal chance (#87, Science §(q))', () => {
  it('RED: a licensed Run → "about 41% chance of meeting your goal" on the face; never "supported by"; the share is hover detail', () => {
    seed(withWarnings([LICENCE]))
    renderCard(ID)
    expect(screen.getByTestId(`option-goal-chance-words-${ID}`).textContent).toBe('about 41% chance of meeting your goal')
    expect(screen.queryByTestId(`option-win-prefix-${ID}`)).toBeNull()
    expect(screen.queryByTestId(`option-win-figure-${ID}`)).toBeNull()
    const hover = screen.getByTestId(`option-goal-chance-${ID}`).getAttribute('aria-label')!
    // §(q): the §(o) horizon line (the licence's own, verbatim) is the hover's FIRST line; the share follows the chance.
    expect(hover.startsWith(LICENCE.horizon_line)).toBe(true)
    expect(hover).toContain('about 41% chance of meeting your goal, in this model.')
    expect(hover).toContain(`In this model, ${share} of runs supported this option.`)
    expect(hover.indexOf('chance of meeting')).toBeLessThan(hover.indexOf('of runs supported'))
  })

  it('CEE\'s display words: a 0 figure is "less than 1%", never "0%" or a floor+1 "< 1%" badge', () => {
    seed(withWarnings([LICENCE]))
    renderCard(OTHER)
    expect(screen.getByTestId(`option-goal-chance-words-${OTHER}`).textContent).toBe('less than 1% chance of meeting your goal')
    expect(document.body.textContent).not.toMatch(/<\s*\d+%/)
  })

  it('§(q): Olumi-estimated links (RC4) → "· on Olumi’s estimates" on the face, the count in the hover', () => {
    seed(withWarnings([{ ...LICENCE, olumi_estimate_link_count: 2 }]))
    renderCard(ID)
    expect(screen.getByTestId(`option-goal-chance-words-${ID}`).textContent).toBe('about 41% chance of meeting your goal · on Olumi’s estimates')
    expect(screen.getByTestId(`option-goal-chance-${ID}`).getAttribute('aria-label')).toContain('in this model, on Olumi’s estimates for 2 links.')
  })

  it('an option CEE withheld → "chance not shown yet", with CEE\'s withheld sentence in the hover; no figure', () => {
    seed(withWarnings([{ ...LICENCE, pct_by_option: { [OTHER]: 0 }, withheld_option_ids: [ID] }]))
    renderCard(ID)
    expect(screen.getByTestId(`option-goal-chance-words-${ID}`).textContent).toBe('chance not shown yet')
    expect(screen.getByTestId(`option-goal-chance-${ID}`).getAttribute('aria-label')).toContain('Olumi can’t yet say its chance of meeting your goal, in this model.')
  })

  it('DL ruling 1 (the run as served: goal figures, NO licence) → "Run the analysis again to see the chance"; no share on the face', () => {
    seed(served)
    renderCard(ID)
    expect(screen.getByTestId(`option-goal-chance-words-${ID}`).textContent).toBe('Run the analysis again to see the chance')
    expect(screen.queryByTestId(`option-win-figure-${ID}`)).toBeNull()
  })

  it('CONTROL (#87 (d)): a Run with no goal figures keeps the share line; it is then the only result, never beside a chance', () => {
    const noGoal = { ...served, option_probabilities: Object.fromEntries(Object.entries(served.option_probabilities as Record<string, Record<string, unknown>>)
      .map(([id, p]) => { const { goal_probability: _g, probability_of_goal: _p, ...rest } = p; return [id, rest] })) }
    seed(noGoal)
    renderCard(ID)
    expect(screen.queryByTestId(`option-goal-chance-${ID}`)).toBeNull()
    expect(screen.getByTestId(`option-win-figure-${ID}`).textContent).toBe(share)
  })
})
