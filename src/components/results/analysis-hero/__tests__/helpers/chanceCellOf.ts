import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'
import { optionChanceCellFromResults } from '../../../optionChanceCellFromResults'
import { withCanonicalTestCells } from './canonicalTestCells'
import { runViewOf } from '../../../../../canvas/runView/runView'

/** Same fixture, same Results context, RunView's sole chance-cell authority. */
export const chanceCellOf = (data: ResultsSectionDataReturn, id: string) => optionChanceCellFromResults(data, id)

/** Feed the report's licensed cells without replacing the fixture's historical identity/headline gates. */
export function withChanceReport(data: ResultsSectionDataReturn, report: unknown): ResultsSectionDataReturn {
  const view = runViewOf(report)
  return withCanonicalTestCells({ ...data, runView: view })
}
