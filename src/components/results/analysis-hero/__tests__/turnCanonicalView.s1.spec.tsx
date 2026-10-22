import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import figures from './fixtures/cee-94b2554d-served-read-b38d1c80.json'
import served from '../../../../canvas/runView/__tests__/fixtures/cee-1c-served-read-464abd0a.json'
import { applyRealRead } from './helpers/realScenarioRead'
import { parseV5Response } from '../../../../v5/responseParser'
import { applyV5State } from '../../../../v5/applyV5State'
import { CHANCE_NOT_SHOWN_YET } from '../../../../canvas/runView/runView'
import { useCanvasStore } from '../../../../canvas/store'
import type { ReportV1 } from '../../../../adapters/plot/types'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { OptionNode } from '../../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider, faceWithoutOwnLabel } from '../../../../canvas/nodes/shared/OptionChanceCellProvider'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})
async function turn(view: unknown = served.canonical_analysis_view, include = true) {
  const body = { response_version: 2, assistant_text: '', blocks: [served.analysis_result],
    suggested_actions: [], insights: [], stage_indicator: 'analyse', analysis_state: served.analysis_state,
    ...(include ? { canonical_analysis_view: view } : {}) }
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200 }))
  expect(parsed.kind).toBe('response')
  if (parsed.kind !== 'response') throw new Error('Turn parse failed')
  return parsed.response
}
function apply(response: Awaited<ReturnType<typeof turn>>, scenarioId = served.scenario_id) {
  const store = useCanvasStore.getState()
  return applyV5State(response, { ...store, currentResultsHash: null }, { turnScenarioId: scenarioId })
}

it('T1: parsed Run TURN adopts its view and the mounted hero and (post-C item 1) the canvas card show served faces without reload', async () => {
  await applyRealRead({ j: served })
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  useCanvasStore.setState({ results: { status: 'idle', report: null } } as never)
  const dataHook = renderHook(() => useResultsSectionData())
  const response = await turn()
  act(() => { apply(response) })
  expect(useCanonicalAnalysisViewStore.getState()).toMatchObject({ scenarioId: served.scenario_id, view: served.canonical_analysis_view })
  const data = dataHook.result.current
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  // The decision matrix is removed in C (#2747 re-scope 2). Post-C UI item 1 (DL, 12 Oct): the canvas card says CEE's served
  // face for its option, verbatim, as the hero does. In C the card showed no chance (U0).
  for (const option of served.canonical_analysis_view.options) {
    const text = option.cell.face
    const row = model.rows.find(r => r.id === option.option_id)!
    expect(screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right > span')!.textContent).toBe(text)
    const node = useCanvasStore.getState().nodes.find(n => n.id === option.option_id)!
    const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
      selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    // #2931 (DL 22 Oct): the named card drops the face's own ‘label’: prefix; the full face stays in its description.
    const readout = screen.getByTestId(`option-win-readout-${node.id}`)
    expect(readout.textContent).toBe(faceWithoutOwnLabel(text))
    expect(readout.closest('[aria-label]')?.getAttribute('aria-label')).toContain(text)
    card.unmount()
  }
})
it('T2: absent and invalid TURN views keep the previous store object unchanged', async () => {
  await applyRealRead({ j: served })
  const before = useCanonicalAnalysisViewStore.getState()
  for (const response of [await turn(undefined, false), await turn({ schema: 'invalid' })]) {
    act(() => { apply(response) })
    expect(useCanonicalAnalysisViewStore.getState()).toBe(before)
  }
})
it('T3: a TURN dispatched for B cannot replace current A view', async () => {
  await applyRealRead({ j: served })
  const before = useCanonicalAnalysisViewStore.getState()
  const foreign = { ...served.canonical_analysis_view, face_when_stale: 'FOREIGN CONTROL' }
  const response = await turn(foreign)
  act(() => { apply(response, 'scenario-B') })
  expect(useCanonicalAnalysisViewStore.getState()).toBe(before)
})
it.each(['licensed', 'goal-figures-only'] as const)('D1/A1/A2: %s report with no matching view shows only the static absence face on the hero (nothing on the card in C)', async source => {
  await applyRealRead(figures)
  if (source === 'goal-figures-only') {
    const state = useCanvasStore.getState()
    const report = state.results.report as ReportV1 & { inference_warnings?: Array<{ code?: string }> }
    useCanvasStore.setState({ results: { ...state.results, report: { ...report,
      inference_warnings: report.inference_warnings?.filter(w => w.code !== 'GOAL_CHANCE_LICENSED'),
    } } } as never)
  }
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  const data = renderHook(() => useResultsSectionData()).result.current
  if (source === 'licensed') expect(data.runView!.goalChance).not.toBeNull()
  else { expect(data.runView!.goalChance).toBeNull(); expect(data.runView!.unlicensedGoalFigures).toBe(true) }
  for (const option of data.recommendation.allOptions) expect(data.runView!.chanceCellOf(option.id, { goalChanceHeroSays: true, hasGoalTarget: true, labelOf: () => 'option' })).toEqual({ kind: 'withheld', text: CHANCE_NOT_SHOWN_YET })
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  const hero = render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  expect(hero.container.textContent).not.toMatch(/chance of meeting|can’t yet say its chance|Run the analysis again to see the chance/)
  for (const option of data.recommendation.allOptions) {
    const row = model.rows.find(r => r.id === option.id)!
    const heroCell = screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right')!
    expect(heroCell.querySelector('span')!.textContent).toBe(CHANCE_NOT_SHOWN_YET)
    expect(heroCell.textContent).not.toMatch(/%|Why\?/)
    const node = useCanvasStore.getState().nodes.find(n => n.id === option.id)!
    const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
      selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    // #2747 re-scope 2 (U0): the canvas card shows no chance in C, not even the absence face.
    expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
    card.unmount()
  }
})

it('D2/A3: served 464abd0a READ preserves every producer face and why unchanged', async () => {
  await applyRealRead({ j: served })
  const data = renderHook(() => useResultsSectionData()).result.current
  for (const option of served.canonical_analysis_view.options) {
    const cell = data.runView!.chanceCellOf(option.option_id, { goalChanceHeroSays: false, labelOf: () => null })
    expect(cell).toEqual({ kind: option.cell.kind, text: option.cell.face,
      ...('why' in option.cell ? { why: option.cell.why } : {}) })
  }
})

// Absence face is an eligibility state, never a pre-Run or target-creation prompt.
it.each(['pre-run', 'no-goal-target', 'not-analysed'] as const)('A4: %s keeps the chance cell absent', async state => {
  await applyRealRead(figures)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  const canvas = useCanvasStore.getState()
  if (state === 'pre-run') {
    useCanvasStore.setState({ results: { status: 'idle', report: null }, hasCompletedFirstRun: false } as never)
    const options = useCanvasStore.getState().nodes.filter(node => node.type === 'option')
    expect(options.length).toBeGreaterThan(0)
    for (const node of options) {
      const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
      </OptionChanceCellProvider></ReactFlowProvider>)
      expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
      card.unmount()
    }
    return
  }
  if (state === 'no-goal-target') useCanvasStore.setState({
    goalThreshold: null, ceeAnalysisReady: { ...canvas.ceeAnalysisReady, goal_threshold_raw: undefined },
    nodes: canvas.nodes.map(node => node.type === 'goal' ? { ...node, data: { ...node.data,
      success_threshold: undefined, goal_threshold: undefined, goal_threshold_raw: undefined,
      threshold_source: undefined, goal_threshold_source: undefined, goal_target: undefined,
      observedState: undefined, observed_state: undefined, threshold: undefined,
    } } : node),
  } as never)
  const data = renderHook(() => useResultsSectionData()).result.current
  expect(data.recommendation.allOptions.length).toBeGreaterThan(0)
  if (state === 'no-goal-target') expect(data.recommendation.goalThreshold).toBeNull()
  for (const option of data.recommendation.allOptions) {
    if (state === 'not-analysed') expect(data.runView!.chanceCellOf(option.id, {
      goalChanceHeroSays: true, hasGoalTarget: true, notAnalysed: true, labelOf: () => 'option',
    })).toEqual({ kind: 'none', text: null })
    else {
      const { optionChanceCellFromResults } = await import('../../optionChanceCellFromResults')
      expect(optionChanceCellFromResults(data, option.id)).toEqual({ kind: 'none', text: null })
    }
  }
})

it('G1: a matching stale canonical view renders exactly face_when_stale, never its chance figures', async () => {
  await applyRealRead({ j: served })
  const stale = parseCanonicalAnalysisView({ ...served.canonical_analysis_view, face_when_stale: 'Run the analysis again to see the chance.',
    staleness: { ...served.canonical_analysis_view.staleness, stale: true } })
  expect(stale).not.toBeNull()
  if (stale === null) throw new Error('Expected a valid stale canonical view')
  expect(stale.face_when_stale).toBe('Run the analysis again to see the chance.')
  act(() => useCanonicalAnalysisViewStore.getState().adopt(served.scenario_id, stale))
  const data = renderHook(() => useResultsSectionData()).result.current
  for (const option of stale.options) {
    const cell = data.runView!.chanceCellOf(option.option_id, { hasGoalTarget: true, goalChanceHeroSays: true, labelOf: () => null })
    expect(cell).toEqual({ kind: 'withheld', text: stale.face_when_stale })
    expect(cell.text).not.toMatch(/\d+%/)
    expect(cell.text).not.toContain('Why?')
  }
})
