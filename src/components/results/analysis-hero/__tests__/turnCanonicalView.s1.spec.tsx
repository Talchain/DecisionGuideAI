import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import figures from './fixtures/cee-94b2554d-served-read-b38d1c80.json'
import served from '../../../../canvas/runView/__tests__/fixtures/cee-1c-served-read-464abd0a.json'
import { applyRealRead } from './helpers/realScenarioRead'
import { parseV5Response } from '../../../../v5/responseParser'
import { applyV5State } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { DecisionMatrix } from '../../analysisNew/sections/DecisionMatrix'
import { OptionNode } from '../../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../../../canvas/nodes/shared/OptionChanceCellProvider'

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

it('T1: parsed Run TURN adopts its view and mounted card/hero/matrix show served faces without reload', async () => {
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
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={served.canonical_analysis_view.options.map(o => o.option_id)} run={{}} isStale={false} />)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  for (const option of served.canonical_analysis_view.options) {
    const text = option.cell.face
    const row = model.rows.find(r => r.id === option.option_id)!
    expect(screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right > span')!.textContent).toBe(text)
    expect(screen.getByTestId(`decision-matrix-chance-${option.option_id}`).querySelector('span')!.textContent).toBe(text)
    const node = useCanvasStore.getState().nodes.find(n => n.id === option.option_id)!
    const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
      selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    expect(screen.getByTestId(`option-win-readout-${node.id}`).textContent).toBe(text)
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
it('D1: a licensed report with no matching view prints no client chance sentence on card/hero/matrix', async () => {
  await applyRealRead(figures)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  const data = renderHook(() => useResultsSectionData()).result.current
  expect(data.runView!.goalChance).not.toBeNull()
  for (const option of data.recommendation.allOptions) expect(data.runView!.chanceCellOf(option.id, { goalChanceHeroSays: true, labelOf: () => 'option' })).toEqual({ kind: 'none', text: null })
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  const hero = render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  expect(hero.container.textContent).not.toMatch(/chance of meeting|can’t yet say its chance|Run the analysis again to see the chance/)
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={data.recommendation.allOptions.map(o => o.id)} run={{}} isStale={false} />)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  for (const option of data.recommendation.allOptions) {
    expect(screen.getByTestId(`decision-matrix-chance-${option.id}`).querySelector('span')!.textContent).toBe('Not shown.')
    const node = useCanvasStore.getState().nodes.find(n => n.id === option.id)!
    const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
      selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </OptionChanceCellProvider></ReactFlowProvider>)
    expect(screen.queryByTestId(`option-win-readout-${node.id}`)).toBeNull()
    card.unmount()
  }
})

it('D2: served 464abd0a READ preserves every producer face and why unchanged', async () => {
  await applyRealRead({ j: served })
  const data = renderHook(() => useResultsSectionData()).result.current
  for (const option of served.canonical_analysis_view.options) {
    const cell = data.runView!.chanceCellOf(option.option_id, { goalChanceHeroSays: false, labelOf: () => null })
    expect(cell).toEqual({ kind: option.cell.kind, text: option.cell.face,
      ...('why' in option.cell ? { why: option.cell.why } : {}) })
  }
})
