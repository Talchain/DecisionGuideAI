import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import * as resultsData from '../../../components/results/useResultsSectionData'
import { DecisionMatrix } from '../../../components/results/analysisNew/sections/DecisionMatrix'
import { buildAnalysisNewViewModel } from '../../../components/results/analysisNew/buildAnalysisNewViewModel'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../../components/results/utils/goalIdentityWithheld'
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'
import { OPTION_CHANCE_WITHHELD, RUN_AGAIN_FOR_CHANCE } from '../../runView/runView'
import { GOAL_FIT_BASIS_CAVEAT_COPY, GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY } from '../../../components/results/utils/goalFitBasisCaveatCopy'
import { fx, SCORED, seedPaulRun, resetPaulRun } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
const ID = 'angel_bridge'
const ids = SCORED.map(o => o.id)
type Case = 'figure' | 'withheld' | 'unlicensed' | 'range' | 'none'

function seed(kind: Case) {
  seedPaulRun(null)
  const state = useCanvasStore.getState()
  const source = state.results.report as unknown as Record<string, unknown>
  const probabilities = Object.fromEntries(ids.map(id => [id, {
    ...(source.option_probabilities as Record<string, object>)[id],
    win_probability: 0.8, goal_probability: kind === 'none' ? undefined : 0.41,
    probability_of_goal: undefined,
  }]))
  const licence = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: ids,
    pct_by_option: Object.fromEntries(ids.filter(id => kind !== 'withheld' || id !== ID).map(id => [id, 41])),
    withheld_option_ids: kind === 'withheld' ? [ID] : [],
    target: { comparator: 'at_least', value: 1200000, unit: '£' },
  }
  const link = fx.draft.edges[0]
  const range = {
    code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: [ID],
    range_by_option: { [ID]: { low_pct: 0, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5',
      kind: 'link_strength', from: link.from, to: link.to, among: 'all' } },
  }
  const warnings = ((source.inference_warnings ?? []) as Array<{ code?: string }>).filter(w =>
    !GOAL_FIGURES_WITHHELD_CODES.includes(w.code ?? '') && w.code !== 'GOAL_CHANCE_LICENSED' && w.code !== 'GOAL_CHANCE_RANGE')
  useCanvasStore.setState({
    results: { ...state.results, report: { ...source, option_probabilities: probabilities,
      inference_warnings: [...warnings, ...(['figure', 'withheld', 'range'].includes(kind) ? [licence] : []), ...(kind === 'range' ? [range] : [])] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: kind === 'none' ? undefined : 1200000, goal_threshold_unit: '£' },
    goalThreshold: kind === 'none' ? null : 1200000,
  } as never)
}

function matrixText() {
  const data = renderHook(() => useResultsSectionData()).result.current
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  const view = render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={ids} run={{ hash: 'run-4276' }} isStale={false} />)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  const text = screen.getByTestId(`decision-matrix-chance-${ID}`).querySelector('span')!.textContent!
  view.unmount()
  return text
}

function card() {
  const n = useCanvasStore.getState().nodes.find(n => n.id === ID)!
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={ID} type="option" data={n.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable /></OptionChanceCellProvider></ReactFlowProvider>)
}

function setGoalBasis() {
  const state = useCanvasStore.getState()
  const report = state.results.report!
  const probabilities = report.option_probabilities!
  useCanvasStore.setState({ viewMode: 'expert', results: { ...state.results, report: {
    ...report, option_probabilities: { ...probabilities, [ID]: {
      ...probabilities[ID], goal_probability: 0.074, goalLevelAuthor: 'olumi',
      goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
    } },
  } } } as never)
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetPaulRun() })
describe('option card headline is the Results chance cell', () => {
  it.each(['figure', 'withheld', 'unlicensed', 'range'] as const)('%s: exact Results words, no runs share on face or accessible name', kind => {
    seed(kind)
    const expected = matrixText()
    if (kind === 'figure') expect(expected.toLowerCase()).toContain(GOAL_ANCHOR_COPY.readout('41%', false).toLowerCase())
    if (kind === 'withheld') expect(expected).toContain(OPTION_CHANCE_WITHHELD)
    if (kind === 'unlicensed') expect(expected).toBe(RUN_AGAIN_FOR_CHANCE)
    if (kind === 'range') expect(expected).toContain('chance of meeting your goal')
    const { container } = card()
    const row = screen.getByTestId(`option-analysis-currency-${ID}`)
    expect(row.textContent).toContain(expected)
    expect(row.getAttribute('aria-label')).toContain(expected)
    expect(row.textContent).toMatch(/^Current model/)
    expect(container.textContent).not.toContain('of runs')
    for (const element of container.querySelectorAll('[aria-label]')) expect(element.getAttribute('aria-label')).not.toContain('of runs')
  })

  it('none: a win share adds no headline, and the pre-run settings remain', () => {
    seed('none')
    expect(matrixText()).toBe('Not shown.')
    const { container } = card()
    expect(screen.queryByTestId(`option-analysis-currency-${ID}`)).toBeNull()
    expect(container.querySelector(`[data-testid^="option-change-row-${ID}-"]`)).not.toBeNull()
    expect(container.textContent).not.toContain('of runs')
    expect(container.textContent).not.toContain('chance of meeting your goal')
  })

  it('licensed figure: exactly one percent-bearing chance text, with no low-chance badge', () => {
    seed('figure')
    setGoalBasis()
    const { container } = card()
    const chanceTexts = [...container.querySelectorAll('span, p')].filter(element =>
      element.querySelector('span, p') === null && /%.*chance of meeting your goal/.test(element.textContent ?? ''))
    expect(chanceTexts.map(element => element.textContent)).toEqual([expect.stringContaining('41%')])
    expect(container.textContent).not.toMatch(/<\s*\d+%|Less than 8%/)
  })

  it('licensed figure: shows the same goal-fit base caveat as Results', () => {
    seed('figure')
    setGoalBasis()
    const data = renderHook(() => useResultsSectionData()).result.current
    const option = data.recommendation.allOptions.find(option => option.id === ID)!
    expect(option.goalFitBaseCaveat).toBe('olumi_estimate')
    expect(option.goalFitIsModelledBasis).toBe(false)
    card()
    expect(screen.getByTestId(`goal-fit-base-caveat-option-node-${ID}`).textContent).toBe(GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY)
    expect(screen.queryByTestId(`goal-fit-basis-caveat-option-node-${ID}`)).toBeNull()
  })

  it.each(['figure', 'withheld'] as const)('%s: modelled-basis caveat follows the Results entry, with a figure-only gate', kind => {
    seed(kind)
    setGoalBasis()
    const projection = renderHook(() => useResultsSectionData())
    const data = projection.result.current
    projection.unmount()
    vi.spyOn(resultsData, 'useResultsSectionData').mockReturnValue({ ...data, recommendation: {
      ...data.recommendation,
      allOptions: data.recommendation.allOptions.map(option => option.id === ID
        ? { ...option, goalFitIsModelledBasis: true } : option),
    } })
    card()
    const caveat = screen.queryByTestId(`goal-fit-basis-caveat-option-node-${ID}`)
    if (kind === 'figure') expect(caveat?.textContent).toBe(GOAL_FIT_BASIS_CAVEAT_COPY)
    else expect(caveat).toBeNull()
  })

  it.each(['withheld', 'unlicensed', 'range'] as const)('%s: carries Results basis metadata but shows no figure caveat', kind => {
    seed(kind)
    setGoalBasis()
    const data = renderHook(() => useResultsSectionData()).result.current
    expect(data.recommendation.allOptions.find(option => option.id === ID)?.goalFitBaseCaveat).toBe('olumi_estimate')
    card()
    expect(screen.queryByTestId(`goal-fit-base-caveat-option-node-${ID}`)).toBeNull()
    expect(screen.queryByTestId(`goal-fit-basis-caveat-option-node-${ID}`)).toBeNull()
  })
})
