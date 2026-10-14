import { withCanonicalTestCells } from './helpers/canonicalTestCells'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../../canvas/store'
import { CHANCE_NOT_SHOWN_YET } from '../../../../canvas/runView/runView'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { AnalysisNewTabBody } from '../../analysisNew/AnalysisNewTabBody'
import { DecisionMatrix, type DecisionMatrixProps } from '../../analysisNew/sections/DecisionMatrix'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../utils/goalIdentityWithheld'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
const TEST_RUN_AGAIN_COPY = 'Run the analysis again to see the chance.'

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
  return withCanonicalTestCells(renderHook(() => useResultsSectionData()).result.current)
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

  it('rows follow CEE’s option order; every quoted chance is the exact hero statement, bound by id', () => {
    const data = seedChance()
    const props = propsFor(data)
    const hero = buildHeroModel(data) as HeroChartModel
    expect(hero.kind).toBe('chart')
    render(<DecisionMatrix {...props} />)
    open()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(data.recommendation.allOptions.length)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(MODEL_ORDER.map((id) => `decision-matrix-row-${id}`))
    for (const option of SCORED) {
      const cell = screen.getByTestId(`decision-matrix-chance-${option.id}`)
      const words = cell.querySelector('span')!.textContent!
      expect(words).toContain(`‘${option.label}’:`)
      expect(hero.subline).toContain(words)
    }
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('a historical withheld capture without a canonical view leaves every chance cell empty and says the Run’s served withheld line once', () => {
    const mapped = mapV5AnalysisToReport(withheldCapture.analysis_result as never, {} as never)
    useCanvasStore.setState({
      nodes: withheldCapture.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, kind: n.kind } })),
      edges: [], results: { status: 'complete', report: mapped }, hasCompletedFirstRun: true,
    } as never)
    const data = renderHook(() => useResultsSectionData()).result.current
    expect(data.recommendation.goalFiguresWithheldMessage).toMatch(/^Not shown\./)
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    // No served cell: no chance words in any cell; the Run's own served withheld line, byte-for-byte, once.
    for (const option of data.recommendation.allOptions) {
      expect(screen.getByTestId(`decision-matrix-chance-${option.id}`).textContent).toBe('')
    }
    expect(screen.getByTestId('decision-matrix-withheld').textContent).toBe(data.recommendation.goalFiguresWithheldMessage)
    expect(screen.getAllByText(data.recommendation.goalFiguresWithheldMessage!)).toHaveLength(1)
    expect(screen.getByRole('table').textContent).not.toMatch(/\d+(?:\.\d+)?%/)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('a Run with goal figures and no canonical view never composes chance text from the report', () => {
    seedPaulRun(SERVED_STAMP)
    const state = useCanvasStore.getState()
    const source = state.results.report as unknown as Record<string, unknown>
    const probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, row]) =>
      [id, { ...row, ...(id in PCT ? { goal_probability: PCT[id as keyof typeof PCT] / 100 } : {}) }]))
    const warnings = ((source.inference_warnings ?? []) as Array<{ code?: string }>).filter((w) =>
      !GOAL_FIGURES_WITHHELD_CODES.includes(w.code ?? '') && w.code !== 'GOAL_CHANCE_LICENSED')
    useCanvasStore.setState({
      results: { ...state.results, report: { ...source, option_probabilities: probabilities, inference_warnings: warnings } },
      ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
    } as never)
    const data = renderHook(() => useResultsSectionData()).result.current
    expect(data.goalChanceLicence).toBeNull()
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    for (const id of QUOTED_ORDER) {
      const cell = screen.getByTestId(`decision-matrix-chance-${id}`).textContent!
      expect(cell).toBe(CHANCE_NOT_SHOWN_YET)
      expect(cell).not.toContain(TEST_RUN_AGAIN_COPY)
      expect(cell).not.toMatch(/\d+%/)
      expect(cell).not.toContain('Why?')
    }
  })

  it('one withheld option uses the hero words without a figure', () => {
    const data = seedChance('angel_bridge')
    const hero = buildHeroModel(data) as HeroChartModel
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    const words = screen.getByTestId('decision-matrix-chance-angel_bridge').querySelector('span')!.textContent!
    expect(words).toContain('Olumi can’t yet say its chance of meeting your goal, in this model.')
    expect(hero.subline).toContain(words)
    expect(words).not.toMatch(/\d+(?:\.\d+)?%/)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('opening the matrix and outcome disclosure causes no fetch, storage, store action, or store notification', () => {
    const props = propsFor(seedChance())
    const before = useCanvasStore.getState()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const setSpy = vi.spyOn(useCanvasStore, 'setState')
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    const notified = vi.fn()
    const unsubscribe = useCanvasStore.subscribe(notified)
    render(<DecisionMatrix {...props} />)
    open()
    fireEvent.click(screen.getByTestId('decision-matrix-outcomes-toggle'))
    expect(screen.getByTestId(`decision-matrix-outcome-${CONVERTIBLE}`)).toBeVisible()
    expect(useCanvasStore.getState()).toBe(before)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    expect(storageSpy).not.toHaveBeenCalled()
    expect(notified).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('a new Run resets the disclosure; stale renders only its line', () => {
    const props = propsFor(seedChance())
    const view = render(<DecisionMatrix {...props} />)
    open()
    view.rerender(<DecisionMatrix {...props} run={{ ...RUN, completedAt: 1791374400000 }} />)
    expect(screen.getByTestId('decision-matrix-toggle')).toHaveAttribute('aria-expanded', 'false')
    open()
    expect(screen.getByRole('table')).toBeVisible()
    view.rerender(<DecisionMatrix {...props} isStale />)
    expect(screen.getByRole('status')).toHaveTextContent('This Run is stale.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByTestId('decision-matrix-stamp')).toBeNull()
    expect(screen.queryByTestId('decision-matrix-horizon')).toBeNull()
    expect(screen.queryByTestId('decision-matrix-outcomes-toggle')).toBeNull()
  })

  it('bounded chances keep the hero words', () => {
    const data = seedChance(undefined, { ...PCT, angel_bridge: 100 })
    render(<DecisionMatrix {...propsFor(data)} />)
    open()
    expect(screen.getByTestId('decision-matrix-chance-angel_bridge')).toHaveTextContent('more than 99%')
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('the stamp uses Compare’s human-readable Run time; full hash and ISO time are data attributes only', () => {
    render(<DecisionMatrix {...propsFor(seedChance())} />)
    open()
    const stamp = screen.getByTestId('decision-matrix-stamp')
    const when = new Date(RUN.computedAt!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    expect(stamp.textContent).toBe(`From the Run at ${when}`)
    expect(stamp.textContent).not.toMatch(/[a-f0-9]{8,}/i)
    expect(stamp.textContent).not.toContain(RUN.computedAt!)
    expect(stamp).toHaveAttribute('data-graph-hash', RUN.graphHash)
    expect(stamp).toHaveAttribute('data-computed-at', RUN.computedAt)
    expect(stamp).toHaveClass(...typography.panelMeta.split(' '))
  })

  it('missing or invalid Run metadata stays explicitly unrecorded', () => {
    const props = propsFor(seedChance())
    const view = render(<DecisionMatrix {...props} run={{}} />)
    open()
    expect(screen.getByTestId('decision-matrix-stamp').textContent).toBe('From the Run (time not recorded)')
    view.rerender(<DecisionMatrix {...props} run={{ computedAt: 'invalid' }} />)
    open()
    expect(screen.getByTestId('decision-matrix-stamp')).not.toHaveTextContent('Invalid Date')
    expect(screen.getByTestId('decision-matrix-stamp')).toHaveTextContent('time not recorded')
  })

  it('the slim table has no UI chance label, panelBody core cells, and no inputs or weighted scores', () => {
    render(<DecisionMatrix {...propsFor(seedChance())} />)
    open()
    const matrix = screen.getByTestId('decision-matrix')
    const table = screen.getByRole('table')
    // CEE's face names the option and the goal; the matrix sets no chance label of its own beside it (no header row; the
    // sentinel census reads the words).
    expect(within(table).queryAllByRole('columnheader')).toHaveLength(0)
    for (const cell of table.querySelectorAll('th, td')) {
      expect(cell).toHaveClass(...typography.panelBody.split(' '))
      expect(cell).not.toHaveClass('text-[11px]')
    }
    expect(matrix.querySelector('input')).toBeNull()
    expect(matrix.querySelector('[data-testid^="decision-matrix-score-"]')).toBeNull()
    expect(matrix.textContent).not.toMatch(/weight|score =|best|winner|recommend/i)
    expect(screen.getByTestId('decision-matrix-outcomes-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`decision-matrix-outcome-${CONVERTIBLE}`)).toBeNull()
    fireEvent.click(screen.getByTestId('decision-matrix-outcomes-toggle'))
    expect(screen.getByTestId(`decision-matrix-outcome-${CONVERTIBLE}`)).toBeVisible()
    expect(table.querySelector('[data-testid^="decision-matrix-outcome-"]')).toBeNull()
  })
})
