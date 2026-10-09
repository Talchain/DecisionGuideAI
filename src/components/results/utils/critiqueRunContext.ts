import { useCanvasStore } from '@/canvas/store'
import { comparableOptions, type DecisionVerdictReportLike } from '@/lib/decisionVerdict'
import { winSharesWithheld, type ProducerLeaderPermission } from '@/canvas/state/winShareGate'
import type { CritiqueRunContext } from './humaniseCritique'

/** Reuse the option share-slot withhold and the results view-model's population reader. */
export function critiqueRunContext(report: (DecisionVerdictReportLike & {
  producer_leader_permission?: ProducerLeaderPermission | null
}) | null | undefined): CritiqueRunContext {
  return {
    hasRankedOptions: !winSharesWithheld(report?.producer_leader_permission) && comparableOptions(report).length > 0,
  }
}

export function useCritiqueRunContext(): CritiqueRunContext {
  const report = useCanvasStore(state => state.results.report)
  return critiqueRunContext(report)
}
