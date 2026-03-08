/**
 * DegradedStateBanner - Display degraded/partial analysis state warnings
 *
 * Shows warnings when:
 * - CEE timed out or degraded (review may be incomplete)
 * - ISL analysis is partial (some computations unavailable)
 *
 * Styling:
 * - Amber background for warnings
 * - Dismissible with X button
 * - Shows available/unavailable analysis types for ISL partial
 */

import { X, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface AnalysisTypeStatus {
  name: string
  available: boolean
}

interface DegradedStateBannerProps {
  /** CEE timed out or degraded */
  ceeDegraded?: boolean
  /** CEE timeout reason if available */
  ceeTimeoutReason?: string
  /** ISL analysis is partial */
  islPartial?: boolean
  /** Status of individual analysis types for ISL partial */
  analysisTypes?: AnalysisTypeStatus[]
  /** Callback when banner is dismissed */
  onDismiss?: () => void
}

export function DegradedStateBanner({
  ceeDegraded,
  ceeTimeoutReason,
  islPartial,
  analysisTypes,
  onDismiss,
}: DegradedStateBannerProps) {
  // Don't render if no degraded states
  if (!ceeDegraded && !islPartial) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-panel border-warning/30"
      data-testid="degraded-state-banner"
    >
      {/* Icon */}
      {ceeDegraded ? (
        <Clock className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning" aria-hidden="true" />
      ) : (
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-warning" aria-hidden="true" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* CEE Degraded Message */}
        {ceeDegraded && (
          <div className="mb-2">
            <p className={`${typography.panelHeader} text-warning`}>
              CEE timed out — review may be incomplete
            </p>
            {ceeTimeoutReason && (
              <p className={`${typography.panelMeta} text-warning mt-1`}>
                {ceeTimeoutReason}
              </p>
            )}
          </div>
        )}

        {/* ISL Partial Message */}
        {islPartial && (
          <div>
            <p className={`${typography.panelHeader} text-warning`}>
              Some analysis features unavailable
            </p>
            {analysisTypes && analysisTypes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {analysisTypes.map((type) => (
                  <span
                    key={type.name}
                    className={`inline-flex items-center gap-1 ${typography.panelMeta} px-2 py-0.5 rounded ${
                      type.available
                        ? 'bg-panel text-success'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {type.available ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {type.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-panel-hover text-warning hover:text-warning transition-colors"
          aria-label="Dismiss warning"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
