/** GR2: real mapper → results hook → mounted hero/matrix, with the reading in every licensed figure sentence. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { DecisionMatrix, type DecisionMatrixProps } from '../../analysisNew/sections/DecisionMatrix'
import { GOAL_IDENTITY_WITHHELD_FALLBACK } from '../../utils/goalIdentityWithheld'
import {
  CONVERTIBLE, CONVERTIBLE_LABEL, SCORED, SERVED_STAMP, fx, resetPaulRun, seedPaulRun,
} from '../../__tests__/helpers/paulRun4276f3f9'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'

const ORDER = ['current_outreach', 'angel_bridge', CONVERTIBLE]
const PCT: Readonly<Record<string, number>> = { current_outreach: 20, angel_bridge: 41, [CONVERTIBLE]: 62 }
const labelOf = (id: string) => SCORED.find((option) => option.id === id)!.label
const READING = {
  v: 1, source: 'olumi_reading', goal: { id: 'funding', label: 'Funding' },
  factors: [{ id: 'backers', label: 'Backers' }, { id: 'ticket', label: 'Amount per backer' }],
  addends: [{ id: 'costs', label: 'Costs', sign: 'less' }],
}
const CLAUSE = ', in this model, if ‘Funding’ = ‘Backers’ × ‘Amount per backer’, less ‘Costs’ (Olumi’s reading).'
const plainLine = (id: string) => `‘${labelOf(id)}’: about ${PCT[id]}% chance of meeting your goal, in this model.`
const labelledLine = (id: string) => `‘${labelOf(id)}’: about ${PCT[id]}% chance of meeting your goal${CLAUSE}`

interface CapturedBlock {
  enrichment: {
    option_comparison: Array<Record<string, unknown>>
    inference_warnings: Array<Record<string, unknown>>
  }
}

/** The funding capture's option identities and distributions stay intact; only the documented licence/goal values change. */
function seed(form: string, fields: Record<string, unknown> = {}, extraWarnings: Array<Record<string, unknown>> = []) {
  seedPaulRun(SERVED_STAMP)
  const source = fx.analysis_block as CapturedBlock
  const record = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form,
    option_ids: ORDER, pct_by_option: PCT, target: { comparator: 'at_least', value: 1200000, unit: '£' },
    ...((form === 'highest' || form === 'highest_all_likely_to_miss')
      ? { leader_option_id: CONVERTIBLE, next_option_id: 'angel_bridge' } : {}),
    ...(form === 'similar' ? { similar_option_ids: ['angel_bridge', CONVERTIBLE] } : {}),
    ...fields,
  }
  const mapped = mapV5AnalysisToReport({
    ...source,
    enrichment: {
      ...source.enrichment,
      option_comparison: source.enrichment.option_comparison.map((option) => ({
        ...option, probability_of_goal: PCT[option.option_id as string] / 100,
      })),
      inference_warnings: [record, ...extraWarnings],
    },
  } as never)
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    results: { ...state.results, report: { ...mapped, producer_leader_permission: SERVED_STAMP } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

function mount(data: ReturnType<typeof useResultsSectionData>) {
  const model = buildHeroModel(data)
  expect(model.kind, 'precondition: the mapped capture builds a chart').toBe('chart')
  const comparison = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false }).optionsComparison
  const props: DecisionMatrixProps = { data, comparison, optionOrder: ORDER, run: { hash: 'run-4276' }, isStale: false }
  render(<>
    <AnalysisHeroPanel model={model as HeroChartModel} rerunDisabled={false} />
    <DecisionMatrix {...props} />
  </>)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  return model as HeroChartModel
}

afterEach(() => { cleanup(); resetPaulRun() })

describe('GR2: labelled licence figures reach the hero and decision matrix', () => {
  it.each(['each', 'highest', 'highest_all_likely_to_miss', 'similar', 'all_likely_to_miss'])(
    '%s: no figure headline and every option carries the reading despite the independent figure withhold', (form) => {
      const data = seed(form, { reading_label: READING })
      expect(data.recommendation.goalFiguresWithheldMessage).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
      for (const option of data.recommendation.allOptions) expect(option.goalProbability).toBeNull()

      const model = mount(data)
      expect(model.goalOptionCoverage?.hasFigures).toBe(true)
      expect(screen.getByTestId('hero-headline')).toHaveTextContent(
        'In this model, on current information, each option’s chance of meeting your goal (at least £1,200,000):',
      )
      expect(model.headline).not.toMatch(/\d+%/)
      expect(screen.getByTestId('hero-subline').textContent).toBe(ORDER.map(labelledLine).join(' '))
      for (const id of ORDER) {
        expect(screen.getByTestId(`decision-matrix-chance-${id}`).textContent).toBe(labelledLine(id))
      }
    },
  )

  it('malformed reading: mapper/hook withhold every point, and neither mounted headline nor matrix shows a goal figure', () => {
    const data = seed('highest', { reading_label: { ...READING, factors: [READING.factors[0]] } })
    expect(data.goalChanceLicence).toBeNull()
    for (const option of data.recommendation.allOptions) expect(option.goalProbability).toBeNull()
    const model = mount(data)
    expect(`${model.headline} ${model.subline ?? ''}`).not.toMatch(/\d+%/)
    for (const id of ORDER) {
      expect(screen.getByTestId(`decision-matrix-chance-${id}`).textContent).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    }
  })

  it('CONTROL: no reading keeps the existing highest headline, omitted quoted lines and matrix sentences exactly', () => {
    const data = seed('highest')
    expect(data.recommendation.goalFiguresWithheldMessage).toBeNull()
    const model = mount(data)
    expect(model.headline).toBe(
      `In this model, on current information, ‘${CONVERTIBLE_LABEL}’ has the highest chance of meeting your goal (at least £1,200,000): `
      + `about 62%, against about 41% for ‘${labelOf('angel_bridge')}’.`,
    )
    expect(screen.getByTestId('hero-subline').textContent).toBe(plainLine('current_outreach'))
    for (const id of ORDER) {
      expect(screen.getByTestId(`decision-matrix-chance-${id}`).textContent).toBe(plainLine(id))
    }
  })

  it('a reading-qualified matrix figure cannot override an unrelated withhold for its option', () => {
    const data = seed('each', { reading_label: READING }, [{
      code: 'GOAL_FIGURES_PRODUCT_NOT_READ', severity: 'warning', message: 'Not shown. The model could not read this goal.',
      option_ids: ['angel_bridge'], withheld_claims: ['goal_probability', 'joint_probability'],
    }])
    mount(data)
    expect(screen.getByTestId('decision-matrix-chance-angel_bridge')).not.toHaveTextContent(/\d+%/)
    for (const id of ['current_outreach', CONVERTIBLE]) {
      expect(screen.getByTestId(`decision-matrix-chance-${id}`).textContent).toBe(labelledLine(id))
    }
  })
})
