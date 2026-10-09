import { withCanonicalTestCells } from '../../analysis-hero/__tests__/helpers/canonicalTestCells'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { runViewOf } from '../../../../canvas/runView/runView'
import { report as servedReport } from './paulRun4276f3f9'

/** Numeric legacy fixtures now supply the same report/licence shape as goalAttainmentCopy. */
export function withGoalChanceReport(data: ResultsSectionDataReturn): ResultsSectionDataReturn {
  const options = data.recommendation.allOptions
  const bearing = options.filter(o => typeof o.goalProbability === 'number' && Number.isFinite(o.goalProbability))
  // A partial UI fixture still needs a valid two-option licence; the control is never displayed.
  const licensed = bearing.length === 1 ? [...bearing, { id: 'synthetic-control', goalProbability: 0 }] : bearing
  const report = {
    ...servedReport,
    option_probabilities: Object.fromEntries(options.map(o => [o.id, { goal_probability: o.goalProbability }])),
    inference_warnings: bearing.length === 0 ? [] : [{
      code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each',
      option_ids: licensed.map(o => o.id),
      // The licence admits whole percentages; keep the original numeric values intact.
      pct_by_option: Object.fromEntries(licensed.map(o => [o.id, Math.round(o.goalProbability! * 100)])),
      target: { comparator: 'at_least', value: data.recommendation.goalThreshold, unit: 'count' },
    }],
  }
  // Preserve fixture headline/identity gates and leader contracts, just as goalAttainmentCopy does.
  return withCanonicalTestCells({ ...data, runView: runViewOf(report) })
}
