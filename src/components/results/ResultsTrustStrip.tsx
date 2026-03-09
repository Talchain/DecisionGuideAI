/**
 * ResultsTrustStrip — one-line trust/provenance summary at the top of the Results panel.
 *
 * Self-sufficient: renders independently of Model tab mount state.
 * The "View model details" callback is optional.
 *
 * Phase 2A: Results trust strip.
 */

import { memo } from 'react'
import { typography } from '../../styles/typography'
import { trackGuidance } from '../../telemetry/guidanceEvents'

export interface ResultsTrustStripProps {
  nSamples?: number | null
  seedUsed?: number | null
  confidenceLabel?: string | null
  /** Optional callback to navigate to Model tab. Strip renders fully without it. */
  onViewModelDetails?: () => void
}

export const ResultsTrustStrip = memo(function ResultsTrustStrip({
  nSamples,
  seedUsed,
  confidenceLabel,
  onViewModelDetails,
}: ResultsTrustStripProps) {
  const parts: string[] = []

  if (nSamples != null) {
    parts.push(`Based on ${nSamples.toLocaleString()} simulations`)
  }

  if (seedUsed != null) {
    // Truncate to last 6 digits
    const seedStr = String(seedUsed)
    const truncated = seedStr.length > 6 ? seedStr.slice(-6) : seedStr
    parts.push(`Seed: ${truncated}`)
  }

  if (confidenceLabel) {
    parts.push(confidenceLabel)
  }

  if (parts.length === 0) return null

  const handleClick = () => {
    trackGuidance('TRUST_STRIP_CLICKED', {
      item_id: 'trust_strip',
      item_type: 'trust',
      surface: 'results',
    })
    onViewModelDetails?.()
  }

  return (
    <div
      className="flex items-center justify-between gap-2 px-1 py-1"
      aria-label="Analysis trust summary"
      data-testid="results-trust-strip"
    >
      <span className={`${typography.panelMeta} text-text-light`}>
        {parts.join(' | ')}
      </span>
      {onViewModelDetails && (
        <button
          type="button"
          onClick={handleClick}
          className={`${typography.panelMeta} text-info hover:underline shrink-0`}
        >
          View model details
        </button>
      )}
    </div>
  )
})
