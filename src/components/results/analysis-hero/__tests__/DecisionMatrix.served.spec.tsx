import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { AnalysisNewTabBody } from '../../analysisNew/AnalysisNewTabBody'
import { DecisionMatrix, type DecisionMatrixProps } from '../../analysisNew/sections/DecisionMatrix'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../utils/goalIdentityWithheld'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { CONVERTIBLE, SCORED, SERVED_STAMP, fx, report, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'
import withheldCapture from '../../analysisNew/__tests__/fixtures/served-funding-goal-figures-withheld-dafdc620.json'

const MODEL_ORDER = fx.draft.nodes.filter((n) => n.kind === 'option').map((n) => n.id)
const QUOTED_ORDER = ['current_outreach', 'angel_bridge', CONVERTIBLE]
const PCT = { current_outreach: 20, angel_bridge: 41, [CONVERTIBLE]: 62 }
const ready = fx.analysis_ready as typeof fx.analysis_ready & { computed_at?: string; graph_hash_at_run?: string }
const RUN = { hash: 'run-4276', computedAt: ready.computed_at, graphHash: ready.graph_hash_at_run }

function propsFor(data: ReturnType<typeof useResultsSectionData>): DecisionMatrixProps {
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  return { data, comparison: vm.optionsComparison, optionOrder: MODEL_ORDER, run: RUN, isStale: vm.status.isStale }
}

/** Real mapped capture; positive controls change only the documented licence and per-option figures. */
function seedChance(withheldId?: string, pct = PCT, driverByOption: Record<string, unknown> = {}) {
  seedPaulRun(SERVED_STAMP)
  const state = useCanvasStore.getState()
  const source = state.results.report as unknown as Record<string, unknown>
  const probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, row]) =>
    [id, { ...row, ...(id in pct && id !== withheldId ? { goal_probability: pct[id as keyof typeof pct] / 100 } : {}) }]))
  const record = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: QUOTED_ORDER,
    pct_by_option: Object.fromEntries(Object.entries(pct).filter(([id]) => id !== withheldId)),
    withheld_option_ids: withheldId ? [withheldId] : [], target: { comparator: 'at_least', value: 1200000, unit: '£' },
    driver_by_option: driverByOption,
  }
  // Same documented record shape used by goalChanceDriverWords.hero; no invented result payload.
  expect(readGoalChanceLicence([record])).not.toBeNull()
  const warnings = ((source.inference_warnings ?? []) as Array<{ code?: string }>).filter((w) =>
    !GOAL_FIGURES_WITHHELD_CODES.includes(w.code ?? '') && w.code !== 'GOAL_CHANCE_LICENSED')
  useCanvasStore.setState({
    results: { ...state.results, report: { ...source, option_probabilities: probabilities, inference_warnings: [...warnings, record] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

function open() { fireEvent.click(screen.getByTestId('decision-matrix-toggle')) }

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetPaulRun() })

describe('Decision matrix — captured Run, shared hero words, read-only interaction', () => {
  it('is reachable on the served AnalysisNewTabBody path after a Run', () => {
    seedPaulRun(SERVED_STAMP)
    const data = renderHook(() => useResultsSectionData()).result.current
    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="run-4276" />)
    expect(screen.getByTestId('decision-matrix-toggle')).toHaveAttribute('aria-expanded', 'false')
    open()
    expect(screen.getByRole('table', { name: 'Decision matrix' })).toBeVisible()
  })

  it('rows are the Run options; every quoted chance is the exact hero statement, bound by id', () => {
    const data = seedChance()
    const props = propsFor(data)
    const hero = buildHeroModel(data) as HeroChartModel
    expect(hero.kind).toBe('chart')
    render(<DecisionMatrix {...props} />)
    open()
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(data.recommendation.allOptions.length)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      ...QUOTED_ORDER, ...MODEL_ORDER.filter((id) => !QUOTED_ORDER.includes(id) && data.recommendation.allOptions.some((o) => o.id === id)),
    ].map((id) => `decision-matrix-row-${id}`))
    for (const option of SCORED) {
      const cell = screen.getByTestId(`decision-matrix-chance-${option.id}`)
      const words = cell.querySelector('span')!.textContent!
      expect(words).toContain(`‘${option.label}’:`)
      expect(hero.subline).toContain(words)
    }
    expect(screen.getByTestId('decision-matrix-stamp')).toHaveTextContent(`From the Run at ${RUN.computedAt} · this model's version (${RUN.graphHash})`)
    expect(screen.queryByRole('columnheader', { name: "Your weighting (not Olumi's view)" })).toBeNull()
  })

  it('the served withheld capture keeps its producer words in every chance cell, never zero', () => {
    const mapped = mapV5AnalysisToReport(withheldCapture.analysis_result as never, {} as never)
    useCanvasStore.setState({
      nodes: withheldCapture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, kind: n.kind } })),
      edges: [], results: { status: 'complete', report: mapped }, hasCompletedFirstRun: true,
    } as never)
    const data = renderHook(() => useResultsSectionData()).result.current
    expect(data.recommendation.goalFiguresWithheldMessage).toMatch(/^Not shown\./)
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    for (const option of data.recommendation.allOptions) {
      expect(screen.getByTestId(`decision-matrix-chance-${option.id}`).querySelector('span')!.textContent).toBe(data.recommendation.goalFiguresWithheldMessage)
    }
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '1' } })
    expect(screen.queryByRole('columnheader', { name: "Your weighting (not Olumi's view)" })).toBeNull()
  })

  it('one withheld option uses the hero words and blocks the whole score column', () => {
    const data = seedChance('angel_bridge')
    const hero = buildHeroModel(data) as HeroChartModel
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    const words = screen.getByTestId('decision-matrix-chance-angel_bridge').querySelector('span')!.textContent!
    expect(words).toContain('Olumi can’t yet say its chance of meeting your goal, in this model.')
    expect(hero.subline).toContain(words)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '2' } })
    expect(screen.queryByRole('columnheader', { name: "Your weighting (not Olumi's view)" })).toBeNull()
  })

  it('the main-driver cell repeats the hero sentence about that option, with no new inference', () => {
    const link = fx.draft.edges.find((e) => fx.draft.nodes.some((n) => n.id === e.from) && fx.draft.nodes.some((n) => n.id === e.to))!
    const claim = { quantity_id: `${link.from}->${link.to}`, kind: 'link_existence', from: link.from, to: link.to,
      side: 'absent', pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false }
    const data = seedChance(undefined, PCT, { angel_bridge: claim })
    const hero = buildHeroModel(data) as HeroChartModel
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    const words = screen.getByTestId('decision-matrix-driver-angel_bridge').textContent!
    expect(words).toMatch(/^It rests most on/)
    expect(hero.subline).toContain(words)
  })

  it('weights change only the local score: no fetch, storage, store action, or store notification', () => {
    const data = seedChance()
    const props = propsFor(data)
    // A fourth, unscored model option remains a row; choose the Run's quoted subset for this scoring control.
    props.data = { ...data, recommendation: { ...data.recommendation, allOptions: data.recommendation.allOptions.filter((o) => QUOTED_ORDER.includes(o.id)) } }
    const before = useCanvasStore.getState()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const setSpy = vi.spyOn(useCanvasStore, 'setState')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    const notified = vi.fn()
    const unsubscribe = useCanvasStore.subscribe(notified)
    render(<DecisionMatrix {...props} />)
    open()
    const chance = screen.getByTestId('decision-matrix-chance-angel_bridge').textContent
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '1' } })
    expect(screen.getByTestId('decision-matrix-score-angel_bridge')).toHaveTextContent('41')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '2' } })
    expect(screen.getByTestId('decision-matrix-score-angel_bridge')).toHaveTextContent('82')
    expect(screen.getByTestId('decision-matrix-chance-angel_bridge').textContent).toBe(chance)
    expect(useCanvasStore.getState()).toBe(before)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    expect(storageSpy).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('a new Run resets weighting synchronously; stale renders only its line', () => {
    const props = propsFor(seedChance())
    const view = render(<DecisionMatrix {...props} />)
    open()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '2' } })
    // Even a repeat Run with the same response/graph hash and producer time resets the inputs.
    view.rerender(<DecisionMatrix {...props} run={{ ...RUN, completedAt: 1791374400000 }} />)
    open()
    expect(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' })).toHaveValue(null)
    expect(screen.queryByRole('columnheader', { name: "Your weighting (not Olumi's view)" })).toBeNull()
    view.rerender(<DecisionMatrix {...props} isStale />)
    expect(screen.getByRole('status')).toHaveTextContent('This Run is stale.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('spinbutton', { name: 'Chance weight (optional)' })).toBeNull()
    expect(screen.queryByTestId('decision-matrix-stamp')).toBeNull()
  })

  it('bounded chances are never treated as exact displayed numbers', () => {
    const data = seedChance(undefined, { ...PCT, angel_bridge: 100 })
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    expect(screen.getByTestId('decision-matrix-chance-angel_bridge')).toHaveTextContent('more than 99%')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Chance weight (optional)' }), { target: { value: '2' } })
    expect(screen.queryByRole('columnheader', { name: "Your weighting (not Olumi's view)" })).toBeNull()
  })
})
