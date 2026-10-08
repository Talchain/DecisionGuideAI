/**
 * H1-REAL: untouched served READ, P02 B2 464abd0a, UI 5bd88ba9 / CEE 53a68cd.
 * Figure parity: untouched staging READ, b38d1c80, CEE 94b2554d.
 * Both run through hydration's real adapter/read-applier/mapper/resultsComplete and Results hook.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { DecisionMatrix } from '../../analysisNew/sections/DecisionMatrix'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { goalChanceHeroSays } from '../../utils/goalChanceLicence'
import { buildRunView, OPTION_CHANCE_WITHHELD, RUN_AGAIN_FOR_CHANCE } from '../../../../canvas/runView/runView'
import { applyRealRead } from './helpers/realScenarioRead'
import p02 from './fixtures/p02-B2-464abd0a-read-reloaded.json'
import figures from './fixtures/cee-94b2554d-served-read-b38d1c80.json'
import bodies from '../../../../canvas/runView/__tests__/fixtures/cee-canonical-view-bodies-283b8a98.json'

const X = 'launch_starter_tier'
const STORE = '../../../../canvas/stores/canonicalAnalysisViewStore'
const ctx = (data: ReturnType<typeof useResultsSectionData>) => ({
  goalChanceHeroSays: goalChanceHeroSays(data.recommendation.goalThreshold, data.recommendation.allOptions, data.goalChanceLicence ?? null),
  goalFiguresWithheldMessage: data.recommendation.goalFiguresWithheldMessage,
  labelOf: (id: string) => data.recommendation.allOptions.find(o => o.id === id)?.label ?? null,
  rangeLabelOf: data.goalChanceDriverNames!.labelOf,
})
async function from(capture: typeof figures | typeof p02) {
  const read = await applyRealRead(capture)
  expect(read.outcome.outcome).toBe('applied')
  expect(read.report).toBeTruthy()
  return renderHook(() => useResultsSectionData()).result.current
}
function matrix(data: ReturnType<typeof useResultsSectionData>) {
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={data.recommendation.allOptions.map(o => o.id)} run={{}} isStale={false} />)
  // The shipped matrix disclosure starts closed, explaining an empty collapsed DOM capture.
  expect(screen.queryAllByTestId(/^decision-matrix-chance-/)).toHaveLength(0)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  return data.recommendation.allOptions.map(o => ({ id: o.id, text: screen.getByTestId(`decision-matrix-chance-${o.id}`).querySelector('span')!.textContent }))
}
function heroParity(data: ReturnType<typeof useResultsSectionData>) {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  expect(model.lenses).toContain('goal')
  render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  expect(screen.getByRole('tab', { name: /Goal fit/ }).textContent).not.toMatch(/not available for this run/i)
  expect(screen.queryByTestId('hero-lens-unavailable')).toBeNull()
  const entries = matrix(data)
  for (const row of model.rows) {
    const cell = data.runView!.chanceCellOf(row.id, ctx(data))
    expect(row.goal.readout).toBe(cell.text)
    expect(screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right > span')!.textContent).toBe(cell.text)
    expect(entries.find(e => e.id === row.id)!.text).toBe(cell.text)
  }
  return model
}
// SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire).
function variant(data: ReturnType<typeof useResultsSectionData>, cell: unknown, runId?: string) {
  const canonical = figures.j.canonical_analysis_view
  const report = useCanvasStore.getState().results.report
  return { ...data, runView: buildRunView({ ...report, run_id: 'same' }, {
    ...canonical, run: { ...canonical.run, run_id: runId ?? 'same' },
    options: [{ option_id: X, cell, main_driver: { kind: 'not_recorded' } }],
  } as never) }
}
afterEach(async () => {
  cleanup(); vi.unstubAllGlobals()
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null, results: { status: 'idle', report: null }, analysisStateV1: null,
    ceeAnalysisReady: null, analysisFreshness: null, lastAuthoritativeGraph: null } as never)
  const store = await import(STORE).catch(() => null)
  store?.useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})
describe('WS5 real served chance cells', () => {
  it('WIRE actual hydration adopts the parsed narrow adapter field, and the READER ignores it once the scenario changes', async () => {
    await from(figures)
    const { useCanonicalAnalysisViewStore: store } = await import(STORE)
    store.setState({ scenarioId: null, view: null })
    const { hydrateCanvasFromServer } = await import('../../../../canvas/hydrate/serverGraphHydration')
    await hydrateCanvasFromServer(figures.j.scenario_id, { retryDelayMs: 0 })
    expect(store.getState().view).toEqual(figures.j.canonical_analysis_view)
    expect(store.getState().scenarioId).toBe(figures.j.scenario_id)
    // Scoping is at READ time (no store subscription, #2709 r3). Bind by identity: plant a server figure that
    // disagrees with the licence, so a matched view shows the server fragment (R2-1) and an unmatched one cannot.
    const planted = structuredClone(figures.j.canonical_analysis_view)
    planted.options.find((o: { option_id: string }) => o.option_id === X)!.cell = { kind: 'figure', display: 'about 99%' }
    store.setState({ view: planted })
    useCanvasStore.setState({ currentScenarioId: figures.j.scenario_id })
    const matched = renderHook(() => useResultsSectionData()).result.current
    expect(matched.runView!.chanceCellOf(X, ctx(matched)).text).toBe('about 99%')
    useCanvasStore.setState({ currentScenarioId: 'different-scenario' })
    const other = renderHook(() => useResultsSectionData()).result.current
    expect(other.runView!.chanceCellOf(X, ctx(other)).text).not.toBe('about 99%')
    expect(store.getState().scenarioId).toBe(figures.j.scenario_id)
  })
  it('MATRIX-REAL before/after: P02 read has three cells when the existing disclosure is opened', async () => {
    const data = await from(p02)
    const entries = matrix(data)
    expect(entries).toHaveLength(3)
    expect(entries.find(e => e.id === X)!.text).toContain('between about 5% and 37%')
    console.info('MATRIX-REAL', JSON.stringify(entries))
  })
  it('H1-REAL P02 licensed RANGE without a point figure makes the goal lens available; H3 parity', async () => {
    const data = await from(p02)
    const model = heroParity(data)
    expect(model.rows.find(r => r.id === X)!.goal.value).toBeNull()
    expect(model.rows.find(r => r.id === X)!.goal.readout).toContain('between about 5% and 37%')
  })
  it('H3/R2-5 served figure matrix/hero parity preserves licensed sentences and canonical digits', async () => {
    const data = await from(figures)
    heroParity(data)
    for (const option of figures.j.canonical_analysis_view.options) {
      const text = data.runView!.chanceCellOf(option.option_id, ctx(data)).text!
      expect(text).not.toBe(option.cell.display)
      for (const pct of option.cell.display.match(/\d+%/g)!) expect(text).toContain(pct)
    }
  })
  it('C1/R2-1 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): canonical range keeps today’s licensed range sentence', async () => {
    const data = await from(p02)
    const current = data.runView!.chanceCellOf(X, ctx(data))
    const report = useCanvasStore.getState().results.report as unknown as { computed_against_hash: string }
    expect(report.computed_against_hash).toBe(p02.j.analysis_result.computed_against_hash)
    const canonical = { ...figures.j.canonical_analysis_view,
      run: { ...figures.j.canonical_analysis_view.run, graph_hash_at_run: report.computed_against_hash },
      options: [{ option_id: X, cell: { kind: 'range', display: 'D-RANGE', detail: {} }, main_driver: { kind: 'not_recorded' } }],
    }
    const { useCanonicalAnalysisViewStore: store } = await import(STORE)
    store.getState().adopt(p02.j.scenario_id, canonical as never)
    const d = renderHook(() => useResultsSectionData()).result.current
    expect(d.runView!.chanceCellOf(X, ctx(d))).toEqual(current)
    heroParity(d)
  })
  it('C2 real b_stale_after_edit with run withholds every cell, including options absent from the view', async () => {
    const data = await from(figures)
    const canonical = bodies.b_stale_after_edit
    const report = { ...useCanvasStore.getState().results.report, run_id: canonical.run.run_id }
    const view = buildRunView(report, canonical as never)
    for (const option of data.recommendation.allOptions) expect(view.chanceCellOf(option.id, ctx(data))).toEqual({ kind: 'withheld', text: RUN_AGAIN_FOR_CHANCE })
  })
  it.each([bodies.c_refused_only, bodies.c2_no_run])('C3 real no-run / unknown staleness falls through ($run)', async canonical => {
    const data = await from(figures)
    const view = buildRunView(useCanvasStore.getState().results.report, canonical as never)
    for (const option of data.recommendation.allOptions) expect(view.chanceCellOf(option.id, ctx(data))).toEqual(data.runView!.chanceCellOf(option.id, ctx(data)))
  })
  it('C4 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): different run id ignored even when graph hash matches', async () => {
    const data = await from(figures)
    const d = variant(data, { kind: 'withheld', reasons: [{ code: 'test', message: 'M-SERVER' }] }, 'different')
    expect(d.runView.chanceCellOf(X, ctx(d))).toEqual(data.runView!.chanceCellOf(X, ctx(data)))
  })
  it.each([['M-SERVER', 'M-SERVER'], [null, OPTION_CHANCE_WITHHELD]])('C5 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): withheld message %s', async (message, expected) => {
    const d = variant(await from(figures), { kind: 'withheld', reasons: [{ code: 'test', message }] })
    expect(d.runView.chanceCellOf(X, ctx(d))).toEqual({ kind: 'withheld', text: expected })
    heroParity(d)
  })
  it('C-LOST restored: basis caveat and joint identity stay beside the shared figure cell', async () => {
    const data = await from(figures)
    const option = data.recommendation.allOptions.find(o => o.id === X)!
    option.goalFitIsModelledBasis = true
    option.goalFitIsSubstitutedJoint = true
    const model = heroParity(data)
    const row = model.rows.find(r => r.id === X)!
    fireEvent.click(screen.getByTestId(`hero-option-row-${row.index}`).querySelector('button')!)
    expect(screen.getByTestId('hero-detail-goal-fit-caveat')).toHaveTextContent(GOAL_FIT_BASIS_CAVEAT_COPY)
    expect(screen.getByTestId('hero-detail-goal-fit')).toHaveTextContent(HERO_COPY.detail.goalFitJointBasis('about 69%'))
    expect(row.goal.readout).toBe(data.runView!.chanceCellOf(X, ctx(data)).text)
  })
  // C-FALSE: joint words beside a goal-only figure removed (DL ruling 8 Oct; staging measurement /private/tmp/ws5-core-constrained.md)
  it('C-FALSE removed: a mixed set keeps the constrained row and detail exactly on its goal-only cell', async () => {
    const data = await from(figures)
    const option = data.recommendation.allOptions.find(o => o.id === X)!
    option.constraintAnalysis = { constraints: [{ node_id: 'limit' }] } as never
    const model = heroParity(data)
    const row = model.rows.find(r => r.id === X)!
    const element = screen.getByTestId(`hero-option-row-${row.index}`)
    fireEvent.click(element.querySelector('button')!)
    const cellText = data.runView!.chanceCellOf(X, ctx(data)).text
    expect(element.querySelector('.text-right > span')!.textContent).toBe(cellText)
    expect(screen.getByTestId('hero-detail-goal-fit').textContent).toBe(cellText)
    expect(element.textContent).not.toMatch(/and limits|limits together/i)
    expect(screen.queryByTestId('hero-detail-goal-fit-identity')).toBeNull()
  })
  it('R2-1 consistency: canonical figure mismatch uses the server fragment', async () => {
    await from(figures)
    const canonical = { ...figures.j.canonical_analysis_view, options: [{ option_id: X, cell: { kind: 'figure', display: 'about 71%' }, main_driver: { kind: 'not_recorded' } }] }
    const { useCanonicalAnalysisViewStore: store } = await import(STORE)
    store.getState().adopt(figures.j.scenario_id, canonical as never)
    const d = renderHook(() => useResultsSectionData()).result.current
    d.recommendation.allOptions.find(o => o.id === X)!.goalFitIsSubstitutedJoint = true
    expect(d.runView!.chanceCellOf(X, ctx(d))).toEqual({ kind: 'figure', text: 'about 71%' })
    const model = heroParity(d)
    expect(model.rows.find(r => r.id === X)!.detail.goalFit).toBe(HERO_COPY.detail.goalFitJointBasis('about 71%'))
  })
  it.each(['figure', 'range'] as const)('R2-1 known copy gap SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): canonical %s without any licensed line renders display', async kind => {
    const data = await from(figures)
    const canonical = { ...figures.j.canonical_analysis_view, options: [{ option_id: X, cell: { kind, display: 'D-FRAGMENT', detail: {} }, main_driver: { kind: 'not_recorded' } }] }
    const report = { ...useCanvasStore.getState().results.report, inference_warnings: [], option_probabilities: {} }
    const view = buildRunView(report, canonical as never)
    expect(view.chanceCellOf(X, ctx(data))).toEqual({ kind, text: 'D-FRAGMENT' })
  })
})
