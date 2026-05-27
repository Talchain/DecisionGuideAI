/**
 * StickyFooter - 48px bar pinned to bottom of panel
 *
 * Left: CheckCircle/XCircle/Loader icon + "Ready"/"Needs attention"/"Checking"
 *       · X/Y reviewed (with source-distribution tooltip)
 * Right: CTA button(s)
 *   - Primary: "Analyse Now" (brand green, pill shape)
 *   - Retry: "Retry Draft" appears when blocked due to incomplete draft
 *   - States: "Checking..." → "Fix N issues" → "Retry Draft" → "Analyse Now" → "Analysing..."
 *
 * Source-distribution tooltip on reviewed count:
 *   0% from brief  → "All values estimated by AI"
 *   <50% from brief → "Most values estimated by AI"
 *   ≥50% from brief → "Most values from your brief"
 *   100% from brief → "All values from your brief"
 */

import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { AnalysisFooter } from '../../shared/AnalysisFooter'
import { useAnalysisDisplayState } from '../../hooks/useAnalysisDisplayState'

interface StickyFooterProps {
  /** Whether analysis can run */
  isReady: boolean
  /** Whether there are blockers */
  hasBlockers: boolean
  /** Number of blocker issues */
  blockerCount: number
  /** Whether analysis is currently running */
  isAnalysing: boolean
  /** Click handler for analyse button */
  onAnalyse: () => void
  /** Human-readable reason when Analyse is blocked */
  blockedReason?: string
  /** Whether CEE data is still loading */
  isLoading?: boolean
  /** Whether retry is in progress */
  isRetrying?: boolean
}

export function StickyFooter({
  isReady,
  hasBlockers,
  blockerCount: _blockerCount,
  isAnalysing,
  onAnalyse,
  blockedReason,
  isLoading = false,
  isRetrying = false,
}: StickyFooterProps) {
  // Brief 5.8A D6: when calibration is incomplete the CTA reads "Analyse
  // anyway" and remains clickable so the user can run with provisional
  // results. Hard blockers (analysing, loading, retrying) still disable.
  // True structural blockers (hasBlockers + blockerCount > 0) keep the
  // button disabled — the wireframe's "anyway" affordance is for soft
  // not-yet-calibrated states, not for hard blockers like missing options.
  const isHardBlocked = isAnalysing || isLoading || isRetrying || (hasBlockers && _blockerCount > 0)
  const isDisabled = isHardBlocked

  let StatusIcon: typeof CheckCircle | typeof XCircle | typeof Loader2 | typeof AlertTriangle
  let statusIconColor: string
  let statusText: string

  // Brief 5.8A D6: pre-analysis status copy aligned to the wireframe.
  // "Ready" / "Not yet calibrated" replace "Needs attention" / "Not ready".
  // Loading + retry states remain to surface progress feedback.
  if (isLoading) {
    StatusIcon = Loader2
    statusIconColor = 'text-text-light animate-spin'
    statusText = 'Checking'
  } else if (isRetrying) {
    StatusIcon = Loader2
    statusIconColor = 'text-primary animate-spin'
    statusText = 'Updating draft'
  } else if (isReady) {
    StatusIcon = CheckCircle
    statusIconColor = 'text-success'
    statusText = 'Ready'
  } else if (hasBlockers) {
    StatusIcon = XCircle
    statusIconColor = 'text-danger'
    statusText = 'Not yet calibrated'
  } else {
    StatusIcon = AlertTriangle
    statusIconColor = 'text-warning'
    statusText = 'Not yet calibrated'
  }

  // Pre-analysis-power-v1 Task 5: the "N/M addressed" counter has been
  // removed from the sticky footer. The top priority-progress counter
  // (T1ContributionRow → "First pass confidence: N of M priority
  // assumptions confirmed.") is now the single source of truth for
  // confirmation progress; rendering it twice with a different denominator
  // was the trust leak the brief targets. We keep a meta line for
  // "Results will be provisional" so the user still sees the provisional
  // warning under the CTA when calibration is incomplete.
  const metaText = (() => {
    if (isRetrying) return undefined
    if (isReady) return undefined
    return <span>Results will be provisional</span>
  })()

  // Brief 5.8A D6: CTA copy aligned to the wireframe — "Analyse now" when
  // ready, "Analyse anyway" when calibration is incomplete (so the user
  // can still run with provisional results). The shared display-state
  // helper still owns the "Rerun analysis" stale-results variant; we only
  // override the label when in the pre-analysis ready/not-ready states.
  const view = useAnalysisDisplayState()
  const baseLabelFromHelper = view.cta?.label ?? 'Run analysis'
  const baseLabel = baseLabelFromHelper === 'Run analysis'
    ? (isReady ? 'Analyse now' : 'Analyse anyway')
    : baseLabelFromHelper
  const ctaLabel = isAnalysing ? 'Running analysis…' : baseLabel
  const actionVariant = view.cta?.kind ?? 'primary'

  // Brief 5.8A D6: aria-label rules.
  //   - Hard-blocked (analysing / loading / retrying) → progress descriptor.
  //   - hasBlockers + count>0 (true structural blockers) → "Address issues…"
  //     so assistive tech announces the gate, not the visible CTA label.
  //   - Soft "not ready" (no hard blockers) → mirror the visible label
  //     ("Analyse anyway") so the announced action matches what the user
  //     sees and can do.
  //   - Ready → mirror the visible label ("Analyse now").
  const actionAriaLabel = isRetrying
    ? 'Draft update in progress'
    : isAnalysing
      ? 'Analysis in progress'
      : isHardBlocked && hasBlockers
        ? `Address issues before analysing${blockedReason ? `: ${blockedReason}` : ''}`
        : baseLabel

  return (
    <AnalysisFooter
      statusIcon={StatusIcon}
      statusIconClassName={statusIconColor}
      statusText={statusText}
      metaText={metaText}
      actionLabel={ctaLabel}
      onAction={onAnalyse}
      actionDisabled={isDisabled}
      actionLoading={isAnalysing || isRetrying}
      actionAriaLabel={actionAriaLabel}
      actionVariant={actionVariant}
      metaPlacement="stacked"
      actionTitle={isDisabled && !isAnalysing && !isLoading && !isRetrying
        ? (blockedReason || 'Address required items before analysing')
        : isReady
          ? 'Run 1,000 Monte Carlo simulations with uncertainty margins to compare your options'
          : 'Run anyway with provisional results — calibration is incomplete'}
    />
  )
}

export default StickyFooter
