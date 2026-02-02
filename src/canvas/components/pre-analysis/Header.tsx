/**
 * Header - Pre-Analysis Panel header section
 *
 * Left: status icon — CheckCircle in success when ready, XCircle in danger when not
 * Status text: "Ready to analyse" / "Not ready"
 * Evidence quality: "Evidence: {level}" — Low in danger, Medium in warning, High in success
 * Right: improvements count as TextBtn, scrolls to All Improvements accordion on click
 */

import { CheckCircle, XCircle } from 'lucide-react'
import { TextBtn } from './primitives'
import type { EvidenceQualityLevel } from './hooks/usePreAnalysisData'

interface HeaderProps {
  /** Whether analysis can run */
  isReady: boolean
  /** Evidence quality level */
  evidenceLevel: EvidenceQualityLevel
  /** Total improvements count */
  totalImprovements: number
  /** Click handler for improvements count */
  onImprovementsClick?: () => void
}

/** Evidence level colour mapping */
const evidenceLevelStyles: Record<EvidenceQualityLevel, string> = {
  low: 'text-danger',
  medium: 'text-warning',
  high: 'text-success',
}

/** Evidence level display labels */
const evidenceLevelLabels: Record<EvidenceQualityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export function Header({
  isReady,
  evidenceLevel,
  totalImprovements,
  onImprovementsClick,
}: HeaderProps) {
  const StatusIcon = isReady ? CheckCircle : XCircle
  const statusIconColor = isReady ? 'text-success' : 'text-danger'
  const statusText = isReady ? 'Ready to analyse' : 'Not ready'

  return (
    <div className="flex items-center justify-between py-2">
      {/* Left: Status + Evidence */}
      <div className="flex items-center gap-3">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <StatusIcon className={`w-4 h-4 ${statusIconColor}`} aria-hidden="true" />
          <span className="text-sm font-medium text-text-body">
            {statusText}
          </span>
        </div>

        {/* Evidence quality */}
        <span className="text-sm text-text-light">
          Evidence:{' '}
          <span className={evidenceLevelStyles[evidenceLevel]}>
            {evidenceLevelLabels[evidenceLevel]}
          </span>
        </span>
      </div>

      {/* Right: Improvements count */}
      {totalImprovements > 0 && (
        <TextBtn onClick={onImprovementsClick}>
          {totalImprovements} improvement{totalImprovements !== 1 ? 's' : ''}
        </TextBtn>
      )}
    </div>
  )
}

export default Header
