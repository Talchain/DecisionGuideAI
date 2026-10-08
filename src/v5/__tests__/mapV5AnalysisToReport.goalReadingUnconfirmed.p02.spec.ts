/**
 * P02 GR2: the served S1 Run's goal probabilities cross the mapper/selector
 * boundary only with the unconfirmed-reading withhold stamp. No producer
 * withhold code is added to these twins; the label itself must fail closed.
 */
import { describe, expect, it } from 'vitest'
import capture from '../blocks/__tests__/fixtures/scout-s1-run1.analysis-block.json'
import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import { selectGoalProbability, type GoalProbabilityInput } from '../../components/results/utils/selectGoalProbability'

const READING_LABEL = {
  v: 1, source: 'olumi_reading',
  goal: { id: 'mrr', label: 'MRR' },
  factors: [
    { id: 'pro_plan_price', label: 'Pro plan price' },
    { id: 'pro_paying_subscribers', label: 'Pro paying subscribers' },
  ],
  addends: [{ id: 'mrr_lost_to_price_driven_churn', label: 'MRR lost to price-driven churn', sign: 'less' }],
}
const SOURCE_OPTIONS = capture.block.enrichment.option_comparison
type ReportWithOptions = ReturnType<typeof mapV5AnalysisToReport> & {
  option_probabilities: Record<string, GoalProbabilityInput>
}

function report(readingLabel?: unknown): ReportWithOptions {
  const wire = structuredClone(capture.block)
  if (arguments.length > 0) {
    const licence = (wire.enrichment.inference_warnings as Record<string, unknown>[])
      .find((warning) => warning.code === 'GOAL_CHANCE_LICENSED')!
    licence.reading_label = readingLabel
  }
  // This fixture's native wire rows become the option_probabilities that every
  // independent figure surface reads; never replace them with hand-made rows.
  expect(wire.enrichment.inference_warnings.some((warning) => warning.code === 'GOAL_FIGURES_READING_UNCONFIRMED')).toBe(false)
  return mapV5AnalysisToReport(wire as unknown as Parameters<typeof mapV5AnalysisToReport>[0]) as ReportWithOptions
}

describe('P02 GR2: an unconfirmed goal reading reaches every mapped option', () => {
  it('reading_label alone stamps all option_probabilities and withholds their selected goal figures', () => {
    const mapped = report(READING_LABEL)
    expect(Object.keys(mapped.option_probabilities).sort()).toEqual(SOURCE_OPTIONS.map((option) => option.option_id).sort())
    for (const source of SOURCE_OPTIONS) {
      const option = mapped.option_probabilities[source.option_id]
      // The numeric producer quantity remains available behind the stamp:
      // this is a display withhold, not a missing-input false positive.
      expect(option.goal_probability).toBe(source.probability_of_goal)
      expect(option.goalIdentityWithheld).toBe(true)
      expect(selectGoalProbability(option).goalProbability).toBeNull()
    }
  })

  it('a malformed reading_label also stamps every option and withholds every selected goal figure', () => {
    const mapped = report({ ...READING_LABEL, factors: [READING_LABEL.factors[0]] })
    for (const source of SOURCE_OPTIONS) {
      const option = mapped.option_probabilities[source.option_id]
      expect(option.goalIdentityWithheld).toBe(true)
      expect(selectGoalProbability(option).goalProbability).toBeNull()
    }
  })

  it('CONTROL: the unchanged served licence retains its quantities and existing certainty guard without a reading stamp', () => {
    const mapped = report()
    expect(SOURCE_OPTIONS.map((option) => option.probability_of_goal)).toEqual([0.331, 0.5055, 0])
    for (const source of SOURCE_OPTIONS) {
      const option = mapped.option_probabilities[source.option_id]
      expect(option.goal_probability).toBe(source.probability_of_goal)
      expect(option.goalIdentityWithheld).toBeUndefined()
      const selected = selectGoalProbability(option)
      if (source.probability_of_goal === 0) {
        expect(option.goalCertaintyUnearned).toBeDefined()
        expect(selected.goalProbability).toBeNull()
        expect(selected.goalCertaintyUnearned).toEqual(option.goalCertaintyUnearned)
      } else {
        expect(option.goalCertaintyUnearned).toBeUndefined()
        expect(selected.goalProbability).toBe(source.probability_of_goal)
      }
    }
  })
})
