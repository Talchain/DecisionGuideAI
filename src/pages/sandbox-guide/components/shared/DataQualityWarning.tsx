/**
 * Data Quality Warning Banner
 *
 * Displays prominent warning when evidence quality is degraded (STALE or AGING).
 * Helps users understand data reliability issues before making decisions.
 */

import type { EvidenceFreshness } from '../../../../types/plot'
import { EvidenceQualityBadge } from './EvidenceQualityBadge'

export interface DataQualityWarningProps {
  evidenceFreshness: EvidenceFreshness
  className?: string
}

export function DataQualityWarning({
  evidenceFreshness,
  className = '',
}: DataQualityWarningProps): JSX.Element | null {
  const { overall_quality, stale_count, aging_count } = evidenceFreshness

  // Only show warning if quality is degraded
  if (overall_quality === 'FRESH' || overall_quality === 'UNKNOWN') {
    return null
  }

  const isStale = overall_quality === 'STALE'
  const totalIssues = stale_count + aging_count

  return (
    <div
      className={`
        p-4 rounded-lg border
        ${isStale ? 'bg-critical-50 border-critical-300' : 'bg-creative-50 border-creative-300'}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isStale ? (
            <span className="text-2xl">⚠️</span>
          ) : (
            <span className="text-2xl">⏱️</span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-charcoal-900">
              {isStale ? 'Stale Data Detected' : 'Data Aging Warning'}
            </span>
            <EvidenceQualityBadge quality={overall_quality} showLabel={false} />
          </div>

          <p className="text-sm text-storm-700">
            {isStale ? (
              <>
                <strong>{stale_count}</strong> evidence source
                {stale_count !== 1 ? 's are' : ' is'} significantly outdated.
                Results may not reflect current conditions.
              </>
            ) : (
              <>
                <strong>{totalIssues}</strong> evidence source
                {totalIssues !== 1 ? 's are' : ' is'} aging.
                Consider updating data for more accurate analysis.
              </>
            )}
          </p>

          {stale_count > 0 && aging_count > 0 && (
            <div className="text-xs text-storm-600">
              {stale_count} stale, {aging_count} aging
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
