/**
 * useAnalysisTrust — THE single answer to "can these results be trusted as
 * current?" (F10+F11 consolidation, UI brief 2026-07-16 item 1).
 *
 * Before this hook, three independent mechanisms answered that question and
 * disagreed on Paul's screen: the CEE-verdict slice (freshness strip), the
 * V5 fact/orphan classifier (orphan banner — stacked BELOW the strip for
 * the same underlying state), and useStaleGuard (dead: its hash keys had
 * zero write sites, so its 12+ consumers could never fire). One CEE 'stale'
 * verdict rendered two banners; a completed run could sit under a retained
 * pre-run "Model changed" claim.
 *
 * This hook composes the surviving two axes plus run state into one value.
 * Every trust-rendering surface reads THIS — never the slices directly.
 */
import { useCanvasStore } from '../store'
import {
  classifyFreshnessForDisplay,
  type AnalysisFreshnessState,
  type FreshnessDisplaySemantic,
} from '../store/analysisFreshness'
import { useAnalysisStateSource, type AnalysisStateSource } from './useAnalysisStateSource'

export interface AnalysisTrust {
  /** current | changed | cannot_confirm | none — the one display semantic. */
  semantic: FreshnessDisplaySemantic
  /** Results exist but no live run fact backs them (recovered session /
   *  hydrated report). Renders as the cannot-confirm variant WITH the Run
   *  action — never as a second stacked banner. */
  orphaned: boolean
  /** An analysis is in flight right now. */
  isRunning: boolean
  /** Technical reason code (debug/telemetry; never user copy). */
  reason?: string
}

const RUNNING_STATUSES = new Set(['preparing', 'connecting', 'streaming'])

/** Pure core — selectors and tests use this; the hook is the store binding. */
export function computeAnalysisTrust(input: {
  freshness: AnalysisFreshnessState | null
  dirty: boolean
  source: AnalysisStateSource | null | undefined
  resultsStatus: string | null | undefined
}): AnalysisTrust {
  const { freshness, dirty, source, resultsStatus } = input
  return {
    semantic: classifyFreshnessForDisplay(freshness, dirty),
    orphaned: source === 'orphaned_plot_result',
    isRunning: RUNNING_STATUSES.has(resultsStatus ?? ''),
    reason: freshness?.freshnessReason,
  }
}

export function useAnalysisTrust(): AnalysisTrust {
  const freshness = useCanvasStore((s) => s.analysisFreshness)
  const dirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const { source } = useAnalysisStateSource()
  return computeAnalysisTrust({ freshness, dirty, source, resultsStatus })
}
