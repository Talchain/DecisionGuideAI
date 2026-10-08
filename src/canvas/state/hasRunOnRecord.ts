import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { selectRunOnRecord } from './analysisStateSelector'

/** Run routing must survive a reportless reload, when only the server's completed Run is restored. */
export function selectHasRunOnRecord(state: {
  hasCompletedFirstRun: boolean
  analysisStateV1?: AnalysisStateV1 | null
}): boolean {
  return state.hasCompletedFirstRun || selectRunOnRecord(state.analysisStateV1)
}
