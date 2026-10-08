import { chanceCellOf } from './helpers/chanceCellOf'
import { afterEach, describe, expect, it } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { CONVERTIBLE, SERVED_STAMP, fx, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'

const ORDER = ['other', 'leader', 'last', 'next']
const PCT = { other: 20, leader: 62, last: 5, next: 41 }
const LABELS: Record<string, string> = {
  other: 'Explore partnerships', leader: 'Hire', last: 'Wait', next: 'Train',
  capacity: 'Capacity', retention: 'Retention', output: 'Output',
}
const labelOf = (id: string) => LABELS[id] ?? null
const OPTIONS = ORDER.map((id) => makeOption({
  id, label: LABELS[id], goalProbability: PCT[id as keyof typeof PCT] / 100,
  expected: 60, outcome: { mean: 60, p10: 40, p50: 60, p90: 80 },
}))
const STRENGTH = {
  kind: 'link_strength', from: 'capacity', to: 'output', strength: 'weaker', authored_by: 'unattributed', user_stated_link: false,
}
const HORIZON = 'This model doesn’t yet say whether any option gets there within 9 months.'
const RANGE = {
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: ['last'],
  range_by_option: { last: {
    low_pct: 0, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5',
    kind: 'link_strength', from: 'capacity', to: 'output', among: 'all',
  } }, horizon_untested: true, horizon_line: HORIZON,
}

function data(form: string, fields: Record<string, unknown> = {}) {
  const d = makeHeroData({ options: OPTIONS })
  d.goalChanceLicence = readGoalChanceLicence([{
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form,
    option_ids: ORDER, pct_by_option: PCT, target: { comparator: 'at_least', value: 62, unit: 'count' },
    ...((form === 'highest' || form === 'highest_all_likely_to_miss')
      ? { leader_option_id: 'leader', next_option_id: 'next' } : {}),
    ...fields,
  }])
  d.goalChanceDriverNames = { labelOf, unitOf: () => null }
  return d
}

function chart(d: ReturnType<typeof data>): HeroChartModel {
  const m = buildHeroModel(d)
  expect(m.kind).toBe('chart')
  return m as HeroChartModel
}

afterEach(() => resetPaulRun())

describe('PR-S3: goal-chance lines under a leader and the deadline’s one home', () => {
  it('reads the range from the hook’s own report and resolves labels from the same canvas (RED on base)', () => {
    seedPaulRun(SERVED_STAMP)
    const link = fx.draft.edges[0]
    const record = {
      ...RANGE, option_ids: [CONVERTIBLE], range_by_option: {
        [CONVERTIBLE]: { ...RANGE.range_by_option.last, from: link.from, to: link.to },
      },
    }
    const state = useCanvasStore.getState()
    useCanvasStore.setState({ results: {
      ...state.results, report: { ...state.results?.report, inference_warnings: [record] },
    } } as never)
    const live = renderHook(() => useResultsSectionData()).result.current
    expect(live.goalChanceRange).toEqual(readGoalChanceRange([record]))
    const entry = live.goalChanceRange?.rangeByOption[CONVERTIBLE]
    expect(entry).toMatchObject({ from: link.from, to: link.to })
    render(<GoalChanceRangeLines range={live.goalChanceRange ?? null} labelOf={live.goalChanceDriverNames!.labelOf} />)
    expect(screen.getByTestId('goal-chance-range-line').getAttribute('data-option-id')).toBe(CONVERTIBLE)
    expect(screen.getByTestId('goal-chance-range-horizon').textContent).toBe(HORIZON)
  })

  it.each(['highest', 'highest_all_likely_to_miss'])('%s keeps unquoted chances and all drivers in model order without repeating quoted figures (RED on base)', (form) => {
    const m = chart(data(form, { driver_by_option: {
      other: STRENGTH, leader: { ...STRENGTH, from: 'retention' }, next: STRENGTH,
    } }))
    const text = m.subline ?? ''
    expect(text).toContain('‘Explore partnerships’: about 20% chance of meeting your goal, in this model. It rests most on how strongly ‘Capacity’ affects ‘Output’')
    expect(text).toContain('‘Hire’: It rests most on how strongly ‘Retention’ affects ‘Output’')
    expect(text).toContain('‘Train’: It rests most on how strongly ‘Capacity’ affects ‘Output’')
    expect(text).toContain('‘Wait’: about 5% chance of meeting your goal, in this model.')
    expect(text).not.toContain('‘Hire’: about 62%')
    expect(text).not.toContain('‘Train’: about 41%')
    expect(ORDER.map((id) => text.indexOf(`‘${LABELS[id]}’:`))).toEqual(
      [...ORDER.map((id) => text.indexOf(`‘${LABELS[id]}’:`))].sort((a, b) => a - b),
    )
  })

  it('each is unchanged: every chance line with its own driver, in model order', () => {
    const m = chart(data('each', { driver_by_option: { leader: STRENGTH } }))
    expect(m.subline).toBe(
      '‘Explore partnerships’: about 20% chance of meeting your goal, in this model. '
      + '‘Hire’: about 62% chance of meeting your goal, in this model. '
      + 'It rests most on how strongly ‘Capacity’ affects ‘Output’: if that effect is weaker than this model assumes, the chance falls. '
      + '‘Wait’: about 5% chance of meeting your goal, in this model. '
      + '‘Train’: about 41% chance of meeting your goal, in this model.',
    )
  })

  it('highest still carries the other options when the quoted options have no drivers (RED on base)', () => {
    expect(chart(data('highest')).subline).toBe(
      '‘Explore partnerships’: about 20% chance of meeting your goal, in this model. ‘Wait’: about 5% chance of meeting your goal, in this model.',
    )
  })

  it('the licence’s verbatim clause follows the option lines and disclosure, once even with the legacy A7 and range present (RED on base)', () => {
    const d = data('each', {
      user_link_existence: { links: 1, one_in: 5 }, horizon_untested: true, horizon_line: HORIZON,
    })
    d.goalChanceRange = readGoalChanceRange([RANGE])
    d.confidence.inferenceWarnings = [{ code: 'GOAL_HORIZON_NOT_TESTED', severity: 'info', message: HORIZON, affected_nodes: [] }]
    const m = chart(d)
    expect(m.subline?.endsWith(HORIZON)).toBe(true)
    expect(m.subline?.indexOf('These chances also count')).toBeLessThan(m.subline?.indexOf(HORIZON) ?? 0)
    expect(m.goalHorizonUntested).toBeNull()
    render(<>
      <AnalysisHeroPanel model={m} rerunDisabled={false} />
      <GoalChanceRangeLines range={d.goalChanceRange} labelOf={labelOf} heroHorizonShown={m.goalChanceHorizonLine != null} />
    </>)
    expect(screen.getByTestId('hero-subline').textContent).toContain(HORIZON)
    expect(screen.queryByTestId('hero-goal-horizon-untested')).toBeNull()
    expect(screen.queryByTestId('goal-chance-range-horizon')).toBeNull()
    expect(screen.getAllByText((text) => text.includes(HORIZON))).toHaveLength(1)
  })

  it('a range clause has its one home after the ranges when the licence has none (RED on base)', () => {
    const d = data('each')
    d.goalChanceRange = readGoalChanceRange([RANGE])
    d.confidence.inferenceWarnings = [{ code: 'GOAL_HORIZON_NOT_TESTED', severity: 'info', message: HORIZON, affected_nodes: [] }]
    const m = chart(d)
    expect(m.goalChanceHorizonLine).toBeNull()
    expect(m.goalHorizonUntested).toBeNull()
    render(<>
      <AnalysisHeroPanel model={m} rerunDisabled={false} />
      <GoalChanceRangeLines range={d.goalChanceRange} labelOf={labelOf} heroHorizonShown={m.goalChanceHorizonLine != null} />
    </>)
    expect(screen.getByTestId('goal-chance-range-horizon').textContent).toBe(HORIZON)
    expect(screen.getAllByText(HORIZON)).toHaveLength(1)
  })

  it('preserves the old deadline slot when no new record supplies a clause', () => {
    const d = data('each')
    d.confidence.inferenceWarnings = [{ code: 'GOAL_HORIZON_NOT_TESTED', severity: 'info', message: HORIZON, affected_nodes: [] }]
    expect(chart(d).goalHorizonUntested).toBe(HORIZON)
  })

  it('a range option remains withheld from the highest headline (existing licence boundary)', () => {
    const d = data('highest', { pct_by_option: { other: 20, leader: 62, next: 41 }, withheld_option_ids: ['last'] })
    d.goalChanceRange = readGoalChanceRange([RANGE])
    expect(d.goalChanceLicence).toBeNull()
    expect(chart(d).headline).not.toContain('has the highest chance of meeting your goal')
  })
})

describe('Science S3 (DL #87 7 Oct, A1 r3 review): a range is never beside a withhold that bars it, nor a point', () => {
  const PLACEHOLDER_LAST = { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', message: 'Not shown.', option_ids: ['last'] }

  it('RED: a run-wide withhold reaches the hero through the real hook, and the range lines say nothing', () => {
    seedPaulRun(SERVED_STAMP)
    const link = fx.draft.edges[0]
    const record = { ...RANGE, option_ids: [CONVERTIBLE], range_by_option: {
      [CONVERTIBLE]: { ...RANGE.range_by_option.last, from: link.from, to: link.to } } }
    const runWide = { code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', severity: 'warning', message: 'Not shown.' }
    const state = useCanvasStore.getState()
    useCanvasStore.setState({ results: {
      ...state.results, report: { ...state.results?.report, inference_warnings: [record, runWide] },
    } } as never)
    const live = renderHook(() => useResultsSectionData()).result.current
    expect(live.goalChanceRange).toBeNull()
    const { container } = render(<GoalChanceRangeLines range={live.goalChanceRange ?? null} labelOf={live.goalChanceDriverNames!.labelOf} />)
    expect(container.innerHTML).toBe('')
  })

  it.each([
    ['PLoT run-wide, scoped elsewhere', { code: 'GOAL_FIGURES_USER_EFFECT_CLAMPED', option_ids: ['other'] }, null],
    ['options identical on this option', { code: 'GOAL_FIGURES_OPTIONS_IDENTICAL', option_ids: ['last'] }, null],
    ['product not read, unscoped', { code: 'GOAL_FIGURES_PRODUCT_NOT_READ' }, null],
    ['probability unusable, unscoped', { code: 'GOAL_FIGURES_PROBABILITY_UNUSABLE' }, null],
    ['CONTROL options identical on another option', { code: 'GOAL_FIGURES_OPTIONS_IDENTICAL', option_ids: ['other'] }, ['last']],
    ['CONTROL target not testable, unscoped (its own cause)', { code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE' }, ['last']],
  ])('%s', (_name, withhold, kept) => {
    const range = readGoalChanceRange([RANGE, PLACEHOLDER_LAST, { severity: 'warning', message: 'Not shown.', ...withhold }])
    expect(range?.optionIds ?? null).toEqual(kept)
  })

  it('a range option shows no point; its withhold still hides the point without the range', () => {
    const d = data('each', { withheld_option_ids: ['last'], pct_by_option: { other: 20, leader: 62, next: 41 } })
    d.goalChanceRange = readGoalChanceRange([RANGE, PLACEHOLDER_LAST])
    const last = chart(d).rows.find((r) => r.id === 'last')!
    expect(last.goal).toEqual({ value: null, readout: chanceCellOf(d, 'last').text })
    expect(chart(d).rows.find((r) => r.id === 'leader')!.goal.readout).not.toBe('—')
    d.goalChanceRange = null
    // The licence withholds this option: removing its range must not expose the hidden number.
    expect(chart(d).rows.find((r) => r.id === 'last')!.goal.value).toBe(null)
  })
})
