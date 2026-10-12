import { CHANCE_NOT_SHOWN_YET } from '../../runView/runView'
import { canonicalTestCellsOf } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { useResultsSectionData } from '../../../components/results/useResultsSectionData'
import * as resultsData from '../../../components/results/useResultsSectionData'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../../components/results/utils/goalIdentityWithheld'
const TEST_WITHHELD_FACE = 'Olumi can’t yet say its chance of meeting your goal, in this model.'
const TEST_RUN_AGAIN_COPY = 'Run the analysis again to see the chance.'

import { GOAL_FIT_BASIS_CAVEAT_COPY, GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY } from '../../../components/results/utils/goalFitBasisCaveatCopy'
import { fx, SCORED, seedPaulRun, resetPaulRun } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'
import { readGoalChanceRange } from '../../../components/results/utils/goalChanceRange'

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
    results: { ...state.results, report: { ...source, run_id: 'canonical-chance-fixture', option_probabilities: probabilities,
      inference_warnings: [...warnings, ...(['figure', 'withheld', 'range'].includes(kind) ? [licence] : []), ...(kind === 'range' ? [range] : [])] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: kind === 'none' ? undefined : 1200000, goal_threshold_unit: '£' },
    goalThreshold: kind === 'none' ? null : 1200000,
  } as never)
  if (kind !== 'unlicensed' && kind !== 'none') {
    const projection = renderHook(() => useResultsSectionData())
    // #2747: the projection's ranges are gated before this canonical view exists, so the fixture reads the Run's range record.
    const rawRange = readGoalChanceRange((useCanvasStore.getState().results.report as { inference_warnings?: unknown }).inference_warnings)
    const canonical = canonicalTestCellsOf({ ...projection.result.current, goalChanceRange: rawRange }, { run_id: 'canonical-chance-fixture', graph_hash_at_run: null, computed_at: null })
    projection.unmount()
    useCanonicalAnalysisViewStore.getState().adopt(state.currentScenarioId!, canonical)
  }
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

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetPaulRun(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
/**
 * #2747 re-scope 2 (U0): the canvas option card shows NO chance in C, whatever the Run holds — the journey path reads
 * chances on the Results hero (CEE's cells) and the chat analysis card only. The card keeps its pre-run settings and every
 * negative: no share of runs, no chance words, no figure caveat (a caveat qualifies a figure the card does not show).
 * Interim limit; the restore trigger is the chance's own served string and Run licence on the canvas (post-C).
 */
describe('option card shows no chance in C (the Results hero says it)', () => {
  it.each(['figure', 'withheld', 'unlicensed', 'range', 'none'] as const)('%s: no chance readout, face or accessible chance; settings remain', kind => {
    seed(kind)
    if (kind === 'figure' || kind === 'range') {
      // CONTROL: the Run DOES hold a chance cell for this option, so the card's silence is not a missing fixture.
      const data = renderHook(() => useResultsSectionData()).result.current
      expect(data.runView!.chanceCellOf(ID, { goalChanceHeroSays: true, labelOf: () => 'option' }).kind).not.toBe('none')
    }
    const { container } = card()
    expect(screen.queryByTestId(`option-analysis-currency-${ID}`)).toBeNull()
    expect(screen.queryByTestId(`option-win-readout-${ID}`)).toBeNull()
    expect(container.querySelector(`[data-testid^="option-change-row-${ID}-"]`)).not.toBeNull()
    for (const said of [container.textContent ?? '', ...[...container.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label') ?? '')]) {
      expect(said).not.toContain('of runs')
      expect(said).not.toContain('chance of meeting your goal')
      expect(said).not.toContain('41%')
      expect(said).not.toContain(TEST_WITHHELD_FACE)
      expect(said).not.toContain(TEST_RUN_AGAIN_COPY)
      expect(said).not.toContain(CHANCE_NOT_SHOWN_YET)
    }
  })

  it.each(['figure', 'withheld', 'unlicensed', 'range'] as const)('%s: no figure caveat is drawn beside a figure the card does not show', kind => {
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
    const { container } = card()
    expect(screen.queryByTestId(`goal-fit-base-caveat-option-node-${ID}`)).toBeNull()
    expect(screen.queryByTestId(`goal-fit-basis-caveat-option-node-${ID}`)).toBeNull()
    expect(container.textContent).not.toContain(GOAL_FIT_BASIS_CAVEAT_COPY)
    expect(container.textContent).not.toContain(GOAL_FIT_ESTIMATE_ONLY_CAVEAT_COPY)
  })
})
