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
  /**
   * Wall-clock ms when the current/most recent run started (the store's
   * `results.startedAt`, stamped by every path that enters a running
   * status). F9: reused run-state banners narrate from THIS clock so a
   * mid-run mount reports the age of the RUN, never the age of the
   * component (the #327 round-2 regression class). Meaningful alongside
   * `isRunning`; undefined when no run has ever started.
   */
  runStartedAt?: number
  /** Technical reason code (debug/telemetry; never user copy). */
  reason?: string
}

const RUNNING_STATUSES = new Set(['preparing', 'connecting', 'streaming'])

/** Reason code carried by the synthesised orphan state — debug only, never user copy. */
export const ORPHANED_RESULT = 'orphaned_result'

/**
 * The F11 fold's ONE precedence rule, shared by the hook and the freshness
 * strip so they cannot diverge (they previously did: the strip synthesised
 * cannot-confirm for orphan-with-no-verdict while the hook said 'none').
 *
 * An orphaned result (results exist with no live run fact) with NO verdict —
 * or with a held 'none' verdict, which claims "no analysis yet" over a
 * visible results body — renders as the cannot-confirm variant WITH the one
 * Rerun action. A held fresh/stale/unknown verdict always wins over the
 * orphan fallback (one banner, verdict precedence).
 */
export function resolveTrustEffectiveState(
  state: AnalysisFreshnessState | null,
  orphaned: boolean,
): { state: AnalysisFreshnessState | null; orphanSynthesised: boolean } {
  if (orphaned && (state === null || state.freshness === 'none')) {
    return {
      state: { freshness: 'unknown', freshnessReason: ORPHANED_RESULT },
      orphanSynthesised: true,
    }
  }
  return { state, orphanSynthesised: false }
}

/** Pure core — selectors and tests use this; the hook is the store binding. */
export function computeAnalysisTrust(input: {
  freshness: AnalysisFreshnessState | null
  dirty: boolean
  source: AnalysisStateSource | null | undefined
  resultsStatus: string | null | undefined
  resultsStartedAt?: number
  /** Interim 2.467 — canvas graph is an unregistered import; see
   *  classifyFreshnessForDisplay's `importHold`. Downgrades 'changed' to
   *  cannot-confirm so the ReanalyseBar cannot assert "Model changed" about a
   *  current analysis. */
  importHold?: boolean
}): AnalysisTrust {
  const { freshness, dirty, source, resultsStatus, resultsStartedAt, importHold } = input
  const orphaned = source === 'orphaned_plot_result'
  // Same effective state the strip renders — the orphan fold happens HERE,
  // not per-consumer, so adopting surfaces inherit the F11 precedence rather
  // than re-implementing (or missing) it.
  const { state: effective } = resolveTrustEffectiveState(freshness, orphaned)
  return {
    semantic: classifyFreshnessForDisplay(effective, dirty, importHold ?? false),
    orphaned,
    isRunning: RUNNING_STATUSES.has(resultsStatus ?? ''),
    runStartedAt: resultsStartedAt,
    reason: effective?.freshnessReason,
  }
}

export function useAnalysisTrust(): AnalysisTrust {
  const freshness = useCanvasStore((s) => s.analysisFreshness)
  const dirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const resultsStatus = useCanvasStore((s) => s.results?.status)
  const resultsStartedAt = useCanvasStore((s) => s.results?.startedAt)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  const { source } = useAnalysisStateSource()
  return computeAnalysisTrust({
    freshness,
    dirty,
    source,
    resultsStatus,
    resultsStartedAt,
    importHold,
  })
}
