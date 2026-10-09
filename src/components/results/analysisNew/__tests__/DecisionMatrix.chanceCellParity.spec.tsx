import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import * as runView from '../../../../canvas/runView/runView'
import { CHANCE_NOT_SHOWN_YET } from '../../../../canvas/runView/runView'
import { useResultsSectionData } from '../../useResultsSectionData'
import { stripEncodingNotation } from '../../utils/cleanFactorLabel'
import { goalChanceHeroSays, readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../utils/goalIdentityWithheld'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { DecisionMatrix } from '../sections/DecisionMatrix'
import { CONVERTIBLE, SERVED_STAMP, fx, report, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'
import withheldCapture from './fixtures/served-funding-goal-figures-withheld-dafdc620.json'

const MODEL_ORDER = fx.draft.nodes.filter((node) => node.kind === 'option').map((node) => node.id)
const QUOTED_ORDER = ['current_outreach', 'angel_bridge', CONVERTIBLE]
const PCT = { current_outreach: 20, angel_bridge: 41, [CONVERTIBLE]: 62 }
const HORIZON = 'This model doesn’t yet say whether any option gets there within 9 months.'
const RANGE = {
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: ['angel_bridge'],
  range_by_option: { angel_bridge: {
    low_pct: 0, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5',
    kind: 'link_strength', from: fx.draft.edges[0].from, to: fx.draft.edges[0].to, among: 'all',
  } }, horizon_untested: true, horizon_line: HORIZON,
}

type Data = ReturnType<typeof useResultsSectionData>

/** The same mapped capture and licence/range variants as DecisionMatrix.served.spec.tsx. */
function seedChance({ withheldId, pct = PCT, licence = true, extra = [], driverByOption = {}, horizon = false }: {
  withheldId?: string
  pct?: Record<string, number>
  licence?: boolean
  extra?: Array<Record<string, unknown>>
  driverByOption?: Record<string, unknown>
  horizon?: boolean
} = {}): Data {
  seedPaulRun(SERVED_STAMP)
  const state = useCanvasStore.getState()
  const source = state.results.report as unknown as Record<string, unknown>
  const probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, row]) =>
    [id, { ...row, ...(id in pct && id !== withheldId ? { goal_probability: pct[id] / 100 } : {}) }]))
  const record = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: QUOTED_ORDER,
    pct_by_option: Object.fromEntries(Object.entries(pct).filter(([id]) => id !== withheldId)),
    withheld_option_ids: withheldId ? [withheldId] : [], target: { comparator: 'at_least', value: 1200000, unit: '£' },
    driver_by_option: driverByOption,
    ...(horizon ? { horizon_untested: true, horizon_line: HORIZON } : {}),
  }
  const warnings = ((source.inference_warnings ?? []) as Array<{ code?: string }>).filter((warning) =>
    !GOAL_FIGURES_WITHHELD_CODES.includes(warning.code ?? '') && warning.code !== 'GOAL_CHANCE_LICENSED')
  useCanvasStore.setState({
    results: { ...state.results, report: { ...source, option_probabilities: probabilities, inference_warnings: [...warnings, ...(licence ? [record] : []), ...extra] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

function seedWithheldCapture(): Data {
  useCanvasStore.setState({
    nodes: withheldCapture.nodes.map((node) => ({ id: node.id, type: node.kind, position: { x: 0, y: 0 }, data: { label: node.label, kind: node.kind } })),
    edges: [], results: { status: 'complete', report: mapV5AnalysisToReport(withheldCapture.analysis_result as never, {} as never) },
    hasCompletedFirstRun: true,
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

function seedRange(extra: Array<Record<string, unknown>> = []): Data {
  return seedChance({ withheldId: 'angel_bridge', extra: [RANGE, ...extra] })
}

const link = fx.draft.edges[0]
const strengthDriver = { quantity_id: `${link.from}->${link.to}`, kind: 'link_strength', from: link.from, to: link.to,
  side: 'low', strength: 'weaker', authored_by: 'olumi', user_stated_link: false }

const cases: Array<{ name: string; seed: () => Data; none?: boolean }> = [
  { name: 'served Analysis tab capture', seed: () => { seedPaulRun(SERVED_STAMP); return renderHook(() => useResultsSectionData()).result.current } },
  { name: 'licensed per-option figures', seed: () => seedChance() },
  { name: 'served Run-wide withheld capture', seed: seedWithheldCapture },
  { name: 'goal figures without a licence', seed: () => seedChance({ licence: false }) },
  { name: 'one licence-withheld option', seed: () => seedChance({ withheldId: 'angel_bridge' }) },
  { name: 'main existence driver', seed: () => seedChance({ driverByOption: { angel_bridge: {
    quantity_id: `${link.from}->${link.to}`, kind: 'link_existence', from: link.from, to: link.to,
    side: 'absent', pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false,
  } } }) },
  { name: 'shared strength driver with reversed hook order', seed: () => {
    const data = seedChance({ driverByOption: Object.fromEntries(QUOTED_ORDER.map((id) => [id, strengthDriver])) })
    return { ...data, recommendation: { ...data.recommendation, allOptions: [...data.recommendation.allOptions].reverse() } }
  } },
  { name: 'bounded chance', seed: () => seedChance({ pct: { ...PCT, angel_bridge: 100 } }) },
  { name: 'mixed point and range', seed: () => seedRange() },
  { name: 'range surviving its own withheld sentence', seed: () => seedRange([
    { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', message: 'Not shown.', option_ids: MODEL_ORDER },
  ]) },
  { name: 'Run-wide withhold code barring ranges', seed: () => seedRange([
    { code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', severity: 'warning', message: 'Not shown.' },
  ]) },
  { name: 'licence and range horizon', seed: () => seedChance({ withheldId: 'angel_bridge', extra: [RANGE], horizon: true }) },
  { name: 'licence-only horizon', seed: () => seedChance({ horizon: true }) },
  { name: 'no horizon clause', seed: () => seedChance() },
  { name: 'unresolved range labels', seed: () => {
    const data = seedRange()
    return { ...data, goalChanceDriverNames: { labelOf: () => null, unitOf: () => null } }
  } },
  { name: 'no goal figures or licence', seed: () => seedChance({ licence: false, pct: {} }), none: true },
]

afterEach(() => { cleanup(); resetPaulRun() })

describe('DecisionMatrix chance cells share RunView authority over the served fixtures', () => {
  it.each(cases)('$name: matrix words equal the shared option cell', ({ seed, none }) => {
    const data = seed()
    const rec = data.recommendation
    const labelOf = (id: string) => {
      const option = rec.allOptions.find((candidate) => candidate.id === id)
      return option ? stripEncodingNotation(option.label) : null
    }
    const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
    render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={MODEL_ORDER} run={{ hash: 'run-4276' }} isStale={false} />)
    fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
    // RED on staging: the Run currently has no shared chance-cell resolution.
    expect(data.runView?.chanceCellOf).toBeTypeOf('function')
    let sawNone = false
    for (const option of rec.allOptions) {
      const cell = data.runView!.chanceCellOf(option.id, {
        goalChanceHeroSays: goalChanceHeroSays(rec.goalThreshold, rec.allOptions, data.goalChanceLicence ?? null),
        hasGoalTarget: rec.hasGoalTarget ?? rec.goalThreshold != null,
        goalFiguresWithheldMessage: rec.goalFiguresWithheldMessage,
        goalCertaintyUnearned: option.goalCertaintyUnearned,
        notAnalysed: option.notAnalysed,
        labelOf,
        rangeLabelOf: data.goalChanceDriverNames?.labelOf ?? labelOf,
      })
      const matrixWords = screen.getByTestId(`decision-matrix-chance-${option.id}`).querySelector('span')!.textContent
      expect(matrixWords).toBe(cell.text ?? 'Not shown.')
      if (cell.kind === 'none') {
        sawNone = true
        expect(cell.text).toBeNull()
        expect(matrixWords).toBe('Not shown.')
      }
    }
    if (none) expect(sawNone).toBe(true)
  })

  it.each(['point', 'stated-time range'] as const)('licensed share-by-date %s fixture without a supplied view: the static absence face, never client chance words', (kind) => {
    const target = { comparator: 'at_least', value: 100, unit: '% of the feature launch', by_date: '2027-04-07' }
    const warnings = kind === 'point' ? [{
      code: 'GOAL_CHANCE_LICENSED', form: 'each', option_ids: ['a', 'b'], pct_by_option: { a: 62, b: 41 }, target,
    }] : [{
      code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: ['a'], target,
      range_by_option: { a: { kind: 'stated_time', basis: 'stated_time', quantity: 'months_to_finish',
        low: 0.23, high: 0.9, low_pct: 23, high_pct: 90, from: 'team_part', to: 'goal', among: 'all',
        stated_estimate: { low: 3, high: 6, unit: 'months' } } },
    }]
    const licence = readGoalChanceLicence(warnings)
    const range = readGoalChanceRange(warnings)
    const options = [{ id: 'a', label: 'Team A' }, { id: 'b', label: 'Team B' }]
    const data = { goalChanceRange: range, goalChanceLicence: licence, recommendation: { goalThreshold: 100, allOptions: options } } as unknown as Data
    const comparison = { rows: [] } as unknown as ReturnType<typeof buildAnalysisNewViewModel>['optionsComparison']
    render(<DecisionMatrix data={data} comparison={comparison} optionOrder={['a', 'b']} run={{}} isStale={false} />)
    fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
    const view = runView.runViewOf({ inference_warnings: warnings })
    // RED on staging for each additional fixture: the shared cell authority does not exist yet.
    expect(view.chanceCellOf).toBeTypeOf('function')
    const labelOf = (id: string) => options.find((option) => option.id === id)?.label ?? null
    for (const option of options) {
      const cell = runView.optionChanceCell(view, option.id, {
        goalChanceHeroSays: goalChanceHeroSays(100, options, licence), hasGoalTarget: true, labelOf,
      })
      expect(screen.getByTestId(`decision-matrix-chance-${option.id}`).querySelector('span')!.textContent).toBe(cell.text ?? 'Not shown.')
    }
    const face = screen.getByTestId('decision-matrix-chance-a').querySelector('span')!.textContent
    expect(face).toBe(CHANCE_NOT_SHOWN_YET)
    expect(face).not.toMatch(/\d+%/)
  })
})
