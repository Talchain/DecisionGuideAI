import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { selectRunOnRecord } from './analysisStateSelector'
import type { CanonicalRunStatus } from './canonicalRunStatus'

/** Run routing must survive a reportless reload, when only the server's completed Run is restored. */
export function selectHasRunOnRecord(state: {
  hasCompletedFirstRun: boolean
  analysisStateV1?: AnalysisStateV1 | null
}, canonicalRun: CanonicalRunStatus = null): boolean {
  // A Run CEE's held canonical view names is a Run on record (canvas audit P0, `canonicalRunStatus.ts`).
  return state.hasCompletedFirstRun || selectRunOnRecord(state.analysisStateV1) || canonicalRun !== null
}
