import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../../../canvas/nodes/shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../../../canvas/store'
import { buildRunView, OPTION_CHANCE_WITHHELD, RUN_AGAIN_FOR_CHANCE } from '../../../../canvas/runView/runView'
import { chanceCellOf, withChanceReport } from './helpers/chanceCellOf'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { HERO_COPY } from '../heroCopy'
import { DecisionMatrix } from '../../analysisNew/sections/DecisionMatrix'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { goalChanceHeroSays } from '../../utils/goalChanceLicence'
import { fx, seedPaulRun, resetPaulRun, SERVED_STAMP } from '../../__tests__/helpers/paulRun4276f3f9'


vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
const X = 'angel_bridge'
const IDS = fx.draft.nodes.filter(n => n.kind === 'option').map(n => n.id)
// Report side uses the captured Paul Run and the existing DecisionMatrix range/licence variants.
function seed(kind: 'figure' | 'range' | 'withheld' | 'no-licence') {
  seedPaulRun(SERVED_STAMP)
  const s = useCanvasStore.getState()
  const link = fx.draft.edges[0]
  const licence = { code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: IDS, target: { comparator: 'at_least', value: 1200000, unit: '£' },
    pct_by_option: Object.fromEntries(IDS.filter(id => kind === 'figure' || id !== X).map(id => [id, 41])),
    withheld_option_ids: kind === 'figure' ? [] : [X] }
  const range = { code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: [X], range_by_option: { [X]: {
    low_pct: 0, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5',
    kind: 'link_strength', from: link.from, to: link.to, among: 'all',
  } } }
  useCanvasStore.setState({ results: { ...s.results, report: { ...s.results.report,
    run_id: 'run-ws5', computed_against_hash: 'hash-ws5',
    option_probabilities: Object.fromEntries(IDS.map(id => [id, { win_probability: 0.3, ...(kind === 'no-licence' ? { goal_probability: 0.41 } : {}) }])),
    inference_warnings: kind === 'no-licence' ? [] : [licence, ...(kind === 'range' ? [range] : [])],
  } }, ceeAnalysisReady: { ...s.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' } } as never)
  return withChanceReport(renderHook(() => useResultsSectionData()).result.current, useCanvasStore.getState().results.report)
}
const ctx = (data: ReturnType<typeof seed>) => ({ goalChanceHeroSays: goalChanceHeroSays(data.recommendation.goalThreshold, data.recommendation.allOptions, data.goalChanceLicence ?? null),
  labelOf: (id: string) => data.recommendation.allOptions.find(o => o.id === id)?.label ?? null,
  rangeLabelOf: data.goalChanceDriverNames!.labelOf })
function parity(data: ReturnType<typeof seed>, expected?: string) {
  const m = buildHeroModel(data)
  expect(m.kind).toBe('chart')
  if (m.kind !== 'chart') throw new Error('chart required')
  expect(m.lenses).toContain('goal')
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  render(<><AnalysisHeroPanel model={m} rerunDisabled={false} /><DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={IDS} run={{}} isStale={false} /></>)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  for (const row of m.rows) {
    const cell = data.runView!.chanceCellOf(row.id, ctx(data))
    expect(row.goal.readout).toBe(cell.text ?? HERO_COPY.readout.missing)
    const heroText = screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right > span')!.textContent
    expect(heroText).toBe(cell.text ?? HERO_COPY.readout.missing)
    expect(screen.getByTestId(`decision-matrix-chance-${row.id}`).querySelector('span')!.textContent).toBe(cell.text ?? 'Not shown.')
  }
  expect(screen.queryByText(HERO_COPY.lensUnavailable.goalProducerGap)).toBeNull()
  if (expected) expect(m.rows.find(r => r.id === X)!.goal.readout).toBe(expected)
  return m
}
const STORE_MODULE = '../../../../canvas/stores/canonicalAnalysisViewStore'
afterEach(async () => {
  cleanup(); resetPaulRun()
  const module = await import(STORE_MODULE).catch(() => null)
  module?.useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})
describe('WS5 hero chance truth', () => {
  it('H1 range-only goal lens is available; H3 range parity', () => parity(seed('range')))
  it('H2 licence-withheld goal row is available; H3 withheld parity', () => {
    const m = parity(seed('withheld'))
    expect(m.rows.find(r => r.id === X)!.goal.readout).toContain(OPTION_CHANCE_WITHHELD)
  })
  it('H3 figure parity', () => parity(seed('figure')))
  it('goal figures without a licence keep the lens available with RunView’s Run-again cells', () => {
    const data = seed('no-licence')
    const m = parity(data)
    for (const row of m.rows) {
      const cardCell = chanceCellOf(data, row.id)
      expect(cardCell.text).toBe(RUN_AGAIN_FOR_CHANCE)
      expect(row.goal.readout).toBe(cardCell.text)
      const node = useCanvasStore.getState().nodes.find(n => n.id === row.id)!
      const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
      </OptionChanceCellProvider></ReactFlowProvider>)
      expect(screen.getByTestId(`option-win-readout-${row.id}`).textContent).toBe(cardCell.text)
      card.unmount()
    }
  })
  it('H4 no target preserves the goalNoTarget body', () => {
    const data = seed('figure')
    data.goalChanceLicence = null
    data.goalChanceRange = null
    data.runView = buildRunView(null)
    data.recommendation = { ...data.recommendation, goalThreshold: null }
    const m = buildHeroModel(data)
    expect(m.kind).toBe('chart')
    if (m.kind !== 'chart') throw new Error('chart required')
    render(<AnalysisHeroPanel model={m} rerunDisabled={false} />)
    fireEvent.click(screen.getByRole('tab', { name: /Goal fit/ }))
    expect(screen.getByText(HERO_COPY.lensUnavailable.goalNoTarget)).toBeInTheDocument()
  })
})
