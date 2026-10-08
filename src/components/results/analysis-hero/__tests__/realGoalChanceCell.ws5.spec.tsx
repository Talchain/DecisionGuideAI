/**
 * H1-REAL: untouched served READ, P02 B2 464abd0a, UI 5bd88ba9 / CEE 53a68cd.
 * Figure parity: untouched staging READ, b38d1c80, CEE 94b2554d.
 * Both run through hydration's real adapter/read-applier/mapper/resultsComplete and Results hook.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../../../canvas/nodes/shared/OptionChanceCellProvider'
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

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
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
function cardParity(data: ReturnType<typeof useResultsSectionData>, id: string) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)!
  const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
  </OptionChanceCellProvider></ReactFlowProvider>)
  expect(screen.getByTestId(`option-win-readout-${id}`).textContent).toBe(data.runView!.chanceCellOf(id, ctx(data)).text)
  card.unmount()
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
  it('H3/R2-5 historical served figure without a face prints only its display fragment across matrix/hero/card', async () => {
    const data = await from(figures)
    heroParity(data)
    for (const option of figures.j.canonical_analysis_view.options) {
      const text = data.runView!.chanceCellOf(option.option_id, ctx(data)).text!
      // C-CELL: historical bytes have no face; a client sentence is no longer licensed.
      expect(text).toBe(option.cell.display)
      for (const pct of option.cell.display.match(/\d+%/g)!) expect(text).toContain(pct)
      cardParity(data, option.option_id)
    }
  })
  it('C1/R2-1 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): matched canonical range overrides today’s legacy range sentence', async () => {
    const data = await from(p02)
    const current = data.runView!.chanceCellOf(X, ctx(data))
    const report = useCanvasStore.getState().results.report as unknown as { computed_against_hash: string }
    expect(report.computed_against_hash).toBe(p02.j.analysis_result.computed_against_hash)
    const canonical = { ...figures.j.canonical_analysis_view,
      run: { ...figures.j.canonical_analysis_view.run, graph_hash_at_run: report.computed_against_hash, computed_at: (useCanvasStore.getState().results.report as unknown as { meta: { computed_at: string } }).meta.computed_at },
      options: [{ option_id: X, cell: { kind: 'range', display: 'D-RANGE', detail: {} }, main_driver: { kind: 'not_recorded' } }],
    }
    const { useCanonicalAnalysisViewStore: store } = await import(STORE)
    store.getState().adopt(p02.j.scenario_id, canonical as never)
    const d = renderHook(() => useResultsSectionData()).result.current
    // C-CELL: the matched READ range always wins over the legacy range (DL r6-3a).
    expect(current.kind).toBe('range')
    expect(d.runView!.chanceCellOf(X, ctx(d))).toEqual({ kind: 'range', text: 'D-RANGE' })
    heroParity(d)
    cardParity(d, X)
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
    // C-CELL: no matching view means the preserved licence fallback, not the matched READ's display-only cell.
    const fallback = buildRunView(useCanvasStore.getState().results.report)
    for (const option of data.recommendation.allOptions) expect(view.chanceCellOf(option.id, ctx(data))).toEqual(fallback.chanceCellOf(option.id, ctx(data)))
  })
  it('C4 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): different run id ignored even when graph hash matches', async () => {
    const data = await from(figures)
    const d = variant(data, { kind: 'withheld', reasons: [{ code: 'test', message: 'M-SERVER' }] }, 'different')
    // C-CELL: a mismatched Run keeps the uncovered-path composer; a matched READ without face prints display only.
    expect(d.runView.chanceCellOf(X, ctx(d))).toEqual(buildRunView(useCanvasStore.getState().results.report).chanceCellOf(X, ctx(data)))
  })
  it.each([['M-SERVER', OPTION_CHANCE_WITHHELD], [null, OPTION_CHANCE_WITHHELD]])('C5 SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): withheld without a face never prints reasons.message %s', async (message, expected) => {
    const d = variant(await from(figures), { kind: 'withheld', reasons: [{ code: 'test', message }] })
    // C-CELL: reasons are not faces; old producer without face retains the existing fallback.
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
    cardParity(d, X)
  })
  it.each(['figure', 'range'] as const)('R2-1 known copy gap SELF-AUTHORED (shape from CEE unit test canonical-analysis-view.test.ts, not wire): canonical %s without any licensed line renders display', async kind => {
    const data = await from(figures)
    const canonical = { ...figures.j.canonical_analysis_view, options: [{ option_id: X, cell: { kind, display: 'D-FRAGMENT', detail: {} }, main_driver: { kind: 'not_recorded' } }] }
    const report = { ...useCanvasStore.getState().results.report, inference_warnings: [], option_probabilities: {} }
    const view = buildRunView(report, canonical as never)
    expect(view.chanceCellOf(X, ctx(data))).toEqual({ kind, text: 'D-FRAGMENT' })
  })
  it.each(['withheld', 'none'] as const)('R6-2 canonical %s suppresses the licence 69 everywhere on the hero', async kind => {
    const data = variant(await from(figures), kind === 'none' ? { kind } : { kind, reasons: [] })
    const model = buildHeroModel(data)
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') throw new Error('Expected chart')
    render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
    expect(model.subline).not.toContain('69%')
    expect(model.headline).not.toContain('69%')
    expect(screen.getByTestId('analysis-hero-panel').textContent).not.toContain('69%')
  })
  it('R6-2 canonical 71 replaces licence 69 in the subline, summary and row', async () => {
    const data = variant(await from(figures), { kind: 'figure', display: 'about 71%' })
    const model = heroParity(data)
    expect(model.subline).toContain('71%')
    expect(model.subline).not.toContain('69%')
    expect(screen.getByTestId('analysis-hero-panel').textContent).toContain('71%')
    expect(screen.getByTestId('analysis-hero-panel').textContent).not.toContain('69%')
  })
  it.each(['available', 'none_licensed', 'not_recorded'] as const)('WS5 canonical main_driver %s stays separate from the own-cell lead', async kind => {
    const data = await from(figures)
    const canonical = structuredClone(figures.j.canonical_analysis_view)
    const entry = canonical.options.find(o => o.option_id === X)!
    // C-CELL stimulus: an explicit additive face keeps this driver's option boundary. Historical bytes have display only.
    Object.assign(entry.cell, { face: `‘Launch starter tier’: ${entry.cell.display}` })
    const driver = { ...canonical.options[0].main_driver.driver, strength: 'stronger' }
    entry.main_driver = (kind === 'available' ? { kind, driver } : kind === 'none_licensed' ? { kind, reason: 'none' } : { kind }) as never
    const report = useCanvasStore.getState().results.report
    const d = { ...data, runView: buildRunView({ ...report, run_id: 'same' }, { ...canonical, run: { ...canonical.run, run_id: 'same' } } as never) }
    const model = buildHeroModel(d)
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') throw new Error('Expected chart')
    // C-LOST restored: the matching canonical driver follows its own cell on a separate line.
    const line = model.goalChanceLeadLines!.find(line => line.id === X)!
    expect(line.text).toBe(`‘Launch starter tier’: ${entry.cell.display}`)
    expect(line.text).not.toContain('It rests most')
    expect(line.text).not.toContain('‘Starter-tier availability’')
    const ownIndex = model.goalChanceLeadLines!.findIndex(line => line.id === X && line.kind === 'cell')
    if (kind === 'available') {
      expect(d.runView!.mainDriverOf(X)).toMatchObject({ from: driver.from, to: driver.to, strength: 'stronger' })
      const driverLine = model.goalChanceLeadLines![ownIndex + 1]
      expect(driverLine).toMatchObject({ id: X, kind: 'driver' })
      expect(driverLine.text).toBe('It rests most on how strongly ‘Price increase’ affects ‘monthly recurring revenue’, at the size you set: if that effect is stronger than that, the chance falls.')
      // Staging asks a shared-driver question once, on the first option carrying it.
      expect(model.subline!.split('How sure are you of that size?')).toHaveLength(2)
      expect(driverLine.text).not.toContain('‘Starter-tier availability’')
    } else {
      expect(d.runView!.mainDriverOf(X)).toBeNull()
      expect(model.goalChanceLeadLines!.filter(line => line.id === X && line.kind === 'driver')).toEqual([])
    }
  })
  it('R6-4 goal sentence readout wraps inside a bounded grid column', async () => {
    const model = heroParity(await from(figures))
    for (const row of model.rows) {
      const element = screen.getByTestId(`hero-option-row-${row.index}`)
      const readout = element.querySelector('.text-right > span')!.parentElement!
      expect(readout).toHaveClass('min-w-0', 'break-words', 'whitespace-normal')
      expect(readout).not.toHaveClass('whitespace-nowrap')
      expect(element.querySelector('button')).toHaveClass('grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_0.875rem]')
    }
  })

  it.each(['figure', 'withheld', 'none'] as const)('R6-2 numeric summary takes the canonical %s cell, including percentage-bearing option labels', async kind => {
    const data = await from(figures)
    const report = useCanvasStore.getState().results.report!
    const warnings = (report as unknown as { inference_warnings: Record<string, unknown>[] }).inference_warnings.map(w =>
      w.code === 'GOAL_CHANCE_LICENSED' ? { ...w, form: 'highest', summary_withheld: undefined, leader_option_id: X, next_option_id: 'raise_prices_10' } : w)
    const canonical = structuredClone(figures.j.canonical_analysis_view)
    canonical.options.find(o => o.option_id === X)!.cell = (kind === 'figure'
      ? { kind, display: 'about 71%' } : kind === 'withheld' ? { kind, reasons: [] } : { kind }) as never
    const view = buildRunView({ ...report, run_id: 'same', inference_warnings: warnings },
      { ...canonical, run: { ...canonical.run, run_id: 'same' } } as never)
    expect(view.goalChance).not.toBeNull()
    const model = buildHeroModel({ ...data, runView: view, goalChanceLicence: view.goalChance })
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') throw new Error('Expected chart')
    expect(model.headline).not.toContain('69%')
    if (kind === 'figure') {
      expect(model.headline).toContain('about 71%, against about 46%')
      expect(model.headline).not.toContain('against 10%')
    } else expect(model.headline).not.toMatch(/\d+%/)
  })

})
