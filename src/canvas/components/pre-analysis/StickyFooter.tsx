/**
 * StickyFooter - 48px bar pinned to bottom of panel
 *
 * Left: CheckCircle/XCircle icon + "Ready"/"Blocked"
 * Right: CTA button
 *   - #63ADCF background, white text, border-radius: 999px
 *   - States: disabled "Fix {n} issues first" (when hasBlockers) → enabled "Analyse Now" (when ready) → "Analysing..." with spinner (during run)
 *
 * Wired to existing run analysis handler.
 * Note: Evidence quality is shown in Header (complementary, not duplicated).
 */

import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Tooltip } from '../Tooltip'
import type { EvidenceQualityLevel } from './hooks/usePreAnalysisData'

/** Evidence level colour mapping per brief spec */
const EVIDENCE_LEVEL_COLOURS: Record<EvidenceQualityLevel, string> = {
  low: '#EA7B4B',    // Danger
  medium: '#FFA656', // Warning
  high: '#67C89E',   // Success
}

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
  /** Evidence quality level for display */
  evidenceLevel?: EvidenceQualityLevel
}

export function StickyFooter({
  isReady,
  hasBlockers,
  blockerCount,
  isAnalysing,
  onAnalyse,
  evidenceLevel,
}: StickyFooterProps) {
  // Determine button state
  const isDisabled = !isReady || isAnalysing

  let buttonLabel: string
  let buttonStyle: string

  if (isAnalysing) {
    buttonLabel = 'Analysing...'
    buttonStyle = 'bg-info text-white cursor-wait'
  } else if (hasBlockers) {
    buttonLabel = `Fix ${blockerCount} issue${blockerCount !== 1 ? 's' : ''} first`
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else if (!isReady) {
    // isReady=false but hasBlockers=false (e.g., status !== 'ready')
    buttonLabel = 'Not ready'
    buttonStyle = 'bg-factor-light text-text-light cursor-not-allowed opacity-40'
  } else {
    buttonLabel = 'Analyse Now'
    buttonStyle = 'bg-info hover:bg-info-hover text-white'
  }

  // Status icon and text
  const StatusIcon = isReady ? CheckCircle : XCircle
  const statusIconColor = isReady ? 'text-success' : 'text-danger'
  const statusText = isReady ? 'Ready' : 'Blocked'

  return (
    <div
      className="flex-shrink-0 h-12 px-3 flex items-center justify-between bg-panel border-t border-panel-border"
      data-testid="sticky-footer"
    >
      {/* Left: Status + Evidence */}
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={`w-4 h-4 ${statusIconColor}`} aria-hidden="true" />
        <span className="font-medium text-text-body">
          {statusText}
        </span>
        {evidenceLevel && (
          <>
            <span className="text-text-light">·</span>
            <Tooltip content="Based on how many factor values are confirmed vs estimated by AI">
              <span className="text-text-body cursor-help">
                Input confidence:{' '}
                <span style={{ color: EVIDENCE_LEVEL_COLOURS[evidenceLevel] }}>
                  {evidenceLevel.charAt(0).toUpperCase() + evidenceLevel.slice(1)}
                </span>
              </span>
            </Tooltip>
          </>
        )}
      </div>

      {/* Right: CTA Button */}
      <button
        type="button"
        onClick={onAnalyse}
        disabled={isDisabled}
        aria-disabled={isDisabled ? 'true' : 'false'}
        className={`
          px-4 py-2 rounded-full text-[11px] font-medium transition-colors
          flex items-center gap-2
          ${buttonStyle}
        `}
        aria-label={
          isAnalysing
            ? 'Analysis in progress'
            : hasBlockers
              ? 'Fix issues before analysing'
              : !isReady
                ? 'Analysis not ready'
                : 'Run analysis'
        }
        title={isDisabled && !isAnalysing ? 'Complete required actions before analysing' : undefined}
      >
        {isAnalysing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {buttonLabel}
      </button>
    </div>
  )
}

export default StickyFooter
